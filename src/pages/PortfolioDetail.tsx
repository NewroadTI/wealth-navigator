import { useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PositionsTable } from '@/components/positions/PositionsTable';
import { portfolios, positions } from '@/lib/mockData';
import { formatCurrency, formatPercent, formatDate, getChangeColor } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
  Settings,
  TrendingUp,
  Wallet,
  ArrowLeftRight,
  PieChart,
} from 'lucide-react';

const PortfolioDetail = () => {
  const { id } = useParams();
  const portfolio = portfolios.find((p) => p.id === id) || portfolios[0];
  const isPositive = portfolio.dayChange >= 0;

  return (
    <AppLayout title={portfolio.name} subtitle={`Portfolio ${portfolio.interfaceCode}`}>
      {/* Header Section */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">{portfolio.name}</h1>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  portfolio.status === 'Active' && 'status-active',
                  portfolio.status === 'Pending' && 'status-pending'
                )}
              >
                {portfolio.status}
              </Badge>
              <Badge variant="outline" className="text-xs bg-secondary/50">
                {portfolio.processingType} Processing
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {portfolio.investor.name} • {portfolio.investor.type} • {portfolio.investor.riskLevel} Risk
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
            <Button variant="outline" size="sm" className="border-border">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="border-border">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Value</p>
            <p className="text-2xl font-bold mono text-foreground">
              {formatCurrency(portfolio.totalValue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Day Change</p>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <ArrowUpRight className="h-5 w-5 text-gain" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-loss" />
              )}
              <div>
                <p className={cn('text-lg font-semibold mono', getChangeColor(portfolio.dayChange))}>
                  {isPositive ? '+' : ''}{formatCurrency(portfolio.dayChange)}
                </p>
                <p className={cn('text-sm mono', getChangeColor(portfolio.dayChangePercent))}>
                  ({isPositive ? '+' : ''}{formatPercent(portfolio.dayChangePercent)})
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">YTD Return</p>
            <p className={cn('text-2xl font-bold mono', getChangeColor(portfolio.ytdReturn))}>
              {portfolio.ytdReturn > 0 ? '+' : ''}{formatPercent(portfolio.ytdReturn)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Inception</p>
            <p className="text-lg font-semibold text-foreground">
              {formatDate(portfolio.inceptionDate)}
            </p>
            <p className="text-sm text-muted-foreground">Benchmark: {portfolio.benchmark}</p>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="positions" className="data-[state=active]:bg-card">
            <TrendingUp className="h-4 w-4 mr-2" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-card">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="allocation" className="data-[state=active]:bg-card">
            <PieChart className="h-4 w-4 mr-2" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="cash" className="data-[state=active]:bg-card">
            <Wallet className="h-4 w-4 mr-2" />
            Cash & FX
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Holdings</h3>
              <span className="text-sm text-muted-foreground">
                {positions.length} positions
              </span>
            </div>
            <PositionsTable positions={positions} />
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Transaction History</h3>
            <p className="text-muted-foreground">View all transactions for this portfolio</p>
          </div>
        </TabsContent>

        <TabsContent value="allocation">
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Asset Allocation</h3>
            <p className="text-muted-foreground">Detailed breakdown of portfolio allocation</p>
          </div>
        </TabsContent>

        <TabsContent value="cash">
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Cash & Currency</h3>
            <p className="text-muted-foreground">Cash balances and FX positions</p>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default PortfolioDetail;
