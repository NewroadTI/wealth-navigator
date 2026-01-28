import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatCurrency, formatPercent, formatDate, getChangeColor } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { transactionsApi, assetsApi, positionsApi, Trade, CashJournal, FxTransaction, CorporateAction, AccountBalance, Position, AssetApi } from '@/lib/api';
import {
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Wallet,
    ArrowLeftRight,
    PieChart,
    Filter,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Search,
    Columns,
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

type AccountApi = {
    account_id: number;
    portfolio_id: number;
    institution: string;
    account_alias: string | null;
    currency: string;
    account_code: string;
    account_type: string | null;
    investment_strategy_id: number | null;
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

const TX_DEFAULT_COLUMNS = ['table_type', 'asset_id', 'date', 'amount', 'currency', 'description'];

// Position columns
const POSITION_COLUMNS = [
    { key: 'account', label: 'Account' },
    { key: 'asset', label: 'Asset' },
    { key: 'report_date', label: 'Report Date' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'mark_price', label: 'Mark Price' },
    { key: 'position_value', label: 'Position Value' },
    { key: 'cost_basis_money', label: 'Cost Basis Money' },
    { key: 'cost_basis_price', label: 'Cost Basis Price' },
    { key: 'open_price', label: 'Open Price' },
    { key: 'fifo_pnl_unrealized', label: 'Unrealized P&L' },
    { key: 'percent_of_nav', label: '% of NAV' },
    { key: 'side', label: 'Side' },
    { key: 'level_of_detail', label: 'Level' },
    { key: 'open_date_time', label: 'Open Date' },
    { key: 'vesting_date', label: 'Vesting Date' },
    { key: 'accrued_interest', label: 'Accrued Interest' },
    { key: 'fx_rate_to_base', label: 'FX Rate' },
];

const POSITION_DEFAULT_COLUMNS = [
    'account', 'asset', 'report_date', 'quantity', 'mark_price', 'position_value', 'open_price', 'fifo_pnl_unrealized'
];

const PortfolioAccounts = () => {
    const { portfolioId, accountId } = useParams();
    const { toast } = useToast();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

    // State
    const [portfolio, setPortfolio] = useState<PortfolioApi | null>(null);
    const [account, setAccount] = useState<AccountApi | null>(null);
    const [investor, setInvestor] = useState<UserApi | null>(null);
    const [loading, setLoading] = useState(true);

    // Positions state
    const [positions, setPositions] = useState<Position[]>([]);
    const [positionsLoading, setPositionsLoading] = useState(false);
    const [positionSearchQuery, setPositionSearchQuery] = useState('');
    const [positionVisibleColumns, setPositionVisibleColumns] = useState<string[]>(POSITION_DEFAULT_COLUMNS);
    const [positionCurrentPage, setPositionCurrentPage] = useState(1);
    const positionPageSize = 25;

    // Asset cache for symbol lookup
    const [assetCache, setAssetCache] = useState<Map<number, AssetApi>>(new Map());

    // Account balance
    const [accountBalance, setAccountBalance] = useState<number>(0);

    // Transaction state
    const [txAllTransactions, setTxAllTransactions] = useState<TransactionDisplay[]>([]);
    const [txLoading, setTxLoading] = useState(false);
    const [txAssetCache, setTxAssetCache] = useState<Map<number, string>>(new Map());
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

    const isPositive = true; // Mocked for day change

    // Load portfolio and account data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Load portfolio
                const portfolioResponse = await fetch(`${apiBaseUrl}/api/v1/portfolios/${portfolioId}`);
                if (!portfolioResponse.ok) throw new Error('Failed to load portfolio');
                const portfolioData = await portfolioResponse.json();
                setPortfolio(portfolioData);

                // Find the account in the portfolio
                const foundAccount = portfolioData.accounts?.find((a: any) => a.account_id === Number(accountId));
                if (foundAccount) {
                    setAccount(foundAccount);
                }

                // Load investor data
                if (portfolioData.owner_user_id) {
                    const userResponse = await fetch(`${apiBaseUrl}/api/v1/users/${portfolioData.owner_user_id}`);
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        setInvestor(userData);
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (portfolioId && accountId) {
            loadData();
        }
    }, [portfolioId, accountId, apiBaseUrl]);

    // Load positions for this account
    useEffect(() => {
        if (!accountId) return;

        const loadPositions = async () => {
            try {
                setPositionsLoading(true);
                const data = await positionsApi.getPositions(Number(accountId), 0, 1000);
                setPositions(data);
            } catch (error) {
                console.error('Error loading positions:', error);
            } finally {
                setPositionsLoading(false);
            }
        };

        loadPositions();
    }, [accountId]);

    // Load account balance
    useEffect(() => {
        if (!accountId) return;

        const loadBalance = async () => {
            try {
                const balances = await positionsApi.getAccountBalances([Number(accountId)]);
                if (balances.length > 0) {
                    setAccountBalance(parseFloat(balances[0].balance) || 0);
                }
            } catch (error) {
                console.error('Error loading account balance:', error);
            }
        };

        loadBalance();
    }, [accountId]);

    // Load assets for cache
    useEffect(() => {
        const loadAssets = async () => {
            try {
                const assets = await assetsApi.getAssets({ skip: 0, limit: 2000 });
                const cache = new Map<number, AssetApi>();
                const symbolCache = new Map<number, string>();
                assets.forEach(a => {
                    cache.set(a.asset_id, a);
                    symbolCache.set(a.asset_id, a.symbol);
                });
                setAssetCache(cache);
                setTxAssetCache(symbolCache);
            } catch (error) {
                console.error('Error loading assets:', error);
            }
        };
        loadAssets();
    }, []);

    // Load transactions for this account
    useEffect(() => {
        if (!accountId) return;

        const loadTransactions = async () => {
            try {
                setTxLoading(true);
                const accountIdNum = Number(accountId);

                const [trades, cashJournal, fxTx, corpActions] = await Promise.all([
                    transactionsApi.getTrades(0, 500, accountIdNum),
                    transactionsApi.getCashJournal(0, 500, accountIdNum),
                    transactionsApi.getFxTransactions(0, 500, accountIdNum),
                    transactionsApi.getCorporateActions(0, 500, accountIdNum),
                ]);

                const txList: TransactionDisplay[] = [];
                trades.forEach((t, idx) => txList.push({ id: `trade-${idx}`, type: 'Trade', date: t.trade_date, data: t }));
                cashJournal.forEach((c, idx) => txList.push({ id: `cj-${idx}`, type: 'CashJournal', date: c.date, data: c }));
                fxTx.forEach((f, idx) => txList.push({ id: `fx-${idx}`, type: 'FX', date: f.trade_date, data: f }));
                corpActions.forEach((a, idx) => txList.push({ id: `ca-${idx}`, type: 'CorporateAction', date: a.execution_date, data: a }));

                txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setTxAllTransactions(txList);
            } catch (error) {
                console.error('Error loading transactions:', error);
            } finally {
                setTxLoading(false);
            }
        };

        loadTransactions();
    }, [accountId]);

    // Get asset symbol from cache
    const getAssetSymbol = (assetId: number) => {
        const asset = assetCache.get(assetId);
        return asset?.symbol || `#${assetId}`;
    };

    // Filter positions
    const filteredPositions = useMemo(() => {
        if (!positionSearchQuery.trim()) return positions;
        const query = positionSearchQuery.toLowerCase();
        return positions.filter(p => {
            const asset = assetCache.get(p.asset_id);
            const assetSymbol = asset?.symbol?.toLowerCase() || '';
            const assetName = asset?.name?.toLowerCase() || '';
            return assetSymbol.includes(query) || assetName.includes(query);
        });
    }, [positions, positionSearchQuery, assetCache]);

    // Paginate positions
    const paginatedPositions = useMemo(() => {
        const start = (positionCurrentPage - 1) * positionPageSize;
        return filteredPositions.slice(start, start + positionPageSize);
    }, [filteredPositions, positionCurrentPage, positionPageSize]);

    const positionTotalPages = Math.ceil(filteredPositions.length / positionPageSize);

    // Filter transactions
    const txFilteredTransactions = useMemo(() => {
        const selectedAssetLower = txSelectedAsset.toLowerCase();

        return txAllTransactions.filter(t => {
            if (!txSelectedTypes.includes(t.type)) return false;

            // Asset filter
            if (selectedAssetLower) {
                const assetId = 'asset_id' in t.data ? (t.data as any).asset_id : null;
                if (assetId) {
                    const symbol = txAssetCache.get(assetId) || '';
                    if (!symbol.toLowerCase().includes(selectedAssetLower)) return false;
                } else {
                    return false;
                }
            }

            // Date range filter
            if (txStartDate || txEndDate) {
                const txDate = new Date(t.date);
                if (txStartDate && txDate < txStartDate) return false;
                if (txEndDate) {
                    const endOfDay = new Date(txEndDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (txDate > endOfDay) return false;
                }
            }

            return true;
        });
    }, [txAllTransactions, txSelectedTypes, txSelectedAsset, txStartDate, txEndDate, txAssetCache]);

    // Paginate transactions
    const txPaginated = useMemo(() => {
        const start = (txCurrentPage - 1) * txPageSize;
        return txFilteredTransactions.slice(start, start + txPageSize);
    }, [txFilteredTransactions, txCurrentPage, txPageSize]);

    const txTotalPages = Math.ceil(txFilteredTransactions.length / txPageSize);

    // Unique assets in transactions for dropdown
    const txUniqueAssets = useMemo(() => {
        const assets = new Set<string>();
        txAllTransactions.forEach(t => {
            const assetId = 'asset_id' in t.data ? (t.data as any).asset_id : null;
            if (assetId) {
                const symbol = txAssetCache.get(assetId);
                if (symbol) assets.add(symbol);
            }
        });
        return Array.from(assets).sort();
    }, [txAllTransactions, txAssetCache]);

    const txFilteredAssets = useMemo(() => {
        if (!txAssetSearchInput) return txUniqueAssets.slice(0, 20);
        return txUniqueAssets
            .filter(a => a.toLowerCase().includes(txAssetSearchInput.toLowerCase()))
            .slice(0, 20);
    }, [txUniqueAssets, txAssetSearchInput]);

    // Render position value with color for P&L
    const renderPositionValue = (key: string, value: any) => {
        if (key === 'fifo_pnl_unrealized' && value !== null && value !== undefined) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const colorClass = numValue < 0 ? 'text-red-500' : numValue > 0 ? 'text-green-500' : 'text-foreground';
                return <span className={colorClass}>{formatCurrency(numValue)}</span>;
            }
        }

        // Format currency values
        if (['mark_price', 'position_value', 'cost_basis_money', 'cost_basis_price', 'open_price', 'accrued_interest'].includes(key)) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                return formatCurrency(numValue);
            }
        }

        // Format percent values
        if (key === 'percent_of_nav' && value !== null) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                return formatPercent(numValue / 100);
            }
        }

        // Format dates
        if (['report_date', 'open_date_time', 'vesting_date'].includes(key) && value) {
            return formatDate(value);
        }

        // Format quantity
        if (key === 'quantity' && value !== null) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                return numValue.toLocaleString();
            }
        }

        return value ?? '-';
    };

    // Get position cell value
    const getPositionCellValue = (position: Position, key: string) => {
        switch (key) {
            case 'account':
                return account?.account_alias || account?.account_code || '-';
            case 'asset':
                return getAssetSymbol(position.asset_id);
            case 'report_date':
                return position.report_date;
            case 'quantity':
                return position.quantity;
            case 'mark_price':
                return position.mark_price;
            case 'position_value':
                return position.position_value;
            case 'cost_basis_money':
                return position.cost_basis_money;
            case 'cost_basis_price':
                return position.cost_basis_price;
            case 'open_price':
                return position.open_price;
            case 'fifo_pnl_unrealized':
                return position.fifo_pnl_unrealized;
            case 'percent_of_nav':
                return position.percent_of_nav;
            case 'side':
                return position.side;
            case 'level_of_detail':
                return position.level_of_detail;
            case 'open_date_time':
                return position.open_date_time;
            case 'vesting_date':
                return position.vesting_date;
            case 'accrued_interest':
                return position.accrued_interest;
            case 'fx_rate_to_base':
                return position.fx_rate_to_base;
            default:
                return '-';
        }
    };

    if (loading) {
        return (
            <AppLayout title="Loading...">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </AppLayout>
        );
    }

    if (!portfolio || !account) {
        return (
            <AppLayout title="Account Not Found">
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Account not found</p>
                    <Link to="/portfolios" className="text-primary hover:underline mt-2 inline-block">
                        Back to Portfolios
                    </Link>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            title={portfolio.name}
        >
            {/* Account Header Card */}
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        {/* Account title */}
                        <h2 className="text-xl md:text-2xl font-bold text-foreground">
                            {account.account_alias || account.account_code} | {account.currency}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                                {investor?.full_name || 'Unknown Investor'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {investor?.entity_type || 'Individual'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
                    <div>
                        <p className="text-xs md:text-sm text-muted-foreground mb-1">Total Value</p>
                        <p className="text-lg md:text-2xl font-bold mono text-foreground">
                            {formatCurrency(accountBalance)}
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

                {/* Positions Tab */}
                <TabsContent value="positions" className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                            <h3 className="text-base font-semibold text-foreground">Holdings</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search asset..."
                                        value={positionSearchQuery}
                                        onChange={(e) => {
                                            setPositionSearchQuery(e.target.value);
                                            setPositionCurrentPage(1);
                                        }}
                                        className="pl-8 h-8 w-48 text-sm"
                                    />
                                </div>

                                {/* Column selector */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 text-xs">
                                            <Columns className="h-3.5 w-3.5 mr-1.5" />
                                            Columns
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-3" align="end">
                                        <div className="space-y-2">
                                            {POSITION_COLUMNS.map(col => (
                                                <div key={col.key} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`pos-col-${col.key}`}
                                                        checked={positionVisibleColumns.includes(col.key)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setPositionVisibleColumns([...positionVisibleColumns, col.key]);
                                                            } else {
                                                                setPositionVisibleColumns(positionVisibleColumns.filter(c => c !== col.key));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`pos-col-${col.key}`} className="text-sm cursor-pointer">
                                                        {col.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {positionsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredPositions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No positions found for this account
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                {POSITION_COLUMNS.filter(col => positionVisibleColumns.includes(col.key)).map(col => (
                                                    <th key={col.key} className="text-xs whitespace-nowrap">
                                                        {col.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedPositions.map((position) => (
                                                <tr key={position.position_id}>
                                                    {POSITION_COLUMNS.filter(col => positionVisibleColumns.includes(col.key)).map(col => (
                                                        <td key={col.key} className="text-xs whitespace-nowrap">
                                                            {renderPositionValue(col.key, getPositionCellValue(position, col.key))}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {positionTotalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                                        <p className="text-xs text-muted-foreground">
                                            Showing {((positionCurrentPage - 1) * positionPageSize) + 1} to {Math.min(positionCurrentPage * positionPageSize, filteredPositions.length)} of {filteredPositions.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPositionCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={positionCurrentPage === 1}
                                                className="h-8"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                Page {positionCurrentPage} of {positionTotalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPositionCurrentPage(p => Math.min(positionTotalPages, p + 1))}
                                                disabled={positionCurrentPage === positionTotalPages}
                                                className="h-8"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <h3 className="text-base font-semibold text-foreground">Transaction History</h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Type filters */}
                                    <div className="flex items-center gap-1">
                                        {txTypeFilters.map(type => (
                                            <Button
                                                key={type}
                                                variant={txSelectedTypes.includes(type) ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => {
                                                    if (txSelectedTypes.includes(type)) {
                                                        setTxSelectedTypes(txSelectedTypes.filter(t => t !== type));
                                                    } else {
                                                        setTxSelectedTypes([...txSelectedTypes, type]);
                                                    }
                                                    setTxCurrentPage(1);
                                                }}
                                                className="h-7 text-xs"
                                            >
                                                {type === 'CashJournal' ? 'Cash' : type === 'CorporateAction' ? 'Corp' : type}
                                            </Button>
                                        ))}
                                    </div>

                                    {/* Asset filter */}
                                    <Popover open={txAssetDropdownOpen} onOpenChange={setTxAssetDropdownOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                                <Filter className="h-3 w-3 mr-1" />
                                                {txSelectedAsset || 'Asset'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="end">
                                            <Input
                                                placeholder="Search asset..."
                                                value={txAssetSearchInput}
                                                onChange={(e) => setTxAssetSearchInput(e.target.value)}
                                                className="h-8 text-sm mb-2"
                                            />
                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setTxSelectedAsset('');
                                                        setTxAssetDropdownOpen(false);
                                                        setTxCurrentPage(1);
                                                    }}
                                                    className="w-full justify-start h-7 text-xs"
                                                >
                                                    All Assets
                                                </Button>
                                                {txFilteredAssets.map(asset => (
                                                    <Button
                                                        key={asset}
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setTxSelectedAsset(asset);
                                                            setTxAssetDropdownOpen(false);
                                                            setTxCurrentPage(1);
                                                        }}
                                                        className="w-full justify-start h-7 text-xs"
                                                    >
                                                        {asset}
                                                    </Button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Date range */}
                                    <Popover open={txStartDateOpen} onOpenChange={setTxStartDateOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                {txStartDate ? format(txStartDate, 'MMM d') : 'From'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <CalendarComponent
                                                mode="single"
                                                selected={txStartDate}
                                                onSelect={(date) => {
                                                    setTxStartDate(date);
                                                    setTxStartDateOpen(false);
                                                    setTxCurrentPage(1);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <Popover open={txEndDateOpen} onOpenChange={setTxEndDateOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                {txEndDate ? format(txEndDate, 'MMM d') : 'To'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <CalendarComponent
                                                mode="single"
                                                selected={txEndDate}
                                                onSelect={(date) => {
                                                    setTxEndDate(date);
                                                    setTxEndDateOpen(false);
                                                    setTxCurrentPage(1);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    {/* Clear filters */}
                                    {(txSelectedAsset || txStartDate || txEndDate) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setTxSelectedAsset('');
                                                setTxStartDate(undefined);
                                                setTxEndDate(undefined);
                                                setTxCurrentPage(1);
                                            }}
                                            className="h-7 text-xs text-muted-foreground"
                                        >
                                            Clear
                                        </Button>
                                    )}

                                    {/* Column selector */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                                <Columns className="h-3 w-3 mr-1" />
                                                Columns
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-3" align="end">
                                            <div className="space-y-2">
                                                {TX_COLUMNS.map(col => (
                                                    <div key={col.key} className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={`tx-col-${col.key}`}
                                                            checked={txVisibleColumns.includes(col.key)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setTxVisibleColumns([...txVisibleColumns, col.key]);
                                                                } else {
                                                                    setTxVisibleColumns(txVisibleColumns.filter(c => c !== col.key));
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor={`tx-col-${col.key}`} className="text-sm cursor-pointer">
                                                            {col.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {txLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                        ) : txFilteredTransactions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No transactions found
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                {TX_COLUMNS.filter(col => txVisibleColumns.includes(col.key)).map(col => (
                                                    <th key={col.key} className="text-xs whitespace-nowrap">
                                                        {col.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {txPaginated.map((tx) => (
                                                <tr key={tx.id}>
                                                    {TX_COLUMNS.filter(col => txVisibleColumns.includes(col.key)).map(col => {
                                                        let value = col.getValue(tx.data);
                                                        // Replace asset_id with symbol
                                                        if (col.key === 'asset_id' && typeof value === 'number') {
                                                            value = txAssetCache.get(value) || `#${value}`;
                                                        }
                                                        // Format date
                                                        if (col.key === 'date' && value) {
                                                            value = formatDate(String(value));
                                                        }
                                                        // Format amount
                                                        if (col.key === 'amount' && value) {
                                                            value = formatCurrency(Number(value));
                                                        }
                                                        return (
                                                            <td key={col.key} className="text-xs whitespace-nowrap">
                                                                {value ?? '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {txTotalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                                        <p className="text-xs text-muted-foreground">
                                            Showing {((txCurrentPage - 1) * txPageSize) + 1} to {Math.min(txCurrentPage * txPageSize, txFilteredTransactions.length)} of {txFilteredTransactions.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTxCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={txCurrentPage === 1}
                                                className="h-8"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                                Page {txCurrentPage} of {txTotalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTxCurrentPage(p => Math.min(txTotalPages, p + 1))}
                                                disabled={txCurrentPage === txTotalPages}
                                                className="h-8"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </TabsContent>

                {/* Allocation Tab (Mocked) */}
                <TabsContent value="allocation" className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="text-base font-semibold text-foreground mb-4">Asset Allocation</h3>
                        <div className="text-center py-12 text-muted-foreground">
                            <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Allocation chart coming soon</p>
                        </div>
                    </div>
                </TabsContent>

                {/* Cash Tab (Mocked) */}
                <TabsContent value="cash" className="space-y-4">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="text-base font-semibold text-foreground mb-4">Cash Summary</h3>
                        <div className="text-center py-12 text-muted-foreground">
                            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Cash summary coming soon</p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
};

export default PortfolioAccounts;
