import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, Building, Globe, Factory, BarChart3 } from 'lucide-react';

// Mock data

const mockCountries = [
  { id: '1', code: 'US', name: 'United States', currency: 'USD', region: 'North America' },
  { id: '2', code: 'GB', name: 'United Kingdom', currency: 'GBP', region: 'Europe' },
  { id: '3', code: 'DE', name: 'Germany', currency: 'EUR', region: 'Europe' },
  { id: '4', code: 'JP', name: 'Japan', currency: 'JPY', region: 'Asia' },
  { id: '5', code: 'CH', name: 'Switzerland', currency: 'CHF', region: 'Europe' },
];

const mockIndustries = [
  { id: '1', code: 'TECH', name: 'Technology', sector: 'Information Technology' },
  { id: '2', code: 'FINC', name: 'Financials', sector: 'Financial Services' },
  { id: '3', code: 'HLTH', name: 'Healthcare', sector: 'Health Care' },
  { id: '4', code: 'ENGY', name: 'Energy', sector: 'Energy' },
  { id: '5', code: 'CONS', name: 'Consumer Goods', sector: 'Consumer Discretionary' },
];

const mockIndices = [
  { id: '1', code: 'SPX', name: 'S&P 500', exchange: 'NYSE', country: 'United States' },
  { id: '2', code: 'NDX', name: 'NASDAQ 100', exchange: 'NASDAQ', country: 'United States' },
  { id: '3', code: 'DJI', name: 'Dow Jones Industrial Average', exchange: 'NYSE', country: 'United States' },
  { id: '4', code: 'FTSE', name: 'FTSE 100', exchange: 'LSE', country: 'United Kingdom' },
  { id: '5', code: 'DAX', name: 'DAX 40', exchange: 'XETRA', country: 'Germany' },
];

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

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  useEffect(() => {
    const controller = new AbortController();
    const loadExchanges = async () => {
      try {
        setExchangesLoading(true);
        setExchangesError(null);
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/exchanges?skip=0&limit=1000`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as ExchangeApi[];
        setExchanges(Array.isArray(data) ? data : []);
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCountries = async () => {
      try {
        setCountriesLoading(true);
        setCountriesError(null);
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries?skip=0&limit=1000`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as CountryApi[];
        setCountries(Array.isArray(data) ? data : []);
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
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/industries?skip=0&limit=1000`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as IndustryApi[];
        setIndustries(Array.isArray(data) ? data : []);
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
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/indices?skip=0&limit=1000`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as IndexApi[];
        setIndices(Array.isArray(data) ? data : []);
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

  const filteredExchanges = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return exchanges;
    }
    return exchanges.filter((exchange) => {
      return (
        exchange.exchange_code.toLowerCase().includes(query) ||
        exchange.name.toLowerCase().includes(query) ||
        (exchange.country_code ?? '').toLowerCase().includes(query)
      );
    });
  }, [exchanges, searchQuery]);

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
      return (
        index.index_code.toLowerCase().includes(query) ||
        index.name.toLowerCase().includes(query) ||
        (index.exchange_code ?? '').toLowerCase().includes(query) ||
        (index.country_code ?? '').toLowerCase().includes(query)
      );
    });
  }, [indices, searchQuery]);

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
                        {exchange.country_code ?? '—'}
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
              <Dialog>
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
                      <Input placeholder="TECH" className="mt-1" />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input placeholder="Technology" className="mt-1" />
                    </div>
                    <div>
                      <Label>Sector</Label>
                      <Input placeholder="Information Technology" className="mt-1" />
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
                        {index.exchange_code ?? '—'}
                      </td>
                      <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">
                        {index.country_code ?? '—'}
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
