import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PositionsTable } from '@/components/positions/PositionsTable';
import { portfolios, getPortfolioPositions } from '@/lib/mockData';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, TrendingUp, TrendingDown } from 'lucide-react';

const Positions = () => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>(portfolios[0]?.id || '');
  
  const portfolio = portfolios.find(p => p.id === selectedPortfolio);
  const positions = getPortfolioPositions(selectedPortfolio);
  
  const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalUnrealizedPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

  // Top gainers and losers for the selected portfolio
  const sortedByPL = [...positions].sort((a, b) => b.unrealizedPLPercent - a.unrealizedPLPercent);
  const topGainers = sortedByPL.filter(p => p.unrealizedPLPercent > 0).slice(0, 3);
  const topLosers = sortedByPL.filter(p => p.unrealizedPLPercent < 0).slice(-3).reverse();

  return (
    <AppLayout title="Positions" subtitle="Holdings by portfolio">
      {/* Portfolio Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
            <SelectTrigger className="w-full md:w-72 bg-muted/50 border-border">
              <SelectValue placeholder="Select portfolio" />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.investor.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
          <Button variant="outline" size="icon" className="border-border">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" className="border-border">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {portfolio && (
        <>
          {/* Portfolio Info */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{portfolio.name}</h2>
                <p className="text-sm text-muted-foreground">{portfolio.investor.name} • {portfolio.type} • {portfolio.mainCurrency}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-semibold mono text-foreground">{formatCurrency(portfolio.totalValue)}</p>
              </div>
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Market Value</p>
              <p className="text-2xl font-semibold mono text-foreground mt-1">
                {formatCurrency(totalMarketValue)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              <p className={`text-2xl font-semibold mono mt-1 ${totalUnrealizedPL >= 0 ? 'text-gain' : 'text-loss'}`}>
                {totalUnrealizedPL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPL)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Positions</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{positions.length}</p>
            </div>
          </div>

          {/* Top Movers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-gain" />
                <h3 className="text-sm font-medium text-foreground">Top Gainers</h3>
              </div>
              <div className="space-y-2">
                {topGainers.length > 0 ? topGainers.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-foreground">{pos.symbol}</span>
                      <span className="text-muted-foreground ml-2 text-sm">{pos.name}</span>
                    </div>
                    <span className="text-gain font-medium mono">
                      +{pos.unrealizedPLPercent.toFixed(2)}%
                    </span>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-sm">No gainers in this portfolio</p>
                )}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-loss" />
                <h3 className="text-sm font-medium text-foreground">Top Losers</h3>
              </div>
              <div className="space-y-2">
                {topLosers.length > 0 ? topLosers.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between py-1">
                    <div>
                      <span className="font-medium text-foreground">{pos.symbol}</span>
                      <span className="text-muted-foreground ml-2 text-sm">{pos.name}</span>
                    </div>
                    <span className="text-loss font-medium mono">
                      {pos.unrealizedPLPercent.toFixed(2)}%
                    </span>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-sm">No losers in this portfolio</p>
                )}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">All Positions</h3>
            </div>
            <PositionsTable positions={positions} />
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Positions;