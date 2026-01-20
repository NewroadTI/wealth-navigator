import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { portfolios, positions, Position } from '@/lib/mockData';
import { formatCurrency, formatNumber, formatPercent, getChangeColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2, Briefcase, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Extended mock data for investor types
const investorTypes = ['Individual', 'Corporate', 'Trust', 'Fund'];

// Add portfolio metadata for filtering
const portfolioMeta = portfolios.map(p => ({
  ...p,
  investorType: p.investor.type === 'Company' ? 'Corporate' : 'Individual',
}));

interface AggregatedAsset {
  symbol: string;
  name: string;
  assetClass: Position['assetClass'];
  sector?: string;
  currency: string;
  totalQuantity: number;
  avgPrice: number;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  unrealizedPLPercent: number;
  dayChangePercent: number;
  accounts: {
    portfolioId: string;
    portfolioName: string;
    accountId: string;
    accountName: string;
    institution: string;
    quantity: number;
    marketValue: number;
  }[];
}

const Positions = () => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPortfolios, setSelectedPortfolios] = useState<string[]>([]);
  const [selectedInvestorType, setSelectedInvestorType] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get filtered portfolios based on investor type
  const filteredPortfolios = useMemo(() => {
    return portfolioMeta.filter(p => {
      if (selectedInvestorType !== 'all' && p.investorType !== selectedInvestorType) return false;
      return true;
    });
  }, [selectedInvestorType]);

  // Get positions based on selected portfolios or all filtered portfolios
  const relevantPositions = useMemo(() => {
    const portfolioIds = selectedPortfolios.length > 0 
      ? selectedPortfolios 
      : filteredPortfolios.map(p => p.id);
    return positions.filter(p => portfolioIds.includes(p.portfolioId));
  }, [selectedPortfolios, filteredPortfolios]);

  // Aggregate positions by asset symbol
  const aggregatedAssets = useMemo(() => {
    const assetMap = new Map<string, AggregatedAsset>();
    
    relevantPositions.forEach(pos => {
      const portfolio = portfolios.find(p => p.id === pos.portfolioId);
      if (!portfolio) return;

      const existing = assetMap.get(pos.symbol);
      const account = portfolio.accounts[0]; // Use first account for simplicity
      
      const accountInfo = {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        accountId: account?.id || '',
        accountName: account?.accountName || '',
        institution: account?.institution || '',
        quantity: pos.quantity,
        marketValue: pos.marketValue,
      };

      if (existing) {
        existing.totalQuantity += pos.quantity;
        existing.totalMarketValue += pos.marketValue;
        existing.totalUnrealizedPL += pos.unrealizedPL;
        existing.accounts.push(accountInfo);
        // Recalculate weighted average price
        existing.avgPrice = existing.totalMarketValue / existing.totalQuantity;
        existing.unrealizedPLPercent = (existing.totalUnrealizedPL / (existing.totalMarketValue - existing.totalUnrealizedPL)) * 100;
        // Use max day change for aggregated view
        existing.dayChangePercent = Math.max(existing.dayChangePercent, pos.dayChangePercent);
      } else {
        assetMap.set(pos.symbol, {
          symbol: pos.symbol,
          name: pos.name,
          assetClass: pos.assetClass,
          sector: pos.sector,
          currency: pos.currency,
          totalQuantity: pos.quantity,
          avgPrice: pos.currentPrice,
          totalMarketValue: pos.marketValue,
          totalUnrealizedPL: pos.unrealizedPL,
          unrealizedPLPercent: pos.unrealizedPLPercent,
          dayChangePercent: pos.dayChangePercent,
          accounts: [accountInfo],
        });
      }
    });

    return Array.from(assetMap.values());
  }, [relevantPositions]);

  // Filter by search query
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return aggregatedAssets;
    const query = searchQuery.toLowerCase();
    return aggregatedAssets.filter(a => 
      a.symbol.toLowerCase().includes(query) || 
      a.name.toLowerCase().includes(query)
    );
  }, [aggregatedAssets, searchQuery]);

  // Top gainers and losers by day change
  const topGainersDay = useMemo(() => {
    return [...filteredAssets]
      .filter(a => a.dayChangePercent > 0)
      .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
      .slice(0, 5);
  }, [filteredAssets]);

  const topLosersDay = useMemo(() => {
    return [...filteredAssets]
      .filter(a => a.dayChangePercent < 0)
      .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
      .slice(0, 5);
  }, [filteredAssets]);

  // Build filter string for save
  const buildFilterString = () => {
    const params = new URLSearchParams();
    if (selectedPortfolios.length > 0) params.set('portfolios', selectedPortfolios.join(','));
    if (selectedInvestorType !== 'all') params.set('investor', selectedInvestorType);
    if (searchQuery) params.set('q', searchQuery);
    return params.toString();
  };

  const clearFilters = () => {
    setSelectedPortfolios([]);
    setSelectedInvestorType('all');
    setSearchQuery('');
    setSelectedAsset(null);
  };

  const hasActiveFilters = selectedPortfolios.length > 0 || selectedInvestorType !== 'all' || searchQuery;

  return (
    <AppLayout title="Positions" subtitle="Aggregated holdings across portfolios">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-border"
            />
          </div>

          {/* Investor Type Filter */}
          <Select value={selectedInvestorType} onValueChange={setSelectedInvestorType}>
            <SelectTrigger className="w-40 bg-muted/50 border-border">
              <SelectValue placeholder="Investor Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Investors</SelectItem>
              {investorTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Portfolio Multi-Select */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-border gap-2">
                <Briefcase className="h-4 w-4" />
                Portfolios {selectedPortfolios.length > 0 && `(${selectedPortfolios.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredPortfolios.map(portfolio => (
                  <label
                    key={portfolio.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedPortfolios.includes(portfolio.id)}
                      onCheckedChange={(checked) => {
                        setSelectedPortfolios(prev =>
                          checked
                            ? [...prev, portfolio.id]
                            : prev.filter(id => id !== portfolio.id)
                        );
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{portfolio.name}</p>
                      <p className="text-xs text-muted-foreground">{portfolio.investor.name}</p>
                    </div>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          <div className="flex-1" />

          {/* Save Filter Button */}
          <SaveFilterButton
            currentPath="/positions"
            currentFilters={buildFilterString()}
            defaultTitle="Positions Filter"
          />
        </div>
      </div>

      {/* Top Movers - Day Only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gain" />
              Top Gainers Today
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topGainersDay.length > 0 ? topGainersDay.map((asset) => (
                <div 
                  key={asset.symbol} 
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedAsset(asset.symbol === selectedAsset ? null : asset.symbol)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gain">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">+{asset.dayChangePercent.toFixed(2)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-2">No gainers today</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-loss" />
              Top Losers Today
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topLosersDay.length > 0 ? topLosersDay.map((asset) => (
                <div 
                  key={asset.symbol} 
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedAsset(asset.symbol === selectedAsset ? null : asset.symbol)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-loss">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">{asset.dayChangePercent.toFixed(2)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-2">No losers today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregated Assets Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Aggregated Positions ({filteredAssets.length} assets)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Class</th>
                  <th className="text-right">Total Qty</th>
                  <th className="text-right">Avg Price</th>
                  <th className="text-right">Market Value</th>
                  <th className="text-right">Unrealized P&L</th>
                  <th className="text-right">Day Chg</th>
                  <th className="text-right">Accounts</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAsset === asset.symbol;
                  const isPositivePL = asset.totalUnrealizedPL >= 0;
                  const isPositiveDay = asset.dayChangePercent >= 0;

                  return (
                    <>
                      <tr 
                        key={asset.symbol} 
                        className={cn("group cursor-pointer", isSelected && "bg-muted/50")}
                        onClick={() => setSelectedAsset(isSelected ? null : asset.symbol)}
                      >
                        <td>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {asset.symbol}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {asset.name}
                            </p>
                          </div>
                        </td>
                        <td>
                          <Badge variant="outline" className="text-xs">
                            {asset.assetClass}
                          </Badge>
                        </td>
                        <td className="text-right mono">{formatNumber(asset.totalQuantity)}</td>
                        <td className="text-right mono">{formatCurrency(asset.avgPrice)}</td>
                        <td className="text-right mono font-medium">{formatCurrency(asset.totalMarketValue)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPositivePL ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-gain" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                            )}
                            <div>
                              <p className={cn('text-sm font-medium mono', getChangeColor(asset.totalUnrealizedPL))}>
                                {isPositivePL ? '+' : ''}{formatCurrency(asset.totalUnrealizedPL)}
                              </p>
                              <p className={cn('text-xs mono', getChangeColor(asset.unrealizedPLPercent))}>
                                {isPositivePL ? '+' : ''}{formatPercent(asset.unrealizedPLPercent)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          <span className={cn('text-sm mono', getChangeColor(asset.dayChangePercent))}>
                            {isPositiveDay ? '+' : ''}{formatPercent(asset.dayChangePercent)}
                          </span>
                        </td>
                        <td className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {asset.accounts.length} {asset.accounts.length === 1 ? 'account' : 'accounts'}
                          </Badge>
                        </td>
                      </tr>
                      {/* Expanded Account Details */}
                      {isSelected && (
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="p-0">
                            <div className="p-4 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                Accounts holding {asset.symbol}
                              </p>
                              <div className="grid gap-2">
                                {asset.accounts.map((acc, idx) => (
                                  <div 
                                    key={`${acc.portfolioId}-${acc.accountId}-${idx}`}
                                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{acc.portfolioName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {acc.institution} • {acc.accountName}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium mono">{formatNumber(acc.quantity)} units</p>
                                      <p className="text-xs text-muted-foreground mono">{formatCurrency(acc.marketValue)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Positions;
