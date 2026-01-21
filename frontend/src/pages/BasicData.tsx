import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, Building, Globe, Factory, BarChart3, ArrowUpDown } from 'lucide-react';
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
  
  const [exchanges, setExchanges] = useState<ExchangeApi[]>([]);
  const [exchangesLoading, setExchangesLoading] = useState(false);
  const [exchangesError, setExchangesError] = useState<string | null>(null);
  
  const [countries, setCountries] = useState<CountryApi[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false);
  const [isEditCountryOpen, setIsEditCountryOpen] = useState(false);
  const [countryDraft, setCountryDraft] = useState({ iso_code: '', name: '' });
  const [editingCountry, setEditingCountry] = useState<CountryApi | null>(null);
  const [countryActionLoading, setCountryActionLoading] = useState(false);
  const [countryActionError, setCountryActionError] = useState<string | null>(null);
  
  const [industries, setIndustries] = useState<IndustryApi[]>([]);
  const [industriesLoading, setIndustriesLoading] = useState(false);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [isCreateIndustryOpen, setIsCreateIndustryOpen] = useState(false);
  const [isEditIndustryOpen, setIsEditIndustryOpen] = useState(false);
  const [industryDraft, setIndustryDraft] = useState({ industry_code: '', name: '', sector: '' });
  const [editingIndustry, setEditingIndustry] = useState<IndustryApi | null>(null);
  const [industryActionLoading, setIndustryActionLoading] = useState(false);
  const [industryActionError, setIndustryActionError] = useState<string | null>(null);
  
  const [indices, setIndices] = useState<IndexApi[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState<string | null>(null);

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

  const refreshIndustries = async () => {
    const data = await fetchAllPages<IndustryApi>('/api/v1/catalogs/industries');
    setIndustries(data);
  };

  const refreshCountries = async () => {
    const data = await fetchAllPages<CountryApi>('/api/v1/catalogs/countries');
    setCountries(data);
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
        title: '✅ Country created',
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
        title: '✅ Country updated',
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
    const country = countries.find(c => c.iso_code === isoCode);
    const confirmed = window.confirm(`Are you sure you want to delete country "${country?.name || isoCode}"?`);
    if (!confirmed) {
      return;
    }
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
        title: '✅ Country deleted',
        description: `Country "${country?.name || isoCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: '❌ Error deleting',
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
        title: '✅ Industry created',
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
        title: '✅ Industry updated',
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
    const industry = industries.find(i => i.industry_code === industryCode);
    const confirmed = window.confirm(`Are you sure you want to delete industry "${industry?.name || industryCode}"?`);
    if (!confirmed) {
      return;
    }
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
        title: '✅ Industry deleted',
        description: `Industry "${industry?.name || industryCode}" has been deleted successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: '❌ Error deleting',
        description: error.message || 'Could not delete the industry.',
        variant: 'destructive',
      });
    } finally {
      setIndustryActionLoading(false);
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                    Add Exchange
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Stock Exchange</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code</Label>
                        <Input placeholder="NYSE" className="mt-1" />
                      </div>
                      <div>
                        <Label>Timezone</Label>
                        <Input placeholder="EST" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="New York Stock Exchange" className="mt-1" />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
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
                    <th className="text-xs md:text-sm hidden md:table-cell">Timezone</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangesLoading && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Loading exchanges...
                      </td>
                    </tr>
                  )}
                  {!exchangesLoading && exchangesError && (
                    <tr>
                      <td colSpan={5} className="text-destructive text-xs md:text-sm text-center py-6">
                        {exchangesError}
                      </td>
                    </tr>
                  )}
                  {!exchangesLoading && !exchangesError && filteredExchanges.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
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
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">—</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                            onClick={() => handleDeleteCountry(country.iso_code)}
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
                      <Label>Sector</Label>
                      <Input
                        placeholder="Information Technology"
                        className="mt-1"
                        value={industryDraft.sector}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                      />
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
                      <Label>Sector</Label>
                      <Input
                        className="mt-1"
                        value={industryDraft.sector}
                        onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                      />
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
                            onClick={() => handleDeleteIndustry(industry.industry_code)}
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
          </div>
        </TabsContent>

        {/* Indices Tab */}
        <TabsContent value="indices">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Market Indices</h3>
              <Dialog>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code</Label>
                        <Input placeholder="SPX" className="mt-1" />
                      </div>
                      <div>
                        <Label>Exchange</Label>
                        <Input placeholder="NYSE" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="S&P 500" className="mt-1" />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline">Cancel</Button>
                      <Button className="bg-primary text-primary-foreground">Save</Button>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default BasicData;
