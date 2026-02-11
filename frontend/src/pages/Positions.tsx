import { Fragment, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatCurrency, formatNumber, formatPercent, getChangeColor, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2, Briefcase, Filter, X, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Radio, Wifi, WifiOff } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';
import { toast } from 'sonner';
import { useLivePricesSSE, LivePriceData } from '@/hooks/useLivePricesSSE';

const ITEMS_PER_PAGE = 15;
// getApiBaseUrl() returns the API URL with runtime protocol detection

// Sortable header component
const SortableHeader = ({ 
  column, 
  label, 
  sortColumn, 
  sortDirection, 
  onSort, 
  align = 'left' 
}: { 
  column: string; 
  label: string; 
  sortColumn: string | null; 
  sortDirection: 'asc' | 'desc'; 
  onSort: (column: string) => void; 
  align?: 'left' | 'right' | 'center';
}) => {
  const isActive = sortColumn === column;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  
  return (
    <th 
      className={cn(
        alignClass, 
        "cursor-pointer hover:bg-muted/50 transition-colors select-none",
        isActive && "bg-muted/30"
      )}
      onClick={() => onSort(column)}
    >
      <div className={cn("flex items-center gap-1", align === 'right' && "justify-end", align === 'center' && "justify-center")}>
        <span>{label}</span>
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </th>
  );
};

interface AggregatedAsset {
  asset_id: number;
  asset_symbol: string;
  asset_class: string;
  total_quantity: number;
  avg_cost_price: number;
  avg_cost_price_original?: number;
  current_mark_price: number;
  current_mark_price_original?: number;
  total_market_value: number;
  total_market_value_original?: number;
  total_cost_basis_money: number;
  total_cost_basis_money_original?: number;
  total_pnl_unrealized: number;
  total_pnl_unrealized_original?: number;
  day_change_pct: number;
  // Distribución de rendimiento
  gainers_count: number;
  losers_count: number;
  neutral_count: number;
  best_pnl_pct: number | null;
  worst_pnl_pct: number | null;
  median_pnl_pct: number | null;
  // Desglose por cuenta
  institutions: Array<{
    institution: string;
    account_id: number;
    user_name: string | null;
    user_first_name: string | null;
    user_last_name: string | null;
    quantity: number | null;
    avg_cost_price: number | null;
    avg_cost_price_original?: number;
    cost_basis_money: number | null;
    cost_basis_money_original?: number;
    market_price: number | null;
    market_price_original?: number;
    market_value: number | null;
    market_value_original?: number;
    unrealized_pnl: number | null;
    unrealized_pnl_original?: number;
    day_change_pct: number | null;
    fx_rate_to_base: number | null;
    currency: string | null;
  }>;
  account_ids: number[];
  fx_rate_to_base: number;
  currency: string;
}

interface TopMover {
  asset_id: number;
  asset_symbol: string;
  asset_name: string | null;
  current_price: number;
  previous_price: number;
  change_pct: number;
  direction: string;
}

interface FilterOptions {
  portfolios: Array<{ id: number; name: string }>;
  asset_classes: Array<{ id: number; code: string; name: string }>;
  asset_subclasses: Array<{ id: number; class_id: number; code: string; name: string }>;
  assets: Array<{ id: number; symbol: string; name: string; class_id: number; subclass_id?: number }>;
  available_dates: string[];
}

// Live price data from IBKR
interface LivePriceItem {
  asset_id: number;
  symbol: string | null;
  isin: string | null;
  live_price: number;
  previous_close: number | null;
  day_change_pct: number | null;
  bid: number | null;
  ask: number | null;
  last: number | null;
  timestamp: string | null;
  currency: string;
}

// LocalStorage key for persisting Live Data state
const LIVE_DATA_STORAGE_KEY = 'wealthroad_live_data_enabled';

const Positions = () => {
  // Helper function to format currency with dual display if not USD
  const formatCurrencyWithCode = (valueOriginal: number, valueUSD: number, currency: string = 'USD') => {
    const formatValue = (val: number) => val.toFixed(2);
    
    if (currency === 'USD' || !currency) {
      return `${formatValue(valueUSD)} USD`;
    }
    // Show: original value in local currency - converted value in USD
    return (
      <span className="whitespace-nowrap">
        {formatValue(valueOriginal)} {currency} - {formatValue(valueUSD)} USD
      </span>
    );
  };

  // Filters State
  const [reportDate, setReportDate] = useState<string>('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [portfolioSearchQuery, setPortfolioSearchQuery] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('');
  const [selectedAssetSubclass, setSelectedAssetSubclass] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [selectedAssetInTable, setSelectedAssetInTable] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Track value changes for institutions (for color animation)
  const [institutionValueChanges, setInstitutionValueChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  const previousInstitutionValuesRef = useRef<Map<string, { mktValue: number; unrealizedPnl: number }>>(new Map());

  // Data State
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [positions, setPositions] = useState<AggregatedAsset[]>([]);
  const [movers, setMovers] = useState<{ gainers: TopMover[]; losers: TopMover[] }>({ gainers: [], losers: [] });
  const [moversFilterType, setMoversFilterType] = useState<'all' | 'options' | 'all_except_options'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Data State - using SSE (persisted in localStorage)
  const [liveDataEnabled, setLiveDataEnabled] = useState(() => {
    // Read initial state from localStorage
    const stored = localStorage.getItem(LIVE_DATA_STORAGE_KEY);
    return stored === 'true';
  });

  // Track price changes for animation (asset_id -> 'up' | 'down' | null)
  const [priceChanges, setPriceChanges] = useState<Map<number, 'up' | 'down' | null>>(new Map());
  const previousPricesRef = useRef<Map<number, number>>(new Map());
  const PRICE_CHANGE_STORAGE_KEY = 'wealthroad_price_change_states';

  const savePriceChangesToStorage = useCallback((map: Map<number, 'up' | 'down' | null>) => {
    try {
      const arr = Array.from(map.entries());
      localStorage.setItem(PRICE_CHANGE_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error('[SSE] Error saving price change states:', e);
    }
  }, []);

  const loadPriceChangesFromStorage = useCallback((): Map<number, 'up' | 'down' | null> => {
    try {
      const raw = localStorage.getItem(PRICE_CHANGE_STORAGE_KEY);
      if (!raw) return new Map();
      const parsed = JSON.parse(raw) as Array<[number, 'up' | 'down' | null]>;
      return new Map(parsed.map(([k, v]) => [Number(k), v]));
    } catch (e) {
      console.error('[SSE] Error loading price change states:', e);
      return new Map();
    }
  }, []);

  // Load persisted price change states on mount
  useEffect(() => {
    const loaded = loadPriceChangesFromStorage();
    if (loaded && loaded.size > 0) {
      setPriceChanges(loaded);
    }
  }, [loadPriceChangesFromStorage]);

  // Persist priceChanges whenever it changes (or clear storage when empty)
  useEffect(() => {
    if (priceChanges && priceChanges.size > 0) {
      savePriceChangesToStorage(priceChanges);
    } else {
      try { localStorage.removeItem(PRICE_CHANGE_STORAGE_KEY); } catch {}
    }
  }, [priceChanges, savePriceChangesToStorage]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/analytics/filter-options`);
        if (!response.ok) throw new Error('Failed to load filter options');
        const data = await response.json();
        setFilterOptions(data);
        // Set default date to the latest available
        if (data.available_dates && data.available_dates.length > 0) {
          setReportDate(data.available_dates[0]);
        }
      } catch (err) {
        console.error('Error loading filter options:', err);
        setError('Failed to load filter options');
      }
    };
    loadFilterOptions();
  }, []);

  // Load positions when filters change
  useEffect(() => {
    if (!reportDate) return;

    const loadPositions = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      try {
        const params = new URLSearchParams({
          report_date: reportDate,
          ...(selectedPortfolio && { portfolio_id: selectedPortfolio }),
          ...(selectedAssetClass && { asset_class_id: selectedAssetClass }),
          ...(selectedAssetSubclass && { asset_subclass_id: selectedAssetSubclass }),
          ...(selectedAsset && { asset_id: selectedAsset }),
        });

        const response = await fetch(`${getApiBaseUrl()}/api/v1/analytics/positions-report?${params}`);
        if (!response.ok) throw new Error('Failed to load positions');
        const data = await response.json();
        
        // Apply fx_rate_to_base transformation to all monetary values
        // Keep both original and converted values for display
        const transformedData = data.map((asset: any) => ({
          ...asset,
          // Store original values with _original suffix
          avg_cost_price_original: asset.avg_cost_price,
          total_cost_basis_money_original: asset.total_cost_basis_money,
          current_mark_price_original: asset.current_mark_price,
          total_market_value_original: asset.total_market_value,
          total_pnl_unrealized_original: asset.total_pnl_unrealized,
          // Convert to USD
          avg_cost_price: asset.avg_cost_price * (asset.fx_rate_to_base || 1),
          total_cost_basis_money: asset.total_cost_basis_money * (asset.fx_rate_to_base || 1),
          current_mark_price: asset.current_mark_price * (asset.fx_rate_to_base || 1),
          total_market_value: asset.total_market_value * (asset.fx_rate_to_base || 1),
          total_pnl_unrealized: asset.total_pnl_unrealized * (asset.fx_rate_to_base || 1),
          institutions: asset.institutions.map((inst: any) => ({
            ...inst,
            // Store original values
            avg_cost_price_original: inst.avg_cost_price ?? 0,
            cost_basis_money_original: inst.cost_basis_money ?? 0,
            market_price_original: inst.market_price ?? 0,
            market_value_original: inst.market_value ?? 0,
            unrealized_pnl_original: inst.unrealized_pnl ?? 0,
            // Convert to USD
            avg_cost_price: (inst.avg_cost_price ?? 0) * (inst.fx_rate_to_base ?? 1),
            cost_basis_money: (inst.cost_basis_money ?? 0) * (inst.fx_rate_to_base ?? 1),
            market_price: (inst.market_price ?? 0) * (inst.fx_rate_to_base ?? 1),
            market_value: (inst.market_value ?? 0) * (inst.fx_rate_to_base ?? 1),
            unrealized_pnl: (inst.unrealized_pnl ?? 0) * (inst.fx_rate_to_base ?? 1),
          }))
        }));
        
        setPositions(transformedData);
      } catch (err) {
        console.error('Error loading positions:', err);
        setError('Failed to load positions');
      } finally {
        setLoading(false);
      }
    };

    loadPositions();
  }, [reportDate, selectedPortfolio, selectedAssetClass, selectedAssetSubclass, selectedAsset]);

  // Load top movers when report date changes or live data changes
  useEffect(() => {
    if (!reportDate) return;

    // If live data is disabled, clear movers
    if (!liveDataEnabled) {
      setMovers({ gainers: [], losers: [] });
      return;
    }

    // When live data is enabled, movers are calculated from live prices (see below)
  }, [reportDate, moversFilterType, liveDataEnabled]);

  // Load top movers when report date changes or live data changes
  useEffect(() => {
    if (!reportDate) return;

    // If live data is disabled, clear movers
    if (!liveDataEnabled) {
      setMovers({ gainers: [], losers: [] });
      return;
    }

    // When live data is enabled, movers are calculated from live prices (see below)
  }, [reportDate, moversFilterType, liveDataEnabled]);

  // Filter portfolios for the Portfolio dropdown based on search
  const filteredPortfoliosForDropdown = useMemo(() => {
    if (!filterOptions?.portfolios) return [];
    if (!portfolioSearchQuery) return filterOptions.portfolios;
    
    const query = portfolioSearchQuery.toLowerCase();
    return filterOptions.portfolios.filter(p => 
      p.name.toLowerCase().includes(query)
    );
  }, [filterOptions?.portfolios, portfolioSearchQuery]);

  // Filter assets for the Asset dropdown based on search
  const filteredAssetsForDropdown = useMemo(() => {
    if (!filterOptions?.assets) return [];
    if (!assetSearchQuery) return filterOptions.assets;
    
    const query = assetSearchQuery.toLowerCase();
    return filterOptions.assets.filter(a => 
      a.symbol.toLowerCase().includes(query) || 
      a.name.toLowerCase().includes(query)
    );
  }, [filterOptions?.assets, assetSearchQuery]);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filter positions by table search (NOT by selected asset - selection only expands)
  const filteredPositions = useMemo(() => {
    let result = [...positions];

    if (tableSearchQuery) {
      const query = tableSearchQuery.toLowerCase();
      result = result.filter(p =>
        p.asset_symbol.toLowerCase().includes(query) ||
        p.institutions.some(inst => {
          const displayName = inst.user_first_name && inst.user_last_name
            ? `${inst.institution}-${inst.user_first_name} ${inst.user_last_name}`
            : inst.institution;
          return displayName.toLowerCase().includes(query);
        })
      );
    }

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case 'symbol':
            aVal = a.asset_symbol;
            bVal = b.asset_symbol;
            break;
          case 'quantity':
            aVal = a.total_quantity;
            bVal = b.total_quantity;
            break;
          case 'avg_cost':
            aVal = a.avg_cost_price;
            bVal = b.avg_cost_price;
            break;
          case 'cost_basis':
            aVal = a.total_cost_basis_money;
            bVal = b.total_cost_basis_money;
            break;
          case 'market_price':
            aVal = a.current_mark_price;
            bVal = b.current_mark_price;
            break;
          case 'market_value':
            aVal = a.total_market_value;
            bVal = b.total_market_value;
            break;
          case 'pnl':
            aVal = a.total_pnl_unrealized;
            bVal = b.total_pnl_unrealized;
            break;
          case 'day_change':
            aVal = a.day_change_pct || 0;
            bVal = b.day_change_pct || 0;
            break;
          case 'accounts':
            aVal = a.institutions.length;
            bVal = b.institutions.length;
            break;
          default:
            return 0;
        }

        // Handle string comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        // Handle numeric comparison
        const aNum = Number(aVal) || 0;
        const bNum = Number(bVal) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      });
    } else {
      // Default sort: by number of accounts (mayor a menor)
      result.sort((a, b) => b.institutions.length - a.institutions.length);
    }

    return result;
  }, [positions, tableSearchQuery, sortColumn, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(filteredPositions.length / ITEMS_PER_PAGE);
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPositions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPositions, currentPage]);

  // ==================== LIVE DATA LOGIC (SSE) ====================
  
  // Get all asset IDs to subscribe to (all filtered positions, not just current page)
  const allAssetIds = useMemo(() => {
    return filteredPositions.map(p => p.asset_id);
  }, [filteredPositions]);
  
  // Use the SSE hook for live price streaming
  const { 
    state: sseState, 
    prices: ssePrices, 
    disconnect: sseDisconnect,
    reconnect: sseReconnect,
    clearCache: sseClearCache
  } = useLivePricesSSE({
    enabled: liveDataEnabled,
    assetIds: allAssetIds,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
  });
  
  // Convert SSE prices to the LivePriceItem format expected by the component
  const livePrices = useMemo(() => {
    const map = new Map<number, LivePriceItem>();
    ssePrices.forEach((price, assetId) => {
      map.set(assetId, {
        asset_id: price.asset_id,
        symbol: price.symbol || null,
        isin: price.isin,
        live_price: price.live_price,
        previous_close: price.previous_close,
        day_change_pct: price.day_change_pct,
        bid: price.bid,
        ask: price.ask,
        last: price.last,
        timestamp: price.timestamp,
        currency: price.currency,
      });
    });
    return map;
  }, [ssePrices]);
  
  // Derived state from SSE
  const liveDataConnected = sseState.connected;
  const liveDataLoading = sseState.connecting;
  const lastLiveUpdate = sseState.lastUpdate;

  // Calculate live movers when live prices change
  useEffect(() => {
    if (!liveDataEnabled || livePrices.size === 0) {
      return;
    }

    // Get OPTION class_id dynamically
    const optionClass = filterOptions?.asset_classes.find(ac => ac.code === 'OPTION');
    const optionClassId = optionClass?.id.toString();

    // Get all assets with live prices
    const moversData: TopMover[] = [];
    
    livePrices.forEach((priceData, assetId) => {
      const asset = positions.find(p => p.asset_id === assetId);
      if (!asset) return;

      // Apply filter
      if (moversFilterType === 'options') {
        if (asset.asset_class !== optionClassId) return;
      } else if (moversFilterType === 'all_except_options') {
        if (asset.asset_class === optionClassId) return;
      }

      const currentPrice = priceData.live_price;
      const previousPrice = asset.current_mark_price;

      if (previousPrice > 0) {
        const pctChange = ((currentPrice - previousPrice) / previousPrice) * 100;
        
        moversData.push({
          asset_id: assetId,
          asset_symbol: asset.asset_symbol,
          asset_name: asset.asset_symbol,
          current_price: currentPrice,
          previous_price: previousPrice,
          change_pct: pctChange,
          direction: pctChange >= 0 ? 'UP' : 'DOWN',
        });
      }
    });

    // Sort and get top 5 gainers and losers
    const sortedByChange = [...moversData].sort((a, b) => b.change_pct - a.change_pct);
    const gainers = sortedByChange.slice(0, 5);
    const losers = sortedByChange.slice(-5).reverse();

    setMovers({ gainers, losers });
  }, [livePrices, positions, moversFilterType, liveDataEnabled, filterOptions]);

  // Toggle live data on/off
  const toggleLiveData = useCallback(() => {
    if (liveDataEnabled) {
      console.log('[Live Data] Turning off...');
      setLiveDataEnabled(false);
      localStorage.setItem(LIVE_DATA_STORAGE_KEY, 'false');
      sseDisconnect();
      // Clear cached prices when manually disabling
      sseClearCache();
    } else {
      console.log('[Live Data] Turning on...');
      setLiveDataEnabled(true);
      localStorage.setItem(LIVE_DATA_STORAGE_KEY, 'true');
    }
  }, [liveDataEnabled, sseDisconnect, sseClearCache]);

  // Handle SSE errors
  useEffect(() => {
    if (sseState.error) {
      toast.error(`Live Data: ${sseState.error}`);
    }
  }, [sseState.error]);

  // Detect price changes and trigger animations
  useEffect(() => {
    if (!liveDataEnabled || livePrices.size === 0) {
      // Clear all changes when live data is disabled
      setPriceChanges(new Map());
      previousPricesRef.current.clear();
      return;
    }

    const newChanges = new Map<number, 'up' | 'down' | null>();
    let hasAnyPreviousPrice = false;

    livePrices.forEach((currentPrice, assetId) => {
      const previousPrice = previousPricesRef.current.get(assetId);
      
      if (previousPrice !== undefined) {
        hasAnyPreviousPrice = true;
        if (currentPrice.live_price !== previousPrice) {
          // Price changed! Set direction
          const direction = currentPrice.live_price > previousPrice ? 'up' : 'down';
          newChanges.set(assetId, direction);
        }
      }

      // Update previous price
      previousPricesRef.current.set(assetId, currentPrice.live_price);
    });

    // Only update price changes if we had previous prices to compare
    // On first load after page reload, preserve the colors loaded from localStorage
    if (hasAnyPreviousPrice) {
      // Replace all changes (clearing old ones and setting new ones)
      // This way, colors only show until the next price update
      setPriceChanges(newChanges);
    }
  }, [livePrices, liveDataEnabled]);

  // ==================== END LIVE DATA LOGIC ====================

  const buildFilterString = () => {
    const params = new URLSearchParams();
    if (selectedPortfolio) params.set('portfolio', selectedPortfolio);
    if (selectedAssetClass) params.set('class', selectedAssetClass);
    if (selectedAssetSubclass) params.set('subclass', selectedAssetSubclass);
    if (selectedAsset) params.set('asset', selectedAsset);
    if (reportDate) params.set('date', reportDate);
    return params.toString();
  };

  const clearSingleFilter = (filterType: string) => {
    switch (filterType) {
      case 'portfolio':
        setSelectedPortfolio('');
        setPortfolioSearchQuery('');
        break;
      case 'class':
        setSelectedAssetClass('');
        break;
      case 'subclass':
        setSelectedAssetSubclass('');
        break;
      case 'asset':
        setSelectedAsset('');
        setAssetSearchQuery('');
        break;
      case 'search':
        setTableSearchQuery('');
        break;
    }
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedPortfolio('');
    setPortfolioSearchQuery('');
    setSelectedAssetClass('');
    setSelectedAssetSubclass('');
    setSelectedAsset('');
    setAssetSearchQuery('');
    setTableSearchQuery('');
    setSelectedAssetInTable(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedPortfolio || selectedAssetClass || selectedAssetSubclass || selectedAsset || tableSearchQuery;

  // Navigate to the page containing the asset and expand it
  const navigateToAsset = (assetId: number) => {
    const assetIndex = filteredPositions.findIndex(pos => pos.asset_id === assetId);
    
    if (assetIndex === -1) {
      // Asset not found in current filtered positions
      console.warn('Asset not found in current filtered positions:', assetId);
      return;
    }
    
    const targetPage = Math.floor(assetIndex / ITEMS_PER_PAGE) + 1;
    setCurrentPage(targetPage);
    setSelectedAssetInTable(assetId);
  };

  return (
    <AppLayout title="Positions" subtitle="Real-time positions with advanced filtering">
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter */}
          <div className="relative">
            <Select value={reportDate} onValueChange={setReportDate}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.available_dates.map(date => (
                  <SelectItem key={date} value={date}>
                    {formatDate(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live Data Toggle Button */}
          <Button
            variant={liveDataEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleLiveData}
            className={cn(
              "gap-2 transition-all",
              liveDataEnabled && "bg-green-600 hover:bg-green-700 text-white",
              liveDataEnabled && liveDataLoading && "animate-pulse"
            )}
          >
            {liveDataEnabled ? (
              liveDataConnected ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )
            ) : (
              <Radio className="h-4 w-4" />
            )}
            {liveDataEnabled ? (
              <>
                Live Data
                {liveDataConnected && lastLiveUpdate && (
                  <span className="text-[10px] opacity-75">
                    {lastLiveUpdate.toLocaleTimeString()}
                  </span>
                )}
              </>
            ) : (
              "Live Data"
            )}
          </Button>

          {/* Live Data Status Badge */}
          {liveDataEnabled && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                liveDataConnected 
                  ? "bg-green-500/10 text-green-500 border-green-500/30" 
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              )}
            >
              {liveDataConnected ? "Connected" : "Connecting..."}
            </Badge>
          )}

          {/* Portfolio Filter with Search */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Portfolios" />
              </SelectTrigger>
              <SelectContent>
                <Input
                  placeholder="Search portfolios..."
                  value={portfolioSearchQuery}
                  onChange={(e) => setPortfolioSearchQuery(e.target.value)}
                  className="m-2 mb-3 h-8"
                  onClick={(e) => e.stopPropagation()}
                />
                {filteredPortfoliosForDropdown.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPortfolio && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('portfolio')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset Class Filter */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAssetClass} onValueChange={setSelectedAssetClass}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.asset_classes.map(ac => (
                  <SelectItem key={ac.id} value={ac.id.toString()}>
                    {ac.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssetClass && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('class')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset SubClass Filter */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAssetSubclass} onValueChange={setSelectedAssetSubclass}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All SubClasses" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.asset_subclasses.map(asc => (
                  <SelectItem key={asc.id} value={asc.id.toString()}>
                    {asc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssetSubclass && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('subclass')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Asset Filter with Search */}
          <div className="relative flex items-center gap-1">
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-40 bg-muted/50 border-border">
                <SelectValue placeholder="All Assets" />
              </SelectTrigger>
              <SelectContent>
                <Input
                  placeholder="Search assets..."
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  className="m-2 mb-3 h-8"
                  onClick={(e) => e.stopPropagation()}
                />
                {filteredAssetsForDropdown.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.symbol} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAsset && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearSingleFilter('asset')}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <Button variant="default" size="sm" onClick={clearAllFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear All
            </Button>
          )}

          <div className="flex-1" />

          <SaveFilterButton
            currentPath="/positions"
            currentFilters={buildFilterString()}
            defaultTitle="Positions Filter"
          />
        </div>
      </div>

      {/* Top Movers - Day Only */}
      {/* Movers Filter Buttons */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={moversFilterType === 'all' ? 'default' : 'outline'}
            onClick={() => setMoversFilterType('all')}
            className="h-7 text-xs"
          >
            All Assets
          </Button>
          <Button
            size="sm"
            variant={moversFilterType === 'options' ? 'default' : 'outline'}
            onClick={() => setMoversFilterType('options')}
            className="h-7 text-xs"
          >
            Options
          </Button>
          <Button
            size="sm"
            variant={moversFilterType === 'all_except_options' ? 'default' : 'outline'}
            onClick={() => setMoversFilterType('all_except_options')}
            className="h-7 text-xs"
          >
            All Except Options
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gain" />
              Top Gainers {liveDataEnabled ? "(Live)" : "Today"}
              {liveDataEnabled && liveDataConnected && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {!liveDataEnabled ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-2">Enable Live Data to see top gainers</p>
                  <Button size="sm" variant="outline" onClick={toggleLiveData}>
                    Enable Live Data
                  </Button>
                </div>
              ) : movers.gainers.length > 0 ? movers.gainers.map((asset) => (
                <div 
                  key={`gainers-${asset.asset_id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigateToAsset(asset.asset_id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.asset_symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.asset_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gain">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">+{asset.change_pct.toFixed(2)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-2">No gainers available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-loss" />
              Top Losers {liveDataEnabled ? "(Live)" : "Today"}
              {liveDataEnabled && liveDataConnected && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {!liveDataEnabled ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-2">Enable Live Data to see top losers</p>
                  <Button size="sm" variant="outline" onClick={toggleLiveData}>
                    Enable Live Data
                  </Button>
                </div>
              ) : movers.losers.length > 0 ? movers.losers.map((asset) => (
                <div 
                  key={`losers-${asset.asset_id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigateToAsset(asset.asset_id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.asset_symbol}</span>
                    <span className="text-muted-foreground text-sm truncate max-w-[120px]">{asset.asset_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-loss">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span className="font-medium mono">{asset.change_pct.toFixed(2)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-2">No losers available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search table (asset, institution)..."
            value={tableSearchQuery}
            onChange={(e) => {
              setTableSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>
        {tableSearchQuery && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => clearSingleFilter('search')}
            className="h-9"
          >
            <X className="h-4 w-4 mr-1" />
            Clear search
          </Button>
        )}
      </div>

      {/* Aggregated Assets Table */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Positions ({filteredPositions.length} / {positions.length} assets)
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableHeader column="symbol" label="Asset" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader column="quantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="avg_cost" label="Avg Price (USD)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="cost_basis" label="Cost Basis (USD)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="market_price" label="Market Price (USD)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="market_value" label="Market Value (USD)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="pnl" label="Unrealized P&L (USD)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <th className="text-center">Distribution</th>
                  <SortableHeader column="day_change" label="Day Chg %" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader column="accounts" label="Accounts" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {paginatedPositions.length > 0 ? paginatedPositions.map((asset) => {
                  const isSelected = selectedAssetInTable === asset.asset_id;
                  const isPositivePL = asset.total_pnl_unrealized >= 0;
                  
                  // Get live price data if available
                  const livePrice = livePrices.get(asset.asset_id);
                  const displayPrice = liveDataEnabled && livePrice 
                    ? livePrice.live_price 
                    : asset.current_mark_price;
                  const displayDayChange = liveDataEnabled && livePrice && livePrice.day_change_pct !== null
                    ? livePrice.day_change_pct
                    : asset.day_change_pct;
                  const isPositiveDay = (displayDayChange || 0) >= 0;
                  
                  // Get price change animation state
                  const priceChange = priceChanges.get(asset.asset_id);

                  return (
                    <Fragment key={asset.asset_id}>
                      <tr 
                        className={cn("group cursor-pointer", isSelected && "bg-muted/50")}
                        onClick={() => setSelectedAssetInTable(isSelected ? null : asset.asset_id)}
                      >
                        <td>
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {asset.asset_symbol}
                            </p>
                          </div>
                        </td>
                        <td className="text-right mono">{formatNumber(asset.total_quantity)}</td>
                        <td className="text-right mono text-xs">{formatCurrencyWithCode(asset.avg_cost_price_original, asset.avg_cost_price, asset.currency)}</td>
                        <td className="text-right mono text-xs">{formatCurrencyWithCode(asset.total_cost_basis_money_original, asset.total_cost_basis_money, asset.currency)}</td>
                        <td className="text-right mono text-xs">
                          <div className="flex items-center justify-end gap-1">
                            {liveDataEnabled && livePrice && (
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live price" />
                            )}
                            <span className={cn(
                              "transition-colors duration-300",
                              priceChange === 'up' && "text-green-500 font-semibold",
                              priceChange === 'down' && "text-red-500 font-semibold",
                              !priceChange && liveDataEnabled && livePrice && "font-medium"
                            )}>
                              {liveDataEnabled && livePrice 
                                ? `${displayPrice.toFixed(2)} USD`
                                : formatCurrencyWithCode(asset.current_mark_price_original, asset.current_mark_price, asset.currency)
                              }
                            </span>
                          </div>
                        </td>
                        <td className="text-right mono font-medium text-xs">{formatCurrencyWithCode(asset.total_market_value_original, asset.total_market_value, asset.currency)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPositivePL ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-gain" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                            )}
                            <p className={cn('text-xs font-medium mono', getChangeColor(asset.total_pnl_unrealized))}>
                              {isPositivePL ? '+' : ''}{formatCurrencyWithCode(asset.total_pnl_unrealized_original, asset.total_pnl_unrealized, asset.currency)}
                            </p>
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-gain font-medium">▲{asset.gainers_count}</span>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-loss font-medium">▼{asset.losers_count}</span>
                            </div>
                            {asset.median_pnl_pct !== null && (
                              <span className={cn('text-[10px] mono', getChangeColor(asset.median_pnl_pct))}>
                                Med: {asset.median_pnl_pct >= 0 ? '+' : ''}{asset.median_pnl_pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {liveDataEnabled && livePrice && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            )}
                            <span className={cn(
                              'text-sm mono', 
                              getChangeColor(displayDayChange || 0),
                              liveDataEnabled && livePrice && "font-semibold"
                            )}>
                              {formatPercent(displayDayChange || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {asset.institutions.length}
                          </Badge>
                        </td>
                      </tr>
                      {/* Expanded Account Details */}
                      {isSelected && (
                        <tr key={`expand-${asset.asset_id}`} className="bg-muted/30">
                          <td colSpan={10} className="p-0">
                            <div className="p-4 border-t border-border">
                              {/* Resumen de distribución */}
                              <div className="mb-4 p-3 bg-card rounded-lg border border-border">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Performance Distribution</p>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gain font-medium">▲ {asset.gainers_count} gaining</span>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="text-loss font-medium">▼ {asset.losers_count} losing</span>
                                    {asset.neutral_count > 0 && (
                                      <>
                                        <span className="text-muted-foreground">|</span>
                                        <span className="text-muted-foreground">{asset.neutral_count} neutral</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <span>Range:</span>
                                    {asset.best_pnl_pct !== null && (
                                      <span className="text-gain mono">+{asset.best_pnl_pct.toFixed(2)}%</span>
                                    )}
                                    <span>to</span>
                                    {asset.worst_pnl_pct !== null && (
                                      <span className="text-loss mono">{asset.worst_pnl_pct.toFixed(2)}%</span>
                                    )}
                                  </div>
                                  {asset.median_pnl_pct !== null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Median:</span>
                                      <span className={cn('mono font-medium', getChangeColor(asset.median_pnl_pct))}>
                                        {asset.median_pnl_pct >= 0 ? '+' : ''}{asset.median_pnl_pct.toFixed(2)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                Accounts holding {asset.asset_symbol} ({asset.institutions.length})
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Account</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qty</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Avg Price</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost Basis</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Mkt Price</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Mkt Value</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Unrealized P&L</th>
                                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Unrealized PNL %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {asset.institutions.map((inst) => {
                                      const displayName = inst.user_first_name && inst.user_last_name
                                        ? `${inst.institution}-${inst.user_first_name} ${inst.user_last_name}`
                                        : inst.institution;
                                      
                                      // Calculate live values if live data is available
                                      const liveAssetPrice = liveDataEnabled && livePrice ? livePrice.live_price : null;
                                      const instMktPrice = liveAssetPrice || (inst.market_price ?? 0);
                                      const instMktValue = inst.quantity ? (inst.quantity * instMktPrice) : (inst.market_value ?? 0);
                                      const instUnrealizedPnl = inst.cost_basis_money ? (instMktValue - inst.cost_basis_money) : (inst.unrealized_pnl ?? 0);
                                      const instUnrealizedPnlPct = inst.cost_basis_money && inst.cost_basis_money > 0 
                                        ? (instUnrealizedPnl / inst.cost_basis_money) * 100 
                                        : 0;
                                      
                                      const instPnlPositive = instUnrealizedPnl >= 0;
                                      
                                      // Track value changes for color animation
                                      const instKey = `${asset.asset_id}-${inst.account_id}`;
                                      const prevValues = previousInstitutionValuesRef.current.get(instKey);
                                      let valueChangeDirection: 'up' | 'down' | null = null;
                                      
                                      if (prevValues && liveDataEnabled) {
                                        if (instMktValue > prevValues.mktValue) {
                                          valueChangeDirection = 'up';
                                        } else if (instMktValue < prevValues.mktValue) {
                                          valueChangeDirection = 'down';
                                        }
                                        
                                        // Update previous values
                                        previousInstitutionValuesRef.current.set(instKey, {
                                          mktValue: instMktValue,
                                          unrealizedPnl: instUnrealizedPnl
                                        });
                                      } else if (liveDataEnabled) {
                                        // First time tracking
                                        previousInstitutionValuesRef.current.set(instKey, {
                                          mktValue: instMktValue,
                                          unrealizedPnl: instUnrealizedPnl
                                        });
                                      }
                                      
                                      return (
                                        <tr 
                                          key={`${inst.institution}-${inst.account_id}`}
                                          className="border-b border-border/50 hover:bg-muted/30"
                                        >
                                          <td className="py-2 px-3 font-medium text-foreground">{displayName}</td>
                                          <td className="text-right py-2 px-3 mono">{formatNumber(inst.quantity ?? 0)}</td>
                                          <td className="text-right py-2 px-3 mono text-xs">{formatCurrencyWithCode(inst.avg_cost_price_original, inst.avg_cost_price, inst.currency ?? 'USD')}</td>
                                          <td className="text-right py-2 px-3 mono text-xs">{formatCurrencyWithCode(inst.cost_basis_money_original, inst.cost_basis_money, inst.currency ?? 'USD')}</td>
                                          <td className={cn(
                                            "text-right py-2 px-3 mono text-xs transition-colors duration-300",
                                            valueChangeDirection === 'up' && "text-green-500 font-semibold",
                                            valueChangeDirection === 'down' && "text-red-500 font-semibold",
                                            !valueChangeDirection && liveDataEnabled && liveAssetPrice && "text-foreground",
                                            !liveDataEnabled && "text-muted-foreground"
                                          )}>
                                            {liveAssetPrice ? `${instMktPrice.toFixed(2)} USD` : (inst.market_price ? formatCurrencyWithCode(inst.market_price_original, inst.market_price, inst.currency ?? 'USD') : '—')}
                                          </td>
                                          <td className={cn(
                                            "text-right py-2 px-3 mono text-xs transition-colors duration-300",
                                            valueChangeDirection === 'up' && "text-green-500 font-semibold",
                                            valueChangeDirection === 'down' && "text-red-500 font-semibold"
                                          )}>
                                            {instMktValue.toFixed(2)} USD
                                          </td>
                                          <td className="text-right py-2 px-3">
                                            <span className={cn(
                                              'mono text-xs transition-colors duration-300',
                                              valueChangeDirection === 'up' && "text-green-500 font-semibold",
                                              valueChangeDirection === 'down' && "text-red-500 font-semibold",
                                              !valueChangeDirection && getChangeColor(instUnrealizedPnl)
                                            )}>
                                              {instPnlPositive ? '+' : ''}{instUnrealizedPnl.toFixed(2)} USD
                                            </span>
                                          </td>
                                          <td className="text-right py-2 px-3">
                                            <span className={cn(
                                              'mono transition-colors duration-300',
                                              valueChangeDirection === 'up' && "text-green-500 font-semibold",
                                              valueChangeDirection === 'down' && "text-red-500 font-semibold",
                                              !valueChangeDirection && getChangeColor(instUnrealizedPnlPct)
                                            )}>
                                              {instUnrealizedPnlPct !== 0 
                                                ? formatPercent(instUnrealizedPnlPct)
                                                : '—'
                                              }
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }) : (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading positions...' : 'No positions found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredPositions.length} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Positions;
