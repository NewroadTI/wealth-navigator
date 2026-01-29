import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatCurrency, formatNumber, formatPercent, getChangeColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2, Briefcase, Filter, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

// Get API URL - supports runtime configuration via window object
const getApiUrl = () => {
  if (typeof window !== 'undefined' && (window as any).__VITE_API_BASE_URL__) {
    return `${(window as any).__VITE_API_BASE_URL__}/api/v1`;
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return `${import.meta.env.VITE_API_BASE_URL}/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE_URL = getApiUrl();
const ITEMS_PER_PAGE = 15;

interface AggregatedAsset {
  asset_id: number;
  asset_symbol: string;
  asset_class: string;
  total_quantity: number;
  avg_cost_price: number;
  current_mark_price: number;
  total_market_value: number;
  total_pnl_unrealized: number;
  day_change_pct: number;
  institutions: Array<{
    institution: string;
    account_id: number;
    user_name: string | null;
  }>;
  account_ids: number[];
}

interface TopMover {
  asset_id: number;
  asset_symbol: string;
  asset_name: string | null;
  current_price: number;
  previous_price: number;
  change_pct: number;
  direction: string;
}

interface FilterOptions {
  portfolios: Array<{ id: number; name: string }>;
  asset_classes: Array<{ id: number; code: string; name: string }>;
  asset_subclasses: Array<{ id: number; class_id: number; code: string; name: string }>;
  assets: Array<{ id: number; symbol: string; name: string; class_id: number; subclass_id?: number }>;
  available_dates: string[];
}

const Positions = () => {
  // Filters State
  const [reportDate, setReportDate] = useState<string>('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [selectedAssetInTable, setSelectedAssetInTable] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Data State
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [positions, setPositions] = useState<AggregatedAsset[]>([]);
  const [movers, setMovers] = useState<{ gainers: TopMover[]; losers: TopMover[] }>({ gainers: [], losers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/analytics/filter-options`);
        if (!response.ok) throw new Error('Failed to load filter options');
        const data = await response.json();
        setFilterOptions(data);
        // Set default date to the latest available
        if (data.available_dates && data.available_dates.length > 0) {
          setReportDate(data.available_dates[0]);
        }
      } catch (err) {
        console.error('Error loading filter options:', err);
        setError('Failed to load filter options');
      }
    };
    loadFilterOptions();
  }, []);

  // Load positions when filters change
  useEffect(() => {
    if (!reportDate) return;

    const loadPositions = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      try {
        const params = new URLSearchParams({
          report_date: reportDate,
          ...(selectedPortfolio && { portfolio_id: selectedPortfolio }),
          ...(selectedAssetClass && { asset_class_id: selectedAssetClass }),
          ...(selectedAssetSubclass && { asset_subclass_id: selectedAssetSubclass }),
          ...(selectedAsset && { asset_id: selectedAsset }),
        });

        const response = await fetch(`${API_BASE_URL}/analytics/positions-report?${params}`);
        if (!response.ok) throw new Error('Failed to load positions');
        const data = await response.json();
        setPositions(data);
      } catch (err) {
        console.error('Error loading positions:', err);
        setError('Failed to load positions');
      } finally {
        setLoading(false);
      }
    };

    loadPositions();
  }, [reportDate, selectedPortfolio, selectedAssetClass, selectedAssetSubclass, selectedAsset]);

  // Load top movers when report date changes
  useEffect(() => {
    if (!reportDate) return;

    const loadMovers = async () => {
      try {
        const params = new URLSearchParams({
          report_date: reportDate,
          limit: '5',
        });

        const response = await fetch(`${API_BASE_URL}/analytics/movers?${params}`);
        if (!response.ok) throw new Error('Failed to load movers');
        const data = await response.json();
        setMovers(data);
      } catch (err) {
        console.error('Error loading movers:', err);
      }
    };

    loadMovers();
  }, [reportDate]);

  // Filter assets for the Asset dropdown based on search
  const filteredAssetsForDropdown = useMemo(() => {
    if (!filterOptions?.assets) return [];
    if (!assetSearchQuery) return filterOptions.assets;
    
    const query = assetSearchQuery.toLowerCase();
    return filterOptions.assets.filter(a => 
      a.symbol.toLowerCase().includes(query) || 
      a.name.toLowerCase().includes(query)
    );
  }, [filterOptions?.assets, assetSearchQuery]);

  // Filter positions by table search and selected asset
  const filteredPositions = useMemo(() => {
    let result = [...positions];

    if (tableSearchQuery) {
      const query = tableSearchQuery.toLowerCase();
      result = result.filter(p =>
        p.asset_symbol.toLowerCase().includes(query) ||
        p.institutions.some(inst => {
          const displayName = inst.user_name 
            ? `${inst.institution.toLowerCase()}-${inst.user_name}`
            : inst.institution.toLowerCase();
          return displayName.toLowerCase().includes(query);
        })
      );
    }

    if (selectedAssetInTable) {
      result = result.filter(p => p.asset_id === selectedAssetInTable);
    }

    return result;
  }, [positions, tableSearchQuery, selectedAssetInTable]);

  // Paginate
  const totalPages = Math.ceil(filteredPositions.length / ITEMS_PER_PAGE);
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPositions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPositions, currentPage]);

  const buildFilterString = () => {
    const params = new URLSearchParams();
    if (selectedPortfolio) params.set('portfolio', selectedPortfolio);
    if (selectedAssetClass) params.set('class', selectedAssetClass);
    if (selectedAssetSubclass) params.set('subclass', selectedAssetSubclass);
    if (selectedAsset) params.set('asset', selectedAsset);
    if (reportDate) params.set('date', reportDate);
    return params.toString();
  };

  const clearSingleFilter = (filterType: string) => {
    switch (filterType) {
      case 'portfolio':
        setSelectedPortfolio('');
        break;
      case 'class':
        setSelectedAssetClass('');
        break;
      case 'subclass':
        setSelectedAssetSubclass('');
        break;
      case 'asset':
        setSelectedAsset('');
        setAssetSearchQuery('');
        break;
      case 'search':
        setTableSearchQuery('');
        break;
    }
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedPortfolio('');
    setSelectedAssetClass('');
    setSelectedAssetSubclass('');
    setSelectedAsset('');
    setAssetSearchQuery('');
    setTableSearchQuery('');
    setSelectedAssetInTable(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedPortfolio || selectedAssetClass || selectedAssetSubclass || selectedAsset || tableSearchQuery;

  return (
    <AppLayout title="Positions" subtitle="Real-time positions with advanced filtering">
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter */}
          <div className="relative">
            <Select value={reportDate} onValueChange={setReportDate}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.available_dates.map(date => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Portfolio Filter */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Portfolios" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.portfolios.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPortfolio && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('portfolio')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset Class Filter */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAssetClass} onValueChange={setSelectedAssetClass}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.asset_classes.map(ac => (
                  <SelectItem key={ac.id} value={ac.id.toString()}>
                    {ac.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssetClass && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('class')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset SubClass Filter */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAssetSubclass} onValueChange={setSelectedAssetSubclass}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All SubClasses" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.asset_subclasses.map(asc => (
                  <SelectItem key={asc.id} value={asc.id.toString()}>
                    {asc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssetSubclass && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('subclass')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset Filter with Search */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Assets" />
              </SelectTrigger>
              <SelectContent>
                <Input
                  placeholder="Search assets..."
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  className="m-2 mb-3 h-8"
                  onClick={(e) => e.stopPropagation()}
                />
                {filteredAssetsForDropdown.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.symbol} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAsset && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('asset')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <Button variant="default" size="sm" onClick={clearAllFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear All
            </Button>
          )}

          <div className="flex-1" />

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
              {movers.gainers.length > 0 ? movers.gainers.map((asset) => (
                <div 
                  key={`gainers-${asset.asset_id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedAssetInTable(asset.asset_id === selectedAssetInTable ? null : asset.asset_id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.asset_symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.asset_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gain">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">+{asset.change_pct.toFixed(2)}%</span>
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
              {movers.losers.length > 0 ? movers.losers.map((asset) => (
                <div 
                  key={`losers-${asset.asset_id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedAssetInTable(asset.asset_id === selectedAssetInTable ? null : asset.asset_id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.asset_symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.asset_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-loss">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">{asset.change_pct.toFixed(2)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-2">No losers today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search table (asset, institution)..."
            value={tableSearchQuery}
            onChange={(e) => {
              setTableSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        {tableSearchQuery && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => clearSingleFilter('search')}
            className="h-9"
          >
            <X className="h-4 w-4 mr-1" />
            Clear search
          </Button>
        )}
      </div>

      {/* Aggregated Assets Table */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Positions ({filteredPositions.length} / {positions.length} assets)
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Price</th>
                  <th className="text-right">Market Price</th>
                  <th className="text-right">Market Value</th>
                  <th className="text-right">Unrealized P&L</th>
                  <th className="text-right">Day Chg %</th>
                  <th className="text-right">Institutions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPositions.length > 0 ? paginatedPositions.map((asset) => {
                  const isSelected = selectedAssetInTable === asset.asset_id;
                  const isPositivePL = asset.total_pnl_unrealized >= 0;
                  const isPositiveDay = asset.day_change_pct >= 0;

                  return (
                    <>
                      <tr 
                        key={`row-${asset.asset_id}`}
                        className={cn("group cursor-pointer", isSelected && "bg-muted/50")}
                        onClick={() => setSelectedAssetInTable(isSelected ? null : asset.asset_id)}
                      >
                        <td>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {asset.asset_symbol}
                            </p>
                          </div>
                        </td>
                        <td className="text-right mono">{formatNumber(asset.total_quantity)}</td>
                        <td className="text-right mono">{formatCurrency(asset.avg_cost_price)}</td>
                        <td className="text-right mono">{formatCurrency(asset.current_mark_price)}</td>
                        <td className="text-right mono font-medium">{formatCurrency(asset.total_market_value)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPositivePL ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-gain" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                            )}
                            <p className={cn('text-sm font-medium mono', getChangeColor(asset.total_pnl_unrealized))}>
                              {isPositivePL ? '+' : ''}{formatCurrency(asset.total_pnl_unrealized)}
                            </p>
                          </div>
                        </td>
                        <td className="text-right">
                          <span className={cn('text-sm mono', getChangeColor(asset.day_change_pct))}>
                            {isPositiveDay ? '+' : ''}{formatPercent(asset.day_change_pct)}
                          </span>
                        </td>
                        <td className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {asset.institutions.length}
                          </Badge>
                        </td>
                      </tr>
                      {/* Expanded Account Details */}
                      {isSelected && (
                        <tr key={`expand-${asset.asset_id}`} className="bg-muted/30">
                          <td colSpan={8} className="p-0">
                            <div className="p-4 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                Institutions holding {asset.asset_symbol}
                              </p>
                              <div className="grid gap-2">
                                {asset.institutions.map((inst) => {
                                  const displayName = inst.user_name 
                                    ? `${inst.institution.toLowerCase()}-${inst.user_name}`
                                    : inst.institution.toLowerCase();
                                  
                                  return (
                                    <div 
                                      key={`${inst.institution}-${inst.account_id}`}
                                      className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <p className="text-sm font-medium text-foreground">{displayName}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading positions...' : 'No positions found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredPositions.length} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Positions;
