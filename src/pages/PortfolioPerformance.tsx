import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { portfolios, positions, performanceData } from '@/lib/mockData';
import { formatCurrency, formatPercent, getChangeColor } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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

// Mock allocation data
const assetAllocationData = [
  { name: 'Equity', value: 55, color: 'hsl(220, 82%, 44%)' },
  { name: 'Fixed Income', value: 25, color: 'hsl(38, 70%, 55%)' },
  { name: 'Funds', value: 15, color: 'hsl(142, 70%, 45%)' },
  { name: 'Cash', value: 5, color: 'hsl(220, 14%, 55%)' },
];

const sectorAllocationData = [
  { name: 'Technology', value: 35, color: 'hsl(220, 82%, 44%)' },
  { name: 'Healthcare', value: 18, color: 'hsl(142, 70%, 45%)' },
  { name: 'Financial', value: 15, color: 'hsl(38, 70%, 55%)' },
  { name: 'Consumer', value: 12, color: 'hsl(280, 60%, 55%)' },
  { name: 'Industrial', value: 10, color: 'hsl(200, 70%, 50%)' },
  { name: 'Other', value: 10, color: 'hsl(220, 14%, 55%)' },
];

const countryAllocationData = [
  { name: 'USA', value: 65, color: 'hsl(220, 82%, 44%)' },
  { name: 'Europe', value: 20, color: 'hsl(38, 70%, 55%)' },
  { name: 'Asia', value: 10, color: 'hsl(142, 70%, 45%)' },
  { name: 'Other', value: 5, color: 'hsl(220, 14%, 55%)' },
];

// Mock gainers/losers
const mockGainersLosers = {
  day: {
    gainers: [
      { symbol: 'NVDA', name: 'NVIDIA', change: 5.23, changePercent: 2.15 },
      { symbol: 'AAPL', name: 'Apple', change: 2.34, changePercent: 1.25 },
      { symbol: 'MSFT', name: 'Microsoft', change: 1.89, changePercent: 0.52 },
    ],
    losers: [
      { symbol: 'TSLA', name: 'Tesla', change: -5.23, changePercent: -2.57 },
      { symbol: 'AMD', name: 'AMD', change: -2.45, changePercent: -1.35 },
      { symbol: 'AMZN', name: 'Amazon', change: -1.12, changePercent: -0.65 },
    ],
  },
  week: {
    gainers: [
      { symbol: 'NVDA', name: 'NVIDIA', change: 45.67, changePercent: 5.45 },
      { symbol: 'AMD', name: 'AMD', change: 12.34, changePercent: 3.21 },
      { symbol: 'AAPL', name: 'Apple', change: 8.90, changePercent: 2.12 },
    ],
    losers: [
      { symbol: 'TSLA', name: 'Tesla', change: -15.23, changePercent: -7.25 },
      { symbol: 'META', name: 'Meta', change: -8.45, changePercent: -2.35 },
      { symbol: 'GOOGL', name: 'Google', change: -5.12, changePercent: -1.25 },
    ],
  },
  month: {
    gainers: [
      { symbol: 'NVDA', name: 'NVIDIA', change: 125.67, changePercent: 15.45 },
      { symbol: 'AMD', name: 'AMD', change: 45.34, changePercent: 12.21 },
      { symbol: 'MSFT', name: 'Microsoft', change: 28.90, changePercent: 8.12 },
    ],
    losers: [
      { symbol: 'TSLA', name: 'Tesla', change: -35.23, changePercent: -15.25 },
      { symbol: 'INTC', name: 'Intel', change: -12.45, changePercent: -8.35 },
      { symbol: 'DIS', name: 'Disney', change: -8.12, changePercent: -5.25 },
    ],
  },
};

const PortfolioPerformance = () => {
  const { id } = useParams();
  const portfolio = portfolios.find((p) => p.id === id) || portfolios[0];
  const portfolioPositions = positions.filter((p) => p.portfolioId === portfolio.id);
  const isPositive = portfolio.dayChange >= 0;

  const AllocationPieChart = ({ data, title, icon: Icon }: { data: typeof assetAllocationData; title: string; icon: React.ElementType }) => (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        <h3 className="text-sm md:text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <ResponsiveContainer width="100%" height={180}>
          <RechartsPie>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 13%)',
                border: '1px solid hsl(222, 35%, 22%)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value}%`, '']}
            />
          </RechartsPie>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 justify-center md:flex-col md:gap-1.5">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium text-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const GainersLosersCard = ({ title, items, isGainer }: { title: string; items: typeof mockGainersLosers.day.gainers; isGainer: boolean }) => (
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
          <div key={item.symbol} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{item.symbol}</p>
              <p className="text-xs text-muted-foreground">{item.name}</p>
            </div>
            <div className="text-right">
              <p className={cn('text-sm font-medium mono', getChangeColor(item.change))}>
                {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
              </p>
              <p className={cn('text-xs mono', getChangeColor(item.changePercent))}>
                {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout title={`${portfolio.name} - Performance`} subtitle={`Detailed analytics for ${portfolio.interfaceCode}`}>
      {/* Back to Portfolio Link */}
      <div className="mb-4">
        <Link to={`/portfolios/${portfolio.id}`}>
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

      {/* Gainers/Losers Tabs */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <h3 className="text-sm md:text-base font-semibold text-foreground mb-4">Top Performers</h3>
        <Tabs defaultValue="day" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="day" className="text-xs data-[state=active]:bg-card">Day</TabsTrigger>
            <TabsTrigger value="week" className="text-xs data-[state=active]:bg-card">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs data-[state=active]:bg-card">Month</TabsTrigger>
          </TabsList>

          {(['day', 'week', 'month'] as const).map((period) => (
            <TabsContent key={period} value={period}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GainersLosersCard
                  title="Top Gainers"
                  items={mockGainersLosers[period].gainers}
                  isGainer={true}
                />
                <GainersLosersCard
                  title="Top Losers"
                  items={mockGainersLosers[period].losers}
                  isGainer={false}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <AllocationPieChart data={assetAllocationData} title="Asset Allocation" icon={PieChart} />
        <AllocationPieChart data={sectorAllocationData} title="Sector Allocation" icon={Building2} />
        <AllocationPieChart data={countryAllocationData} title="Country Allocation" icon={Globe} />
      </div>
    </AppLayout>
  );
};

export default PortfolioPerformance;
