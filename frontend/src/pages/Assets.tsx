import { useState, useMemo, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/config';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { portfolios, getPortfolioTransactions } from '@/lib/mockData';
import { assetsApi, catalogsApi, AssetApi, AssetClass } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, Download, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import {
  AssetFormFields,
  AssetFormState,
  defaultAssetFormState,
  formatDecimalValue,
  AssetsTable,
  AssetSortKey,
  SortConfig,
  createColumnDefinitions,
} from './AssetsSection';

const Assets = () => {
  const { toast } = useToast();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [countries, setCountries] = useState<Array<{ iso_code: string; name?: string | null }>>([]);
  const [industries, setIndustries] = useState<Array<{ industry_code: string; name: string; sector?: string | null }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [assets, setAssets] = useState<AssetApi[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [assetSort, setAssetSort] = useState<SortConfig>({ key: 'symbol', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<AssetSortKey[]>([
    'symbol',
    'description',
    'class',
    'type',
    'currency',
    'isin',
    'country',
    'industry',
  ]);
  const pageSize = 100;
  const maxAssets = 3000;
  const apiBaseUrl = getApiBaseUrl();

  const [newAssetDraft, setNewAssetDraft] = useState<AssetFormState>(defaultAssetFormState);
  const [editAssetDraft, setEditAssetDraft] = useState<AssetFormState>(defaultAssetFormState);
  const [assetToDelete, setAssetToDelete] = useState<AssetApi | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetApi | null>(null);
  const [assetActionError, setAssetActionError] = useState<string | null>(null);
  const [assetActionLoading, setAssetActionLoading] = useState(false);

  // Cargar asset classes desde el API
  useEffect(() => {
    const loadAssetClasses = async () => {
      try {
        setIsLoadingClasses(true);
        const classes = await catalogsApi.getAssetClasses();
        setAssetClasses(classes);
        if (classes.length > 0) {
          setNewAssetDraft((prev) => ({ ...prev, class_id: String(classes[0].class_id) }));
        }
      } catch (error) {
        console.error('Error loading asset classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    loadAssetClasses();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalogs = async () => {
      try {
        const [countriesResponse, industriesResponse, currenciesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/catalogs/countries`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/v1/catalogs/industries`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`, { signal: controller.signal }),
        ]);
        if (!countriesResponse.ok || !industriesResponse.ok || !currenciesResponse.ok) {
          throw new Error('Failed to load catalogs');
        }
        const countriesData = (await countriesResponse.json()) as Array<{ iso_code: string; name?: string | null }>;
        const industriesData = (await industriesResponse.json()) as Array<{ industry_code: string; name: string; sector?: string | null }>;
        const currenciesData = (await currenciesResponse.json()) as Array<{ code: string; name: string }>;
        setCountries(Array.isArray(countriesData) ? countriesData : []);
        setIndustries(Array.isArray(industriesData) ? industriesData : []);
        setCurrencies(Array.isArray(currenciesData) ? currenciesData : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setCountries([]);
        setIndustries([]);
        setCurrencies([]);
      }
    };
    loadCatalogs();
    return () => controller.abort();
  }, [apiBaseUrl]);

  const loadAssets = async (signal?: AbortSignal) => {
    try {
      setIsLoadingAssets(true);
      const allAssets: AssetApi[] = [];
      let skip = 0;

      while (skip < maxAssets && !(signal?.aborted)) {
        const data = await assetsApi.getAssets({ skip, limit: pageSize });
        if (signal?.aborted) {
          return;
        }
        allAssets.push(...data);
        if (data.length < pageSize) {
          break;
        }
        skip += pageSize;
      }

      if (!signal?.aborted) {
        setAssets(allAssets.slice(0, maxAssets));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Error loading assets:', error);
      setAssets([]);
    } finally {
      if (!signal?.aborted) {
        setIsLoadingAssets(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadAssets(controller.signal);
    return () => controller.abort();
  }, [pageSize]);

  const classNameById = useMemo(() => new Map(assetClasses.map((cls) => [cls.class_id, cls.name])), [assetClasses]);
  const subClassNameById = useMemo(() => {
    return new Map(assetClasses.flatMap((cls) => cls.sub_classes.map((sub) => [sub.sub_class_id, sub.name])));
  }, [assetClasses]);

  const currencyOptions = useMemo(
    () =>
      currencies.map((currency) => ({
        value: currency.code,
        label: `${currency.code} - ${currency.name}`,
      })),
    [currencies],
  );

  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.iso_code,
        label: `${country.name ?? country.iso_code} (${country.iso_code})`,
      })),
    [countries],
  );

  const industryOptions = useMemo(
    () =>
      industries.map((industry) => ({
        value: industry.industry_code,
        label: industry.name,
        secondary: industry.industry_code,
      })),
    [industries],
  );

  const columnDefinitions = useMemo(
    () => createColumnDefinitions(classNameById, subClassNameById),
    [classNameById, subClassNameById]
  );

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
        case 'figi':
          return asset.figi ?? '';
        case 'cusip':
          return asset.cusip ?? '';
        case 'multiplier':
          return asset.multiplier ?? '';
        case 'contract_size':
          return asset.contract_size ?? '';
        case 'underlying_symbol':
          return asset.underlying_symbol ?? '';
        case 'strike_price':
          return asset.strike_price ?? '';
        case 'expiry_date':
          return asset.expiry_date ?? '';
        case 'put_call':
          return asset.put_call ?? '';
        case 'maturity_date':
          return asset.maturity_date ?? '';
        case 'coupon_rate':
          return asset.coupon_rate ?? '';
        case 'issuer':
          return asset.issuer ?? '';
        case 'initial_fixing_date':
          return asset.initial_fixing_date ?? '';
        case 'next_autocall_date':
          return asset.next_autocall_date ?? '';
        case 'next_coupon_payment_date':
          return asset.next_coupon_payment_date ?? '';
        case 'autocall_trigger':
          return asset.autocall_trigger ?? '';
        case 'coupon_trigger':
          return asset.coupon_trigger ?? '';
        case 'capital_barrier':
          return asset.capital_barrier ?? '';
        case 'protection_level':
          return asset.protection_level ?? '';
        case 'payment_frequency':
          return asset.payment_frequency ?? '';
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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, selectedSubClassId, searchQuery]);

  const totalAssets = filteredAssets.length;
  const totalPages = Math.max(1, Math.ceil(totalAssets / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = totalAssets === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalAssets);

  const pagedAssets = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredAssets.slice(startIndex, startIndex + pageSize);
  }, [filteredAssets, safePage, pageSize]);

  // Obtener subclasses disponibles para la clase seleccionada
  const availableSubclasses = useMemo(() => {
    if (selectedClassId === null) return [];
    const selectedClass = assetClasses.find(c => c.class_id === selectedClassId);
    return selectedClass?.sub_classes || [];
  }, [selectedClassId, assetClasses]);

  const normalizeNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getErrorMessage = (errorData: any, fallback: string) => {
    if (!errorData) {
      return fallback;
    }
    if (typeof errorData.detail === 'string') {
      return errorData.detail;
    }
    if (Array.isArray(errorData.detail) && errorData.detail.length > 0 && errorData.detail[0]?.msg) {
      return errorData.detail[0].msg;
    }
    if (typeof errorData.message === 'string') {
      return errorData.message;
    }
    return fallback;
  };

  const buildAssetPayload = (formState: AssetFormState) => {
    const normalizedPutCall = formState.put_call.trim();
    return {
      symbol: formState.symbol.trim(),
      name: formState.name.trim() || null,
      description: formState.description.trim() || null,
      isin: formState.isin.trim() || null,
      figi: formState.figi.trim() || null,
      cusip: formState.cusip.trim() || null,
      class_id: Number(formState.class_id),
      sub_class_id: formState.sub_class_id ? Number(formState.sub_class_id) : null,
      industry_code: formState.industry_code.trim() ? formState.industry_code.trim().toUpperCase() : null,
      country_code: formState.country_code.trim() ? formState.country_code.trim().toUpperCase() : null,
      currency: formState.currency.trim() ? formState.currency.trim().toUpperCase() : null,
      multiplier: normalizeNumber(formState.multiplier),
      contract_size: normalizeNumber(formState.contract_size),
      underlying_symbol: formState.underlying_symbol.trim() || null,
      strike_price: normalizeNumber(formState.strike_price),
      expiry_date: formState.expiry_date || null,
      put_call: normalizedPutCall && normalizedPutCall !== '-' ? normalizedPutCall : null,
      maturity_date: formState.maturity_date || null,
      coupon_rate: normalizeNumber(formState.coupon_rate),
      issuer: formState.issuer.trim() || null,
      initial_fixing_date: formState.initial_fixing_date || null,
      next_autocall_date: formState.next_autocall_date || null,
      next_coupon_payment_date: formState.next_coupon_payment_date || null,
      autocall_trigger: normalizeNumber(formState.autocall_trigger),
      coupon_trigger: normalizeNumber(formState.coupon_trigger),
      capital_barrier: normalizeNumber(formState.capital_barrier),
      protection_level: normalizeNumber(formState.protection_level),
      payment_frequency: formState.payment_frequency.trim() || null,
    };
  };

  const handleCreateAsset = async () => {
    if (!newAssetDraft.symbol.trim() || !newAssetDraft.class_id) {
      setAssetActionError('Symbol and Asset Class are required.');
      return;
    }
    try {
      setAssetActionLoading(true);
      setAssetActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssetPayload(newAssetDraft)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(getErrorMessage(errorData, `HTTP ${response.status}`));
      }

      await loadAssets();
      setIsNewAssetOpen(false);
      setNewAssetDraft(defaultAssetFormState);
      toast({
        title: 'Asset created',
        description: `Asset "${newAssetDraft.symbol.trim()}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAssetActionError(error.message || 'Could not create the asset.');
    } finally {
      setAssetActionLoading(false);
    }
  };

  const handleEditAsset = (asset: AssetApi) => {
    setEditingAsset(asset);
    setEditAssetDraft({
      symbol: asset.symbol ?? '',
      name: asset.name ?? '',
      description: asset.description ?? '',
      isin: asset.isin ?? '',
      figi: asset.figi ?? '',
      cusip: asset.cusip ?? '',
      class_id: asset.class_id ? String(asset.class_id) : '',
      sub_class_id: asset.sub_class_id ? String(asset.sub_class_id) : '',
      industry_code: asset.industry_code ?? '',
      country_code: asset.country_code ?? '',
      currency: asset.currency ?? '',
      multiplier: formatDecimalValue(asset.multiplier ?? '1.0'),
      contract_size: formatDecimalValue(asset.contract_size ?? '0.0'),
      underlying_symbol: asset.underlying_symbol ?? '',
      strike_price: formatDecimalValue(asset.strike_price ?? '0.0'),
      expiry_date: asset.expiry_date ?? '',
      put_call: asset.put_call ?? '',
      maturity_date: asset.maturity_date ?? '',
      coupon_rate: asset.coupon_rate ?? '0.0',
      issuer: asset.issuer ?? '',
      initial_fixing_date: asset.initial_fixing_date ?? '',
      next_autocall_date: asset.next_autocall_date ?? '',
      next_coupon_payment_date: asset.next_coupon_payment_date ?? '',
      autocall_trigger: asset.autocall_trigger ?? '',
      coupon_trigger: asset.coupon_trigger ?? '',
      capital_barrier: asset.capital_barrier ?? '',
      protection_level: asset.protection_level ?? '',
      payment_frequency: asset.payment_frequency ?? '',
    });
    setAssetActionError(null);
    setIsEditAssetOpen(true);
  };

  const handleUpdateAsset = async (assetId: number) => {
    if (!editAssetDraft.symbol.trim() || !editAssetDraft.class_id) {
      setAssetActionError('Symbol and Asset Class are required.');
      return;
    }
    try {
      setAssetActionLoading(true);
      setAssetActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssetPayload(editAssetDraft)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(getErrorMessage(errorData, `HTTP ${response.status}`));
      }

      await loadAssets();
      setIsEditAssetOpen(false);
    } catch (error: any) {
      setAssetActionError(error.message || 'Could not update the asset.');
    } finally {
      setAssetActionLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    try {
      setAssetActionLoading(true);
      setAssetActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(getErrorMessage(errorData, `HTTP ${response.status}`));
      }

      await loadAssets();
    } catch (error: any) {
      setAssetActionError(error.message || 'Could not delete the asset.');
    } finally {
      setAssetActionLoading(false);
    }
  };


  const toggleSort = (key: AssetSortKey) => {
    setAssetSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const visibleColumnDefs = columnDefinitions.filter((column) => visibleColumns.includes(column.key));

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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-border text-xs md:text-sm h-8 md:h-9">
                  <SlidersHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2">
                  {columnDefinitions.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={visibleColumns.includes(column.key)}
                        onCheckedChange={(checked) => {
                          const isChecked = Boolean(checked);
                          setVisibleColumns((prev) => {
                            if (isChecked) {
                              return [...prev, column.key];
                            }
                            return prev.filter((key) => key !== column.key);
                          });
                        }}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm h-8 md:h-9">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Dialog
              open={isNewAssetOpen}
              onOpenChange={(open) => {
                setIsNewAssetOpen(open);
                setAssetActionError(null);
                if (open) {
                  setNewAssetDraft({
                    ...defaultAssetFormState,
                    class_id: assetClasses[0]?.class_id ? String(assetClasses[0].class_id) : '',
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm h-8 md:h-9">
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  <span className="hidden sm:inline">New Asset</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Asset</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  {assetActionError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-sm text-red-800">
                        {assetActionError}
                      </AlertDescription>
                    </Alert>
                  )}
                  <AssetFormFields
                    formState={newAssetDraft}
                    setFormState={setNewAssetDraft}
                    assetClasses={assetClasses}
                    isLoadingClasses={isLoadingClasses}
                    currencyOptions={currencyOptions}
                    countryOptions={countryOptions}
                    industryOptions={industryOptions}
                    idPrefix="asset"
                  />
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsNewAssetOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground"
                      onClick={handleCreateAsset}
                      disabled={assetActionLoading}
                    >
                      {assetActionLoading ? 'Saving...' : 'Create Asset'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isEditAssetOpen}
              onOpenChange={(open) => {
                setIsEditAssetOpen(open);
                if (!open) {
                  setEditingAsset(null);
                }
                setAssetActionError(null);
              }}
            >
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Asset</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  {assetActionError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-sm text-red-800">
                        {assetActionError}
                      </AlertDescription>
                    </Alert>
                  )}
                  <AssetFormFields
                    formState={editAssetDraft}
                    setFormState={setEditAssetDraft}
                    assetClasses={assetClasses}
                    isLoadingClasses={isLoadingClasses}
                    currencyOptions={currencyOptions}
                    countryOptions={countryOptions}
                    industryOptions={industryOptions}
                    idPrefix="edit-asset"
                  />
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsEditAssetOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground"
                      onClick={() => editingAsset && handleUpdateAsset(editingAsset.asset_id)}
                      disabled={assetActionLoading || !editingAsset}
                    >
                      {assetActionLoading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
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
      <AssetsTable
        assets={pagedAssets}
        visibleColumnDefs={visibleColumnDefs}
        sortConfig={assetSort}
        onSort={toggleSort}
        isLoading={isLoadingAssets}
        totalAssets={totalAssets}
        pageStart={pageStart}
        pageEnd={pageEnd}
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onEdit={handleEditAsset}
        onDeleteRequest={setAssetToDelete}
        assetToDelete={assetToDelete}
        onDeleteConfirm={handleDeleteAsset}
        onDeleteCancel={() => setAssetToDelete(null)}
      />

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
