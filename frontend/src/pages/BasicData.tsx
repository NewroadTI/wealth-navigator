import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { API_BASE_URL } from '@/lib/config';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Globe, Factory, BarChart3, Coins, Search, Layers, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ExchangesSection,
  CountriesSection,
  IndustriesSection,
  IndicesSection,
  CurrenciesSection,
  AssetClassesSection,
  InvestmentStrategiesSection,
  fetchAllPages,
  toggleSort,
  SortableHeader,
} from './BasicDataSections';
import type {
  ExchangeApi,
  CountryApi,
  IndustryApi,
  IndexApi,
  CurrencyApi,
  AssetClassApi,
  AssetSubClassApi,
  InvestmentStrategyApi,
  SortConfig,
} from './BasicDataSections';

// Re-export types for backwards compatibility
export type { ExchangeApi, CountryApi, IndustryApi, IndexApi, CurrencyApi, AssetClassApi, AssetSubClassApi, SortConfig };

const BasicData = () => {
  const [activeTab, setActiveTab] = useState('exchanges');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  // Sorting state for each table
  const [exchangeSort, setExchangeSort] = useState<SortConfig>({ key: 'exchange_code', direction: 'asc' });
  const [countrySort, setCountrySort] = useState<SortConfig>({ key: 'iso_code', direction: 'asc' });
  const [industrySort, setIndustrySort] = useState<SortConfig>({ key: 'industry_code', direction: 'asc' });
  const [indexSort, setIndexSort] = useState<SortConfig>({ key: 'index_code', direction: 'asc' });
  const [currencySort, setCurrencySort] = useState<SortConfig>({ key: 'code', direction: 'asc' });

  const [exchanges, setExchanges] = useState<ExchangeApi[]>([]);
  const [exchangesLoading, setExchangesLoading] = useState(false);
  const [exchangesError, setExchangesError] = useState<string | null>(null);
  const [isCreateExchangeOpen, setIsCreateExchangeOpen] = useState(false);
  const [isEditExchangeOpen, setIsEditExchangeOpen] = useState(false);
  const [exchangeDraft, setExchangeDraft] = useState({ exchange_code: '', name: '', country_code: '' });
  const [editingExchange, setEditingExchange] = useState<ExchangeApi | null>(null);
  const [exchangeActionLoading, setExchangeActionLoading] = useState(false);
  const [exchangeActionError, setExchangeActionError] = useState<string | null>(null);
  const [exchangeToDelete, setExchangeToDelete] = useState<ExchangeApi | null>(null);
  const [exchangeCountryOpen, setExchangeCountryOpen] = useState(false);
  const [exchangeEditCountryOpen, setExchangeEditCountryOpen] = useState(false);

  const [countries, setCountries] = useState<CountryApi[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false);
  const [isEditCountryOpen, setIsEditCountryOpen] = useState(false);
  const [countryDraft, setCountryDraft] = useState({ iso_code: '', name: '' });
  const [editingCountry, setEditingCountry] = useState<CountryApi | null>(null);
  const [countryActionLoading, setCountryActionLoading] = useState(false);
  const [countryActionError, setCountryActionError] = useState<string | null>(null);
  const [countryToDelete, setCountryToDelete] = useState<CountryApi | null>(null);

  const [industries, setIndustries] = useState<IndustryApi[]>([]);
  const [industriesLoading, setIndustriesLoading] = useState(false);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [isCreateIndustryOpen, setIsCreateIndustryOpen] = useState(false);
  const [isEditIndustryOpen, setIsEditIndustryOpen] = useState(false);
  const [industryDraft, setIndustryDraft] = useState({ industry_code: '', name: '', sector: '' });
  const [editingIndustry, setEditingIndustry] = useState<IndustryApi | null>(null);
  const [industryActionLoading, setIndustryActionLoading] = useState(false);
  const [industryActionError, setIndustryActionError] = useState<string | null>(null);
  const [industryToDelete, setIndustryToDelete] = useState<IndustryApi | null>(null);

  const [indices, setIndices] = useState<IndexApi[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const [indexToDelete, setIndexToDelete] = useState<IndexApi | null>(null);
  const [isCreateIndexOpen, setIsCreateIndexOpen] = useState(false);
  const [isEditIndexOpen, setIsEditIndexOpen] = useState(false);
  const [indexDraft, setIndexDraft] = useState({ index_code: '', name: '', country_code: '', exchange_code: '' });
  const [editingIndex, setEditingIndex] = useState<IndexApi | null>(null);
  const [indexActionLoading, setIndexActionLoading] = useState(false);
  const [indexActionError, setIndexActionError] = useState<string | null>(null);
  const [indexCountryOpen, setIndexCountryOpen] = useState(false);
  const [indexExchangeOpen, setIndexExchangeOpen] = useState(false);
  const [indexEditCountryOpen, setIndexEditCountryOpen] = useState(false);
  const [indexEditExchangeOpen, setIndexEditExchangeOpen] = useState(false);

  const [currencies, setCurrencies] = useState<CurrencyApi[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);
  const [isCreateCurrencyOpen, setIsCreateCurrencyOpen] = useState(false);
  const [isEditCurrencyOpen, setIsEditCurrencyOpen] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState({ code: '', name: '' });
  const [editingCurrency, setEditingCurrency] = useState<CurrencyApi | null>(null);
  const [currencyActionLoading, setCurrencyActionLoading] = useState(false);
  const [currencyActionError, setCurrencyActionError] = useState<string | null>(null);
  const [currencyToDelete, setCurrencyToDelete] = useState<CurrencyApi | null>(null);

  const [assetClasses, setAssetClasses] = useState<AssetClassApi[]>([]);
  const [assetClassesLoading, setAssetClassesLoading] = useState(false);
  const [assetClassesError, setAssetClassesError] = useState<string | null>(null);
  const [isCreateAssetClassOpen, setIsCreateAssetClassOpen] = useState(false);
  const [isEditAssetClassOpen, setIsEditAssetClassOpen] = useState(false);
  const [assetClassDraft, setAssetClassDraft] = useState({
    class_id: 0,
    code: '',
    name: '',
    description: '',
    sub_classes: [] as AssetSubClassApi[],
  });
  const [editingAssetClass, setEditingAssetClass] = useState<AssetClassApi | null>(null);
  const [assetClassActionLoading, setAssetClassActionLoading] = useState(false);
  const [assetClassActionError, setAssetClassActionError] = useState<string | null>(null);
  const [assetClassToDelete, setAssetClassToDelete] = useState<AssetClassApi | null>(null);

  // Investment Strategies state
  const [strategies, setStrategies] = useState<InvestmentStrategyApi[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [strategySort, setStrategySort] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const [isCreateStrategyOpen, setIsCreateStrategyOpen] = useState(false);
  const [isEditStrategyOpen, setIsEditStrategyOpen] = useState(false);
  const [strategyDraft, setStrategyDraft] = useState({ name: '', description: '' });
  const [editingStrategy, setEditingStrategy] = useState<InvestmentStrategyApi | null>(null);
  const [strategyActionLoading, setStrategyActionLoading] = useState(false);
  const [strategyActionError, setStrategyActionError] = useState<string | null>(null);
  const [strategyToDelete, setStrategyToDelete] = useState<InvestmentStrategyApi | null>(null);

  const apiBaseUrl = API_BASE_URL;

  // Handle sort toggle
  const toggleSort = (setSort: React.Dispatch<React.SetStateAction<SortConfig>>, key: string) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle tab change with scroll to top
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchQuery('');
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchAllPages = async <T,>(
    path: string,
    signal?: AbortSignal,
    pageSize: number = 500,
  ): Promise<T[]> => {
    const results: T[] = [];
    for (let skip = 0; ; skip += pageSize) {
      const response = await fetch(`${apiBaseUrl}${path}?skip=${skip}&limit=${pageSize}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const page = (await response.json()) as T[];
      if (!Array.isArray(page) || page.length === 0) {
        break;
      }
      results.push(...page);
      if (page.length < pageSize) {
        break;
      }
    }
    return results;
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadExchanges = async () => {
      try {
        setExchangesLoading(true);
        setExchangesError(null);
        const data = await fetchAllPages<ExchangeApi>('/api/v1/catalogs/exchanges', controller.signal);
        setExchanges(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setExchangesError('Could not load Exchanges.');
        setExchanges([]);
      } finally {
        setExchangesLoading(false);
      }
    };

    loadExchanges();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadCountries = async () => {
      try {
        setCountriesLoading(true);
        setCountriesError(null);
        const data = await fetchAllPages<CountryApi>('/api/v1/catalogs/countries', controller.signal);
        setCountries(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setCountriesError('Could not load Countries.');
        setCountries([]);
      } finally {
        setCountriesLoading(false);
      }
    };

    loadCountries();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadIndustries = async () => {
      try {
        setIndustriesLoading(true);
        setIndustriesError(null);
        const data = await fetchAllPages<IndustryApi>('/api/v1/catalogs/industries', controller.signal);
        setIndustries(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setIndustriesError('Could not load Industries.');
        setIndustries([]);
      } finally {
        setIndustriesLoading(false);
      }
    };

    loadIndustries();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadIndices = async () => {
      try {
        setIndicesLoading(true);
        setIndicesError(null);
        const data = await fetchAllPages<IndexApi>('/api/v1/catalogs/indices', controller.signal);
        setIndices(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setIndicesError('Could not load Indices.');
        setIndices([]);
      } finally {
        setIndicesLoading(false);
      }
    };

    loadIndices();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadCurrencies = async () => {
      try {
        setCurrenciesLoading(true);
        setCurrenciesError(null);
        const data = await fetchAllPages<CurrencyApi>('/api/v1/catalogs/currencies', controller.signal);
        setCurrencies(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setCurrenciesError('Could not load Currencies.');
        setCurrencies([]);
      } finally {
        setCurrenciesLoading(false);
      }
    };

    loadCurrencies();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadAssetClasses = async () => {
      try {
        setAssetClassesLoading(true);
        setAssetClassesError(null);
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/asset-classes`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as AssetClassApi[];
        setAssetClasses(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setAssetClassesError('Could not load Asset Classes.');
        setAssetClasses([]);
      } finally {
        setAssetClassesLoading(false);
      }
    };

    loadAssetClasses();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const loadStrategies = async () => {
      try {
        setStrategiesLoading(true);
        setStrategiesError(null);
        const data = await fetchAllPages<InvestmentStrategyApi>('/api/v1/catalogs/investment-strategies', controller.signal);
        setStrategies(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setStrategiesError('Could not load Investment Strategies.');
        setStrategies([]);
      } finally {
        setStrategiesLoading(false);
      }
    };

    loadStrategies();
    return () => controller.abort();
  }, [apiBaseUrl]);

  const countryNameByIso = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) {
      if (country.iso_code) {
        map.set(country.iso_code, country.name ?? country.iso_code);
      }
    }
    return map;
  }, [countries]);

  const exchangeNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const exchange of exchanges) {
      map.set(exchange.exchange_code, exchange.name);
    }
    return map;
  }, [exchanges]);

  const industrySectorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const industry of industries) {
      const sector = industry.sector?.trim();
      if (sector) {
        set.add(sector);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [industries]);

  const refreshIndustries = async () => {
    const data = await fetchAllPages<IndustryApi>('/api/v1/catalogs/industries');
    setIndustries(data);
  };

  const refreshExchanges = async () => {
    const data = await fetchAllPages<ExchangeApi>('/api/v1/catalogs/exchanges');
    setExchanges(data);
  };

  const refreshCountries = async () => {
    const data = await fetchAllPages<CountryApi>('/api/v1/catalogs/countries');
    setCountries(data);
  };

  const refreshIndices = async () => {
    const data = await fetchAllPages<IndexApi>('/api/v1/catalogs/indices');
    setIndices(data);
  };

  const refreshCurrencies = async () => {
    const data = await fetchAllPages<CurrencyApi>('/api/v1/catalogs/currencies');
    setCurrencies(data);
  };

  const refreshAssetClasses = async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/asset-classes`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as AssetClassApi[];
    setAssetClasses(Array.isArray(data) ? data : []);
  };

  const handleCreateExchange = async () => {
    if (!exchangeDraft.exchange_code.trim() || !exchangeDraft.name.trim()) {
      setExchangeActionError('Code and Name fields are required.');
      return;
    }
    try {
      setExchangeActionLoading(true);
      setExchangeActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/exchanges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange_code: exchangeDraft.exchange_code.trim().toUpperCase(),
          name: exchangeDraft.name.trim(),
          country_code: exchangeDraft.country_code.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshExchanges();
      setExchangeDraft({ exchange_code: '', name: '', country_code: '' });
      setIsCreateExchangeOpen(false);

      toast({
        title: 'Exchange created',
        description: `Exchange "${exchangeDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setExchangeActionError(error.message || 'Could not create the exchange.');
    } finally {
      setExchangeActionLoading(false);
    }
  };

  const handleEditExchange = (exchange: ExchangeApi) => {
    setEditingExchange(exchange);
    setExchangeDraft({
      exchange_code: exchange.exchange_code,
      name: exchange.name,
      country_code: exchange.country_code ?? '',
    });
    setExchangeActionError(null);
    setIsEditExchangeOpen(true);
  };

  const handleUpdateExchange = async () => {
    if (!editingExchange) {
      return;
    }
    if (!exchangeDraft.name.trim()) {
      setExchangeActionError('Name field is required.');
      return;
    }
    try {
      setExchangeActionLoading(true);
      setExchangeActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/exchanges/${editingExchange.exchange_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: exchangeDraft.name.trim(),
          country_code: exchangeDraft.country_code.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshExchanges();
      setIsEditExchangeOpen(false);
      setEditingExchange(null);

      toast({
        title: 'Exchange updated',
        description: `Exchange "${exchangeDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setExchangeActionError(error.message || 'Could not update the exchange.');
    } finally {
      setExchangeActionLoading(false);
    }
  };

  const handleDeleteExchange = async (exchangeCode: string) => {
    try {
      setExchangeActionLoading(true);
      setExchangeActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/exchanges/${exchangeCode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshExchanges();

      toast({
        title: 'Exchange deleted',
        description: `Exchange "${exchangeCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the exchange.',
        variant: 'destructive',
      });
    } finally {
      setExchangeActionLoading(false);
    }
  };

  const handleCreateCountry = async () => {
    if (!countryDraft.iso_code.trim() || !countryDraft.name.trim()) {
      setCountryActionError('ISO Code and Name fields are required.');
      return;
    }
    try {
      setCountryActionLoading(true);
      setCountryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iso_code: countryDraft.iso_code.trim().toUpperCase(),
          name: countryDraft.name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCountries();
      setCountryDraft({ iso_code: '', name: '' });
      setIsCreateCountryOpen(false);

      toast({
        title: 'Country created',
        description: `Country "${countryDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setCountryActionError(error.message || 'Could not create the country.');
    } finally {
      setCountryActionLoading(false);
    }
  };

  const handleEditCountry = (country: CountryApi) => {
    setEditingCountry(country);
    setCountryDraft({
      iso_code: country.iso_code,
      name: country.name ?? '',
    });
    setCountryActionError(null);
    setIsEditCountryOpen(true);
  };

  const handleUpdateCountry = async () => {
    if (!editingCountry) {
      return;
    }
    if (!countryDraft.name.trim()) {
      setCountryActionError('Name field is required.');
      return;
    }
    try {
      setCountryActionLoading(true);
      setCountryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries/${editingCountry.iso_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: countryDraft.name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCountries();
      setIsEditCountryOpen(false);
      setEditingCountry(null);

      toast({
        title: 'Country updated',
        description: `Country "${countryDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setCountryActionError(error.message || 'Could not update the country.');
    } finally {
      setCountryActionLoading(false);
    }
  };

  const handleDeleteCountry = async (isoCode: string) => {
    try {
      setCountryActionLoading(true);
      setCountryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries/${isoCode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCountries();

      toast({
        title: 'Country deleted',
        description: `Country "${isoCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the country.',
        variant: 'destructive',
      });
    } finally {
      setCountryActionLoading(false);
    }
  };

  const handleCreateIndustry = async () => {
    if (!industryDraft.industry_code.trim() || !industryDraft.name.trim()) {
      setIndustryActionError('Code and Name fields are required.');
      return;
    }
    try {
      setIndustryActionLoading(true);
      setIndustryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/industries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry_code: industryDraft.industry_code.trim(),
          name: industryDraft.name.trim(),
          sector: industryDraft.sector.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndustries();
      setIndustryDraft({ industry_code: '', name: '', sector: '' });
      setIsCreateIndustryOpen(false);

      toast({
        title: 'Industry created',
        description: `Industry "${industryDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setIndustryActionError(error.message || 'Could not create the industry.');
    } finally {
      setIndustryActionLoading(false);
    }
  };

  const handleEditIndustry = (industry: IndustryApi) => {
    setEditingIndustry(industry);
    setIndustryDraft({
      industry_code: industry.industry_code,
      name: industry.name,
      sector: industry.sector ?? '',
    });
    setIndustryActionError(null);
    setIsEditIndustryOpen(true);
  };

  const handleUpdateIndustry = async () => {
    if (!editingIndustry) {
      return;
    }
    if (!industryDraft.name.trim()) {
      setIndustryActionError('Name field is required.');
      return;
    }
    try {
      setIndustryActionLoading(true);
      setIndustryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/industries/${editingIndustry.industry_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: industryDraft.name.trim(),
          sector: industryDraft.sector.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndustries();
      setIsEditIndustryOpen(false);
      setEditingIndustry(null);

      toast({
        title: 'Industry updated',
        description: `Industry "${industryDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setIndustryActionError(error.message || 'Could not update the industry.');
    } finally {
      setIndustryActionLoading(false);
    }
  };

  const handleDeleteIndustry = async (industryCode: string) => {
    try {
      setIndustryActionLoading(true);
      setIndustryActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/industries/${industryCode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndustries();

      toast({
        title: 'Industry deleted',
        description: `Industry "${industryCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the industry.',
        variant: 'destructive',
      });
    } finally {
      setIndustryActionLoading(false);
    }
  };

  const handleCreateIndex = async () => {
    if (!indexDraft.index_code.trim() || !indexDraft.name.trim()) {
      setIndexActionError('Code and Name fields are required.');
      return;
    }
    try {
      setIndexActionLoading(true);
      setIndexActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/indices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index_code: indexDraft.index_code.trim().toUpperCase(),
          name: indexDraft.name.trim(),
          country_code: indexDraft.country_code.trim() || null,
          exchange_code: indexDraft.exchange_code.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndices();
      setIndexDraft({ index_code: '', name: '', country_code: '', exchange_code: '' });
      setIsCreateIndexOpen(false);

      toast({
        title: 'Index created',
        description: `Index "${indexDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setIndexActionError(error.message || 'Could not create the index.');
    } finally {
      setIndexActionLoading(false);
    }
  };

  const handleEditIndex = (index: IndexApi) => {
    setEditingIndex(index);
    setIndexDraft({
      index_code: index.index_code,
      name: index.name,
      country_code: index.country_code ?? '',
      exchange_code: index.exchange_code ?? '',
    });
    setIndexActionError(null);
    setIsEditIndexOpen(true);
  };

  const handleUpdateIndex = async () => {
    if (!editingIndex) {
      return;
    }
    if (!indexDraft.name.trim()) {
      setIndexActionError('Name field is required.');
      return;
    }
    try {
      setIndexActionLoading(true);
      setIndexActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/indices/${editingIndex.index_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: indexDraft.name.trim(),
          country_code: indexDraft.country_code.trim() || null,
          exchange_code: indexDraft.exchange_code.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndices();
      setIsEditIndexOpen(false);
      setEditingIndex(null);

      toast({
        title: 'Index updated',
        description: `Index "${indexDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setIndexActionError(error.message || 'Could not update the index.');
    } finally {
      setIndexActionLoading(false);
    }
  };

  const handleDeleteIndex = async (indexCode: string) => {
    try {
      setIndexActionLoading(true);
      setIndexActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/indices/${indexCode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshIndices();

      toast({
        title: 'Index deleted',
        description: `Index "${indexCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the index.',
        variant: 'destructive',
      });
    } finally {
      setIndexActionLoading(false);
    }
  };

  const handleCreateCurrency = async () => {
    if (!currencyDraft.code.trim() || !currencyDraft.name.trim()) {
      setCurrencyActionError('Code and Name fields are required.');
      return;
    }
    try {
      setCurrencyActionLoading(true);
      setCurrencyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currencyDraft.code.trim().toUpperCase(),
          name: currencyDraft.name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCurrencies();
      setCurrencyDraft({ code: '', name: '' });
      setIsCreateCurrencyOpen(false);

      toast({
        title: 'Currency created',
        description: `Currency "${currencyDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setCurrencyActionError(error.message || 'Could not create the currency.');
    } finally {
      setCurrencyActionLoading(false);
    }
  };

  const handleEditCurrency = (currency: CurrencyApi) => {
    setEditingCurrency(currency);
    setCurrencyDraft({
      code: currency.code,
      name: currency.name,
    });
    setCurrencyActionError(null);
    setIsEditCurrencyOpen(true);
  };

  const handleUpdateCurrency = async () => {
    if (!editingCurrency) {
      return;
    }
    if (!currencyDraft.name.trim()) {
      setCurrencyActionError('Name field is required.');
      return;
    }
    try {
      setCurrencyActionLoading(true);
      setCurrencyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/currencies/${editingCurrency.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currencyDraft.name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCurrencies();
      setIsEditCurrencyOpen(false);
      setEditingCurrency(null);

      toast({
        title: 'Currency updated',
        description: `Currency "${currencyDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setCurrencyActionError(error.message || 'Could not update the currency.');
    } finally {
      setCurrencyActionLoading(false);
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    try {
      setCurrencyActionLoading(true);
      setCurrencyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/currencies/${code}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshCurrencies();

      toast({
        title: 'Currency deleted',
        description: `Currency "${code}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the currency.',
        variant: 'destructive',
      });
    } finally {
      setCurrencyActionLoading(false);
    }
  };

  const handleCreateAssetClass = async () => {
    if (!assetClassDraft.code.trim() || !assetClassDraft.name.trim()) {
      setAssetClassActionError('Code and Name fields are required.');
      return;
    }
    try {
      setAssetClassActionLoading(true);
      setAssetClassActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/asset-classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: assetClassDraft.code.trim().toUpperCase(),
          name: assetClassDraft.name.trim(),
          description: assetClassDraft.description?.trim() || null,
          sub_classes: assetClassDraft.sub_classes.map((sub) => ({
            code: sub.code.trim().toUpperCase(),
            name: sub.name.trim(),
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshAssetClasses();
      setAssetClassDraft({ class_id: 0, code: '', name: '', description: '', sub_classes: [] });
      setIsCreateAssetClassOpen(false);

      toast({
        title: 'Asset class created',
        description: `Asset class "${assetClassDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAssetClassActionError(error.message || 'Could not create the asset class.');
    } finally {
      setAssetClassActionLoading(false);
    }
  };

  const handleEditAssetClass = (assetClass: AssetClassApi) => {
    setEditingAssetClass(assetClass);
    setAssetClassDraft({
      class_id: assetClass.class_id,
      code: assetClass.code,
      name: assetClass.name,
      description: assetClass.description ?? '',
      sub_classes: assetClass.sub_classes.map((sub) => ({
        sub_class_id: sub.sub_class_id,
        code: sub.code,
        name: sub.name,
      })),
    });
    setAssetClassActionError(null);
    setIsEditAssetClassOpen(true);
  };

  const handleUpdateAssetClass = async () => {
    if (!editingAssetClass) {
      return;
    }
    if (!assetClassDraft.code.trim() || !assetClassDraft.name.trim()) {
      setAssetClassActionError('Code and Name fields are required.');
      return;
    }
    try {
      setAssetClassActionLoading(true);
      setAssetClassActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/asset-classes/${editingAssetClass.class_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: assetClassDraft.code.trim().toUpperCase(),
          name: assetClassDraft.name.trim(),
          description: assetClassDraft.description?.trim() || null,
          sub_classes: assetClassDraft.sub_classes.map((sub) => ({
            sub_class_id: sub.sub_class_id,
            code: sub.code.trim().toUpperCase(),
            name: sub.name.trim(),
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshAssetClasses();
      setIsEditAssetClassOpen(false);
      setEditingAssetClass(null);

      toast({
        title: 'Asset class updated',
        description: `Asset class "${assetClassDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAssetClassActionError(error.message || 'Could not update the asset class.');
    } finally {
      setAssetClassActionLoading(false);
    }
  };

  const handleDeleteAssetClass = async (classId: number) => {
    try {
      setAssetClassActionLoading(true);
      setAssetClassActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/asset-classes/${classId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshAssetClasses();

      toast({
        title: 'Asset class deleted',
        description: 'Asset class has been deleted successfully.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the asset class.',
        variant: 'destructive',
      });
    } finally {
      setAssetClassActionLoading(false);
    }
  };

  // --- Investment Strategies Handlers ---
  const refreshStrategies = async () => {
    const data = await fetchAllPages<InvestmentStrategyApi>('/api/v1/catalogs/investment-strategies');
    setStrategies(data);
  };

  const handleCreateStrategy = async () => {
    if (!strategyDraft.name.trim()) {
      setStrategyActionError('Name field is required.');
      return;
    }
    try {
      setStrategyActionLoading(true);
      setStrategyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/investment-strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: strategyDraft.name.trim(),
          description: strategyDraft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshStrategies();
      setStrategyDraft({ name: '', description: '' });
      setIsCreateStrategyOpen(false);

      toast({
        title: 'Strategy created',
        description: `Strategy "${strategyDraft.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setStrategyActionError(error.message || 'Could not create the strategy.');
    } finally {
      setStrategyActionLoading(false);
    }
  };

  const handleEditStrategy = (strategy: InvestmentStrategyApi) => {
    setEditingStrategy(strategy);
    setStrategyDraft({
      name: strategy.name,
      description: strategy.description ?? '',
    });
    setStrategyActionError(null);
    setIsEditStrategyOpen(true);
  };

  const handleUpdateStrategy = async () => {
    if (!editingStrategy) {
      return;
    }
    if (!strategyDraft.name.trim()) {
      setStrategyActionError('Name field is required.');
      return;
    }
    try {
      setStrategyActionLoading(true);
      setStrategyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/investment-strategies/${editingStrategy.strategy_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: strategyDraft.name.trim(),
          description: strategyDraft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshStrategies();
      setIsEditStrategyOpen(false);
      setEditingStrategy(null);

      toast({
        title: 'Strategy updated',
        description: `Strategy "${strategyDraft.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setStrategyActionError(error.message || 'Could not update the strategy.');
    } finally {
      setStrategyActionLoading(false);
    }
  };

  const handleDeleteStrategy = async (strategyId: number) => {
    try {
      setStrategyActionLoading(true);
      setStrategyActionError(null);
      const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/investment-strategies/${strategyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await refreshStrategies();

      toast({
        title: 'Strategy deleted',
        description: 'Strategy has been deleted successfully.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting',
        description: error.message || 'Could not delete the strategy.',
        variant: 'destructive',
      });
    } finally {
      setStrategyActionLoading(false);
    }
  };

  const filteredExchanges = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = exchanges;
    if (query) {
      result = result.filter((exchange) => {
        const countryName = exchange.country_code ? (countryNameByIso.get(exchange.country_code) ?? '') : '';
        return (
          exchange.exchange_code.toLowerCase().includes(query) ||
          exchange.name.toLowerCase().includes(query) ||
          (exchange.country_code ?? '').toLowerCase().includes(query) ||
          countryName.toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[exchangeSort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[exchangeSort.key] ?? '').toLowerCase();
      return exchangeSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [countryNameByIso, exchanges, searchQuery, exchangeSort]);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = countries;
    if (query) {
      result = result.filter((country) => {
        return (
          country.iso_code.toLowerCase().includes(query) ||
          (country.name ?? '').toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[countrySort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[countrySort.key] ?? '').toLowerCase();
      return countrySort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [countries, searchQuery, countrySort]);

  const filteredIndustries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = industries;
    if (query) {
      result = result.filter((industry) => {
        return (
          industry.industry_code.toLowerCase().includes(query) ||
          industry.name.toLowerCase().includes(query) ||
          (industry.sector ?? '').toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[industrySort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[industrySort.key] ?? '').toLowerCase();
      return industrySort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [industries, searchQuery, industrySort]);

  const filteredIndices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = indices;
    if (query) {
      result = result.filter((index) => {
        const exchangeName = index.exchange_code ? (exchangeNameByCode.get(index.exchange_code) ?? '') : '';
        const countryName = index.country_code ? (countryNameByIso.get(index.country_code) ?? '') : '';
        return (
          index.index_code.toLowerCase().includes(query) ||
          index.name.toLowerCase().includes(query) ||
          (index.exchange_code ?? '').toLowerCase().includes(query) ||
          (index.country_code ?? '').toLowerCase().includes(query) ||
          exchangeName.toLowerCase().includes(query) ||
          countryName.toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[indexSort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[indexSort.key] ?? '').toLowerCase();
      return indexSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [countryNameByIso, exchangeNameByCode, indices, searchQuery, indexSort]);

  const filteredCurrencies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = currencies;
    if (query) {
      result = result.filter((currency) => {
        return (
          currency.code.toLowerCase().includes(query) ||
          currency.name.toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[currencySort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[currencySort.key] ?? '').toLowerCase();
      return currencySort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [currencies, searchQuery, currencySort]);

  const filteredAssetClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = assetClasses;
    if (query) {
      result = result.filter((assetClass) => {
        const matchesClass = [
          assetClass.code,
          assetClass.name,
          assetClass.description ?? '',
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
        const matchesSub = assetClass.sub_classes?.some((sub) =>
          [sub.code, sub.name].filter(Boolean).some((value) => value.toLowerCase().includes(query))
        );
        return matchesClass || !!matchesSub;
      });
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [assetClasses, searchQuery]);

  const filteredStrategies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = strategies;
    if (query) {
      result = result.filter((strategy) => {
        return (
          strategy.name.toLowerCase().includes(query) ||
          (strategy.description ?? '').toLowerCase().includes(query)
        );
      });
    }
    return [...result].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[strategySort.key] ?? '').toLowerCase();
      const bVal = String((b as Record<string, unknown>)[strategySort.key] ?? '').toLowerCase();
      return strategySort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [strategies, searchQuery, strategySort]);

  return (
    <AppLayout title="Basic Data" subtitle="Manage reference data for the system">
      <div ref={contentRef} className="h-full overflow-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 md:space-y-6">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mt-4 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
              <TabsList className="bg-muted/50 p-1 w-full sm:w-auto overflow-x-auto flex-nowrap">
                <TabsTrigger value="exchanges" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Building className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Exchanges
                </TabsTrigger>
                <TabsTrigger value="countries" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Countries
                </TabsTrigger>
                <TabsTrigger value="industries" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Factory className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Industries
                </TabsTrigger>
                <TabsTrigger value="indices" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Indices
                </TabsTrigger>
                <TabsTrigger value="currencies" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Currencies
                </TabsTrigger>
                <TabsTrigger value="asset-classes" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Layers className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Asset Classes
                </TabsTrigger>
                <TabsTrigger value="strategies" className="data-[state=active]:bg-card text-xs md:text-sm whitespace-nowrap">
                  <Target className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Strategies
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48 md:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted/50 border-border text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <ExchangesSection
            exchangesLoading={exchangesLoading}
            exchangesError={exchangesError}
            filteredExchanges={filteredExchanges}
            exchangeSort={exchangeSort}
            onSort={(key) => toggleSort(setExchangeSort, key)}
            countries={countries}
            countryNameByIso={countryNameByIso}
            exchangeDraft={exchangeDraft}
            setExchangeDraft={setExchangeDraft}
            isCreateExchangeOpen={isCreateExchangeOpen}
            setIsCreateExchangeOpen={setIsCreateExchangeOpen}
            isEditExchangeOpen={isEditExchangeOpen}
            setIsEditExchangeOpen={setIsEditExchangeOpen}
            exchangeActionError={exchangeActionError}
            exchangeActionLoading={exchangeActionLoading}
            setExchangeActionError={setExchangeActionError}
            handleCreateExchange={handleCreateExchange}
            handleUpdateExchange={handleUpdateExchange}
            handleEditExchange={handleEditExchange}
            exchangeToDelete={exchangeToDelete}
            setExchangeToDelete={setExchangeToDelete}
            handleDeleteExchange={handleDeleteExchange}
            exchangeCountryOpen={exchangeCountryOpen}
            setExchangeCountryOpen={setExchangeCountryOpen}
            exchangeEditCountryOpen={exchangeEditCountryOpen}
            setExchangeEditCountryOpen={setExchangeEditCountryOpen}
            SortableHeader={SortableHeader}
          />

          <CountriesSection
            countriesLoading={countriesLoading}
            countriesError={countriesError}
            filteredCountries={filteredCountries}
            countrySort={countrySort}
            onSort={(key) => toggleSort(setCountrySort, key)}
            countryDraft={countryDraft}
            setCountryDraft={setCountryDraft}
            isCreateCountryOpen={isCreateCountryOpen}
            setIsCreateCountryOpen={setIsCreateCountryOpen}
            isEditCountryOpen={isEditCountryOpen}
            setIsEditCountryOpen={setIsEditCountryOpen}
            countryActionError={countryActionError}
            countryActionLoading={countryActionLoading}
            setCountryActionError={setCountryActionError}
            handleCreateCountry={handleCreateCountry}
            handleUpdateCountry={handleUpdateCountry}
            handleEditCountry={handleEditCountry}
            countryToDelete={countryToDelete}
            setCountryToDelete={setCountryToDelete}
            handleDeleteCountry={handleDeleteCountry}
            SortableHeader={SortableHeader}
          />

          <IndustriesSection
            industriesLoading={industriesLoading}
            industriesError={industriesError}
            filteredIndustries={filteredIndustries}
            industrySort={industrySort}
            onSort={(key) => toggleSort(setIndustrySort, key)}
            industryDraft={industryDraft}
            setIndustryDraft={setIndustryDraft}
            isCreateIndustryOpen={isCreateIndustryOpen}
            setIsCreateIndustryOpen={setIsCreateIndustryOpen}
            isEditIndustryOpen={isEditIndustryOpen}
            setIsEditIndustryOpen={setIsEditIndustryOpen}
            industryActionError={industryActionError}
            industryActionLoading={industryActionLoading}
            setIndustryActionError={setIndustryActionError}
            handleCreateIndustry={handleCreateIndustry}
            handleUpdateIndustry={handleUpdateIndustry}
            handleEditIndustry={handleEditIndustry}
            industryToDelete={industryToDelete}
            setIndustryToDelete={setIndustryToDelete}
            handleDeleteIndustry={handleDeleteIndustry}
            industrySectorOptions={industrySectorOptions}
            SortableHeader={SortableHeader}
          />

          <IndicesSection
            indicesLoading={indicesLoading}
            indicesError={indicesError}
            filteredIndices={filteredIndices}
            indexSort={indexSort}
            onSort={(key) => toggleSort(setIndexSort, key)}
            exchanges={exchanges}
            countries={countries}
            countryNameByIso={countryNameByIso}
            exchangeNameByCode={exchangeNameByCode}
            indexDraft={indexDraft}
            setIndexDraft={setIndexDraft}
            isCreateIndexOpen={isCreateIndexOpen}
            setIsCreateIndexOpen={setIsCreateIndexOpen}
            isEditIndexOpen={isEditIndexOpen}
            setIsEditIndexOpen={setIsEditIndexOpen}
            indexActionError={indexActionError}
            indexActionLoading={indexActionLoading}
            setIndexActionError={setIndexActionError}
            handleCreateIndex={handleCreateIndex}
            handleUpdateIndex={handleUpdateIndex}
            handleEditIndex={handleEditIndex}
            indexToDelete={indexToDelete}
            setIndexToDelete={setIndexToDelete}
            handleDeleteIndex={handleDeleteIndex}
            indexCountryOpen={indexCountryOpen}
            setIndexCountryOpen={setIndexCountryOpen}
            indexExchangeOpen={indexExchangeOpen}
            setIndexExchangeOpen={setIndexExchangeOpen}
            indexEditCountryOpen={indexEditCountryOpen}
            setIndexEditCountryOpen={setIndexEditCountryOpen}
            indexEditExchangeOpen={indexEditExchangeOpen}
            setIndexEditExchangeOpen={setIndexEditExchangeOpen}
            SortableHeader={SortableHeader}
          />

          <CurrenciesSection
            currenciesLoading={currenciesLoading}
            currenciesError={currenciesError}
            filteredCurrencies={filteredCurrencies}
            currencySort={currencySort}
            onSort={(key) => toggleSort(setCurrencySort, key)}
            currencyDraft={currencyDraft}
            setCurrencyDraft={setCurrencyDraft}
            isCreateCurrencyOpen={isCreateCurrencyOpen}
            setIsCreateCurrencyOpen={setIsCreateCurrencyOpen}
            isEditCurrencyOpen={isEditCurrencyOpen}
            onEditCurrencyOpenChange={(open) => {
              setIsEditCurrencyOpen(open);
              if (!open) {
                setEditingCurrency(null);
              }
            }}
            currencyActionError={currencyActionError}
            currencyActionLoading={currencyActionLoading}
            setCurrencyActionError={setCurrencyActionError}
            handleCreateCurrency={handleCreateCurrency}
            handleUpdateCurrency={handleUpdateCurrency}
            handleEditCurrency={handleEditCurrency}
            currencyToDelete={currencyToDelete}
            setCurrencyToDelete={setCurrencyToDelete}
            handleDeleteCurrency={handleDeleteCurrency}
            SortableHeader={SortableHeader}
          />

          <AssetClassesSection
            assetClassesLoading={assetClassesLoading}
            assetClassesError={assetClassesError}
            filteredAssetClasses={filteredAssetClasses}
            assetClassDraft={assetClassDraft}
            setAssetClassDraft={setAssetClassDraft}
            isCreateAssetClassOpen={isCreateAssetClassOpen}
            setIsCreateAssetClassOpen={setIsCreateAssetClassOpen}
            isEditAssetClassOpen={isEditAssetClassOpen}
            setIsEditAssetClassOpen={setIsEditAssetClassOpen}
            assetClassActionError={assetClassActionError}
            assetClassActionLoading={assetClassActionLoading}
            setAssetClassActionError={setAssetClassActionError}
            handleCreateAssetClass={handleCreateAssetClass}
            handleUpdateAssetClass={handleUpdateAssetClass}
            handleEditAssetClass={handleEditAssetClass}
            assetClassToDelete={assetClassToDelete}
            setAssetClassToDelete={setAssetClassToDelete}
            handleDeleteAssetClass={handleDeleteAssetClass}
          />

          <InvestmentStrategiesSection
            strategiesLoading={strategiesLoading}
            strategiesError={strategiesError}
            filteredStrategies={filteredStrategies}
            strategySort={strategySort}
            onSort={(key) => toggleSort(setStrategySort, key)}
            strategyDraft={strategyDraft}
            setStrategyDraft={setStrategyDraft}
            isCreateStrategyOpen={isCreateStrategyOpen}
            setIsCreateStrategyOpen={setIsCreateStrategyOpen}
            isEditStrategyOpen={isEditStrategyOpen}
            setIsEditStrategyOpen={setIsEditStrategyOpen}
            strategyActionError={strategyActionError}
            strategyActionLoading={strategyActionLoading}
            setStrategyActionError={setStrategyActionError}
            handleCreateStrategy={handleCreateStrategy}
            handleUpdateStrategy={handleUpdateStrategy}
            handleEditStrategy={handleEditStrategy}
            strategyToDelete={strategyToDelete}
            setStrategyToDelete={setStrategyToDelete}
            handleDeleteStrategy={handleDeleteStrategy}
          />
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default BasicData;
