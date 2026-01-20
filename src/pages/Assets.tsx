import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { portfolios, assets, getPortfolioTransactions } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Search, Plus, Download, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const assetClasses = ['Equity', 'Fixed Income', 'Funds', 'Derivatives', 'Custom'];
const assetSubclasses: Record<string, string[]> = {
  'Equity': ['Common Stock', 'Preferred Stock', 'ADR', 'Warrant', 'Rights'],
  'Fixed Income': ['Government Bond', 'Corporate Bond', 'Structured Note', 'Factoring'],
  'Funds': ['ETF', 'Mutual Fund', 'Closed-End Fund', 'Private Equity'],
  'Derivatives': ['Futures', 'Call Option', 'Put Option'],
  'Custom': ['Art', 'Loan', 'Real Estate', 'Other'],
};

// Mock current prices
const mockPrices: Record<string, number> = {
  'AAPL': 189.45,
  'MSFT': 378.92,
  'NVDA': 875.34,
  'VTI': 242.18,
  'AGG': 98.23,
  'DE10Y': 97.23,
  'AAPL-C-200': 12.50,
};

const Assets = () => {
  const location = useLocation();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [newAssetClass, setNewAssetClass] = useState<string>('Equity');
  
  // Get transactions filtered by portfolio and asset class
  const filteredTransactions = selectedPortfolio === 'all'
    ? []
    : getPortfolioTransactions(selectedPortfolio).filter(
        t => (selectedAssetClass === 'all' || t.assetClass === selectedAssetClass)
      );

  const portfolio = portfolios.find(p => p.id === selectedPortfolio);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (selectedAssetClass !== 'all' && a.assetClass !== selectedAssetClass) return false;
      if (selectedAssetSubclass !== 'all' && a.assetType !== selectedAssetSubclass) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return a.symbol.toLowerCase().includes(query) || 
               a.name.toLowerCase().includes(query) ||
               (a.isin && a.isin.toLowerCase().includes(query));
      }
      return true;
    });
  }, [selectedAssetClass, selectedAssetSubclass, searchQuery]);

  const availableSubclasses = selectedAssetClass !== 'all' ? assetSubclasses[selectedAssetClass] || [] : [];

  // Build current filter string for saving
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPortfolio !== 'all') params.set('portfolio', selectedPortfolio);
    if (selectedAssetClass !== 'all') params.set('class', selectedAssetClass);
    if (selectedAssetSubclass !== 'all') params.set('subclass', selectedAssetSubclass);
    if (searchQuery) params.set('q', searchQuery);
    return params.toString();
  }, [selectedPortfolio, selectedAssetClass, selectedAssetSubclass, searchQuery]);

  const filterTitle = useMemo(() => {
    const parts = ['Assets'];
    if (selectedAssetClass !== 'all') parts.push(selectedAssetClass);
    if (searchQuery) parts.push(`"${searchQuery}"`);
    return parts.join(' - ');
  }, [selectedAssetClass, searchQuery]);

  return (
    <AppLayout title="Assets" subtitle="Manage and filter assets by portfolio and type">
      {/* Filters Row */}
      <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto">
            <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-full sm:w-48 md:w-64 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
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
            
            <Select value={selectedAssetClass} onValueChange={(v) => { setSelectedAssetClass(v); setSelectedAssetSubclass('all'); }}>
              <SelectTrigger className="w-full sm:w-36 md:w-44 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                <SelectValue placeholder="Asset Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {assetClasses.map((ac) => (
                  <SelectItem key={ac} value={ac}>{ac}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableSubclasses.length > 0 && (
              <Select value={selectedAssetSubclass} onValueChange={setSelectedAssetSubclass}>
                <SelectTrigger className="w-full sm:w-36 md:w-44 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                  <SelectValue placeholder="Subclass" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subclasses</SelectItem>
                  {availableSubclasses.map((asc) => (
                    <SelectItem key={asc} value={asc}>{asc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-[150px] sm:w-40 md:w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <SaveFilterButton
              currentPath={location.pathname}
              currentFilters={currentFilters}
              defaultTitle={filterTitle}
            />
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm h-8 md:h-9">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Dialog open={isNewAssetOpen} onOpenChange={setIsNewAssetOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm h-8 md:h-9">
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  <span className="hidden sm:inline">New Asset</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Asset</DialogTitle>
                </DialogHeader>
                <Tabs value={newAssetClass} onValueChange={setNewAssetClass} className="mt-4">
                  <TabsList className="grid grid-cols-5 w-full text-xs">
                    <TabsTrigger value="Equity">Equity</TabsTrigger>
                    <TabsTrigger value="Fixed Income">Fixed Inc.</TabsTrigger>
                    <TabsTrigger value="Funds">Funds</TabsTrigger>
                    <TabsTrigger value="Derivatives">Deriv.</TabsTrigger>
                    <TabsTrigger value="Custom">Custom</TabsTrigger>
                  </TabsList>
                  
                  {Object.entries(assetSubclasses).map(([classType, types]) => (
                    <TabsContent key={classType} value={classType} className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="symbol" className="text-sm">Symbol / Ticker</Label>
                          <Input id="symbol" placeholder="AAPL" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="name" className="text-sm">Asset Name</Label>
                          <Input id="name" placeholder="Apple Inc." className="mt-1" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="assetType" className="text-sm">Asset Type</Label>
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
                          <Label htmlFor="currency" className="text-sm">Currency</Label>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="isin" className="text-sm">ISIN</Label>
                          <Input id="isin" placeholder="US0378331005" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="exchange" className="text-sm">Exchange</Label>
                          <Input id="exchange" placeholder="NASDAQ" className="mt-1" />
                        </div>
                      </div>

                      {classType === 'Fixed Income' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="coupon" className="text-sm">Coupon (%)</Label>
                            <Input id="coupon" type="number" placeholder="2.5" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="maturity" className="text-sm">Maturity Date</Label>
                            <Input id="maturity" type="date" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="rating" className="text-sm">Rating</Label>
                            <Input id="rating" placeholder="AAA" className="mt-1" />
                          </div>
                        </div>
                      )}

                      {classType === 'Derivatives' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="strike" className="text-sm">Strike Price</Label>
                            <Input id="strike" type="number" placeholder="200" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="expiry" className="text-sm">Expiration Date</Label>
                            <Input id="expiry" type="date" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="underlying" className="text-sm">Underlying Asset</Label>
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
      </div>

      {/* Portfolio Info */}
      {portfolio && (
        <div className="bg-card border border-border rounded-lg p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base md:text-lg font-semibold text-foreground">{portfolio.name}</h2>
              <p className="text-xs md:text-sm text-muted-foreground">{portfolio.investor.name} • {portfolio.mainCurrency}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs md:text-sm text-muted-foreground">Total Value</p>
              <p className="text-lg md:text-xl font-semibold mono text-foreground">{formatCurrency(portfolio.totalValue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Assets Catalog */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Asset Catalog</h3>
          </div>
          <span className="text-xs text-muted-foreground">{filteredAssets.length} assets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-xs">Symbol</th>
                <th className="text-xs">Name</th>
                <th className="text-xs hidden sm:table-cell">Class</th>
                <th className="text-xs hidden md:table-cell">Type</th>
                <th className="text-xs">Price</th>
                <th className="text-xs hidden lg:table-cell">Currency</th>
                <th className="text-xs hidden xl:table-cell">Exchange</th>
                <th className="text-xs hidden xl:table-cell">ISIN</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td className="font-medium text-foreground text-xs md:text-sm">{asset.symbol}</td>
                  <td className="text-foreground text-xs md:text-sm max-w-[150px] truncate">{asset.name}</td>
                  <td className="hidden sm:table-cell">
                    <span className="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-primary/20 text-primary">
                      {asset.assetClass}
                    </span>
                  </td>
                  <td className="text-muted-foreground text-xs hidden md:table-cell">{asset.assetType}</td>
                  <td className="font-medium mono text-foreground text-xs md:text-sm">
                    {mockPrices[asset.symbol] ? formatCurrency(mockPrices[asset.symbol]) : '-'}
                  </td>
                  <td className="text-muted-foreground text-xs hidden lg:table-cell">{asset.currency}</td>
                  <td className="text-muted-foreground text-xs hidden xl:table-cell">{asset.exchange || '-'}</td>
                  <td className="text-muted-foreground mono text-[10px] hidden xl:table-cell">{asset.isin || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions by Asset */}
      {selectedPortfolio !== 'all' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-3 md:p-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm md:text-base">
              Transactions {selectedAssetClass !== 'all' && `- ${selectedAssetClass}`}
            </h3>
          </div>
          {filteredTransactions.length > 0 ? (
            <TransactionsTable transactions={filteredTransactions} />
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No transactions found for the selected filters
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Assets;
