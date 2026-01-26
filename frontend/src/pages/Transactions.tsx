import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Plus, Search, Filter, Download, Calendar, Calculator, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { transactionsApi, accountsApi, usersApi, portfoliosApi, assetsApi, catalogsApi, Trade, CashJournal, FxTransaction, CorporateAction, Account, User, Portfolio, PortfolioSimple, AssetClass } from '@/lib/api';
import { TransactionsTable } from '@/components/transactions/TransactionsTable'; // Ajusta la ruta


type AnyTransaction = Trade | CashJournal | FxTransaction | CorporateAction;

interface TransactionDisplay {
  id: string;
  type: 'Trade' | 'CashJournal' | 'FX' | 'CorporateAction';
  date: string;
  data: AnyTransaction;
}

const transactionTypeFilters = ['Trade', 'CashJournal', 'FX', 'CorporateAction'];

// Define columns for each transaction type
interface ColumnDef {
  key: string;
  label: string;
  tables: string[]; // Which tables this column appears in ('Trade', 'CashJournal', 'FX', 'CorporateAction')
  getValue: (data: AnyTransaction) => string | number | null | undefined;
}

// All available columns organized by data
const ALL_COLUMNS: ColumnDef[] = [
  // Common columns
  { key: 'account_id', label: 'Account ID', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('account_id' in d) return (d as any).account_id || '';
    return '';
  }},
  { key: 'asset_id', label: 'Asset ID', tables: ['Trade', 'CashJournal', 'CorporateAction'], getValue: (d) => {
    if ('asset_id' in d) return (d as any).asset_id || '';
    return '';
  }},
  // Date columns (unified)
  { key: 'date', label: 'Date', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('transaction_id' in d && 'trade_date' in d) return (d as Trade).trade_date || '';
    if ('journal_id' in d && 'date' in d) return (d as CashJournal).date || '';
    if ('fx_id' in d && 'trade_date' in d) return (d as FxTransaction).trade_date || '';
    if ('action_id' in d && 'execution_date' in d) return (d as CorporateAction).execution_date || '';
    return '';
  }},
  // Amount columns (unified)
  { key: 'amount', label: 'Amount', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('transaction_id' in d && 'gross_amount' in d) return (d as Trade).gross_amount || '';
    if ('journal_id' in d && 'amount' in d) return (d as CashJournal).amount || '';
    if ('fx_id' in d && 'source_amount' in d) return (d as FxTransaction).source_amount || '';
    if ('action_id' in d && 'amount' in d) return (d as CorporateAction).amount || '';
    return '';
  }},
  // Type of table (fx/fxtrade, cj:dividend, etc.)
  { key: 'table_type', label: 'Type', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('transaction_id' in d && 'side' in d) return `trade/${(d as Trade).side.toLowerCase()}`;
    if ('journal_id' in d) return `cj:${(d as CashJournal).type.toLowerCase()}`;
    if ('fx_id' in d) return 'fx/fxtrade';
    if ('action_id' in d) return `ca:${(d as CorporateAction).action_type.toLowerCase()}`;
    return '';
  }},
  // Currency columns (unified)
  { key: 'currency', label: 'Currency', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('transaction_id' in d && 'currency' in d) return (d as Trade).currency || '';
    if ('journal_id' in d && 'currency' in d) return (d as CashJournal).currency || '';
    if ('fx_id' in d && 'source_currency' in d) return (d as FxTransaction).source_currency || '';
    if ('action_id' in d && 'currency' in d) return (d as CorporateAction).currency || '';
    return '';
  }},
  // Description
  { key: 'description', label: 'Description', tables: ['Trade', 'CashJournal', 'FX', 'CorporateAction'], getValue: (d) => {
    if ('description' in d) return (d as any).description || '';
    return '';
  }},
  // Quantity
  { key: 'quantity', label: 'Quantity', tables: ['Trade', 'CashJournal', 'CorporateAction'], getValue: (d) => {
    if ('transaction_id' in d && 'quantity' in d) return (d as Trade).quantity || '';
    if ('journal_id' in d && 'quantity' in d) return (d as CashJournal).quantity || '';
    if ('action_id' in d && 'quantity_adjustment' in d) return (d as CorporateAction).quantity_adjustment || '';
    return '';
  }},
  // Side
  { key: 'side', label: 'Side', tables: ['Trade', 'FX'], getValue: (d) => {
    if ('transaction_id' in d && 'side' in d) return (d as Trade).side || '';
    if ('fx_id' in d && 'side' in d) return (d as FxTransaction).side || '';
    return '';
  }},
  
  // Trade-specific columns
  { key: 'settlement_date', label: 'Settlement Date', tables: ['Trade'], getValue: (d) => (d as Trade).settlement_date || '' },
  { key: 'report_date', label: 'Report Date', tables: ['Trade'], getValue: (d) => (d as Trade).report_date || '' },
  { key: 'price', label: 'Price', tables: ['Trade'], getValue: (d) => (d as Trade).price || '' },
  { key: 'gross_amount', label: 'Gross Amount', tables: ['Trade'], getValue: (d) => (d as Trade).gross_amount || '' },
  { key: 'net_amount', label: 'Net Amount', tables: ['Trade'], getValue: (d) => (d as Trade).net_amount || '' },
  { key: 'commission', label: 'Commission', tables: ['Trade'], getValue: (d) => (d as Trade).commission || '' },
  { key: 'tax', label: 'Tax', tables: ['Trade'], getValue: (d) => (d as Trade).tax || '' },
  { key: 'ib_exec_id', label: 'IB Exec ID', tables: ['Trade'], getValue: (d) => (d as Trade).ib_exec_id || '' },
  
  // Cash Journal-specific columns
  { key: 'ex_date', label: 'Ex Date', tables: ['CashJournal'], getValue: (d) => (d as CashJournal).ex_date || '' },
  { key: 'cash_type', label: 'Cash Type', tables: ['CashJournal'], getValue: (d) => (d as CashJournal).type || '' },
  { key: 'rate_per_share', label: 'Rate Per Share', tables: ['CashJournal'], getValue: (d) => (d as CashJournal).rate_per_share || '' },
  
  // FX-specific columns
  { key: 'source_currency', label: 'Source Currency', tables: ['FX'], getValue: (d) => (d as FxTransaction).source_currency || '' },
  { key: 'source_amount', label: 'Source Amount', tables: ['FX'], getValue: (d) => (d as FxTransaction).source_amount || '' },
  { key: 'target_currency', label: 'Target Currency', tables: ['FX'], getValue: (d) => (d as FxTransaction).target_currency || '' },
  { key: 'target_amount', label: 'Target Amount', tables: ['FX'], getValue: (d) => (d as FxTransaction).target_amount || '' },
  { key: 'exchange_rate', label: 'Exchange Rate', tables: ['FX'], getValue: (d) => (d as FxTransaction).exchange_rate || '' },
  { key: 'target_account_id', label: 'Target Account ID', tables: ['FX'], getValue: (d) => (d as FxTransaction).target_account_id || '' },
  { key: 'external_id', label: 'External ID', tables: ['FX'], getValue: (d) => (d as FxTransaction).external_id || '' },
  
  // Corporate Action-specific columns
  { key: 'action_type', label: 'Action Type', tables: ['CorporateAction'], getValue: (d) => (d as CorporateAction).action_type || '' },
  { key: 'ratio_old', label: 'Ratio Old', tables: ['CorporateAction'], getValue: (d) => (d as CorporateAction).ratio_old || '' },
  { key: 'ratio_new', label: 'Ratio New', tables: ['CorporateAction'], getValue: (d) => (d as CorporateAction).ratio_new || '' },
  { key: 'symbol', label: 'Symbol', tables: ['CorporateAction'], getValue: (d) => (d as CorporateAction).symbol || '' },
  { key: 'isin', label: 'ISIN', tables: ['CorporateAction'], getValue: (d) => (d as CorporateAction).isin || '' },
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = ['table_type', 'account_id', 'asset_id', 'date', 'amount', 'currency', 'description', 'quantity', 'side'];

const Transactions = () => {
  // Component for displaying and filtering transactions
  const location = useLocation();
  const [allTransactions, setAllTransactions] = useState<TransactionDisplay[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfoliosSimple, setPortfoliosSimple] = useState<PortfolioSimple[]>([]);
  const [assetCache, setAssetCache] = useState<Map<number, { symbol: string; class_id?: number; sub_class_id?: number }>>(new Map()); // Cache asset_id -> {symbol, class_id, sub_class_id}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>(transactionTypeFilters);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [assetSearchInput, setAssetSearchInput] = useState('');
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [showSum, setShowSum] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 18;

  // Date pickers state
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Fetch all transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        const [trades, cashJournal, fxTransactions, corporateActions, accountsData, usersData, portfoliosData] = await Promise.all([
          transactionsApi.getTrades(0, 1000),
          transactionsApi.getCashJournal(0, 1000),
          transactionsApi.getFxTransactions(0, 1000),
          transactionsApi.getCorporateActions(0, 1000),
          accountsApi.getAccounts(),
          usersApi.getUsers(),
          portfoliosApi.getPortfolios(),
        ]);

        setAccounts(accountsData);
        setUsers(usersData);
        setPortfolios(portfoliosData);

        // Build transaction list with type identification
        const txList: TransactionDisplay[] = [
          ...trades.map((t, idx) => ({
            id: `trade-${idx}`,
            type: 'Trade' as const,
            date: t.trade_date,
            data: t,
          })),
          ...cashJournal.map((c, idx) => ({
            id: `journal-${idx}`,
            type: 'CashJournal' as const,
            date: c.date,
            data: c,
          })),
          ...fxTransactions.map((f, idx) => ({
            id: `fx-${idx}`,
            type: 'FX' as const,
            date: f.trade_date,
            data: f,
          })),
          ...corporateActions.map((a, idx) => ({
            id: `action-${idx}`,
            type: 'CorporateAction' as const,
            date: a.execution_date,
            data: a,
          })),
        ];

        // Sort by date (most recent first)
        txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAllTransactions(txList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
        toast.error('Error loading transactions', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Load asset classes
  useEffect(() => {
    const loadAssetClasses = async () => {
      try {
        setIsLoadingClasses(true);
        const classes = await catalogsApi.getAssetClasses();
        setAssetClasses(classes);
      } catch (error) {
        console.error('Error loading asset classes:', error);
        toast.error('Error loading asset classes');
      } finally {
        setIsLoadingClasses(false);
      }
    };
    loadAssetClasses();
  }, []);

  // Load portfolios simple
  useEffect(() => {
    const loadPortfoliosSimple = async () => {
      try {
        const portfolios = await portfoliosApi.getPortfoliosSimple({ active_only: true });
        setPortfoliosSimple(portfolios);
      } catch (error) {
        console.error('Error loading portfolios:', error);
        toast.error('Error loading portfolios');
      }
    };
    loadPortfoliosSimple();
  }, []);

  // Load asset dictionary in bulk for better performance
  useEffect(() => {
    const loadAssetDictionary = async () => {
      try {
        const BATCH_SIZE = 1000; // Load 1000 assets at a time
        let skip = 0;
        let hasMore = true;
        const newCache = new Map(assetCache);
        
        while (hasMore) {
          const assetsBatch = await assetsApi.getAssets({ skip, limit: BATCH_SIZE });
          
          if (!assetsBatch || assetsBatch.length === 0) {
            hasMore = false;
            break;
          }

          assetsBatch.forEach((asset) => {
            newCache.set(asset.asset_id, {
              symbol: asset.symbol,
              class_id: asset.class_id,
              sub_class_id: asset.sub_class_id,
            });
          });

          if (assetsBatch.length < BATCH_SIZE) {
            hasMore = false;
          } else {
            skip += BATCH_SIZE;
          }
        }
        
        setAssetCache(newCache);
      } catch (err) {
        console.error("Error building asset dictionary:", err);
      }
    };

    // Load asset dictionary once on component mount
    loadAssetDictionary();
  }, []);

  // Get available subclasses for selected class
  const availableSubclasses = useMemo(() => {
    if (selectedAssetClass === 'all') return [];
    const selectedClass = assetClasses.find(c => c.class_id === Number(selectedAssetClass));
    return selectedClass?.sub_classes || [];
  }, [selectedAssetClass, assetClasses]);

  // Pre-compute maps for O(1) lookups
  const accountMap = useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach(a => map.set(a.account_id, a));
    return map;
  }, [accounts]);

  const portfolioMap = useMemo(() => {
    const map = new Map<number, Portfolio>();
    portfolios.forEach(p => map.set(p.portfolio_id, p));
    return map;
  }, [portfolios]);

  const userMap = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach(u => map.set(u.user_id, u));
    return map;
  }, [users]);

  // Filter transactions with optimized lookups
  const filteredTransactions = useMemo(() => {
    const selectedClassId = selectedAssetClass === 'all' ? null : Number(selectedAssetClass);
    const selectedSubClassId = selectedAssetSubclass === 'all' ? null : Number(selectedAssetSubclass);
    const selectedPortfolioNum = selectedPortfolio === 'all' ? null : Number(selectedPortfolio);
    const searchLower = searchText.toLowerCase();
    const selectedAssetLower = selectedAsset.toLowerCase();
    const filterByPortfolio = selectedPortfolioNum !== null;
    const filterByAssetClass = selectedClassId !== null || selectedSubClassId !== null;
    const filterByAsset = selectedAsset !== '';
    const filterBySearch = searchText !== '';

    return allTransactions.filter((t) => {
      // Type filter
      if (!selectedTypes.includes(t.type)) return false;
      
      // Date filters
      if (startDate && new Date(t.date) < startDate) return false;
      if (endDate && new Date(t.date) > endDate) return false;
      
      const data = t.data;
      
      // Portfolio filter with O(1) lookup
      if (filterByPortfolio) {
        if ('account_id' in data) {
          const account = accountMap.get((data as any).account_id);
          if (!account || account.portfolio_id !== selectedPortfolioNum) return false;
        } else {
          return false;
        }
      }
      
      // Asset class/subclass filter
      if (filterByAssetClass) {
        if ('asset_id' in data) {
          const assetId = (data as any).asset_id;
          if (assetId === null || assetId === undefined) return false;
          
          const assetInfo = assetCache.get(assetId);
          if (!assetInfo) return false;
          
          if (selectedClassId !== null && assetInfo.class_id !== selectedClassId) return false;
          if (selectedSubClassId !== null && assetInfo.sub_class_id !== selectedSubClassId) return false;
        } else {
          return false;
        }
      }
      
      // Asset symbol filter
      if (filterByAsset) {
        if ('description' in data) {
          const desc = (data.description || '').split(' ')[0];
          if (!desc || !desc.toLowerCase().includes(selectedAssetLower)) return false;
        } else {
          return false;
        }
      }
      
      // Text search filter
      if (filterBySearch) {
        const dataStr = JSON.stringify(data).toLowerCase();
        if (!dataStr.includes(searchLower)) return false;
      }
      
      return true;
    });
  }, [allTransactions, selectedTypes, startDate, endDate, searchText, selectedAsset, selectedAssetClass, selectedAssetSubclass, selectedPortfolio, accountMap, assetCache]);

  // Get unique asset symbols for filtering
  const availableAssets = useMemo(() => {
    const assets = new Map<string, string>();
    allTransactions.forEach((t) => {
      if ('description' in t.data) {
        const symbol = (t.data.description || '').split(' ')[0];
        if (symbol && !assets.has(symbol)) {
          assets.set(symbol, symbol);
        }
      }
    });
    return Array.from(assets.values()).sort();
  }, [allTransactions]);

  // Filter assets based on search input
  const filteredAssets = useMemo(() => {
    if (!assetSearchInput) return availableAssets;
    return availableAssets.filter((a) =>
      a.toLowerCase().includes(assetSearchInput.toLowerCase())
    );
  }, [availableAssets, assetSearchInput]);

  // Get column value for a transaction with optimized lookups
  const getColumnValue = (transaction: TransactionDisplay, columnKey: string): string => {
    const data = transaction.data;

    // Special case: account_id should show institution-username
    if (columnKey === 'account_id' && 'account_id' in data) {
      const account = accountMap.get((data as any).account_id);
      if (account) {
        const portfolio = portfolioMap.get(account.portfolio_id);
        if (portfolio) {
          const user = userMap.get(portfolio.owner_user_id);
          if (user) {
            const nameParts = user.full_name.split(' ').filter(p => p.length > 0);
            if (nameParts.length > 0) {
              const firstName = nameParts[0].toLowerCase();
              const lastName = nameParts[nameParts.length - 1];
              const lastNameAbbr = lastName.substring(0, 3).toLowerCase();
              return `${account.institution.toLowerCase()}-${firstName}_${lastNameAbbr}`;
            }
          }
        }
      }
      return '';
    }

    // Special case: asset_id - fetch symbol from cache
    if (columnKey === 'asset_id' && 'asset_id' in data) {
      const assetId = (data as any).asset_id;
      if (assetId !== null && assetId !== undefined && assetId !== '') {
        const assetInfo = assetCache.get(assetId);
        return assetInfo?.symbol || '';
      }
      return '';
    }

    // Default: use column definition
    const column = ALL_COLUMNS.find((c) => c.key === columnKey);
    if (column) {
      const value = column.getValue(data);
      return value === null || value === undefined ? '' : String(value);
    }

    return '';
  };

  // Get color and format for table_type badge
  const getTypeColor = (typeValue: string): { bg: string; text: string; icon: string } => {
    if (typeValue.startsWith('trade/')) {
      const side = typeValue.split('/')[1];
      return side === 'buy' 
        ? { bg: 'bg-purple-100/80 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', icon: '' }
        : { bg: 'bg-orange-100/80 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', icon: '' };
    }
    if (typeValue.startsWith('cj:')) {
      const type = typeValue.split(':')[1];
      if (type === 'dividend') return { bg: 'bg-yellow-100/80 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-400', icon: '$' };
      if (type === 'interest') return { bg: 'bg-blue-100/80 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', icon: '%' };
      return { bg: 'bg-gray-100/80 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-400', icon: '◆' };
    }
    if (typeValue.startsWith('fx/')) {
      return { bg: 'bg-purple-100/80 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', icon: '⇄' };
    }
    if (typeValue.startsWith('ca:')) {
      return { bg: 'bg-orange-100/80 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400', icon: '◐' };
    }
    return { bg: 'bg-gray-100/80 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-400', icon: '◆' };
  };

  // Pagination - computed once per render
  const paginationData = useMemo(() => {
    const total = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
    const safe = Math.min(currentPage, total);
    const start = filteredTransactions.length === 0 ? 0 : (safe - 1) * pageSize + 1;
    const end = Math.min(safe * pageSize, filteredTransactions.length);
    return { totalPages: total, safePage: safe, pageStart: start, pageEnd: end, paginatedTransactions: filteredTransactions.slice((safe - 1) * pageSize, (safe - 1) * pageSize + pageSize) };
  }, [filteredTransactions, currentPage, pageSize]);

  const { totalPages, safePage, pageStart, pageEnd, paginatedTransactions } = paginationData;

  // Handler functions
  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSumIncome = () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range first', {
        description: 'Both start and end dates are required to calculate income sum.',
      });
      return;
    }
    setShowSum(true);
  };

  // Build filter title
  const filterTitle = useMemo(() => {
    const parts: string[] = ['Transactions'];
    if (selectedPortfolio !== 'all') {
      parts.push(`Portfolio ${selectedPortfolio}`);
    }
    if (startDate && endDate) parts.push(`${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')}`);
    return parts.join(' - ');
  }, [selectedPortfolio, startDate, endDate]);

  // Build current filter string for saving
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPortfolio !== 'all') params.set('portfolio', selectedPortfolio);
    if (startDate) params.set('from', format(startDate, 'yyyy-MM-dd'));
    if (endDate) params.set('to', format(endDate, 'yyyy-MM-dd'));
    if (selectedTypes.length !== transactionTypeFilters.length) {
      params.set('types', selectedTypes.join(','));
    }
    return params.toString();
  }, [selectedPortfolio, startDate, endDate, selectedTypes]);

  if (error) {
    return (
      <AppLayout title="Transactions" subtitle="View and manage all financial transactions">
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Transactions" subtitle="View and manage all financial transactions">
      {/* Filters Row */}
      <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
        {/* Top Row: Search and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search transactions..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 bg-muted/50 border-border text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <SaveFilterButton
              currentPath={location.pathname}
              currentFilters={currentFilters}
              defaultTitle={filterTitle}
            />
            <Button variant="outline" size="sm" className="border-border text-xs md:text-sm">
              <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              <span className="hidden sm:inline">Add Transaction</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Portfolio Filter */}
          <Select value={selectedPortfolio} onValueChange={(v) => { setSelectedPortfolio(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-48 md:w-56 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
              <SelectValue placeholder="Portfolio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portfolios</SelectItem>
              {portfoliosSimple.map((p) => (
                <SelectItem key={p.portfolio_id} value={String(p.portfolio_id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Asset Class Filter */}
          <Select
            value={selectedAssetClass}
            onValueChange={(v) => {
              setSelectedAssetClass(v);
              setSelectedAssetSubclass('all');
              setCurrentPage(1);
            }}
            disabled={isLoadingClasses}
          >
            <SelectTrigger className="w-full sm:w-36 md:w-44 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
              <SelectValue placeholder={isLoadingClasses ? "Loading..." : "Asset Class"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {assetClasses.map((ac) => (
                <SelectItem key={ac.class_id} value={String(ac.class_id)}>{ac.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Asset Subclass Filter */}
          {availableSubclasses.length > 0 && (
            <Select value={selectedAssetSubclass} onValueChange={(v) => { setSelectedAssetSubclass(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-36 md:w-44 bg-muted/50 border-border text-xs md:text-sm h-8 md:h-9">
                <SelectValue placeholder="Subclass" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subclasses</SelectItem>
                {availableSubclasses.map((subclass) => (
                  <SelectItem key={subclass.sub_class_id} value={String(subclass.sub_class_id)}>
                    {subclass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Asset Filter */}
          <Popover open={assetDropdownOpen} onOpenChange={setAssetDropdownOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Asset {selectedAsset && `(${selectedAsset})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-2 block">Search Asset Symbol</Label>
                  <Input
                    type="text"
                    placeholder="Type symbol (e.g., CCL)..."
                    value={assetSearchInput}
                    onChange={(e) => setAssetSearchInput(e.target.value)}
                    className="h-8 text-xs bg-muted/50 border-border"
                  />
                </div>
                <div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded p-2">
                    {filteredAssets.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No assets found</p>
                    ) : (
                      filteredAssets.map((asset) => (
                        <button
                          key={asset}
                          onClick={() => {
                            setSelectedAsset(asset);
                            setAssetSearchInput('');
                            setAssetDropdownOpen(false);
                            setCurrentPage(1);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-primary/10 transition-colors"
                        >
                          {asset}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {selectedAsset && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedAsset('');
                      setAssetSearchInput('');
                      setCurrentPage(1);
                    }}
                  >
                    Clear Asset Filter
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Type Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Types ({selectedTypes.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Transaction Types</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSelectedTypes(selectedTypes.length === transactionTypeFilters.length ? [] : transactionTypeFilters)}
                  >
                    {selectedTypes.length === transactionTypeFilters.length ? 'Clear' : 'All'}
                  </Button>
                </div>
                {transactionTypeFilters.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                    />
                    <Label htmlFor={type} className="text-sm cursor-pointer">{type}</Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={`border-border h-8 md:h-9 text-xs md:text-sm ${startDate && endDate ? 'border-primary text-primary' : ''}`}
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">
                  {startDate && endDate 
                    ? `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}` 
                    : 'Date Range'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-2 block">Start Date</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartDateOpen(false);
                          setCurrentPage(1);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">End Date</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndDateOpen(false);
                          setCurrentPage(1);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setCurrentPage(1);
                    setShowSum(false);
                  }}
                >
                  Clear Dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Columns Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-8 md:h-9 text-xs md:text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Columns ({visibleColumns.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-3 max-h-96 overflow-y-auto" align="start">
              <div className="space-y-3">
                {ALL_COLUMNS.map((col) => (
                  <div key={col.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={visibleColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumnVisibility(col.key)}
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-xs cursor-pointer flex-1">
                      {col.label}
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({col.tables.join(', ')})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Sum Income Button */}
          <Button
            variant={showSum ? "secondary" : "outline"}
            size="sm"
            className="border-border h-8 md:h-9 text-xs md:text-sm"
            onClick={handleSumIncome}
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Sum Income</span>
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <TransactionsTable 
        transactions={paginatedTransactions}
        visibleColumns={visibleColumns}
        allColumns={ALL_COLUMNS}
        isLoading={loading}
        totalTransactions={filteredTransactions.length}
        pageStart={pageStart}
        pageEnd={pageEnd}
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        getColumnValue={getColumnValue}
        getTypeColor={getTypeColor}
      />

      {/* Sum Display - Below Table */}
      {showSum && (
        <div className="mt-4 md:mt-6">
          {(!startDate || !endDate) ? (
            <div className="flex items-center gap-2 p-3 md:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">Please select a date range to calculate income sum.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Income Summary ({format(startDate, 'yyyy-MM-dd')} to {format(endDate, 'yyyy-MM-dd')})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Summary</p>
                  <p className="text-lg md:text-2xl font-semibold mono">To be implemented</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Transactions;
