import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { portfolios, positions, performanceData } from '@/lib/mockData';
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Globe,
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

// API Types
interface TopMover {
  symbol: string;
  name: string;
  asset_id: number;
  change: number;
  change_percent: number;
  current_value: number;
  previous_value: number;
}

interface TopMoversResponse {
  gainers: TopMover[];
  losers: TopMover[];
  report_date: string;
  previous_date: string;
}

interface AllocationItem {
  name: string;
  value: number;
  percentage: number;
  color: string | null;
}

interface AllocationResponse {
  data: AllocationItem[];
  total_value: number;
  report_date: string;
}

// TWR Types
interface TWRSeriesPoint {
  date: string;
  twr: number;
  nav: number;
}

interface TWRStatusResponse {
  is_synced: boolean;
  last_complete_date: string | null;
  expected_date: string;
  missing_etl_jobs: string[];
  cutoff_date: string | null;
}

interface USDAccount {
  account_id: number;
  account_code: string;
  account_alias: string | null;
  currency: string;
  twr_cutoff_date: string | null;
  last_twr_date: string | null;
  last_twr_value: number | null;
  last_nav: number | null;
}

interface AccountTWRData {
  account: USDAccount;
  series: TWRSeriesPoint[];
}

const PortfolioPerformance = () => {
  const { id } = useParams();
  const apiBaseUrl = getApiBaseUrl();
  const portfolio = portfolios.find((p) => p.id === id) || portfolios[0];
  const portfolioPositions = positions.filter((p) => p.portfolioId === portfolio.id);
  const isPositive = portfolio.dayChange >= 0;

  // API Data States
  const [topMovers, setTopMovers] = useState<TopMoversResponse | null>(null);
  const [assetAllocation, setAssetAllocation] = useState<AllocationResponse | null>(null);
  const [sectorAllocation, setSectorAllocation] = useState<AllocationResponse | null>(null);
  const [countryAllocation, setCountryAllocation] = useState<AllocationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // TWR State
  const [accountsTWR, setAccountsTWR] = useState<AccountTWRData[]>([]);
  const [twrStatus, setTwrStatus] = useState<TWRStatusResponse | null>(null);
  const [twrLoading, setTwrLoading] = useState(true);

  // Load performance data
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const [moversRes, assetRes, sectorRes, countryRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/performance/top-movers/${id}?limit=3`),
          fetch(`${apiBaseUrl}/api/v1/performance/asset-allocation/${id}`),
          fetch(`${apiBaseUrl}/api/v1/performance/sector-allocation/${id}`),
          fetch(`${apiBaseUrl}/api/v1/performance/country-allocation/${id}`),
        ]);

        if (moversRes.ok) {
          const moversData = await moversRes.json();
          setTopMovers(moversData);
        }

        if (assetRes.ok) {
          const assetData = await assetRes.json();
          setAssetAllocation(assetData);
        }

        if (sectorRes.ok) {
          const sectorData = await sectorRes.json();
          setSectorAllocation(sectorData);
        }

        if (countryRes.ok) {
          const countryData = await countryRes.json();
          setCountryAllocation(countryData);
        }
      } catch (error) {
        console.error('Error loading performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPerformanceData();
  }, [id, apiBaseUrl]);

  // Load TWR data - fetch per-account series
  useEffect(() => {
    const loadTwrData = async () => {
      if (!id) return;
      setTwrLoading(true);
      try {
        // Fetch accounts list and status
        const [accountsRes, statusRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/twr/portfolio/${id}/accounts`),
          fetch(`${apiBaseUrl}/api/v1/twr/${id}/status`),
        ]);

        if (statusRes.ok) {
          setTwrStatus(await statusRes.json());
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          const accounts: USDAccount[] = accountsData.accounts || [];

          // Fetch series for each account
          const accountsWithSeries = await Promise.all(
            accounts.map(async (account) => {
              try {
                const seriesRes = await fetch(`${apiBaseUrl}/api/v1/twr/account/${account.account_id}/series`);
                if (seriesRes.ok) {
                  const seriesData = await seriesRes.json();
                  return {
                    account,
                    series: seriesData.data || [],
                  };
                }
              } catch (error) {
                console.error(`Error loading TWR for account ${account.account_code}:`, error);
              }
              return {
                account,
                series: [],
              };
            })
          );

          setAccountsTWR(accountsWithSeries);
        }
      } catch (error) {
        console.error('Error loading TWR data:', error);
      } finally {
        setTwrLoading(false);
      }
    };
    loadTwrData();
  }, [id, apiBaseUrl]);

  const AllocationPieChart = ({ 
    data, 
    title, 
    icon: Icon,
    loading 
  }: { 
    data: AllocationResponse | null; 
    title: string; 
    icon: React.ElementType;
    loading: boolean;
  }) => {
    if (loading) {
      return (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="text-sm md:text-base font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (!data || data.data.length === 0) {
      return (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="text-sm md:text-base font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No data available
          </div>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          <h3 className="text-sm md:text-base font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={180}>
            <RechartsPie>
              <Pie
                data={data.data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="percentage"
              >
                {data.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || 'hsl(220, 82%, 44%)'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 13%)',
                  border: '1px solid hsl(222, 35%, 22%)',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
              />
            </RechartsPie>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center md:flex-col md:gap-1.5">
            {data.data.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || 'hsl(220, 82%, 44%)' }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium text-foreground">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const GainersLosersCard = ({ 
    title, 
    items, 
    isGainer,
    loading 
  }: { 
    title: string; 
    items: TopMover[]; 
    isGainer: boolean;
    loading: boolean;
  }) => {
    if (loading) {
      return (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            {isGainer ? (
              <TrendingUp className="h-4 w-4 text-gain" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
          </div>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            {isGainer ? (
              <TrendingUp className="h-4 w-4 text-gain" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
          </div>
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No data available
          </div>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          {isGainer ? (
            <TrendingUp className="h-4 w-4 text-gain" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.asset_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{item.symbol}</p>
                <p className="text-xs text-muted-foreground">{item.name}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-medium mono', getChangeColor(item.change))}>
                  {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
                </p>
                <p className={cn('text-xs mono', getChangeColor(item.change_percent))}>
                  {item.change_percent > 0 ? '+' : ''}{item.change_percent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppLayout title={`${portfolio.name} - Performance`} subtitle={`Detailed analytics for ${portfolio.interfaceCode}`}>
      {/* Back to Portfolio Link */}
      <div className="mb-4">
        <Link to={`/portfolios/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Button>
        </Link>
      </div>

      {/* Header Summary */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg md:text-2xl font-bold mono text-foreground">
              {formatCurrency(portfolio.totalValue)}
            </p>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Day Change</p>
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-gain" />
              ) : (
                <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-loss" />
              )}
              <div>
                <p className={cn('text-sm md:text-lg font-semibold mono', getChangeColor(portfolio.dayChange))}>
                  {isPositive ? '+' : ''}{formatCurrency(portfolio.dayChange)}
                </p>
                <p className={cn('text-xs mono', getChangeColor(portfolio.dayChangePercent))}>
                  ({isPositive ? '+' : ''}{formatPercent(portfolio.dayChangePercent)})
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">YTD Return</p>
            <p className={cn('text-lg md:text-2xl font-bold mono', getChangeColor(portfolio.ytdReturn))}>
              {portfolio.ytdReturn > 0 ? '+' : ''}{formatPercent(portfolio.ytdReturn)}
            </p>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Positions</p>
            <p className="text-lg md:text-2xl font-bold text-foreground">
              {portfolioPositions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm md:text-base font-semibold text-foreground">Portfolio Evolution</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Portfolio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-muted-foreground">{portfolio.benchmark}</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 35%, 18%)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(38, 20%, 55%)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(38, 20%, 55%)' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 13%)',
                border: '1px solid hsl(222, 35%, 22%)',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: 'hsl(38, 30%, 95%)', marginBottom: '4px' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="hsl(220, 82%, 44%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(220, 82%, 44%)' }}
              name="Portfolio"
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="hsl(38, 70%, 55%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(38, 70%, 55%)' }}
              name="Benchmark"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TWR (Time-Weighted Return) - Per-Account Charts */}
      <div className="space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-base md:text-lg font-semibold text-foreground">
              Time-Weighted Return (TWR)
            </h3>
            {twrStatus && (
              <Badge
                variant={twrStatus.is_synced ? 'default' : 'destructive'}
                className={cn(
                  'text-xs gap-1',
                  twrStatus.is_synced
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : ''
                )}
              >
                {twrStatus.is_synced ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {twrStatus.is_synced ? 'Synced' : 'Needs Update'}
              </Badge>
            )}
          </div>
        </div>

        {twrLoading ? (
          <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accountsTWR.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-sm text-muted-foreground">No TWR data available yet.</p>
          </div>
        ) : (
          accountsTWR.map(({ account, series }) => (
            <div key={account.account_id} className="bg-card border border-border rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm md:text-base font-semibold text-foreground mono">
                    {account.account_code}
                  </h4>
                  {account.account_alias && (
                    <p className="text-xs text-muted-foreground">{account.account_alias}</p>
                  )}
                </div>
                <Link to={`/portfolios/${id}/performance-configuration?account=${account.account_id}`}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Settings2 className="h-3 w-3" />
                    Configure
                  </Button>
                </Link>
              </div>

              {series.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <p className="text-sm text-muted-foreground">No data for this account yet.</p>
                </div>
              ) : (
                <>
                  {/* TWR summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current TWR</p>
                      <p
                        className={cn(
                          'text-lg font-bold mono',
                          series[series.length - 1].twr >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {series[series.length - 1].twr >= 0 ? '+' : ''}
                        {series[series.length - 1].twr.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Latest NAV</p>
                      <p className="text-lg font-bold mono text-foreground">
                        ${series[series.length - 1].nav.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Since</p>
                      <p className="text-sm font-medium text-foreground">
                        {account.twr_cutoff_date || series[0]?.date || '—'}
                      </p>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 35%, 18%)" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(38, 20%, 55%)' }}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(38, 20%, 55%)' }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(222, 47%, 13%)',
                          border: '1px solid hsl(222, 35%, 22%)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                        }}
                        labelStyle={{ color: 'hsl(38, 30%, 95%)', marginBottom: '4px' }}
                        formatter={(value: number, name: string) => {
                          if (name === 'twr') return [`${value.toFixed(2)}%`, 'TWR'];
                          return [`$${value.toLocaleString()}`, 'NAV'];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="twr"
                        stroke="hsl(142, 70%, 45%)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'hsl(142, 70%, 45%)' }}
                        name="twr"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Gainers/Losers Tabs */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm md:text-base font-semibold text-foreground">Top Performers</h3>
          {topMovers && topMovers.report_date && (
            <span className="text-xs text-muted-foreground">
              Based on last 2 report dates: {topMovers.previous_date} → {topMovers.report_date}
            </span>
          )}
        </div>
        <Tabs defaultValue="day" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="day" className="text-xs data-[state=active]:bg-card">Latest Period</TabsTrigger>
          </TabsList>

          <TabsContent value="day">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GainersLosersCard
                title="Top Gainers"
                items={topMovers?.gainers || []}
                isGainer={true}
                loading={loading}
              />
              <GainersLosersCard
                title="Top Losers"
                items={topMovers?.losers || []}
                isGainer={false}
                loading={loading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <AllocationPieChart 
          data={assetAllocation} 
          title="Asset Allocation" 
          icon={PieChart}
          loading={loading}
        />
        <AllocationPieChart 
          data={sectorAllocation} 
          title="Sector Allocation" 
          icon={Building2}
          loading={loading}
        />
        <AllocationPieChart 
          data={countryAllocation} 
          title="Country Allocation" 
          icon={Globe}
          loading={loading}
        />
      </div>
    </AppLayout>
  );
};

export default PortfolioPerformance;
