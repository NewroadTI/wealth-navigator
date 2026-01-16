import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { portfolios, positions, transactions } from '@/lib/mockData';
import { formatCurrency, formatPercent, getChangeColor, formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Calculate top gainers/losers from all positions
const getTopMovers = (type: 'gainers' | 'losers') => {
  const sorted = [...positions].sort((a, b) => 
    type === 'gainers' 
      ? b.dayChangePercent - a.dayChangePercent 
      : a.dayChangePercent - b.dayChangePercent
  );
  return sorted.slice(0, 5);
};

// Get important transactions (dividends, interest, large deposits)
const getImportantTransactions = () => {
  return transactions
    .filter(t => ['Dividend', 'Interest', 'Deposit'].includes(t.type) || Math.abs(t.amount) > 10000)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
};

// Mock performance data for all accounts
const allAccountsPerformance = [
  { month: 'Jul', portfolio: 0, benchmark: 0 },
  { month: 'Aug', portfolio: 2.1, benchmark: 1.8 },
  { month: 'Sep', portfolio: 3.5, benchmark: 3.2 },
  { month: 'Oct', portfolio: 5.2, benchmark: 4.5 },
  { month: 'Nov', portfolio: 7.8, benchmark: 6.2 },
  { month: 'Dec', portfolio: 8.9, benchmark: 7.1 },
  { month: 'Jan', portfolio: 10.5, benchmark: 8.5 },
];

// Mock cash balances by sub-account
const cashBalancesByAccount = [
  { account: 'IB-001 (USD)', currency: 'USD', balance: 234567.89, portfolio: 'Global Growth' },
  { account: 'IB-002 (EUR)', currency: 'EUR', balance: 45678.90, portfolio: 'Global Growth' },
  { account: 'JPM-001', currency: 'USD', balance: 50000.00, portfolio: 'Global Growth' },
  { account: 'PSH-001', currency: 'USD', balance: 523489.12, portfolio: 'Conservative Income' },
  { account: 'UBS-001 (CHF)', currency: 'CHF', balance: 125000.00, portfolio: 'Conservative Income' },
  { account: 'IB-003', currency: 'USD', balance: 152345.67, portfolio: 'Tech Opportunities' },
];

const Dashboard = () => {
  const location = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('day');
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');

  // Calculate totals
  const totalAUM = portfolios.reduce((sum, p) => sum + p.totalValue, 0);
  const totalDayChange = portfolios.reduce((sum, p) => sum + p.dayChange, 0);
  const totalDayChangePercent = (totalDayChange / (totalAUM - totalDayChange)) * 100;
  const avgYTDReturn = portfolios.reduce((sum, p) => sum + p.ytdReturn, 0) / portfolios.length;

  const topGainers = useMemo(() => getTopMovers('gainers'), []);
  const topLosers = useMemo(() => getTopMovers('losers'), []);
  const importantTransactions = useMemo(() => getImportantTransactions(), []);

  // Sort portfolios by total value
  const sortedPortfolios = useMemo(() => 
    [...portfolios].sort((a, b) => b.totalValue - a.totalValue),
  []);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return importantTransactions.filter(t => {
      if (txnTypeFilter !== 'all' && t.type !== txnTypeFilter) return false;
      if (minAmount && Math.abs(t.amount) < parseFloat(minAmount)) return false;
      return true;
    });
  }, [importantTransactions, txnTypeFilter, minAmount]);

  // Build filter string for saving
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (txnTypeFilter !== 'all') params.set('txnType', txnTypeFilter);
    if (minAmount) params.set('minAmount', minAmount);
    return params.toString();
  }, [txnTypeFilter, minAmount]);

  const filterTitle = useMemo(() => {
    const parts = ['Dashboard'];
    if (txnTypeFilter !== 'all') parts.push(txnTypeFilter);
    if (minAmount) parts.push(`>${minAmount}`);
    return parts.join(' - ');
  }, [txnTypeFilter, minAmount]);

  return (
    <AppLayout title="Dashboard" subtitle="Overview of all portfolios and key metrics">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Total AUM</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="text-lg md:text-2xl font-bold mono text-foreground">
            {formatCurrency(totalAUM)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {totalDayChange >= 0 ? (
              <ArrowUpRight className="h-3 w-3 text-gain" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-loss" />
            )}
            <span className={cn('text-xs mono', getChangeColor(totalDayChange))}>
              {formatCurrency(totalDayChange)} today
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Active Portfolios</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-lg md:text-2xl font-bold text-foreground">
            {portfolios.filter(p => p.status === 'Active').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            of {portfolios.length} total
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Avg YTD Return</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className={cn('text-lg md:text-2xl font-bold mono', getChangeColor(avgYTDReturn))}>
            {avgYTDReturn > 0 ? '+' : ''}{formatPercent(avgYTDReturn)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">across all portfolios</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Day Change</span>
            {totalDayChangePercent >= 0 ? (
              <TrendingUp className="h-4 w-4 text-gain" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </div>
          <p className={cn('text-lg md:text-2xl font-bold mono', getChangeColor(totalDayChangePercent))}>
            {totalDayChangePercent > 0 ? '+' : ''}{totalDayChangePercent.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">consolidated</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Charts & Portfolios */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Performance vs Benchmark */}
          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Performance vs Benchmark (All Accounts)
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Portfolio</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Benchmark</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={allAccountsPerformance}>
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
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  stroke="hsl(220, 82%, 44%)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="hsl(38, 70%, 55%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Portfolios by Volume */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border">
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Portfolios by Volume
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">Portfolio</th>
                    <th className="text-xs">Client</th>
                    <th className="text-xs text-right">Value</th>
                    <th className="text-xs text-right hidden sm:table-cell">Day Change</th>
                    <th className="text-xs text-right hidden md:table-cell">YTD</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPortfolios.map((portfolio) => (
                    <tr key={portfolio.id}>
                      <td className="font-medium text-foreground text-xs md:text-sm">{portfolio.name}</td>
                      <td className="text-muted-foreground text-xs">{portfolio.investor.name}</td>
                      <td className="font-medium mono text-foreground text-xs md:text-sm text-right">
                        {formatCurrency(portfolio.totalValue)}
                      </td>
                      <td className={cn('mono text-xs text-right hidden sm:table-cell', getChangeColor(portfolio.dayChange))}>
                        {portfolio.dayChange > 0 ? '+' : ''}{formatPercent(portfolio.dayChangePercent)}
                      </td>
                      <td className={cn('mono text-xs text-right hidden md:table-cell', getChangeColor(portfolio.ytdReturn))}>
                        {portfolio.ytdReturn > 0 ? '+' : ''}{formatPercent(portfolio.ytdReturn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Important Transactions */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Recent Important Transactions
              </h3>
              <div className="flex items-center gap-2">
                <Select value={txnTypeFilter} onValueChange={setTxnTypeFilter}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Dividend">Dividend</SelectItem>
                    <SelectItem value="Interest">Interest</SelectItem>
                    <SelectItem value="Deposit">Deposit</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Min $"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="h-7 w-20 text-xs"
                />
                <SaveFilterButton
                  currentPath={location.pathname}
                  currentFilters={currentFilters}
                  defaultTitle={filterTitle}
                  className="h-7"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-xs">Date</th>
                    <th className="text-xs">Type</th>
                    <th className="text-xs hidden sm:table-cell">Description</th>
                    <th className="text-xs text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id}>
                      <td className="text-xs text-muted-foreground">{formatDate(txn.date)}</td>
                      <td>
                        <Badge variant="outline" className="text-[10px]">
                          {txn.type}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                        {txn.description}
                      </td>
                      <td className={cn('font-medium mono text-xs text-right', txn.amount >= 0 ? 'text-gain' : 'text-loss')}>
                        {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-4 md:space-y-6">
          {/* Top Gainers/Losers */}
          <div className="bg-card border border-border rounded-xl p-4">
            <Tabs defaultValue="gainers" className="space-y-3">
              <TabsList className="bg-muted/50 p-1 w-full">
                <TabsTrigger value="gainers" className="flex-1 text-xs data-[state=active]:bg-card">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Gainers
                </TabsTrigger>
                <TabsTrigger value="losers" className="flex-1 text-xs data-[state=active]:bg-card">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Losers
                </TabsTrigger>
              </TabsList>

              <TabsContent value="gainers" className="space-y-2">
                {topGainers.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pos.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{pos.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium mono text-gain">
                        +{formatPercent(pos.dayChangePercent)}
                      </p>
                      <p className="text-xs mono text-gain">
                        +{formatCurrency(pos.dayChange)}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="losers" className="space-y-2">
                {topLosers.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pos.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{pos.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium mono text-loss">
                        {formatPercent(pos.dayChangePercent)}
                      </p>
                      <p className="text-xs mono text-loss">
                        {formatCurrency(pos.dayChange)}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* Cash Balances by Sub-Account */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Cash by Sub-Account</h3>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {cashBalancesByAccount.map((acc, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{acc.account}</p>
                    <p className="text-[10px] text-muted-foreground">{acc.portfolio}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium mono text-foreground">
                      {acc.currency} {acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
