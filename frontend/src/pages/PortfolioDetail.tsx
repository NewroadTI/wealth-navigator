import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { getApiBaseUrl } from '@/lib/config';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { transactionsApi, assetsApi, positionsApi, Trade, CashJournal, FxTransaction, CorporateAction, AccountBalance } from '@/lib/api';
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
  Plus,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
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

type CurrencyApi = {
  code: string;
  name: string;
};

type InvestmentStrategyApi = {
  strategy_id: number;
  name: string;
  description: string | null;
};

// Transaction types
type AnyTransaction = Trade | CashJournal | FxTransaction | CorporateAction;

interface TransactionDisplay {
  id: string;
  type: 'Trade' | 'CashJournal' | 'FX' | 'CorporateAction';
  date: string;
  data: AnyTransaction;
}

const txTypeFilters = ['Trade', 'CashJournal', 'FX', 'CorporateAction'];

// Column definitions for transactions
interface ColumnDef {
  key: string;
  label: string;
  tables: string[];
  getValue: (data: AnyTransaction) => string | number | null | undefined;
}

const TX_COLUMNS: ColumnDef[] = [
  {
    key: 'table_type', label: 'Type', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('transaction_id' in d && 'side' in d) return `trade/${(d as Trade).side.toLowerCase()}`;
      if ('journal_id' in d) return `cj:${(d as CashJournal).type.toLowerCase()}`;
      if ('fx_id' in d) return 'fx/fxtrade';
      if ('action_id' in d) return `ca:${(d as CorporateAction).action_type.toLowerCase()}`;
      return '';
    }
  },
  {
    key: 'account_id', label: 'Account', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('account_id' in d) return (d as any).account_id || '';
      return '';
    }
  },
  {
    key: 'asset_id', label: 'Asset', tables: ['Trade', 'CashJournal', 'CorporateAction'], getValue: (d) => {
      if ('asset_id' in d) return (d as any).asset_id || '';
      return '';
    }
  },
  {
    key: 'date', label: 'Date', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('transaction_id' in d && 'trade_date' in d) return (d as Trade).trade_date || '';
      if ('journal_id' in d && 'date' in d) return (d as CashJournal).date || '';
      if ('fx_id' in d && 'trade_date' in d) return (d as FxTransaction).trade_date || '';
      if ('action_id' in d && 'execution_date' in d) return (d as CorporateAction).execution_date || '';
      return '';
    }
  },
  {
    key: 'amount', label: 'Amount', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('transaction_id' in d && 'gross_amount' in d) return (d as Trade).gross_amount || '';
      if ('journal_id' in d && 'amount' in d) return (d as CashJournal).amount || '';
      if ('fx_id' in d && 'source_amount' in d) return (d as FxTransaction).source_amount || '';
      if ('action_id' in d && 'amount' in d) return (d as CorporateAction).amount || '';
      return '';
    }
  },
  {
    key: 'currency', label: 'Currency', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('transaction_id' in d && 'currency' in d) return (d as Trade).currency || '';
      if ('journal_id' in d && 'currency' in d) return (d as CashJournal).currency || '';
      if ('fx_id' in d && 'source_currency' in d) return (d as FxTransaction).source_currency || '';
      if ('action_id' in d && 'currency' in d) return (d as CorporateAction).currency || '';
      return '';
    }
  },
  {
    key: 'description', label: 'Description', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
      if ('description' in d) return (d as any).description || '';
      return '';
    }
  },
  {
    key: 'quantity', label: 'Quantity', tables: ['Trade', 'CashJournal', 'CorporateAction'], getValue: (d) => {
      if ('transaction_id' in d && 'quantity' in d) return (d as Trade).quantity || '';
      if ('journal_id' in d && 'quantity' in d) return (d as CashJournal).quantity || '';
      if ('action_id' in d && 'quantity_adjustment' in d) return (d as CorporateAction).quantity_adjustment || '';
      return '';
    }
  },
  {
    key: 'side', label: 'Side', tables: ['Trade', 'FX'], getValue: (d) => {
      if ('transaction_id' in d && 'side' in d) return (d as Trade).side || '';
      if ('fx_id' in d && 'side' in d) return (d as FxTransaction).side || '';
      return '';
    }
  },
];

const TX_DEFAULT_COLUMNS = ['table_type', 'account_id', 'asset_id', 'date', 'amount', 'currency', 'description'];

const PortfolioDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const apiBaseUrl = getApiBaseUrl();

  // State
  const [portfolio, setPortfolio] = useState<PortfolioApi | null>(null);
  const [investor, setInvestor] = useState<UserApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryApi[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyApi[]>([]);
  const [investmentStrategies, setInvestmentStrategies] = useState<InvestmentStrategyApi[]>([]);

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

  // Add account dialog state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    institution: 'IBKR',
    account_alias: '',
    currency: 'USD',
    account_code: '',
    investment_strategy_id: '',
    account_type: 'Individual',
  });
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  // Transaction state
  const [txAllTransactions, setTxAllTransactions] = useState<TransactionDisplay[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txAssetCache, setTxAssetCache] = useState<Map<number, string>>(new Map());
  const [txSelectedAccount, setTxSelectedAccount] = useState<string>('all');
  const [txSelectedAsset, setTxSelectedAsset] = useState<string>('');
  const [txAssetSearchInput, setTxAssetSearchInput] = useState('');
  const [txAssetDropdownOpen, setTxAssetDropdownOpen] = useState(false);
  const [txSelectedTypes, setTxSelectedTypes] = useState<string[]>(txTypeFilters);
  const [txStartDate, setTxStartDate] = useState<Date | undefined>(undefined);
  const [txEndDate, setTxEndDate] = useState<Date | undefined>(undefined);
  const [txStartDateOpen, setTxStartDateOpen] = useState(false);
  const [txEndDateOpen, setTxEndDateOpen] = useState(false);
  const [txVisibleColumns, setTxVisibleColumns] = useState<string[]>(TX_DEFAULT_COLUMNS);
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const txPageSize = 20;

  // Account balances state
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);

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

  // Load currencies
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`);
        if (response.ok) {
          const data = await response.json();
          setCurrencies(data);
        }
      } catch (error) {
        console.error('Error loading currencies:', error);
      }
    };
    loadCurrencies();
  }, [apiBaseUrl]);

  // Load investment strategies
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/catalogs/investment-strategies`);
        if (response.ok) {
          const data = await response.json();
          setInvestmentStrategies(data);
        }
      } catch (error) {
        console.error('Error loading investment strategies:', error);
      }
    };
    loadStrategies();
  }, [apiBaseUrl]);

  // Load transactions for portfolio accounts
  useEffect(() => {
    if (!portfolio?.accounts || portfolio.accounts.length === 0) return;

    const loadTransactions = async () => {
      try {
        setTxLoading(true);
        const accountIds = portfolio.accounts.map(a => a.account_id);

        // Fetch all transaction types for all accounts
        const allPromises = accountIds.flatMap(accountId => [
          transactionsApi.getTrades(0, 500, accountId),
          transactionsApi.getCashJournal(0, 500, accountId),
          transactionsApi.getFxTransactions(0, 500, accountId),
          transactionsApi.getCorporateActions(0, 500, accountId),
        ]);

        const results = await Promise.all(allPromises);

        // Group results by type
        const txList: TransactionDisplay[] = [];
        for (let i = 0; i < accountIds.length; i++) {
          const baseIdx = i * 4;
          const trades = results[baseIdx] as Trade[];
          const cashJournal = results[baseIdx + 1] as CashJournal[];
          const fxTx = results[baseIdx + 2] as FxTransaction[];
          const corpActions = results[baseIdx + 3] as CorporateAction[];

          trades.forEach((t, idx) => txList.push({ id: `trade-${i}-${idx}`, type: 'Trade', date: t.trade_date, data: t }));
          cashJournal.forEach((c, idx) => txList.push({ id: `cj-${i}-${idx}`, type: 'CashJournal', date: c.date, data: c }));
          fxTx.forEach((f, idx) => txList.push({ id: `fx-${i}-${idx}`, type: 'FX', date: f.trade_date, data: f }));
          corpActions.forEach((a, idx) => txList.push({ id: `ca-${i}-${idx}`, type: 'CorporateAction', date: a.execution_date, data: a }));
        }

        // Sort by date descending
        txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTxAllTransactions(txList);
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setTxLoading(false);
      }
    };

    loadTransactions();
  }, [portfolio?.accounts]);

  // Build asset cache for symbol lookup
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const assets = await assetsApi.getAssets({ skip: 0, limit: 2000 });
        const cache = new Map<number, string>();
        assets.forEach(a => cache.set(a.asset_id, a.symbol));
        setTxAssetCache(cache);
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };
    loadAssets();
  }, []);

  // Account map for lookups
  const txAccountMap = useMemo(() => {
    const map = new Map<number, any>();
    portfolio?.accounts?.forEach(a => map.set(a.account_id, a));
    return map;
  }, [portfolio?.accounts]);

  // Load account balances
  useEffect(() => {
    if (!portfolio?.accounts || portfolio.accounts.length === 0) return;

    const loadBalances = async () => {
      try {
        const accountIds = portfolio.accounts.map(a => a.account_id);
        const balances = await positionsApi.getAccountBalances(accountIds);
        setAccountBalances(balances);
      } catch (error) {
        console.error('Error loading account balances:', error);
      }
    };

    loadBalances();
  }, [portfolio?.accounts]);

  // Create a map of account_id -> balance for quick lookups
  const accountBalanceMap = useMemo(() => {
    const map = new Map<number, number>();
    accountBalances.forEach(b => {
      map.set(b.account_id, parseFloat(b.balance) || 0);
    });
    return map;
  }, [accountBalances]);

  // Calculate total portfolio value (sum of all account balances)
  const totalPortfolioValue = useMemo(() => {
    return accountBalances.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);
  }, [accountBalances]);

  // Filter transactions
  const txFilteredTransactions = useMemo(() => {
    const selectedAccountId = txSelectedAccount === 'all' ? null : Number(txSelectedAccount);
    const selectedAssetLower = txSelectedAsset.toLowerCase();

    return txAllTransactions.filter(t => {
      // Type filter
      if (!txSelectedTypes.includes(t.type)) return false;
      // Date filters
      if (txStartDate && new Date(t.date) < txStartDate) return false;
      if (txEndDate && new Date(t.date) > txEndDate) return false;
      // Account filter
      if (selectedAccountId !== null && 'account_id' in t.data && (t.data as any).account_id !== selectedAccountId) return false;
      // Asset filter
      if (txSelectedAsset && 'description' in t.data) {
        const desc = ((t.data as any).description || '').split(' ')[0];
        if (!desc.toLowerCase().includes(selectedAssetLower)) return false;
      }
      return true;
    });
  }, [txAllTransactions, txSelectedTypes, txStartDate, txEndDate, txSelectedAccount, txSelectedAsset]);

  // Available assets for filter dropdown
  const txAvailableAssets = useMemo(() => {
    const assets = new Set<string>();
    txAllTransactions.forEach(t => {
      if ('description' in t.data) {
        const symbol = ((t.data as any).description || '').split(' ')[0];
        if (symbol) assets.add(symbol);
      }
    });
    return Array.from(assets).sort();
  }, [txAllTransactions]);

  const txFilteredAssets = useMemo(() => {
    if (!txAssetSearchInput) return txAvailableAssets;
    return txAvailableAssets.filter(a => a.toLowerCase().includes(txAssetSearchInput.toLowerCase()));
  }, [txAvailableAssets, txAssetSearchInput]);

  // Pagination
  const txPaginationData = useMemo(() => {
    const total = Math.max(1, Math.ceil(txFilteredTransactions.length / txPageSize));
    const safe = Math.min(txCurrentPage, total);
    const start = txFilteredTransactions.length === 0 ? 0 : (safe - 1) * txPageSize + 1;
    const end = Math.min(safe * txPageSize, txFilteredTransactions.length);
    return {
      totalPages: total, safePage: safe, pageStart: start, pageEnd: end,
      paginatedTransactions: txFilteredTransactions.slice((safe - 1) * txPageSize, safe * txPageSize)
    };
  }, [txFilteredTransactions, txCurrentPage, txPageSize]);

  // Get column value helper
  const getTxColumnValue = (transaction: TransactionDisplay, columnKey: string): string => {
    const data = transaction.data;
    // Account: show account_code
    if (columnKey === 'account_id' && 'account_id' in data) {
      const account = txAccountMap.get((data as any).account_id);
      return account?.account_code || '';
    }
    // Asset: show symbol
    if (columnKey === 'asset_id' && 'asset_id' in data) {
      const assetId = (data as any).asset_id;
      return assetId ? txAssetCache.get(assetId) || '' : '';
    }
    // Default: use column definition
    const column = TX_COLUMNS.find(c => c.key === columnKey);
    if (column) {
      const value = column.getValue(data);
      return value === null || value === undefined ? '' : String(value);
    }
    return '';
  };

  // Type badge colors
  const getTxTypeColor = (typeValue: string) => {
    if (typeValue.startsWith('trade/')) {
      return typeValue.includes('buy')
        ? { bg: 'bg-purple-100/80 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' }
        : { bg: 'bg-orange-100/80 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400' };
    }
    if (typeValue.startsWith('cj:')) {
      if (typeValue.includes('dividend')) return { bg: 'bg-yellow-100/80 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-400' };
      if (typeValue.includes('interest')) return { bg: 'bg-blue-100/80 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' };
      return { bg: 'bg-gray-100/80 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-400' };
    }
    if (typeValue.startsWith('fx/')) return { bg: 'bg-purple-100/80 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' };
    if (typeValue.startsWith('ca:')) return { bg: 'bg-orange-100/80 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400' };
    return { bg: 'bg-gray-100/80 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-400' };
  };

  const toggleTxType = (type: string) => {
    setTxSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    setTxCurrentPage(1);
  };

  const toggleTxColumn = (key: string) => {
    setTxVisibleColumns(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

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

  // Handle account alias or currency change - auto-fill account code
  const updateAccountCode = (alias: string, currency: string) => {
    if (alias && currency) {
      setAccountForm(prev => ({
        ...prev,
        account_code: `${alias}_${currency}`
      }));
    }
  };

  // Handle create account
  const handleCreateAccount = async () => {
    if (!portfolio) return;
    if (!accountForm.account_alias || !accountForm.account_code) {
      setAccountError('Please fill all required fields (Account Alias and Account Code).');
      return;
    }

    try {
      setAccountLoading(true);
      setAccountError(null);
      setAccountSuccess(null);

      const payload = {
        portfolio_id: portfolio.portfolio_id,
        institution: accountForm.institution,
        account_alias: accountForm.account_alias,
        account_code: accountForm.account_code,
        currency: accountForm.currency,
        account_type: accountForm.account_type,
        investment_strategy_id: accountForm.investment_strategy_id ? parseInt(accountForm.investment_strategy_id) : null,
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/accounts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const newAccount = await response.json();

      // Update portfolio with new account
      setPortfolio(prev => prev ? {
        ...prev,
        accounts: [...prev.accounts, newAccount]
      } : null);

      setAccountSuccess(`Account "${newAccount.account_code}" created successfully.`);

      // Reset form after short delay
      setTimeout(() => {
        setIsAddAccountOpen(false);
        setAccountForm({
          institution: 'IBKR',
          account_alias: '',
          currency: 'USD',
          account_code: '',
          investment_strategy_id: '',
          account_type: 'Individual',
        });
        setAccountSuccess(null);
      }, 1500);

      toast({
        title: 'Account created',
        description: `Account "${newAccount.account_code}" has been created successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setAccountError(error.message || 'Could not create account.');
    } finally {
      setAccountLoading(false);
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
              {formatCurrency(totalPortfolioValue)}
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
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-medium text-foreground truncate" title={investor?.full_name || 'N/A'}>
              {investor?.full_name || 'N/A'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground truncate" title={investor?.email || 'N/A'}>
              {investor?.email || 'N/A'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium text-foreground truncate" title={investor?.phone || 'N/A'}>
              {investor?.phone || 'N/A'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tax ID</p>
            <p className="text-sm font-medium text-foreground mono truncate" title={investor?.tax_id || 'N/A'}>
              {investor?.tax_id || 'N/A'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Entity Type</p>
            <Badge variant="outline" className="text-xs mt-1">{investor?.entity_type || 'Individual'}</Badge>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Client Since</p>
            <p className="text-sm font-medium text-foreground truncate">
              {investor?.created_at ? new Date(investor.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm md:text-base">Linked Accounts</h3>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              setIsAddAccountOpen(true);
              setAccountError(null);
              setAccountSuccess(null);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Account
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-xs">Institution</th>
                <th className="text-xs">Account Alias</th>
                <th className="text-xs hidden sm:table-cell">Account Code</th>
                <th className="text-xs hidden md:table-cell">Account Type</th>
                <th className="text-xs hidden md:table-cell">Currency</th>
                <th className="text-xs hidden lg:table-cell">Investment Strategy</th>
                <th className="text-xs text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.accounts.map((account) => {
                const strategy = investmentStrategies.find(
                  s => s.strategy_id === account.investment_strategy_id
                );
                const balance = accountBalanceMap.get(account.account_id) || 0;
                return (
                  <tr key={account.account_id}>
                    <td className="font-medium text-foreground text-xs md:text-sm">{account.institution}</td>
                    <td className="text-foreground text-xs md:text-sm">
                      <Link
                        to={`/portfolios/${portfolio.portfolio_id}/accounts/${account.account_id}`}
                        className="text-primary hover:underline"
                      >
                        {account.account_alias || '-'}
                      </Link>
                    </td>
                    <td className="text-muted-foreground text-xs hidden sm:table-cell">{account.account_code}</td>
                    <td className="text-muted-foreground text-xs hidden md:table-cell">{account.account_type || '-'}</td>
                    <td className="text-muted-foreground text-xs hidden md:table-cell">{account.currency}</td>
                    <td className="text-muted-foreground text-xs hidden lg:table-cell">{strategy?.name || '-'}</td>
                    <td className="font-medium mono text-foreground text-xs md:text-sm text-right">
                      {formatCurrency(balance)}
                    </td>
                  </tr>
                );
              })}
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
          <div className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Account Filter */}
              <Select value={txSelectedAccount} onValueChange={(v) => { setTxSelectedAccount(v); setTxCurrentPage(1); }}>
                <SelectTrigger className="w-40 bg-muted/50 border-border text-xs h-8">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {portfolio.accounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={String(acc.account_id)}>{acc.account_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Asset Filter */}
              <Popover open={txAssetDropdownOpen} onOpenChange={setTxAssetDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-border h-8 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    Asset {txSelectedAsset && `(${txSelectedAsset})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-3">
                    <Input
                      type="text"
                      placeholder="Search symbol..."
                      value={txAssetSearchInput}
                      onChange={(e) => setTxAssetSearchInput(e.target.value)}
                      className="h-8 text-xs bg-muted/50 border-border"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded p-2">
                      {txFilteredAssets.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No assets found</p>
                      ) : (
                        txFilteredAssets.slice(0, 50).map((asset) => (
                          <button
                            key={asset}
                            onClick={() => { setTxSelectedAsset(asset); setTxAssetSearchInput(''); setTxAssetDropdownOpen(false); setTxCurrentPage(1); }}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-primary/10 transition-colors"
                          >
                            {asset}
                          </button>
                        ))
                      )}
                    </div>
                    {txSelectedAsset && (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setTxSelectedAsset(''); setTxCurrentPage(1); }}>
                        Clear Filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Types Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-border h-8 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    Types ({txSelectedTypes.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Transaction Types</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setTxSelectedTypes(txSelectedTypes.length === txTypeFilters.length ? [] : txTypeFilters)}>
                        {txSelectedTypes.length === txTypeFilters.length ? 'Clear' : 'All'}
                      </Button>
                    </div>
                    {txTypeFilters.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox id={`tx-${type}`} checked={txSelectedTypes.includes(type)} onCheckedChange={() => toggleTxType(type)} />
                        <Label htmlFor={`tx-${type}`} className="text-sm cursor-pointer">{type}</Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Date Range Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`border-border h-8 text-xs ${txStartDate && txEndDate ? 'border-primary text-primary' : ''}`}>
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {txStartDate && txEndDate ? `${format(txStartDate, 'MMM dd')} - ${format(txEndDate, 'MMM dd')}` : 'Date Range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs mb-2 block">Start Date</Label>
                      <Popover open={txStartDateOpen} onOpenChange={setTxStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !txStartDate && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {txStartDate ? format(txStartDate, "PPP") : "Pick start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={txStartDate} onSelect={(d) => { setTxStartDate(d); setTxStartDateOpen(false); setTxCurrentPage(1); }} initialFocus className="p-3" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">End Date</Label>
                      <Popover open={txEndDateOpen} onOpenChange={setTxEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !txEndDate && "text-muted-foreground")}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {txEndDate ? format(txEndDate, "PPP") : "Pick end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={txEndDate} onSelect={(d) => { setTxEndDate(d); setTxEndDateOpen(false); setTxCurrentPage(1); }} initialFocus className="p-3" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setTxStartDate(undefined); setTxEndDate(undefined); setTxCurrentPage(1); }}>
                      Clear Dates
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Columns Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-border h-8 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    Columns ({txVisibleColumns.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 max-h-72 overflow-y-auto" align="start">
                  <div className="space-y-2">
                    {TX_COLUMNS.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox id={`col-${col.key}`} checked={txVisibleColumns.includes(col.key)} onCheckedChange={() => toggleTxColumn(col.key)} />
                        <Label htmlFor={`col-${col.key}`} className="text-xs cursor-pointer">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Transactions Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm md:text-base">Transactions</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {txLoading ? 'Loading...' : txFilteredTransactions.length === 0 ? '0 transactions' : `${txPaginationData.pageStart}-${txPaginationData.pageEnd} of ${txFilteredTransactions.length}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTxCurrentPage(Math.max(1, txCurrentPage - 1))} disabled={txLoading || txCurrentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="hidden sm:inline">Page {txPaginationData.safePage} of {txPaginationData.totalPages}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTxCurrentPage(Math.min(txPaginationData.totalPages, txCurrentPage + 1))} disabled={txLoading || txCurrentPage === txPaginationData.totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {txLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
                ) : txPaginationData.paginatedTransactions.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {txVisibleColumns.map((colKey) => {
                          const col = TX_COLUMNS.find(c => c.key === colKey);
                          return <th key={colKey} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap text-xs">{col?.label || colKey}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {txPaginationData.paginatedTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          {txVisibleColumns.map((colKey) => (
                            <td key={`${tx.id}-${colKey}`} className="px-4 py-3 text-xs">
                              {colKey === 'date' ? (
                                format(new Date(tx.date), 'yyyy-MM-dd HH:mm')
                              ) : colKey === 'table_type' ? (
                                (() => {
                                  const typeValue = getTxColumnValue(tx, colKey);
                                  const colors = getTxTypeColor(typeValue);
                                  return <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${colors.bg} ${colors.text}`}>{typeValue}</span>;
                                })()
                              ) : (
                                getTxColumnValue(tx, colKey) || ''
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No transactions found for the selected filters</div>
                )}
              </div>
            </div>
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

      {/* Add Account Dialog */}
      <Dialog open={isAddAccountOpen} onOpenChange={(open) => {
        setIsAddAccountOpen(open);
        if (!open) {
          setAccountError(null);
          setAccountSuccess(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {accountError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                {accountError}
              </div>
            )}
            {accountSuccess && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
                {accountSuccess}
              </div>
            )}

            {/* Portfolio (disabled) */}
            <div>
              <Label>Portfolio</Label>
              <Input
                value={portfolio.name}
                disabled
                className="mt-1 bg-muted/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Institution */}
              <div>
                <Label>Institution *</Label>
                <Select
                  value={accountForm.institution}
                  onValueChange={(value) => setAccountForm({ ...accountForm, institution: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select institution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IBKR">IBKR</SelectItem>
                    <SelectItem value="Pershing">Pershing</SelectItem>
                    <SelectItem value="JP Morgan">JP Morgan</SelectItem>
                    <SelectItem value="Morgan Stanley">Morgan Stanley</SelectItem>
                    <SelectItem value="UBS">UBS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account Type */}
              <div>
                <Label>Account Type *</Label>
                <Select
                  value={accountForm.account_type}
                  onValueChange={(value) => setAccountForm({ ...accountForm, account_type: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Account Alias */}
              <div>
                <Label>Account Alias *</Label>
                <Input
                  placeholder="U8888"
                  className="mt-1"
                  value={accountForm.account_alias}
                  onChange={(e) => {
                    const newAlias = e.target.value;
                    setAccountForm({ ...accountForm, account_alias: newAlias });
                    updateAccountCode(newAlias, accountForm.currency);
                  }}
                />
              </div>

              {/* Currency */}
              <div>
                <Label>Currency *</Label>
                <Select
                  value={accountForm.currency}
                  onValueChange={(value) => {
                    setAccountForm({ ...accountForm, currency: value });
                    updateAccountCode(accountForm.account_alias, value);
                  }}
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
            </div>

            {/* Account Code (auto-filled, editable) */}
            <div>
              <Label>Account Code *</Label>
              <Input
                placeholder="U8888_USD"
                className="mt-1"
                value={accountForm.account_code}
                onChange={(e) => setAccountForm({ ...accountForm, account_code: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-generated from alias and currency. You can modify it if needed.
              </p>
            </div>

            {/* Investment Strategy */}
            <div>
              <Label>Investment Strategy</Label>
              <Select
                value={accountForm.investment_strategy_id}
                onValueChange={(value) => setAccountForm({ ...accountForm, investment_strategy_id: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select strategy (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">-</SelectItem>
                  {investmentStrategies.map((strategy) => (
                    <SelectItem key={strategy.strategy_id} value={strategy.strategy_id.toString()}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleCreateAccount}
                disabled={accountLoading || !!accountSuccess}
              >
                {accountLoading ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PortfolioDetail;
