import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PositionsTable } from '@/components/positions/PositionsTable';
import { positions } from '@/lib/mockData';
import { formatCurrency, formatPercent, formatDate, getChangeColor } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  Trash2,
} from 'lucide-react';

// Types
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

type UserApi = {
  user_id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  tax_id: string | null;
  entity_type: string | null;
  created_at: string;
};

type CountryApi = {
  iso_code: string;
  name: string | null;
};

const PortfolioDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  // State
  const [portfolio, setPortfolio] = useState<PortfolioApi | null>(null);
  const [investor, setInvestor] = useState<UserApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryApi[]>([]);

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    residence_country: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load portfolio data
  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/v1/portfolios/${id}`);
        if (!response.ok) throw new Error('Failed to load portfolio');
        const data = await response.json();
        setPortfolio(data);

        // Load investor data
        if (data.owner_user_id) {
          const userResponse = await fetch(`${apiBaseUrl}/api/v1/users/${data.owner_user_id}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setInvestor(userData);
          }
        }

        // Set edit form defaults
        setEditForm({
          name: data.name || '',
          residence_country: data.residence_country || '',
        });
      } catch (error) {
        console.error('Error loading portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPortfolio();
    }
  }, [id, apiBaseUrl]);

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/countries`);
        if (response.ok) {
          const data = await response.json();
          setCountries(data);
        }
      } catch (error) {
        console.error('Error loading countries:', error);
      }
    };
    loadCountries();
  }, [apiBaseUrl]);

  // Handle edit portfolio
  const handleEditPortfolio = async () => {
    if (!portfolio) return;

    try {
      setEditLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/portfolios/${portfolio.portfolio_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          residence_country: editForm.residence_country || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const updated = await response.json();
      setPortfolio(updated);
      setIsEditOpen(false);

      toast({
        title: 'Portfolio updated',
        description: `Portfolio "${updated.name}" has been updated successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating portfolio',
        description: error.message || 'Could not update portfolio.',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete portfolio
  const handleDeletePortfolio = async () => {
    if (!portfolio) return;

    try {
      setDeleteLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/portfolios/${portfolio.portfolio_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      toast({
        title: 'Portfolio deleted',
        description: `Portfolio "${portfolio.name}" has been deleted successfully.`,
        variant: 'success',
      });

      // Redirect to portfolios list
      window.location.href = '/portfolios';
    } catch (error: any) {
      toast({
        title: 'Error deleting portfolio',
        description: error.message || 'Could not delete portfolio.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
      setIsDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Loading..." subtitle="Please wait">
        <div className="text-center py-12 text-muted-foreground">Loading portfolio...</div>
      </AppLayout>
    );
  }

  if (!portfolio) {
    return (
      <AppLayout title="Not Found" subtitle="Portfolio not found">
        <div className="text-center py-12 text-muted-foreground">
          Portfolio not found. <Link to="/portfolios" className="text-primary underline">Go back to portfolios</Link>
        </div>
      </AppLayout>
    );
  }

  const isPositive = true; // Mockup
  const portfolioPositions = positions.slice(0, 5); // Mockup positions

  return (
    <AppLayout title={portfolio.name} subtitle={`Portfolio ${portfolio.interface_code}`}>
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
                  portfolio.active_status && 'status-active',
                  !portfolio.active_status && 'status-pending'
                )}
              >
                {portfolio.active_status ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="text-[10px] md:text-xs bg-secondary/50">
                {investor?.entity_type || 'Individual'}
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {investor?.full_name || investor?.username || 'Unknown'} • {investor?.entity_type || 'Individual'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/portfolios/${portfolio.portfolio_id}/performance`}>
              <Button variant="default" size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                <LineChart className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                Performance
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => setIsEditOpen(true)}>
              <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg md:text-2xl font-bold mono text-foreground">
              {formatCurrency(2847532.45)}
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
                <p className={cn('text-sm md:text-lg font-semibold mono', getChangeColor(12500))}>
                  +{formatCurrency(12500)}
                </p>
                <p className={cn('text-xs mono', getChangeColor(0.44))}>
                  (+{formatPercent(0.0044)})
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">YTD Return</p>
            <p className={cn('text-lg md:text-2xl font-bold mono', getChangeColor(0.0872))}>
              +{formatPercent(0.0872)}
            </p>
          </div>
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Inception</p>
            <p className="text-sm md:text-lg font-semibold text-foreground">
              {portfolio.inception_date ? formatDate(portfolio.inception_date) : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Benchmark: S&P 500</p>
          </div>
        </div>
      </div>

      {/* Investor Info Card */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
        <h3 className="text-sm md:text-base font-semibold text-foreground mb-3">Investor Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-medium text-foreground">{investor?.full_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{investor?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium text-foreground">{investor?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tax ID</p>
            <p className="text-sm font-medium text-foreground mono">{investor?.tax_id || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entity Type</p>
            <Badge variant="outline" className="text-xs mt-1">{investor?.entity_type || 'Individual'}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client Since</p>
            <p className="text-sm font-medium text-foreground">
              {investor?.created_at ? new Date(investor.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {portfolio.accounts.map((account) => (
                <tr key={account.account_id}>
                  <td className="font-medium text-foreground text-xs md:text-sm">{account.institution}</td>
                  <td className="text-foreground text-xs md:text-sm">{account.account_code}</td>
                  <td className="text-muted-foreground text-xs hidden sm:table-cell">{account.account_type}</td>
                  <td className="text-muted-foreground text-xs hidden md:table-cell">{account.currency}</td>
                  <td className="font-medium mono text-foreground text-xs md:text-sm text-right">
                    {formatCurrency(125000)}
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
            <Link to={`/transactions?portfolio=${portfolio.portfolio_id}`}>
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
            <Link to={`/portfolios/${portfolio.portfolio_id}/performance`}>
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
                  <div key={account.account_id} className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">{account.institution}</p>
                    <p className="text-sm font-medium text-foreground">{account.account_code}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{account.currency}</span>
                      <span className="text-lg font-semibold mono text-foreground">
                        {formatCurrency(125000)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="editName">Portfolio Name</Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="editCountry">Residence Country</Label>
              <Select
                value={editForm.residence_country}
                onValueChange={(value) => setEditForm({ ...editForm, residence_country: value })}
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
            <div>
              <Label htmlFor="editBenchmark">Benchmark</Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="S&P 500" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sp500">S&P 500</SelectItem>
                  <SelectItem value="nasdaq">NASDAQ 100</SelectItem>
                  <SelectItem value="bloomberg">Bloomberg US Agg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditPortfolio} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the portfolio "{portfolio.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePortfolio}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default PortfolioDetail;
