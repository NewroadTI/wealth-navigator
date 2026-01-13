import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PortfolioSummaryCard } from '@/components/dashboard/PortfolioSummaryCard';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { CashBalanceWidget } from '@/components/dashboard/CashBalanceWidget';
import { portfolios, dashboardStats, getPortfolioPositions } from '@/lib/mockData';
import { formatCurrency } from '@/lib/formatters';
import { Briefcase, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Dashboard = () => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');

  const filteredPortfolios = selectedPortfolio === 'all' 
    ? portfolios 
    : portfolios.filter(p => p.id === selectedPortfolio);

  const stats = selectedPortfolio === 'all' ? dashboardStats : {
    totalAUM: filteredPortfolios.reduce((sum, p) => sum + p.totalValue, 0),
    activePortfolios: filteredPortfolios.filter(p => p.status === 'Active').length,
    ytdReturn: filteredPortfolios[0]?.ytdReturn || 0,
    monthChange: filteredPortfolios.reduce((sum, p) => sum + p.dayChange * 30, 0),
    monthChangePercent: filteredPortfolios[0]?.dayChangePercent * 30 || 0,
    dayChangePercent: filteredPortfolios[0]?.dayChangePercent || 0,
  };

  return (
    <AppLayout title="Dashboard" subtitle="Welcome back to WealthRoad">
      {/* Portfolio Filter */}
      <div className="mb-6">
        <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
          <SelectTrigger className="w-72 bg-muted/50 border-border">
            <SelectValue placeholder="Filter by portfolio" />
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
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total AUM"
          value={stats.totalAUM}
          change={stats.dayChangePercent}
          changeLabel="vs yesterday"
          icon={DollarSign}
        />
        <MetricCard
          title="Active Portfolios"
          value={stats.activePortfolios}
          format="number"
          icon={Briefcase}
        />
        <MetricCard
          title="YTD Return"
          value={stats.ytdReturn}
          format="percent"
          icon={TrendingUp}
        />
        <MetricCard
          title="Monthly Change"
          value={stats.monthChange}
          change={stats.monthChangePercent}
          changeLabel="this month"
          icon={Activity}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Portfolios */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolios Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Portfolios</h2>
              <a href="/portfolios" className="text-sm text-primary hover:underline">
                View all
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPortfolios.slice(0, 4).map((portfolio) => (
                <PortfolioSummaryCard key={portfolio.id} portfolio={portfolio} />
              ))}
            </div>
          </div>

          {/* Performance Chart */}
          <PerformanceChart />
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <AllocationChart />
          <CashBalanceWidget />
          <RecentTransactions />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;