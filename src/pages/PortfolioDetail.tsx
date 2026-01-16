import { useParams, Link } from 'react-router-dom';
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
  LineChart,
  Edit,
  Trash2,
} from 'lucide-react';

const PortfolioDetail = () => {
  const { id } = useParams();
  const portfolio = portfolios.find((p) => p.id === id) || portfolios[0];
  const portfolioPositions = positions.filter((p) => p.portfolioId === portfolio.id);
  const isPositive = portfolio.dayChange >= 0;

  return (
    <AppLayout title={portfolio.name} subtitle={`Portfolio ${portfolio.interfaceCode}`}>
      {/* Header Section */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
              <h1 className="text-lg md:text-2xl font-bold text-foreground">{portfolio.name}</h1>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] md:text-xs',
                  portfolio.status === 'Active' && 'status-active',
                  portfolio.status === 'Pending' && 'status-pending'
                )}
              >
                {portfolio.status}
              </Badge>
              <Badge variant="outline" className="text-[10px] md:text-xs bg-secondary/50">
                {portfolio.processingType} Processing
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {portfolio.investor.name} • {portfolio.investor.type} • {portfolio.investor.riskLevel} Risk
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/portfolios/${portfolio.id}/performance`}>
              <Button variant="default" size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                <LineChart className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                Performance
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <Edit className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border">
              <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg md:text-2xl font-bold mono text-foreground">
              {formatCurrency(portfolio.totalValue)}
            </p>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Day Change</p>
            <div className="flex items-center gap-1.5 md:gap-2">
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
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Inception</p>
            <p className="text-sm md:text-lg font-semibold text-foreground">
              {formatDate(portfolio.inceptionDate)}
            </p>
            <p className="text-xs text-muted-foreground">Benchmark: {portfolio.benchmark}</p>
          </div>
        </div>
      </div>

      {/* Investor Info Card */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
        <h3 className="text-sm md:text-base font-semibold text-foreground mb-3">Investor Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-medium text-foreground">{portfolio.investor.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-medium text-foreground">{portfolio.investor.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Risk Level</p>
            <Badge variant="outline" className="text-xs mt-1">{portfolio.investor.riskLevel}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client Since</p>
            <p className="text-sm font-medium text-foreground">{portfolio.investor.clientSince || 'N/A'}</p>
          </div>
          {portfolio.investor.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{portfolio.investor.email}</p>
            </div>
          )}
          {portfolio.investor.phone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium text-foreground">{portfolio.investor.phone}</p>
            </div>
          )}
          {portfolio.investor.taxId && (
            <div>
              <p className="text-xs text-muted-foreground">Tax ID</p>
              <p className="text-sm font-medium text-foreground mono">{portfolio.investor.taxId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm md:text-base">Linked Accounts</h3>
          <Button variant="outline" size="sm" className="text-xs">
            Add Account
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-xs">Institution</th>
                <th className="text-xs">Account</th>
                <th className="text-xs hidden sm:table-cell">Type</th>
                <th className="text-xs hidden md:table-cell">Currency</th>
                <th className="text-xs text-right">Balance</th>
                <th className="text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.accounts.map((account) => (
                <tr key={account.id}>
                  <td className="font-medium text-foreground text-xs md:text-sm">{account.institution}</td>
                  <td className="text-foreground text-xs md:text-sm">{account.accountName}</td>
                  <td className="text-muted-foreground text-xs hidden sm:table-cell">{account.accountType}</td>
                  <td className="text-muted-foreground text-xs hidden md:table-cell">{account.currency}</td>
                  <td className="font-medium mono text-foreground text-xs md:text-sm text-right">
                    {formatCurrency(account.balance)}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="positions" className="text-xs md:text-sm data-[state=active]:bg-card">
            <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs md:text-sm data-[state=active]:bg-card">
            <ArrowLeftRight className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="allocation" className="text-xs md:text-sm data-[state=active]:bg-card">
            <PieChart className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="cash" className="text-xs md:text-sm data-[state=active]:bg-card">
            <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
            Cash
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Holdings</h3>
              <span className="text-xs text-muted-foreground">
                {portfolioPositions.length} positions
              </span>
            </div>
            <PositionsTable positions={portfolioPositions} />
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <ArrowLeftRight className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2 text-sm md:text-base">Transaction History</h3>
            <p className="text-muted-foreground text-xs md:text-sm">View all transactions for this portfolio</p>
            <Link to={`/transactions?portfolio=${portfolio.id}`}>
              <Button variant="outline" size="sm" className="mt-4 text-xs">
                View All Transactions
              </Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="allocation">
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <PieChart className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2 text-sm md:text-base">Asset Allocation</h3>
            <p className="text-muted-foreground text-xs md:text-sm">Detailed breakdown of portfolio allocation</p>
            <Link to={`/portfolios/${portfolio.id}/performance`}>
              <Button variant="outline" size="sm" className="mt-4 text-xs">
                View Performance & Allocation
              </Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="cash">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm md:text-base">Cash Balances</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolio.accounts.map((account) => (
                  <div key={account.id} className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">{account.institution}</p>
                    <p className="text-sm font-medium text-foreground">{account.accountName}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{account.currency}</span>
                      <span className="text-lg font-semibold mono text-foreground">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default PortfolioDetail;
