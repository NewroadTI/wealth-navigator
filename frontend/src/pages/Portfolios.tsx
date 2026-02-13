import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DevelopmentBanner } from '@/components/common/DevelopmentBanner';
import { PortfolioCard } from '@/components/portfolios/PortfolioCard';
import { getApiBaseUrl } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, Download, LayoutGrid, List, User, Building2, Calendar, TrendingUp, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Types
type UserApi = {
  user_id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  entity_type: string | null;
  is_active: boolean;
};

type CurrencyApi = {
  code: string;
  name: string;
};

type CountryApi = {
  iso_code: string;
  name: string | null;
};

type PortfolioApi = {
  portfolio_id: number;
  owner_user_id: number;
  interface_code: string;
  name: string;
  main_currency: string;
  residence_country: string | null;
  inception_date: string | null;
  active_status: boolean;
  accounts: any[];
  advisors: any[];
};

const Portfolios = () => {
  const [isNewPortfolioOpen, setIsNewPortfolioOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'lastUpdate' | 'totalValue' | 'lastTwr' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  // API data states
  const [portfolios, setPortfolios] = useState<PortfolioApi[]>([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [investors, setInvestors] = useState<UserApi[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyApi[]>([]);
  const [countries, setCountries] = useState<CountryApi[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    owner_user_id: '',
    interface_code: '',
    name: '',
    main_currency: 'USD',
    residence_country: '',
    inception_date: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const apiBaseUrl = getApiBaseUrl();

  // Load portfolios
  useEffect(() => {
    const loadPortfolios = async () => {
      try {
        setPortfoliosLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/v1/portfolios/`);
        if (!response.ok) throw new Error('Failed to load portfolios');
        const data = await response.json();
        setPortfolios(data);
      } catch (error) {
        console.error('Error loading portfolios:', error);
      } finally {
        setPortfoliosLoading(false);
      }
    };
    loadPortfolios();
  }, [apiBaseUrl]);

  // Load investors
  useEffect(() => {
    const loadInvestors = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/users/investors`);
        if (!response.ok) throw new Error('Failed to load investors');
        const data = await response.json();
        setInvestors(data);
      } catch (error) {
        console.error('Error loading investors:', error);
      }
    };
    loadInvestors();
  }, [apiBaseUrl]);

  // Load currencies
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`);
        if (!response.ok) throw new Error('Failed to load currencies');
        const data = await response.json();
        setCurrencies(data);
      } catch (error) {
        console.error('Error loading currencies:', error);
      }
    };
    loadCurrencies();
  }, [apiBaseUrl]);

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries`);
        if (!response.ok) throw new Error('Failed to load countries');
        const data = await response.json();
        setCountries(data);
      } catch (error) {
        console.error('Error loading countries:', error);
      }
    };
    loadCountries();
  }, [apiBaseUrl]);

  // TWR summaries state
  type TWRAccountSummary = {
    account_id: number;
    account_code: string;
    nav: number;
    last_date: string | null;
    day_change: number;
    twr_pct: number;
    cutoff_date: string | null;
  };
  type TWRPortfolioSummary = {
    portfolio_id: number;
    total_nav: number;
    last_date: string | null;
    day_change: number;
    last_twr_pct: number;
    accounts: TWRAccountSummary[];
  };
  const [twrSummaries, setTwrSummaries] = useState<TWRPortfolioSummary[]>([]);

  // Load TWR summaries for all portfolios
  useEffect(() => {
    const loadTwrSummaries = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/twr/portfolios/summaries`);
        if (!response.ok) throw new Error('Failed to load TWR summaries');
        const data = await response.json();
        setTwrSummaries(data);
      } catch (error) {
        console.error('Error loading TWR summaries:', error);
      }
    };
    loadTwrSummaries();
  }, [apiBaseUrl]);

  // Create a map of portfolio_id -> TWR summary
  const twrSummaryMap = useMemo(() => {
    const map = new Map<number, TWRPortfolioSummary>();
    twrSummaries.forEach(s => map.set(s.portfolio_id, s));
    return map;
  }, [twrSummaries]);

  // Handle investor selection - auto-complete portfolio name
  const handleInvestorChange = (userId: string) => {
    const investor = investors.find(i => i.user_id === parseInt(userId));
    setFormData(prev => ({
      ...prev,
      owner_user_id: userId,
      name: investor ? `${investor.full_name || investor.username}'s Portfolio` : prev.name,
    }));
  };

  // Create portfolio
  const handleCreatePortfolio = async () => {
    if (!formData.owner_user_id || !formData.interface_code || !formData.name) {
      setFormError('Please fill all required fields.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const response = await fetch(`${apiBaseUrl}/api/v1/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_user_id: parseInt(formData.owner_user_id),
          interface_code: formData.interface_code,
          name: formData.name,
          main_currency: formData.main_currency,
          residence_country: formData.residence_country || null,
          inception_date: formData.inception_date || null,
          active_status: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const newPortfolio = await response.json();
      setPortfolios(prev => [...prev, newPortfolio]);
      setIsNewPortfolioOpen(false);
      setFormData({
        owner_user_id: '',
        interface_code: '',
        name: '',
        main_currency: 'USD',
        residence_country: '',
        inception_date: '',
      });

      toast({
        title: 'Portfolio created',
        description: `Portfolio "${newPortfolio.name}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setFormError(error.message || 'Could not create portfolio.');
    } finally {
      setFormLoading(false);
    }
  };

  // Filter and sort portfolios
  const filteredPortfolios = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = portfolios;
    
    if (query) {
      filtered = portfolios.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.interface_code.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const twrA = twrSummaryMap.get(a.portfolio_id);
        const twrB = twrSummaryMap.get(b.portfolio_id);

        let compareValue = 0;

        if (sortColumn === 'lastUpdate') {
          const dateA = twrA?.last_date ? new Date(twrA.last_date).getTime() : 0;
          const dateB = twrB?.last_date ? new Date(twrB.last_date).getTime() : 0;
          compareValue = dateA - dateB;
        } else if (sortColumn === 'totalValue') {
          const navA = twrA?.total_nav ?? 0;
          const navB = twrB?.total_nav ?? 0;
          compareValue = navA - navB;
        } else if (sortColumn === 'lastTwr') {
          const twrPctA = twrA?.last_twr_pct ?? -Infinity;
          const twrPctB = twrB?.last_twr_pct ?? -Infinity;
          compareValue = twrPctA - twrPctB;
        }

        return sortDirection === 'asc' ? compareValue : -compareValue;
      });
    }

    return filtered;
  }, [portfolios, searchQuery, sortColumn, sortDirection, twrSummaryMap]);

  // Handle sort column click
  const handleSort = (column: 'lastUpdate' | 'totalValue' | 'lastTwr') => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Get sort icon for header
  const getSortIcon = (column: 'lastUpdate' | 'totalValue' | 'lastTwr') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    }
    return sortDirection === 'desc' 
      ? <ChevronDown className="h-3.5 w-3.5 ml-1" />
      : <ChevronUp className="h-3.5 w-3.5 ml-1" />;
  };

  // Get investor name by id
  const getInvestorName = (userId: number) => {
    const investor = investors.find(i => i.user_id === userId);
    return investor?.full_name || investor?.username || 'Unknown';
  };

  const getInvestorType = (userId: number) => {
    const investor = investors.find(i => i.user_id === userId);
    return investor?.entity_type || 'Individual';
  };

  return (
    <AppLayout title="Portfolios" subtitle="Manage investor portfolios and accounts">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search portfolios..."
              className="pl-9 bg-muted/50 border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="border-border">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="border-border">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isNewPortfolioOpen} onOpenChange={(open) => {
            setIsNewPortfolioOpen(open);
            if (!open) {
              setFormError(null);
              setFormData({
                owner_user_id: '',
                interface_code: '',
                name: '',
                main_currency: 'USD',
                residence_country: '',
                inception_date: '',
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create New Portfolio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {formError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="investor">Investor *</Label>
                    <Select value={formData.owner_user_id} onValueChange={handleInvestorChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select investor" />
                      </SelectTrigger>
                      <SelectContent>
                        {investors.map((investor) => (
                          <SelectItem key={investor.user_id} value={investor.user_id.toString()}>
                            {investor.full_name || investor.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="interfaceCode">Interface Code *</Label>
                    <Input
                      id="interfaceCode"
                      placeholder="WR-2024-001"
                      className="mt-1"
                      value={formData.interface_code}
                      onChange={(e) => setFormData({ ...formData, interface_code: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="portfolioName">Portfolio Name *</Label>
                  <Input
                    id="portfolioName"
                    placeholder="Global Growth Portfolio"
                    className="mt-1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mainCurrency">Main Currency</Label>
                    <Select
                      value={formData.main_currency}
                      onValueChange={(value) => setFormData({ ...formData, main_currency: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="country">Residence Country</Label>
                    <Select
                      value={formData.residence_country}
                      onValueChange={(value) => setFormData({ ...formData, residence_country: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.iso_code} value={country.iso_code}>
                            {country.name || country.iso_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="inceptionDate">Inception Date</Label>
                    <Input
                      id="inceptionDate"
                      type="date"
                      className="mt-1"
                      value={formData.inception_date}
                      onChange={(e) => setFormData({ ...formData, inception_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="benchmark">Benchmark</Label>
                    <Select>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select benchmark" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sp500">S&P 500</SelectItem>
                        <SelectItem value="nasdaq">NASDAQ 100</SelectItem>
                        <SelectItem value="bloomberg">Bloomberg US Agg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
                  <Button variant="outline" onClick={() => setIsNewPortfolioOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={handleCreatePortfolio}
                    disabled={formLoading}
                  >
                    {formLoading ? 'Creating...' : 'Create Portfolio'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading state */}
      {portfoliosLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading portfolios...</div>
      )}

      {/* Empty state */}
      {!portfoliosLoading && filteredPortfolios.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No portfolios match your search.' : 'No portfolios found. Create your first portfolio!'}
        </div>
      )}

      {/* Portfolio Grid or List View */}
      {!portfoliosLoading && filteredPortfolios.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPortfolios.map((portfolio) => {
            const investorName = getInvestorName(portfolio.owner_user_id);
            const investorType = getInvestorType(portfolio.owner_user_id);
            const twrSummary = twrSummaryMap.get(portfolio.portfolio_id);
            const totalNav = twrSummary?.total_nav ?? 0;
            const dayChange = twrSummary?.day_change ?? 0;
            const twrPct = twrSummary?.last_twr_pct ?? null;
            const lastDate = twrSummary?.last_date;
            const isDayPositive = dayChange >= 0;

            return (
              <Link
                key={portfolio.portfolio_id}
                to={`/portfolios/${portfolio.portfolio_id}`}
                className="block"
              >
                <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer">
                  {/* Header with name and badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{portfolio.name}</h3>
                      <p className="text-xs text-muted-foreground">{portfolio.interface_code}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {investorType}
                    </Badge>
                  </div>

                  {/* Value and Day Change */}
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-2xl font-bold mono text-foreground">
                      {formatCurrency(totalNav)}
                    </span>
                    <span className={`text-sm font-medium ${isDayPositive ? 'text-success' : 'text-destructive'}`}>
                      {isDayPositive ? '+' : ''}{formatCurrency(dayChange)}
                    </span>
                  </div>

                  {/* Investor Row */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-foreground truncate">{investorName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-foreground text-xs">
                        {lastDate ? new Date(lastDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* YTD Row */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-foreground">
                        {portfolio.inception_date ? new Date(portfolio.inception_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      {twrPct !== null ? (
                        <span className={`mono ${twrPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                          Last TWR: {twrPct >= 0 ? '+' : ''}{twrPct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="mono text-muted-foreground">Last TWR: N/A</span>
                      )}
                    </div>
                  </div>

                  {/* Currency, Benchmark and Status Badge */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {portfolio.main_currency} • S&P 500
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${portfolio.active_status
                        ? 'bg-success/20 text-success border-success/30'
                        : 'bg-warning/20 text-warning border-warning/30'
                        }`}
                    >
                      {portfolio.active_status ? 'Active' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!portfoliosLoading && filteredPortfolios.length > 0 && viewMode === 'list' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 border-b border-border text-sm font-medium text-muted-foreground">
            <div className="col-span-3">Portfolio</div>
            <div className="col-span-2">Investor</div>
            <button 
              onClick={() => handleSort('lastUpdate')} 
              className="col-span-2 flex items-center hover:text-foreground transition-colors cursor-pointer"
            >
              Last Update
              {getSortIcon('lastUpdate')}
            </button>
            <button 
              onClick={() => handleSort('totalValue')} 
              className="col-span-2 flex items-center justify-end hover:text-foreground transition-colors cursor-pointer"
            >
              Total Value
              {getSortIcon('totalValue')}
            </button>
            <button 
              onClick={() => handleSort('lastTwr')} 
              className="col-span-1 flex items-center justify-end hover:text-foreground transition-colors cursor-pointer"
            >
              Last TWR
              {getSortIcon('lastTwr')}
            </button>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-center">Type</div>
          </div>

          {/* List Rows */}
          {filteredPortfolios.map((portfolio) => {
            const twrSummary = twrSummaryMap.get(portfolio.portfolio_id);
            const totalNav = twrSummary?.total_nav ?? 0;
            const twrPct = twrSummary?.last_twr_pct ?? null;
            return (
              <Link
                key={portfolio.portfolio_id}
                to={`/portfolios/${portfolio.portfolio_id}`}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
              >
                <div className="col-span-3">
                  <p className="font-medium text-foreground">{portfolio.name}</p>
                  <p className="text-xs text-muted-foreground">{portfolio.interface_code}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-foreground">{getInvestorName(portfolio.owner_user_id)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">
                    {twrSummary?.last_date ? new Date(twrSummary.last_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <p className="font-mono font-medium text-foreground">
                    {formatCurrency(totalNav)}
                  </p>
                </div>
                <div className="col-span-1 text-right">
                  {twrPct !== null ? (
                    <span className={`font-mono ${twrPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {twrPct >= 0 ? '+' : ''}{twrPct.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="font-mono text-muted-foreground">N/A</span>
                  )}
                </div>
                <div className="col-span-1 text-center">
                  <Badge
                    variant="outline"
                    className={`text-xs ${portfolio.active_status
                      ? 'bg-success/20 text-success border-success/30'
                      : 'bg-muted/20 text-muted-foreground border-border'
                      }`}
                  >
                    {portfolio.active_status ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="col-span-1 text-center">
                  <Badge variant="outline" className="text-xs">
                    {getInvestorType(portfolio.owner_user_id)}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Portfolios;
