import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { portfolios, getPortfolioTransactions } from '@/lib/mockData';
import { assetsApi, catalogsApi, AssetApi, AssetClass } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, Download, Package, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal, Pencil, Trash2, ChevronDown, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type AssetSortKey =
  | 'symbol'
  | 'description'
  | 'class'
  | 'type'
  | 'currency'
  | 'isin'
  | 'country'
  | 'industry'
  | 'figi'
  | 'cusip'
  | 'multiplier'
  | 'contract_size'
  | 'underlying_symbol'
  | 'strike_price'
  | 'expiry_date'
  | 'put_call'
  | 'maturity_date'
  | 'coupon_rate'
  | 'issuer'
  | 'initial_fixing_date'
  | 'next_autocall_date'
  | 'next_coupon_payment_date'
  | 'autocall_trigger'
  | 'coupon_trigger'
  | 'capital_barrier'
  | 'protection_level'
  | 'payment_frequency';
type SortConfig = { key: AssetSortKey; direction: 'asc' | 'desc' };

type AssetFormState = {
  symbol: string;
  name: string;
  description: string;
  isin: string;
  figi: string;
  cusip: string;
  class_id: string;
  sub_class_id: string;
  industry_code: string;
  country_code: string;
  currency: string;
  multiplier: string;
  contract_size: string;
  underlying_symbol: string;
  strike_price: string;
  expiry_date: string;
  put_call: string;
  maturity_date: string;
  coupon_rate: string;
  issuer: string;
  initial_fixing_date: string;
  next_autocall_date: string;
  next_coupon_payment_date: string;
  autocall_trigger: string;
  coupon_trigger: string;
  capital_barrier: string;
  protection_level: string;
  payment_frequency: string;
};

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
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  const noneSelectValue = '__none__';
  const defaultAssetFormState: AssetFormState = {
    symbol: '',
    name: '',
    description: '',
    isin: '',
    figi: '',
    cusip: '',
    class_id: '',
    sub_class_id: '',
    industry_code: '',
    country_code: '',
    currency: '',
    multiplier: '1.0',
    contract_size: '0.0',
    underlying_symbol: '',
    strike_price: '0.0',
    expiry_date: '',
    put_call: '',
    maturity_date: '',
    coupon_rate: '0.0',
    issuer: '',
    initial_fixing_date: '',
    next_autocall_date: '',
    next_coupon_payment_date: '',
    autocall_trigger: '',
    coupon_trigger: '',
    capital_barrier: '',
    protection_level: '',
    payment_frequency: '',
  };
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

  const getSubclassesByClassId = (classId: string) => {
    const numericId = Number(classId);
    if (!Number.isFinite(numericId)) {
      return [];
    }
    return assetClasses.find((cls) => cls.class_id === numericId)?.sub_classes ?? [];
  };

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

  const formatDecimalValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return String(value);
    }
    return Number.isInteger(parsed) ? parsed.toFixed(1) : String(parsed);
  };

  const SearchableSelect = ({
    value,
    onChange,
    options,
    placeholder,
    emptyLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; secondary?: string }>;
    placeholder: string;
    emptyLabel?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {emptyLabel && (
                  <CommandItem
                    value={noneSelectValue}
                    onSelect={() => {
                      onChange('');
                      setOpen(false);
                    }}
                  >
                    {emptyLabel}
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.secondary && (
                        <span className="text-xs text-muted-foreground">{option.secondary}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const DateField = ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type="date"
          placeholder="No setup"
          className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border focus:ring-0 focus:border-border focus:outline-none focus-visible:outline-none ${
            value ? '' : 'text-muted-foreground'
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ colorScheme: 'dark' }}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            onClick={() => onChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );

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

  const columnDefinitions: Array<{
    key: AssetSortKey;
    label: string;
    getValue: (asset: AssetApi) => ReactNode;
  }> = [
    { key: 'symbol', label: 'Symbol', getValue: (asset) => asset.symbol || '-' },
    { key: 'description', label: 'Description', getValue: (asset) => asset.description || '-' },
    {
      key: 'class',
      label: 'Class',
      getValue: (asset) => (
        <span className="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-primary/20 text-primary">
          {classNameById.get(asset.class_id ?? -1) || '-'}
        </span>
      ),
    },
    { key: 'type', label: 'Type', getValue: (asset) => subClassNameById.get(asset.sub_class_id ?? -1) || '-' },
    { key: 'currency', label: 'Currency', getValue: (asset) => asset.currency || '-' },
    { key: 'isin', label: 'ISIN', getValue: (asset) => asset.isin || '-' },
    { key: 'country', label: 'Country', getValue: (asset) => asset.country_code || '-' },
    { key: 'industry', label: 'Industry', getValue: (asset) => asset.industry_code || '-' },
    { key: 'figi', label: 'FIGI', getValue: (asset) => asset.figi || '-' },
    { key: 'cusip', label: 'CUSIP', getValue: (asset) => asset.cusip || '-' },
    { key: 'multiplier', label: 'Multiplier', getValue: (asset) => asset.multiplier || '-' },
    { key: 'contract_size', label: 'Contract Size', getValue: (asset) => formatDecimalValue(asset.contract_size) || '-' },
    { key: 'underlying_symbol', label: 'Underlying', getValue: (asset) => asset.underlying_symbol || '-' },
    { key: 'strike_price', label: 'Strike Price', getValue: (asset) => formatDecimalValue(asset.strike_price) || '-' },
    { key: 'expiry_date', label: 'Expiry Date', getValue: (asset) => asset.expiry_date || '-' },
    { key: 'put_call', label: 'Put/Call', getValue: (asset) => asset.put_call || '-' },
    { key: 'maturity_date', label: 'Maturity Date', getValue: (asset) => asset.maturity_date || '-' },
    { key: 'coupon_rate', label: 'Coupon Rate', getValue: (asset) => asset.coupon_rate || '-' },
    { key: 'issuer', label: 'Issuer', getValue: (asset) => asset.issuer || '-' },
    { key: 'initial_fixing_date', label: 'Initial Fixing', getValue: (asset) => asset.initial_fixing_date || '-' },
    { key: 'next_autocall_date', label: 'Next Autocall', getValue: (asset) => asset.next_autocall_date || '-' },
    { key: 'next_coupon_payment_date', label: 'Next Coupon', getValue: (asset) => asset.next_coupon_payment_date || '-' },
    { key: 'autocall_trigger', label: 'Autocall Trigger', getValue: (asset) => asset.autocall_trigger || '-' },
    { key: 'coupon_trigger', label: 'Coupon Trigger', getValue: (asset) => asset.coupon_trigger || '-' },
    { key: 'capital_barrier', label: 'Capital Barrier', getValue: (asset) => asset.capital_barrier || '-' },
    { key: 'protection_level', label: 'Protection Level', getValue: (asset) => asset.protection_level || '-' },
    { key: 'payment_frequency', label: 'Payment Frequency', getValue: (asset) => asset.payment_frequency || '-' },
  ];

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Asset Class *</Label>
                      <Select
                        value={newAssetDraft.class_id}
                        onValueChange={(value) => {
                          setNewAssetDraft((prev) => ({ ...prev, class_id: value, sub_class_id: '' }));
                        }}
                        disabled={isLoadingClasses}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={isLoadingClasses ? 'Loading...' : 'Select class'} />
                        </SelectTrigger>
                        <SelectContent>
                          {assetClasses.map((assetClass) => (
                            <SelectItem key={assetClass.class_id} value={String(assetClass.class_id)}>
                              {assetClass.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Asset Subclass</Label>
                      <Select
                        value={newAssetDraft.sub_class_id || noneSelectValue}
                        onValueChange={(value) =>
                          setNewAssetDraft((prev) => ({
                            ...prev,
                            sub_class_id: value === noneSelectValue ? '' : value,
                          }))
                        }
                        disabled={getSubclassesByClassId(newAssetDraft.class_id).length === 0}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select subclass" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={noneSelectValue}>None</SelectItem>
                          {getSubclassesByClassId(newAssetDraft.class_id).map((subclass) => (
                            <SelectItem key={subclass.sub_class_id} value={String(subclass.sub_class_id)}>
                              {subclass.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="asset-symbol" className="text-sm">Symbol *</Label>
                      <Input
                        id="asset-symbol"
                        placeholder="AAPL"
                        className="mt-1"
                        value={newAssetDraft.symbol}
                        onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="asset-description" className="text-sm">Description</Label>
                      <Input
                        id="asset-description"
                        placeholder="Asset description"
                        className="mt-1"
                        value={newAssetDraft.description}
                        onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Currency</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={newAssetDraft.currency}
                          onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, currency: value }))}
                          options={currencyOptions}
                          placeholder="Select currency"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="asset-isin" className="text-sm">ISIN</Label>
                      <Input
                        id="asset-isin"
                        placeholder="US0378331005"
                        className="mt-1"
                        value={newAssetDraft.isin}
                        onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, isin: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Country</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={newAssetDraft.country_code}
                          onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, country_code: value }))}
                          options={countryOptions}
                          placeholder="Select country"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Industry</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={newAssetDraft.industry_code}
                          onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, industry_code: value }))}
                          options={industryOptions}
                          placeholder="Select industry"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Additional Fields
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="asset-figi" className="text-sm">FIGI</Label>
                          <Input
                            id="asset-figi"
                            className="mt-1"
                            value={newAssetDraft.figi}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, figi: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-cusip" className="text-sm">CUSIP</Label>
                          <Input
                            id="asset-cusip"
                            className="mt-1"
                            value={newAssetDraft.cusip}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, cusip: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-multiplier" className="text-sm">Multiplier</Label>
                          <Input
                            id="asset-multiplier"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.multiplier}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, multiplier: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-contract" className="text-sm">Contract Size</Label>
                          <Input
                            id="asset-contract"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.contract_size}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, contract_size: e.target.value }))}
                            onBlur={() =>
                              setNewAssetDraft((prev) => ({
                                ...prev,
                                contract_size: formatDecimalValue(prev.contract_size),
                              }))
                            }
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-underlying" className="text-sm">Underlying Symbol</Label>
                          <Input
                            id="asset-underlying"
                            className="mt-1"
                            value={newAssetDraft.underlying_symbol}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, underlying_symbol: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-strike" className="text-sm">Strike Price</Label>
                          <Input
                            id="asset-strike"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.strike_price}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, strike_price: e.target.value }))}
                            onBlur={() =>
                              setNewAssetDraft((prev) => ({
                                ...prev,
                                strike_price: formatDecimalValue(prev.strike_price),
                              }))
                            }
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <DateField
                            id="asset-expiry"
                            label="Expiry Date"
                            value={newAssetDraft.expiry_date}
                            onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, expiry_date: value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Put/Call</Label>
                          <Select
                            value={newAssetDraft.put_call || noneSelectValue}
                            onValueChange={(value) =>
                              setNewAssetDraft((prev) => ({
                                ...prev,
                                put_call: value === noneSelectValue ? '' : value,
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={noneSelectValue}>-</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="CALL">CALL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <DateField
                            id="asset-maturity"
                            label="Maturity Date"
                            value={newAssetDraft.maturity_date}
                            onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, maturity_date: value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-coupon" className="text-sm">Coupon Rate</Label>
                          <Input
                            id="asset-coupon"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.coupon_rate}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, coupon_rate: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-issuer" className="text-sm">Issuer</Label>
                          <Input
                            id="asset-issuer"
                            className="mt-1"
                            value={newAssetDraft.issuer}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, issuer: e.target.value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="asset-initial-fixing"
                            label="Initial Fixing Date"
                            value={newAssetDraft.initial_fixing_date}
                            onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, initial_fixing_date: value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="asset-next-autocall"
                            label="Next Autocall Date"
                            value={newAssetDraft.next_autocall_date}
                            onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, next_autocall_date: value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="asset-next-coupon"
                            label="Next Coupon Date"
                            value={newAssetDraft.next_coupon_payment_date}
                            onChange={(value) => setNewAssetDraft((prev) => ({ ...prev, next_coupon_payment_date: value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-autocall" className="text-sm">Autocall Trigger</Label>
                          <Input
                            id="asset-autocall"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.autocall_trigger}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, autocall_trigger: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-coupon-trigger" className="text-sm">Coupon Trigger</Label>
                          <Input
                            id="asset-coupon-trigger"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.coupon_trigger}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, coupon_trigger: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-capital-barrier" className="text-sm">Capital Barrier</Label>
                          <Input
                            id="asset-capital-barrier"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.capital_barrier}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, capital_barrier: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-protection" className="text-sm">Protection Level</Label>
                          <Input
                            id="asset-protection"
                            type="number"
                            className="mt-1"
                            value={newAssetDraft.protection_level}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, protection_level: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="asset-payment" className="text-sm">Payment Frequency</Label>
                          <Input
                            id="asset-payment"
                            className="mt-1"
                            value={newAssetDraft.payment_frequency}
                            onChange={(e) => setNewAssetDraft((prev) => ({ ...prev, payment_frequency: e.target.value }))}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Asset Class *</Label>
                      <Select
                        value={editAssetDraft.class_id}
                        onValueChange={(value) => {
                          setEditAssetDraft((prev) => ({ ...prev, class_id: value, sub_class_id: '' }));
                        }}
                        disabled={isLoadingClasses}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={isLoadingClasses ? 'Loading...' : 'Select class'} />
                        </SelectTrigger>
                        <SelectContent>
                          {assetClasses.map((assetClass) => (
                            <SelectItem key={assetClass.class_id} value={String(assetClass.class_id)}>
                              {assetClass.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Asset Subclass</Label>
                      <Select
                        value={editAssetDraft.sub_class_id || noneSelectValue}
                        onValueChange={(value) =>
                          setEditAssetDraft((prev) => ({
                            ...prev,
                            sub_class_id: value === noneSelectValue ? '' : value,
                          }))
                        }
                        disabled={getSubclassesByClassId(editAssetDraft.class_id).length === 0}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select subclass" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={noneSelectValue}>None</SelectItem>
                          {getSubclassesByClassId(editAssetDraft.class_id).map((subclass) => (
                            <SelectItem key={subclass.sub_class_id} value={String(subclass.sub_class_id)}>
                              {subclass.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-asset-symbol" className="text-sm">Symbol *</Label>
                      <Input
                        id="edit-asset-symbol"
                        className="mt-1"
                        value={editAssetDraft.symbol}
                        onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-asset-description" className="text-sm">Description</Label>
                      <Input
                        id="edit-asset-description"
                        className="mt-1"
                        value={editAssetDraft.description}
                        onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Currency</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={editAssetDraft.currency}
                          onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, currency: value }))}
                          options={currencyOptions}
                          placeholder="Select currency"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-asset-isin" className="text-sm">ISIN</Label>
                      <Input
                        id="edit-asset-isin"
                        className="mt-1"
                        value={editAssetDraft.isin}
                        onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, isin: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Country</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={editAssetDraft.country_code}
                          onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, country_code: value }))}
                          options={countryOptions}
                          placeholder="Select country"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Industry</Label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={editAssetDraft.industry_code}
                          onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, industry_code: value }))}
                          options={industryOptions}
                          placeholder="Select industry"
                          emptyLabel="None"
                        />
                      </div>
                    </div>
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Additional Fields
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-asset-figi" className="text-sm">FIGI</Label>
                          <Input
                            id="edit-asset-figi"
                            className="mt-1"
                            value={editAssetDraft.figi}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, figi: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-cusip" className="text-sm">CUSIP</Label>
                          <Input
                            id="edit-asset-cusip"
                            className="mt-1"
                            value={editAssetDraft.cusip}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, cusip: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-multiplier" className="text-sm">Multiplier</Label>
                          <Input
                            id="edit-asset-multiplier"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.multiplier}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, multiplier: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-contract" className="text-sm">Contract Size</Label>
                          <Input
                            id="edit-asset-contract"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.contract_size}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, contract_size: e.target.value }))}
                            onBlur={() =>
                              setEditAssetDraft((prev) => ({
                                ...prev,
                                contract_size: formatDecimalValue(prev.contract_size),
                              }))
                            }
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-underlying" className="text-sm">Underlying Symbol</Label>
                          <Input
                            id="edit-asset-underlying"
                            className="mt-1"
                            value={editAssetDraft.underlying_symbol}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, underlying_symbol: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-strike" className="text-sm">Strike Price</Label>
                          <Input
                            id="edit-asset-strike"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.strike_price}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, strike_price: e.target.value }))}
                            onBlur={() =>
                              setEditAssetDraft((prev) => ({
                                ...prev,
                                strike_price: formatDecimalValue(prev.strike_price),
                              }))
                            }
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <DateField
                            id="edit-asset-expiry"
                            label="Expiry Date"
                            value={editAssetDraft.expiry_date}
                            onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, expiry_date: value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Put/Call</Label>
                          <Select
                            value={editAssetDraft.put_call || noneSelectValue}
                            onValueChange={(value) =>
                              setEditAssetDraft((prev) => ({
                                ...prev,
                                put_call: value === noneSelectValue ? '' : value,
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={noneSelectValue}>-</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="CALL">CALL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <DateField
                            id="edit-asset-maturity"
                            label="Maturity Date"
                            value={editAssetDraft.maturity_date}
                            onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, maturity_date: value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-coupon" className="text-sm">Coupon Rate</Label>
                          <Input
                            id="edit-asset-coupon"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.coupon_rate}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, coupon_rate: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-issuer" className="text-sm">Issuer</Label>
                          <Input
                            id="edit-asset-issuer"
                            className="mt-1"
                            value={editAssetDraft.issuer}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, issuer: e.target.value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="edit-asset-initial-fixing"
                            label="Initial Fixing Date"
                            value={editAssetDraft.initial_fixing_date}
                            onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, initial_fixing_date: value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="edit-asset-next-autocall"
                            label="Next Autocall Date"
                            value={editAssetDraft.next_autocall_date}
                            onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, next_autocall_date: value }))}
                          />
                        </div>
                        <div>
                          <DateField
                            id="edit-asset-next-coupon"
                            label="Next Coupon Date"
                            value={editAssetDraft.next_coupon_payment_date}
                            onChange={(value) => setEditAssetDraft((prev) => ({ ...prev, next_coupon_payment_date: value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-autocall" className="text-sm">Autocall Trigger</Label>
                          <Input
                            id="edit-asset-autocall"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.autocall_trigger}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, autocall_trigger: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-coupon-trigger" className="text-sm">Coupon Trigger</Label>
                          <Input
                            id="edit-asset-coupon-trigger"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.coupon_trigger}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, coupon_trigger: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-capital-barrier" className="text-sm">Capital Barrier</Label>
                          <Input
                            id="edit-asset-capital-barrier"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.capital_barrier}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, capital_barrier: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-protection" className="text-sm">Protection Level</Label>
                          <Input
                            id="edit-asset-protection"
                            type="number"
                            className="mt-1"
                            value={editAssetDraft.protection_level}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, protection_level: e.target.value }))}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asset-payment" className="text-sm">Payment Frequency</Label>
                          <Input
                            id="edit-asset-payment"
                            className="mt-1"
                            value={editAssetDraft.payment_frequency}
                            onChange={(e) => setEditAssetDraft((prev) => ({ ...prev, payment_frequency: e.target.value }))}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

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
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Asset Catalog</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {isLoadingAssets
                ? 'Loading...'
                : totalAssets === 0
                  ? '0 assets'
                  : `${pageStart}-${pageEnd} of ${totalAssets}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={isLoadingAssets || safePage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={isLoadingAssets || safePage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {visibleColumnDefs.map((column) => (
                  <SortableHeader key={column.key} label={column.label} sortKey={column.key} />
                ))}
                <th className="text-xs md:text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedAssets.map((asset) => (
                <tr key={asset.asset_id}>
                  {visibleColumnDefs.map((column) => (
                    <td
                      key={column.key}
                      className={`text-muted-foreground text-xs md:text-sm ${
                        column.key === 'description' ? 'max-w-[220px] truncate text-foreground' : ''
                      } ${column.key === 'symbol' ? 'font-medium text-foreground' : ''} ${
                        column.key === 'isin' ? 'mono text-[10px] md:text-xs' : ''
                      }`}
                    >
                      {column.getValue(asset)}
                    </td>
                  ))}
                  <td>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8"
                        onClick={() => handleEditAsset(asset)}
                      >
                        <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                        onClick={() => setAssetToDelete(asset)}
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete asset</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete asset "{assetToDelete?.symbol}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (assetToDelete) {
                    handleDeleteAsset(assetToDelete.asset_id);
                  }
                  setAssetToDelete(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
