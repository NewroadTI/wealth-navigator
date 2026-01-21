import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { portfolios, getPortfolioTransactions } from '@/lib/mockData';
import { assetsApi, catalogsApi, AssetApi, AssetClass } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Search, Plus, Download, Package, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

type AssetSortKey = 'symbol' | 'description' | 'class' | 'type' | 'currency' | 'isin' | 'country' | 'industry';
type SortConfig = { key: AssetSortKey; direction: 'asc' | 'desc' };

const Assets = () => {
  const location = useLocation();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [newAssetClass, setNewAssetClass] = useState<string>('Equity');
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [assets, setAssets] = useState<AssetApi[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [assetSort, setAssetSort] = useState<SortConfig>({ key: 'symbol', direction: 'asc' });

  // Cargar asset classes desde el API
  useEffect(() => {
    const loadAssetClasses = async () => {
      try {
        setIsLoadingClasses(true);
        const classes = await catalogsApi.getAssetClasses();
        setAssetClasses(classes);
        // Inicializar newAssetClass con el primer asset class
        if (classes.length > 0) {
          setNewAssetClass(classes[0].code);
        }
      } catch (error) {
        console.error('Error loading asset classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    loadAssetClasses();
  }, []);

  // Cargar assets desde el API
  useEffect(() => {
    const controller = new AbortController();
    const loadAssets = async () => {
      try {
        setIsLoadingAssets(true);
        const data = await assetsApi.getAssets({ skip: 0, limit: 3000 });
        if (!controller.signal.aborted) {
          setAssets(data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error loading assets:', error);
        setAssets([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAssets(false);
        }
      }
    };
    loadAssets();
    return () => controller.abort();
  }, []);

  const classNameById = useMemo(() => new Map(assetClasses.map((cls) => [cls.class_id, cls.name])), [assetClasses]);
  const subClassNameById = useMemo(() => {
    return new Map(assetClasses.flatMap((cls) => cls.sub_classes.map((sub) => [sub.sub_class_id, sub.name])));
  }, [assetClasses]);

  const selectedClassId = selectedAssetClass === 'all' ? null : Number(selectedAssetClass);
  const selectedSubClassId = selectedAssetSubclass === 'all' ? null : Number(selectedAssetSubclass);
  const selectedClassName = selectedClassId ? classNameById.get(selectedClassId) : undefined;
  
  // Get transactions filtered by portfolio and asset class
  const filteredTransactions = selectedPortfolio === 'all'
    ? []
    : getPortfolioTransactions(selectedPortfolio).filter(
        t => (selectedAssetClass === 'all' || (selectedClassName ? t.assetClass === selectedClassName : true))
      );

  const portfolio = portfolios.find(p => p.id === selectedPortfolio);

  // Filter assets
  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = assets;

    if (selectedClassId !== null) {
      result = result.filter((asset) => asset.class_id === selectedClassId);
    }
    if (selectedSubClassId !== null) {
      result = result.filter((asset) => asset.sub_class_id === selectedSubClassId);
    }
    if (query) {
      result = result.filter((asset) => {
        const haystack = [
          asset.symbol,
          asset.description,
          asset.isin,
          asset.country_code,
          asset.industry_code,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return haystack.some((value) => value.includes(query));
      });
    }

    const getSortableValue = (asset: AssetApi, key: AssetSortKey) => {
      switch (key) {
        case 'symbol':
          return asset.symbol ?? '';
        case 'description':
          return asset.description ?? '';
        case 'class':
          return classNameById.get(asset.class_id ?? -1) ?? '';
        case 'type':
          return subClassNameById.get(asset.sub_class_id ?? -1) ?? '';
        case 'currency':
          return asset.currency ?? '';
        case 'isin':
          return asset.isin ?? '';
        case 'country':
          return asset.country_code ?? '';
        case 'industry':
          return asset.industry_code ?? '';
        default:
          return '';
      }
    };

    return [...result].sort((a, b) => {
      const aVal = String(getSortableValue(a, assetSort.key)).toLowerCase();
      const bVal = String(getSortableValue(b, assetSort.key)).toLowerCase();
      return assetSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [assets, selectedClassId, selectedSubClassId, searchQuery, assetSort, classNameById, subClassNameById]);

  // Obtener subclasses disponibles para la clase seleccionada
  const availableSubclasses = useMemo(() => {
    if (selectedClassId === null) return [];
    const selectedClass = assetClasses.find(c => c.class_id === selectedClassId);
    return selectedClass?.sub_classes || [];
  }, [selectedClassId, assetClasses]);

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
    if (selectedAssetClass !== 'all' && selectedClassName) parts.push(selectedClassName);
    if (searchQuery) parts.push(`"${searchQuery}"`);
    return parts.join(' - ');
  }, [selectedAssetClass, selectedClassName, searchQuery]);

  const toggleSort = (key: AssetSortKey) => {
    setAssetSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: AssetSortKey }) => (
    <th
      className="text-xs cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => toggleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${assetSort.key === sortKey ? 'opacity-100' : 'opacity-40'}`} />
      </div>
    </th>
  );

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
            
            <Select
              value={selectedAssetClass}
              onValueChange={(v) => {
                setSelectedAssetClass(v);
                setSelectedAssetSubclass('all');
              }}
              disabled={isLoadingClasses}
            >
              <SelectTrigger className="w-full sm:w-36 md:w-44 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                <SelectValue placeholder={isLoadingClasses ? "Loading..." : "Asset Class"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {assetClasses.map((ac) => (
                  <SelectItem key={ac.class_id} value={String(ac.class_id)}>{ac.name}</SelectItem>
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
                  {availableSubclasses.map((subclass) => (
                    <SelectItem key={subclass.sub_class_id} value={String(subclass.sub_class_id)}>
                      {subclass.name}
                    </SelectItem>
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
                  <TabsList className="grid w-full text-xs" style={{ gridTemplateColumns: `repeat(${assetClasses.length}, minmax(0, 1fr))` }}>
                    {assetClasses.map((ac) => (
                      <TabsTrigger key={ac.class_id} value={ac.code}>
                        {ac.name.length > 10 ? ac.name.substring(0, 8) + '.' : ac.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {assetClasses.map((assetClass) => (
                    <TabsContent key={assetClass.class_id} value={assetClass.code} className="space-y-4 mt-4">
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
                              {assetClass.sub_classes.length > 0 ? (
                                assetClass.sub_classes.map(sc => (
                                  <SelectItem key={sc.sub_class_id} value={sc.code}>{sc.name}</SelectItem>
                                ))
                              ) : (
                                <SelectItem value="default">Default</SelectItem>
                              )}
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

                      {assetClass.code === 'FIXED_INCOME' && (
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

                      {assetClass.code === 'DERIVATIVES' && (
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
          <span className="text-xs text-muted-foreground">
            {isLoadingAssets ? 'Loading...' : `${filteredAssets.length} assets`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader label="Symbol" sortKey="symbol" />
                <SortableHeader label="Description" sortKey="description" />
                <SortableHeader label="Class" sortKey="class" />
                <SortableHeader label="Type" sortKey="type" />
                <SortableHeader label="Currency" sortKey="currency" />
                <SortableHeader label="ISIN" sortKey="isin" />
                <SortableHeader label="Country" sortKey="country" />
                <SortableHeader label="Industry" sortKey="industry" />
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.asset_id}>
                  <td className="font-medium text-foreground text-xs md:text-sm">{asset.symbol || '-'}</td>
                  <td className="text-foreground text-xs md:text-sm max-w-[220px] truncate">{asset.description || '-'}</td>
                  <td className="text-muted-foreground text-xs md:text-sm">
                    <span className="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-primary/20 text-primary">
                      {classNameById.get(asset.class_id ?? -1) || '-'}
                    </span>
                  </td>
                  <td className="text-muted-foreground text-xs md:text-sm">
                    {subClassNameById.get(asset.sub_class_id ?? -1) || '-'}
                  </td>
                  <td className="text-muted-foreground text-xs md:text-sm">{asset.currency || '-'}</td>
                  <td className="text-muted-foreground mono text-[10px] md:text-xs">{asset.isin || '-'}</td>
                  <td className="text-muted-foreground text-xs md:text-sm">{asset.country_code || '-'}</td>
                  <td className="text-muted-foreground text-xs md:text-sm">{asset.industry_code || '-'}</td>
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
