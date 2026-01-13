import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PortfolioSummaryCard } from '@/components/dashboard/PortfolioSummaryCard';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { CashBalanceWidget } from '@/components/dashboard/CashBalanceWidget';
import { portfolios, dashboardStats } from '@/lib/mockData';
import { formatCompactNumber } from '@/lib/formatters';
import { Briefcase, TrendingUp, DollarSign, Activity } from 'lucide-react';

const Dashboard = () => {
  return (
    <AppLayout title="Dashboard" subtitle="Welcome back to WealthRoad">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total AUM"
          value={dashboardStats.totalAUM}
          change={dashboardStats.dayChangePercent}
          changeLabel="vs yesterday"
          icon={DollarSign}
        />
        <MetricCard
          title="Active Portfolios"
          value={dashboardStats.activePortfolios}
          format="number"
          icon={Briefcase}
        />
        <MetricCard
          title="YTD Return"
          value={dashboardStats.ytdReturn}
          format="percent"
          icon={TrendingUp}
        />
        <MetricCard
          title="Monthly Change"
          value={dashboardStats.monthChange}
          change={dashboardStats.monthChangePercent}
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
              {portfolios.slice(0, 4).map((portfolio) => (
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
