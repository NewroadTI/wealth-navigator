import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { portfolios, assets, getPortfolioTransactions } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Filter, Download, Package, TrendingUp, Landmark, PieChart, Layers, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const assetClassIcons = {
  'Equity': TrendingUp,
  'Fixed Income': Landmark,
  'Funds': PieChart,
  'Derivatives': Layers,
  'Custom': Sparkles,
};

const assetTypes = {
  'Equity': ['Common Stock', 'Preferred Stock', 'ADR', 'Warrant', 'Rights'],
  'Fixed Income': ['Government Bond', 'Corporate Bond', 'Structured Note', 'Factoring'],
  'Funds': ['ETF', 'Mutual Fund', 'Closed-End Fund', 'Private Equity'],
  'Derivatives': ['Futures', 'Call Option', 'Put Option'],
  'Custom': ['Art', 'Loan', 'Real Estate', 'Other'],
};

const Assets = () => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [newAssetClass, setNewAssetClass] = useState<string>('Equity');
  
  // Get transactions filtered by portfolio and asset class
  const filteredTransactions = selectedPortfolio === 'all'
    ? []
    : getPortfolioTransactions(selectedPortfolio).filter(
        t => selectedAssetClass === 'all' || t.assetClass === selectedAssetClass
      );

  const portfolio = portfolios.find(p => p.id === selectedPortfolio);

  // Get asset class stats for selected portfolio
  const getAssetClassStats = () => {
    if (selectedPortfolio === 'all') return [];
    const txns = getPortfolioTransactions(selectedPortfolio);
    const stats: Record<string, { count: number; value: number }> = {};
    txns.forEach(t => {
      if (t.assetClass) {
        if (!stats[t.assetClass]) stats[t.assetClass] = { count: 0, value: 0 };
        stats[t.assetClass].count++;
        stats[t.assetClass].value += Math.abs(t.amount);
      }
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data }));
  };

  const assetStats = getAssetClassStats();

  return (
    <AppLayout title="Assets" subtitle="Manage and filter assets by portfolio and type">
      {/* Filters Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
            <SelectTrigger className="w-full md:w-64 bg-muted/50 border-border">
              <SelectValue placeholder="Select portfolio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portfolios</SelectItem>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.investor.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedAssetClass} onValueChange={setSelectedAssetClass}>
            <SelectTrigger className="w-full md:w-48 bg-muted/50 border-border">
              <SelectValue placeholder="Asset Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Asset Classes</SelectItem>
              <SelectItem value="Equity">Equity</SelectItem>
              <SelectItem value="Fixed Income">Fixed Income</SelectItem>
              <SelectItem value="Funds">Funds</SelectItem>
              <SelectItem value="Derivatives">Derivatives</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search assets..."
              className="pl-9 bg-muted/50 border-border"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isNewAssetOpen} onOpenChange={setIsNewAssetOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register New Asset</DialogTitle>
              </DialogHeader>
              <Tabs value={newAssetClass} onValueChange={setNewAssetClass} className="mt-4">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="Equity">Equity</TabsTrigger>
                  <TabsTrigger value="Fixed Income">Fixed Income</TabsTrigger>
                  <TabsTrigger value="Funds">Funds</TabsTrigger>
                  <TabsTrigger value="Derivatives">Derivatives</TabsTrigger>
                  <TabsTrigger value="Custom">Custom</TabsTrigger>
                </TabsList>
                
                {Object.entries(assetTypes).map(([classType, types]) => (
                  <TabsContent key={classType} value={classType} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="symbol">Symbol / Ticker</Label>
                        <Input id="symbol" placeholder="AAPL" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="name">Asset Name</Label>
                        <Input id="name" placeholder="Apple Inc." className="mt-1" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="assetType">Asset Type</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {types.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="currency">Currency</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="isin">ISIN</Label>
                        <Input id="isin" placeholder="US0378331005" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="exchange">Exchange</Label>
                        <Input id="exchange" placeholder="NASDAQ" className="mt-1" />
                      </div>
                    </div>

                    {classType === 'Fixed Income' && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="coupon">Coupon (%)</Label>
                          <Input id="coupon" type="number" placeholder="2.5" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="maturity">Maturity Date</Label>
                          <Input id="maturity" type="date" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="rating">Rating</Label>
                          <Input id="rating" placeholder="AAA" className="mt-1" />
                        </div>
                      </div>
                    )}

                    {classType === 'Derivatives' && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="strike">Strike Price</Label>
                          <Input id="strike" type="number" placeholder="200" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="expiry">Expiration Date</Label>
                          <Input id="expiry" type="date" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="underlying">Underlying Asset</Label>
                          <Input id="underlying" placeholder="AAPL" className="mt-1" />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsNewAssetOpen(false)}>Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Create Asset</Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Asset Class Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(assetClassIcons).map(([name, Icon]) => {
          const isSelected = selectedAssetClass === name;
          const stats = assetStats.find(s => s.name === name);
          return (
            <button
              key={name}
              onClick={() => setSelectedAssetClass(isSelected ? 'all' : name)}
              className={`bg-card border rounded-lg p-4 text-left transition-all ${
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>{name}</span>
              </div>
              {stats && (
                <p className="text-xs text-muted-foreground">{stats.count} transactions</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Portfolio Info */}
      {portfolio && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{portfolio.name}</h2>
              <p className="text-sm text-muted-foreground">{portfolio.investor.name} • {portfolio.mainCurrency}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-xl font-semibold mono text-foreground">{formatCurrency(portfolio.totalValue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Assets Catalog */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Asset Catalog</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Class</th>
                <th>Type</th>
                <th>Currency</th>
                <th>Exchange</th>
                <th>ISIN</th>
              </tr>
            </thead>
            <tbody>
              {assets
                .filter(a => selectedAssetClass === 'all' || a.assetClass === selectedAssetClass)
                .map((asset) => (
                  <tr key={asset.id}>
                    <td className="font-medium text-foreground">{asset.symbol}</td>
                    <td className="text-foreground">{asset.name}</td>
                    <td>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">
                        {asset.assetClass}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{asset.assetType}</td>
                    <td className="text-muted-foreground">{asset.currency}</td>
                    <td className="text-muted-foreground">{asset.exchange || '-'}</td>
                    <td className="text-muted-foreground mono text-xs">{asset.isin || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions by Asset */}
      {selectedPortfolio !== 'all' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">
              Transactions {selectedAssetClass !== 'all' && `- ${selectedAssetClass}`}
            </h3>
          </div>
          {filteredTransactions.length > 0 ? (
            <TransactionsTable transactions={filteredTransactions} />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No transactions found for the selected filters
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Assets;