import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, Building, Globe, Factory, BarChart3 } from 'lucide-react';

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

const BasicData = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [exchanges, setExchanges] = useState<ExchangeApi[]>([]);
  const [exchangesLoading, setExchangesLoading] = useState(false);
  const [exchangesError, setExchangesError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryApi[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<IndustryApi[]>([]);
  const [industriesLoading, setIndustriesLoading] = useState(false);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [indices, setIndices] = useState<IndexApi[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const [isCreateIndustryOpen, setIsCreateIndustryOpen] = useState(false);
  const [isEditIndustryOpen, setIsEditIndustryOpen] = useState(false);
  const [industryDraft, setIndustryDraft] = useState({ industry_code: '', name: '', sector: '' });
  const [editingIndustry, setEditingIndustry] = useState<IndustryApi | null>(null);
  const [industryActionLoading, setIndustryActionLoading] = useState(false);
  const [industryActionError, setIndustryActionError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

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
        setExchangesError('No se pudo cargar Exchanges.');
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
        setCountriesError('No se pudo cargar Countries.');
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
        setIndustriesError('No se pudo cargar Industries.');
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
        setIndicesError('No se pudo cargar Indices.');
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

  const handleCreateIndustry = async () => {
    if (!industryDraft.industry_code.trim() || !industryDraft.name.trim()) {
      setIndustryActionError('Completa Code y Name.');
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
        throw new Error(`HTTP ${response.status}`);
      }
      await refreshIndustries();
      setIndustryDraft({ industry_code: '', name: '', sector: '' });
      setIsCreateIndustryOpen(false);
    } catch (error) {
      setIndustryActionError('No se pudo crear la industria.');
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
      setIndustryActionError('Completa Name.');
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
        throw new Error(`HTTP ${response.status}`);
      }
      await refreshIndustries();
      setIsEditIndustryOpen(false);
      setEditingIndustry(null);
    } catch (error) {
      setIndustryActionError('No se pudo actualizar la industria.');
    } finally {
      setIndustryActionLoading(false);
    }
  };

  const handleDeleteIndustry = async (industryCode: string) => {
    const confirmed = window.confirm('¿Eliminar la industria seleccionada?');
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
        throw new Error(`HTTP ${response.status}`);
      }
      await refreshIndustries();
    } catch (error) {
      setIndustryActionError('No se pudo eliminar la industria.');
    } finally {
      setIndustryActionLoading(false);
    }
  };

  const filteredExchanges = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return exchanges;
    }
    return exchanges.filter((exchange) => {
      const countryName = exchange.country_code ? (countryNameByIso.get(exchange.country_code) ?? '') : '';
      return (
        exchange.exchange_code.toLowerCase().includes(query) ||
        exchange.name.toLowerCase().includes(query) ||
        (exchange.country_code ?? '').toLowerCase().includes(query) ||
        countryName.toLowerCase().includes(query)
      );
    });
  }, [countryNameByIso, exchanges, searchQuery]);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return countries;
    }
    return countries.filter((country) => {
      return (
        country.iso_code.toLowerCase().includes(query) ||
        (country.name ?? '').toLowerCase().includes(query)
      );
    });
  }, [countries, searchQuery]);

  const filteredIndustries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return industries;
    }
    return industries.filter((industry) => {
      return (
        industry.industry_code.toLowerCase().includes(query) ||
        industry.name.toLowerCase().includes(query) ||
        (industry.sector ?? '').toLowerCase().includes(query)
      );
    });
  }, [industries, searchQuery]);

  const filteredIndices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return indices;
    }
    return indices.filter((index) => {
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
  }, [countryNameByIso, exchangeNameByCode, indices, searchQuery]);

  return (
    <AppLayout title="Basic Data" subtitle="Manage reference data for the system">
      <Tabs defaultValue="exchanges" className="space-y-4 md:space-y-6">
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
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Country</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Timezone</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangesLoading && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Cargando exchanges...
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
                        No hay exchanges para mostrar.
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
              <Dialog>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code (ISO)</Label>
                        <Input placeholder="US" className="mt-1" />
                      </div>
                      <div>
                        <Label>Currency</Label>
                        <Input placeholder="USD" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="United States" className="mt-1" />
                    </div>
                    <div>
                      <Label>Region</Label>
                      <Input placeholder="North America" className="mt-1" />
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
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Currency</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Region</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countriesLoading && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Cargando countries...
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && countriesError && (
                    <tr>
                      <td colSpan={5} className="text-destructive text-xs md:text-sm text-center py-6">
                        {countriesError}
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && !countriesError && filteredCountries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        No hay countries para mostrar.
                      </td>
                    </tr>
                  )}
                  {!countriesLoading && !countriesError && filteredCountries.map((country) => (
                    <tr key={country.iso_code}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{country.iso_code}</td>
                      <td className="text-foreground text-xs md:text-sm">{country.name ?? '—'}</td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">—</td>
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
                        Save
                      </Button>
                    </div>
                    {industryActionError && (
                      <p className="text-xs text-destructive">{industryActionError}</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditIndustryOpen} onOpenChange={setIsEditIndustryOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Industry</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
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
                        Save
                      </Button>
                    </div>
                    {industryActionError && (
                      <p className="text-xs text-destructive">{industryActionError}</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Sector</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {industriesLoading && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Cargando industries...
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
                        No hay industries para mostrar.
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
                    <th className="text-xs md:text-sm">Code</th>
                    <th className="text-xs md:text-sm">Name</th>
                    <th className="text-xs md:text-sm hidden sm:table-cell">Exchange</th>
                    <th className="text-xs md:text-sm hidden md:table-cell">Country</th>
                    <th className="text-xs md:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {indicesLoading && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                        Cargando indices...
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
                        No hay indices para mostrar.
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
    </AppLayout>
  );
};

export default BasicData;
