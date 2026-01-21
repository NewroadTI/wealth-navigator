import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Search, Edit2, Trash2, Building, Globe, Factory, BarChart3, Coins, ArrowUpDown, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Data is fetched from API (catalogs)

type ExchangeApi = {
  exchange_code: string;
  name: string;
  country_code?: string | null;
};

type CountryApi = {
  iso_code: string;
  name?: string | null;
};

type IndustryApi = {
  industry_code: string;
  name: string;
  sector?: string | null;
};

type IndexApi = {
  index_code: string;
  name: string;
  country_code?: string | null;
  exchange_code?: string | null;
};

type CurrencyApi = {
  code: string;
  name: string;
};

type SortConfig = { key: string; direction: 'asc' | 'desc' };

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

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
  
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

  // Sortable column header component
  const SortableHeader = ({ label, sortKey, currentSort, onSort }: { label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }) => (
    <th
      className="text-xs md:text-sm cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${currentSort.key === sortKey ? 'opacity-100' : 'opacity-40'}`} />
      </div>
    </th>
  );

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

        {/* Exchanges Tab */}
        <TabsContent value="exchanges">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Stock Exchanges</h3>
              <Dialog
                open={isCreateExchangeOpen}
                onOpenChange={(open) => {
                  setIsCreateExchangeOpen(open);
                  setExchangeActionError(null);
                  if (open) {
                    setExchangeDraft({ exchange_code: '', name: '', country_code: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Exchange
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Stock Exchange</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {exchangeActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {exchangeActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="exchange-code">Code *</Label>
                        <Input
                          id="exchange-code"
                          placeholder="NYSE"
                          className="mt-1"
                          value={exchangeDraft.exchange_code}
                          onChange={(e) => setExchangeDraft({ ...exchangeDraft, exchange_code: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="exchange-country">Country</Label>
                        <div className="mt-1">
                          <Popover open={exchangeCountryOpen} onOpenChange={setExchangeCountryOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                id="exchange-country"
                                className="w-full justify-between"
                              >
                                {exchangeDraft.country_code
                                  ? (countryNameByIso.get(exchangeDraft.country_code) ?? exchangeDraft.country_code)
                                  : 'Select country'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full p-0"
                              align="start"
                              onWheel={(event) => event.stopPropagation()}
                            >
                              <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandList className="max-h-60 overflow-auto">
                                  <CommandGroup>
                                    {countries.map((country) => (
                                      <CommandItem
                                        key={country.iso_code}
                                        value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                        onSelect={() => {
                                          setExchangeDraft({
                                            ...exchangeDraft,
                                            country_code: country.iso_code,
                                          });
                                          setExchangeCountryOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${exchangeDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <span>{country.name ?? country.iso_code}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="exchange-name">Name *</Label>
                      <Input
                        id="exchange-name"
                        placeholder="New York Stock Exchange"
                        className="mt-1"
                        value={exchangeDraft.name}
                        onChange={(e) => setExchangeDraft({ ...exchangeDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateExchangeOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleCreateExchange}
                        disabled={exchangeActionLoading}
                      >
                        {exchangeActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditExchangeOpen} onOpenChange={setIsEditExchangeOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Stock Exchange</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {exchangeActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {exchangeActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-exchange-code">Code</Label>
                        <Input
                          id="edit-exchange-code"
                          className="mt-1"
                          value={exchangeDraft.exchange_code}
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-exchange-country">Country</Label>
                        <div className="mt-1">
                          <Popover open={exchangeEditCountryOpen} onOpenChange={setExchangeEditCountryOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                id="edit-exchange-country"
                                className="w-full justify-between"
                              >
                                {exchangeDraft.country_code
                                  ? (countryNameByIso.get(exchangeDraft.country_code) ?? exchangeDraft.country_code)
                                  : 'Select country'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full p-0"
                              align="start"
                              onWheel={(event) => event.stopPropagation()}
                            >
                              <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandList className="max-h-60 overflow-auto">
                                  <CommandGroup>
                                    {countries.map((country) => (
                                      <CommandItem
                                        key={country.iso_code}
                                        value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                        onSelect={() => {
                                          setExchangeDraft({
                                            ...exchangeDraft,
                                            country_code: country.iso_code,
                                          });
                                          setExchangeEditCountryOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${exchangeDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <span>{country.name ?? country.iso_code}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-exchange-name">Name *</Label>
                      <Input
                        id="edit-exchange-name"
                        className="mt-1"
                        value={exchangeDraft.name}
                        onChange={(e) => setExchangeDraft({ ...exchangeDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsEditExchangeOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleUpdateExchange}
                        disabled={exchangeActionLoading}
                      >
                        {exchangeActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Code" sortKey="exchange_code" currentSort={exchangeSort} onSort={(k) => toggleSort(setExchangeSort, k)} />
                    <SortableHeader label="Name" sortKey="name" currentSort={exchangeSort} onSort={(k) => toggleSort(setExchangeSort, k)} />
                    <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => toggleSort(setExchangeSort, 'country_code')}>
                      <div className="flex items-center gap-1">Country <ArrowUpDown className={`h-3 w-3 ${exchangeSort.key === 'country_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
                    </th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangesLoading && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading exchanges...
                      </td>
                    </tr>
                  )}
                  {!exchangesLoading && exchangesError && (
                    <tr>
                      <td colSpan={4} className="text-destructive text-xs md:text-sm text-center py-6">
                        {exchangesError}
                      </td>
                    </tr>
                  )}
                  {!exchangesLoading && !exchangesError && filteredExchanges.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No exchanges to display.
                      </td>
                    </tr>
                  )}
                  {!exchangesLoading && !exchangesError && filteredExchanges.map((exchange) => (
                    <tr key={exchange.exchange_code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{exchange.exchange_code}</td>
                      <td className="text-foreground text-xs md:text-sm">{exchange.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        {exchange.country_code
                          ? (countryNameByIso.get(exchange.country_code) ?? exchange.country_code)
                          : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => handleEditExchange(exchange)}
                          >
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setExchangeToDelete(exchange)}
                            disabled={exchangeActionLoading}
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
            <AlertDialog open={!!exchangeToDelete} onOpenChange={(open) => !open && setExchangeToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete exchange</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete exchange "{exchangeToDelete?.exchange_code}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (exchangeToDelete) {
                        handleDeleteExchange(exchangeToDelete.exchange_code);
                      }
                      setExchangeToDelete(null);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* Countries Tab */}
        <TabsContent value="countries">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Countries</h3>
              <Dialog
                open={isCreateCountryOpen}
                onOpenChange={(open) => {
                  setIsCreateCountryOpen(open);
                  setCountryActionError(null);
                  if (open) {
                    setCountryDraft({ iso_code: '', name: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Country
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Country</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {countryActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {countryActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label htmlFor="country-iso">ISO Code *</Label>
                      <Input
                        id="country-iso"
                        placeholder="US"
                        className="mt-1"
                        maxLength={2}
                        value={countryDraft.iso_code}
                        onChange={(e) => setCountryDraft({ ...countryDraft, iso_code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="country-name">Name *</Label>
                      <Input
                        id="country-name"
                        placeholder="United States"
                        className="mt-1"
                        value={countryDraft.name}
                        onChange={(e) => setCountryDraft({ ...countryDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateCountryOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleCreateCountry}
                        disabled={countryActionLoading}
                      >
                        {countryActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditCountryOpen} onOpenChange={setIsEditCountryOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Country</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {countryActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {countryActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label htmlFor="edit-country-iso">ISO Code</Label>
                      <Input
                        id="edit-country-iso"
                        className="mt-1"
                        value={countryDraft.iso_code}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-country-name">Name *</Label>
                      <Input
                        id="edit-country-name"
                        className="mt-1"
                        value={countryDraft.name}
                        onChange={(e) => setCountryDraft({ ...countryDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsEditCountryOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleUpdateCountry}
                        disabled={countryActionLoading}
                      >
                        {countryActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Code" sortKey="iso_code" currentSort={countrySort} onSort={(k) => toggleSort(setCountrySort, k)} />
                    <SortableHeader label="Name" sortKey="name" currentSort={countrySort} onSort={(k) => toggleSort(setCountrySort, k)} />
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countriesLoading && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading countries...
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && countriesError && (
                    <tr>
                      <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                        {countriesError}
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && !countriesError && filteredCountries.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No countries to display.
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && !countriesError && filteredCountries.map((country) => (
                    <tr key={country.iso_code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{country.iso_code}</td>
                      <td className="text-foreground text-xs md:text-sm">{country.name ?? '—'}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => handleEditCountry(country)}
                          >
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setCountryToDelete(country)}
                            disabled={countryActionLoading}
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
            <AlertDialog open={!!countryToDelete} onOpenChange={(open) => !open && setCountryToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete country</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete country "{countryToDelete?.name ?? countryToDelete?.iso_code}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (countryToDelete) {
                        handleDeleteCountry(countryToDelete.iso_code);
                      }
                      setCountryToDelete(null);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* Industries Tab */}
        <TabsContent value="industries">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Industries</h3>
              <Dialog
                open={isCreateIndustryOpen}
                onOpenChange={(open) => {
                  setIsCreateIndustryOpen(open);
                  setIndustryActionError(null);
                  if (open) {
                    setIndustryDraft({ industry_code: '', name: '', sector: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Industry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Industry</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {industryActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {industryActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label>Code</Label>
                      <Input
                        placeholder="TECH"
                        className="mt-1"
                        value={industryDraft.industry_code}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, industry_code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input
                        placeholder="Technology"
                        className="mt-1"
                        value={industryDraft.name}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="industry-sector">Sector</Label>
                      <Input
                        id="industry-sector"
                        list="industry-sector-options"
                        placeholder="Information Technology"
                        className="mt-1"
                        value={industryDraft.sector}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                      />
                      <datalist id="industry-sector-options">
                        {industrySectorOptions.map((sector) => (
                          <option key={sector} value={sector} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateIndustryOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleCreateIndustry}
                        disabled={industryActionLoading}
                      >
                        {industryActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditIndustryOpen} onOpenChange={setIsEditIndustryOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Industry</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {industryActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {industryActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label>Code</Label>
                      <Input className="mt-1" value={industryDraft.industry_code} disabled />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input
                        className="mt-1"
                        value={industryDraft.name}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-industry-sector">Sector</Label>
                      <Input
                        id="edit-industry-sector"
                        list="industry-sector-options"
                        className="mt-1"
                        value={industryDraft.sector}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                      />
                      <datalist id="industry-sector-options">
                        {industrySectorOptions.map((sector) => (
                          <option key={sector} value={sector} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsEditIndustryOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleUpdateIndustry}
                        disabled={industryActionLoading}
                      >
                        {industryActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Code" sortKey="industry_code" currentSort={industrySort} onSort={(k) => toggleSort(setIndustrySort, k)} />
                    <SortableHeader label="Name" sortKey="name" currentSort={industrySort} onSort={(k) => toggleSort(setIndustrySort, k)} />
                    <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => toggleSort(setIndustrySort, 'sector')}>
                      <div className="flex items-center gap-1">Sector <ArrowUpDown className={`h-3 w-3 ${industrySort.key === 'sector' ? 'opacity-100' : 'opacity-40'}`} /></div>
                    </th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {industriesLoading && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading industries...
                      </td>
                    </tr>
                  )}
                  {!industriesLoading && industriesError && (
                    <tr>
                      <td colSpan={4} className="text-destructive text-xs md:text-sm text-center py-6">
                        {industriesError}
                      </td>
                    </tr>
                  )}
                  {!industriesLoading && !industriesError && filteredIndustries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No industries to display.
                      </td>
                    </tr>
                  )}
                  {!industriesLoading && !industriesError && filteredIndustries.map((industry) => (
                    <tr key={industry.industry_code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{industry.industry_code}</td>
                      <td className="text-foreground text-xs md:text-sm">{industry.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        {industry.sector ?? '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => handleEditIndustry(industry)}
                          >
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setIndustryToDelete(industry)}
                            disabled={industryActionLoading}
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
            <AlertDialog open={!!industryToDelete} onOpenChange={(open) => !open && setIndustryToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete industry</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete industry "{industryToDelete?.name ?? industryToDelete?.industry_code}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (industryToDelete) {
                        handleDeleteIndustry(industryToDelete.industry_code);
                      }
                      setIndustryToDelete(null);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* Indices Tab */}
        <TabsContent value="indices">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Market Indices</h3>
              <Dialog
                open={isCreateIndexOpen}
                onOpenChange={(open) => {
                  setIsCreateIndexOpen(open);
                  setIndexActionError(null);
                  if (open) {
                    setIndexDraft({ index_code: '', name: '', country_code: '', exchange_code: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Index
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Market Index</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {indexActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {indexActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="index-code">Code *</Label>
                        <Input
                          id="index-code"
                          placeholder="SPX"
                          className="mt-1"
                          value={indexDraft.index_code}
                          onChange={(e) => setIndexDraft({ ...indexDraft, index_code: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="index-exchange">Exchange</Label>
                        <div className="mt-1">
                          <Popover open={indexExchangeOpen} onOpenChange={setIndexExchangeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                id="index-exchange"
                                className="w-full justify-between"
                              >
                                {indexDraft.exchange_code || '-'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full p-0"
                              align="start"
                              onWheel={(event) => event.stopPropagation()}
                            >
                              <Command>
                                <CommandInput placeholder="Search exchange..." />
                                <CommandEmpty>No exchange found.</CommandEmpty>
                                <CommandList className="max-h-60 overflow-auto">
                                  <CommandGroup>
                                    <CommandItem
                                      value="-"
                                      onSelect={() => {
                                        setIndexDraft({ ...indexDraft, exchange_code: '' });
                                        setIndexExchangeOpen(false);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === '' ? 'opacity-100' : 'opacity-0'}`} />
                                      -
                                    </CommandItem>
                                    {exchanges.map((exchange) => (
                                      <CommandItem
                                        key={exchange.exchange_code}
                                        value={`${exchange.exchange_code} ${exchange.name}`}
                                        onSelect={() => {
                                          setIndexDraft({
                                            ...indexDraft,
                                            exchange_code: exchange.exchange_code,
                                          });
                                          setIndexExchangeOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === exchange.exchange_code ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <span>{exchange.exchange_code}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{exchange.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="index-name">Name *</Label>
                      <Input
                        id="index-name"
                        placeholder="S&P 500"
                        className="mt-1"
                        value={indexDraft.name}
                        onChange={(e) => setIndexDraft({ ...indexDraft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="index-country">Country</Label>
                      <div className="mt-1">
                        <Popover open={indexCountryOpen} onOpenChange={setIndexCountryOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              id="index-country"
                              className="w-full justify-between"
                            >
                              {indexDraft.country_code
                                ? (countryNameByIso.get(indexDraft.country_code) ?? indexDraft.country_code)
                                : 'Select country'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-full p-0"
                            align="start"
                            onWheel={(event) => event.stopPropagation()}
                          >
                            <Command>
                              <CommandInput placeholder="Search country..." />
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandList className="max-h-60 overflow-auto">
                                <CommandGroup>
                                  {countries.map((country) => (
                                    <CommandItem
                                      key={country.iso_code}
                                      value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                      onSelect={() => {
                                        setIndexDraft({
                                          ...indexDraft,
                                          country_code: country.iso_code,
                                        });
                                        setIndexCountryOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${indexDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                      />
                                      <span>{country.name ?? country.iso_code}</span>
                                      <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateIndexOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleCreateIndex}
                        disabled={indexActionLoading}
                      >
                        {indexActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditIndexOpen} onOpenChange={setIsEditIndexOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Market Index</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {indexActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {indexActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-index-code">Code</Label>
                        <Input
                          id="edit-index-code"
                          className="mt-1"
                          value={indexDraft.index_code}
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-index-exchange">Exchange</Label>
                        <div className="mt-1">
                          <Popover open={indexEditExchangeOpen} onOpenChange={setIndexEditExchangeOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                id="edit-index-exchange"
                                className="w-full justify-between"
                              >
                                {indexDraft.exchange_code || '-'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full p-0"
                              align="start"
                              onWheel={(event) => event.stopPropagation()}
                            >
                              <Command>
                                <CommandInput placeholder="Search exchange..." />
                                <CommandEmpty>No exchange found.</CommandEmpty>
                                <CommandList className="max-h-60 overflow-auto">
                                  <CommandGroup>
                                    <CommandItem
                                      value="-"
                                      onSelect={() => {
                                        setIndexDraft({ ...indexDraft, exchange_code: '' });
                                        setIndexEditExchangeOpen(false);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === '' ? 'opacity-100' : 'opacity-0'}`} />
                                      -
                                    </CommandItem>
                                    {exchanges.map((exchange) => (
                                      <CommandItem
                                        key={exchange.exchange_code}
                                        value={`${exchange.exchange_code} ${exchange.name}`}
                                        onSelect={() => {
                                          setIndexDraft({
                                            ...indexDraft,
                                            exchange_code: exchange.exchange_code,
                                          });
                                          setIndexEditExchangeOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === exchange.exchange_code ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <span>{exchange.exchange_code}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{exchange.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-index-name">Name *</Label>
                      <Input
                        id="edit-index-name"
                        className="mt-1"
                        value={indexDraft.name}
                        onChange={(e) => setIndexDraft({ ...indexDraft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-index-country">Country</Label>
                      <div className="mt-1">
                        <Popover open={indexEditCountryOpen} onOpenChange={setIndexEditCountryOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              id="edit-index-country"
                              className="w-full justify-between"
                            >
                              {indexDraft.country_code
                                ? (countryNameByIso.get(indexDraft.country_code) ?? indexDraft.country_code)
                                : 'Select country'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-full p-0"
                            align="start"
                            onWheel={(event) => event.stopPropagation()}
                          >
                            <Command>
                              <CommandInput placeholder="Search country..." />
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandList className="max-h-60 overflow-auto">
                                <CommandGroup>
                                  {countries.map((country) => (
                                    <CommandItem
                                      key={country.iso_code}
                                      value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                      onSelect={() => {
                                        setIndexDraft({
                                          ...indexDraft,
                                          country_code: country.iso_code,
                                        });
                                        setIndexEditCountryOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${indexDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                      />
                                      <span>{country.name ?? country.iso_code}</span>
                                      <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsEditIndexOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleUpdateIndex}
                        disabled={indexActionLoading}
                      >
                        {indexActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Code" sortKey="index_code" currentSort={indexSort} onSort={(k) => toggleSort(setIndexSort, k)} />
                    <SortableHeader label="Name" sortKey="name" currentSort={indexSort} onSort={(k) => toggleSort(setIndexSort, k)} />
                    <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => toggleSort(setIndexSort, 'exchange_code')}>
                      <div className="flex items-center gap-1">Exchange <ArrowUpDown className={`h-3 w-3 ${indexSort.key === 'exchange_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
                    </th>
                    <th className="text-xs md:text-sm hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => toggleSort(setIndexSort, 'country_code')}>
                      <div className="flex items-center gap-1">Country <ArrowUpDown className={`h-3 w-3 ${indexSort.key === 'country_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
                    </th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {indicesLoading && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading indices...
                      </td>
                    </tr>
                  )}
                  {!indicesLoading && indicesError && (
                    <tr>
                      <td colSpan={5} className="text-destructive text-xs md:text-sm text-center py-6">
                        {indicesError}
                      </td>
                    </tr>
                  )}
                  {!indicesLoading && !indicesError && filteredIndices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No indices to display.
                      </td>
                    </tr>
                  )}
                  {!indicesLoading && !indicesError && filteredIndices.map((index) => (
                    <tr key={index.index_code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{index.index_code}</td>
                      <td className="text-foreground text-xs md:text-sm">{index.name}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        {index.exchange_code
                          ? `${exchangeNameByCode.get(index.exchange_code) ?? index.exchange_code} (${index.exchange_code})`
                          : '—'}
                      </td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">
                        {index.country_code
                          ? (countryNameByIso.get(index.country_code) ?? index.country_code)
                          : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => handleEditIndex(index)}
                          >
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setIndexToDelete(index)}
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
            <AlertDialog open={!!indexToDelete} onOpenChange={(open) => !open && setIndexToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete market index</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete index "{indexToDelete?.index_code}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (indexToDelete) {
                        handleDeleteIndex(indexToDelete.index_code);
                      }
                      setIndexToDelete(null);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>

        {/* Currencies Tab */}
        <TabsContent value="currencies">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Currencies</h3>
              <Dialog
                open={isCreateCurrencyOpen}
                onOpenChange={(open) => {
                  setIsCreateCurrencyOpen(open);
                  setCurrencyActionError(null);
                  if (open) {
                    setCurrencyDraft({ code: '', name: '' });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Currency
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Currency</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {currencyActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {currencyActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label htmlFor="currency-code">Code *</Label>
                      <Input
                        id="currency-code"
                        placeholder="USD"
                        className="mt-1"
                        value={currencyDraft.code}
                        onChange={(e) => setCurrencyDraft({ ...currencyDraft, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency-name">Name *</Label>
                      <Input
                        id="currency-name"
                        placeholder="US Dollar"
                        className="mt-1"
                        value={currencyDraft.name}
                        onChange={(e) => setCurrencyDraft({ ...currencyDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateCurrencyOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleCreateCurrency}
                        disabled={currencyActionLoading}
                      >
                        {currencyActionLoading ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isEditCurrencyOpen}
                onOpenChange={(open) => {
                  setIsEditCurrencyOpen(open);
                  setCurrencyActionError(null);
                  if (!open) {
                    setEditingCurrency(null);
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Currency</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {currencyActionError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-sm text-red-800">
                          {currencyActionError}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label htmlFor="edit-currency-code">Code</Label>
                      <Input
                        id="edit-currency-code"
                        className="mt-1"
                        value={currencyDraft.code}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-currency-name">Name *</Label>
                      <Input
                        id="edit-currency-name"
                        className="mt-1"
                        value={currencyDraft.name}
                        onChange={(e) => setCurrencyDraft({ ...currencyDraft, name: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsEditCurrencyOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={handleUpdateCurrency}
                        disabled={currencyActionLoading}
                      >
                        {currencyActionLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Code" sortKey="code" currentSort={currencySort} onSort={(k) => toggleSort(setCurrencySort, k)} />
                    <SortableHeader label="Name" sortKey="name" currentSort={currencySort} onSort={(k) => toggleSort(setCurrencySort, k)} />
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currenciesLoading && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {currenciesError && (
                    <tr>
                      <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                        {currenciesError}
                      </td>
                    </tr>
                  )}
                  {!currenciesLoading && !currenciesError && filteredCurrencies.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No currencies found.
                      </td>
                    </tr>
                  )}
                  {!currenciesLoading && !currenciesError && filteredCurrencies.map((currency) => (
                    <tr key={currency.code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{currency.code}</td>
                      <td className="text-foreground text-xs md:text-sm">{currency.name}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => handleEditCurrency(currency)}
                          >
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setCurrencyToDelete(currency)}
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
            <AlertDialog open={!!currencyToDelete} onOpenChange={(open) => !open && setCurrencyToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete currency</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete currency "{currencyToDelete?.code}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (currencyToDelete) {
                        handleDeleteCurrency(currencyToDelete.code);
                      }
                      setCurrencyToDelete(null);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default BasicData;
