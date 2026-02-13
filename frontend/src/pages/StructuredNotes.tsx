import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveFilterButton } from '@/components/common/SaveFilterButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  RefreshCw,
  Filter,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Columns3,
  ExternalLink,
  Download,
  AlertTriangle,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Pencil,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { CreateAssetDialog } from '@/components/assets/CreateAssetDialog';
import { formatCurrency } from '@/lib/formatters';
import { API_V1_URL, getApiBaseUrl } from '@/lib/config';
import { catalogsApi, AssetClass } from '@/lib/api';
import {
  AssetFormFields,
  AssetFormState,
  defaultAssetFormState,
} from './AssetsSection';
// --- Types ---

interface Underlying {
  ticker: string;
  strike: number;
  initial_fixing_level?: number;
  spot: number;
  perf: number;
}

interface UnderlyingForm {
  ticker: string;
  strike: string;
  initial_fixing_level: string;
  spot: string;
  perf: string;
}

interface StructuredNote {
  note_id: number;
  asset_id: number;
  isin: string;
  upload_date: string; // YYYY-MM-DD
  dealer?: string;
  code?: string;
  status?: string;
  product_type?: string;
  issuer?: string;
  custodian?: string;
  advisor?: string;
  size?: number;
  underlyings?: Underlying[];
  maturity_date?: string;
  issue_date?: string;
  strike_date?: string;
  last_autocall_obs?: string;
  next_autocall_obs?: string;
  next_coupon_obs?: string;
  next_payment_date?: string;
  coupon_annual_pct?: number;
  coupon_periodic_pct?: number;
  coupon_annual_amount?: number;
  coupon_periodic_amount?: number;
  coupon_type?: string;
  cap_pct?: number;
  capital_protected_pct?: number;
  autocall_trigger?: number;
  step_down?: number;
  autocall_obs_count?: number;
  protection_barrier?: number;
  coupon_barrier?: number;
  observation_frequency?: string;
  termsheet?: string;
  termsheet_url?: string;
  coupons_paid_count?: number;
  coupons_paid_amount?: number;
  gross_yield_pct?: number;
  bid?: number;
  ask?: number;
}

interface NoteHolder {
  full_name: string;
  portfolio_name: string;
  quantity: number;
  mark_price: number | null;
  market_value: number;
  avg_price: number;
  unrealized_pnl: number;
  report_date: string;
}

interface MissingAsset {
  isin: string;
  description: string;
  currency: string;
  suggested_ticker: string;
  product?: string;
  issuer?: string;
  underlyings_label?: string;
  done: boolean;
}

interface ImportResult {
  status: string;
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  missing_assets: MissingAsset[];
  errors: string[];
}

interface StructuredNotesJob {
  job_id: number;
  job_type: string;
  status: string;
  done: boolean;
  extra_data?: {
    missing_assets?: MissingAsset[];
    errors?: string[];
    report_date?: string;
  };
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  started_at: string;
  completed_at?: string;
}

type RefreshStep = 'idle' | 'exporting' | 'importing' | 'done' | 'error';

type NoteDialogMode = 'edit' | 'create';

interface StructuredNoteFormState {
  note_id?: number;
  isin: string;
  upload_date: string;
  dealer: string;
  code: string;
  status: string;
  product_type: string;
  issuer: string;
  custodian: string;
  advisor: string;
  size: string;
  maturity_date: string;
  issue_date: string;
  strike_date: string;
  last_autocall_obs: string;
  next_autocall_obs: string;
  next_coupon_obs: string;
  next_payment_date: string;
  coupon_annual_pct: string;
  coupon_periodic_pct: string;
  coupon_annual_amount: string;
  coupon_periodic_amount: string;
  coupon_type: string;
  cap_pct: string;
  capital_protected_pct: string;
  autocall_trigger: string;
  step_down: string;
  autocall_obs_count: string;
  protection_barrier: string;
  coupon_barrier: string;
  observation_frequency: string;
  termsheet: string;
  termsheet_url: string;
  coupons_paid_count: string;
  coupons_paid_amount: string;
  gross_yield_pct: string;
  bid: string;
  ask: string;
  underlyings: UnderlyingForm[];
}

// Column definitions for the table
type ColumnType = 'text' | 'number' | 'date' | 'pct' | 'amount' | 'badge' | 'underlyings' | 'link' | 'underlyings-data';

interface ColumnDef {
  key: keyof StructuredNote | 'strike' | 'spot' | 'perf'; // Added virtual keys
  label: string;
  type: ColumnType;
  sortable?: boolean;
  minWidth?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'upload_date', label: 'Upload Date', type: 'date', sortable: true, minWidth: '120px' },
  { key: 'isin', label: 'ISIN', type: 'text', sortable: true, minWidth: '130px' },
  { key: 'issuer', label: 'Issuer', type: 'text', sortable: true },
  { key: 'product_type', label: 'Product Type', type: 'text', sortable: true, minWidth: '180px' },
  { key: 'status', label: 'Status', type: 'badge', sortable: true },
  { key: 'underlyings', label: 'Underlyings', type: 'underlyings', minWidth: '180px' },
  { key: 'strike', label: 'Strikes', type: 'underlyings-data', minWidth: '200px' },
  { key: 'spot', label: 'Spots', type: 'underlyings-data', minWidth: '200px' },
  { key: 'perf', label: 'Perfs', type: 'underlyings-data', minWidth: '200px' },
  { key: 'size', label: 'Size', type: 'number', sortable: true },
  { key: 'bid', label: 'Bid', type: 'pct', sortable: true },
  { key: 'ask', label: 'Ask', type: 'pct', sortable: true },
  { key: 'coupon_annual_pct', label: 'Cpn Annual %', type: 'pct', sortable: true },
  { key: 'coupon_periodic_pct', label: 'Cpn Periodic %', type: 'pct', sortable: true },
  { key: 'coupon_annual_amount', label: 'Cpn Annual $', type: 'amount', sortable: true },
  { key: 'coupon_periodic_amount', label: 'Cpn Periodic $', type: 'amount', sortable: true },
  { key: 'cap_pct', label: 'Cap %', type: 'pct', sortable: true },
  { key: 'capital_protected_pct', label: 'Capital Prot %', type: 'pct', sortable: true },
  { key: 'coupon_barrier', label: 'Cpn Barr', type: 'pct' },
  { key: 'protection_barrier', label: 'Prot Barr', type: 'pct' },
  { key: 'autocall_trigger', label: 'Autocall', type: 'pct' },
  { key: 'step_down', label: 'Step Down', type: 'pct', sortable: true },
  { key: 'autocall_obs_count', label: 'Autocall Obs #', type: 'number' },
  { key: 'next_autocall_obs', label: 'Next Autocall', type: 'date', sortable: true },
  { key: 'last_autocall_obs', label: 'Last Autocall', type: 'date', sortable: true },
  { key: 'next_coupon_obs', label: 'Next Obs', type: 'date', sortable: true },
  { key: 'next_payment_date', label: 'Next Pay', type: 'date', sortable: true },
  { key: 'maturity_date', label: 'Maturity', type: 'date', sortable: true },
  { key: 'issue_date', label: 'Issue Date', type: 'date', sortable: true },
  { key: 'strike_date', label: 'Strike Date', type: 'date', sortable: true },
  { key: 'observation_frequency', label: 'Freq', type: 'text' },
  { key: 'coupon_type', label: 'Cpn Type', type: 'text' },
  { key: 'coupons_paid_count', label: 'Cpns Paid #', type: 'number' },
  { key: 'coupons_paid_amount', label: 'Cpns Paid $', type: 'amount', sortable: true },
  { key: 'gross_yield_pct', label: 'Gross Yield %', type: 'pct', sortable: true },
  { key: 'dealer', label: 'Dealer', type: 'text' },
  { key: 'custodian', label: 'Custodian', type: 'text' },
  { key: 'advisor', label: 'Advisor', type: 'text' },
  { key: 'termsheet', label: 'Termsheet', type: 'link' },
  { key: 'code', label: 'Code', type: 'text' },
];

// Default visible columns
const DEFAULT_VISIBLE_KEYS = [
  'upload_date', 'isin', 'issuer', 'product_type', 'status',
  'underlyings', 'perf',
  'size', 'bid', 'maturity_date', 'next_autocall_obs', 'coupon_annual_pct'
];

const STORAGE_KEY = 'wealth_navigator_structured_notes_columns';

const ALL_TIME_VALUE = 'all';

const EMPTY_UNDERLYING: UnderlyingForm = {
  ticker: '',
  strike: '',
  initial_fixing_level: '',
  spot: '',
  perf: '',
};

const defaultStructuredNoteFormState: StructuredNoteFormState = {
  isin: '',
  upload_date: new Date().toISOString().split('T')[0],
  dealer: '',
  code: '',
  status: '',
  product_type: '',
  issuer: '',
  custodian: '',
  advisor: '',
  size: '',
  maturity_date: '',
  issue_date: '',
  strike_date: '',
  last_autocall_obs: '',
  next_autocall_obs: '',
  next_coupon_obs: '',
  next_payment_date: '',
  coupon_annual_pct: '',
  coupon_periodic_pct: '',
  coupon_annual_amount: '',
  coupon_periodic_amount: '',
  coupon_type: '',
  cap_pct: '',
  capital_protected_pct: '',
  autocall_trigger: '',
  step_down: '',
  autocall_obs_count: '',
  protection_barrier: '',
  coupon_barrier: '',
  observation_frequency: '',
  termsheet: '',
  termsheet_url: '',
  coupons_paid_count: '',
  coupons_paid_amount: '',
  gross_yield_pct: '',
  bid: '',
  ask: '',
  underlyings: [{ ...EMPTY_UNDERLYING }],
};

const KG_HIDDEN_COLUMN_KEYS = [
  'coupon_annual_pct',
  'coupon_periodic_pct',
  'coupon_annual_amount',
  'coupon_periodic_amount',
];

const NON_ALL_NON_KG_HIDDEN_COLUMN_KEYS = [
  'cap_pct',
  'capital_protected_pct',
];

// =============================================================================
// COMPONENT
// =============================================================================

const StructuredNotes = () => {
  const location = useLocation();
  const { toast } = useToast();
  const apiBaseUrl = getApiBaseUrl();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Column visibility (persisted)
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { }
    return DEFAULT_VISIBLE_KEYS;
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Status, issuer, product type filters
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [issuerFilter, setIssuerFilter] = useState<string>('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('');

  // Data state
  const [notes, setNotes] = useState<StructuredNote[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(ALL_TIME_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  // Notes create/edit dialog
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteDialogMode, setNoteDialogMode] = useState<NoteDialogMode>('edit');
  const [noteForm, setNoteForm] = useState<StructuredNoteFormState>(defaultStructuredNoteFormState);
  const [noteActionLoading, setNoteActionLoading] = useState(false);
  const [noteActionError, setNoteActionError] = useState<string | null>(null);

  // Holders state (per expanded row)
  const [holders, setHolders] = useState<NoteHolder[]>([]);
  const [isLoadingHolders, setIsLoadingHolders] = useState(false);

  // Refresh state
  const [refreshStep, setRefreshStep] = useState<RefreshStep>('idle');
  const [refreshMessage, setRefreshMessage] = useState('');

  // ── Missing Assets from JobLog (persistent) ──
  const [latestJob, setLatestJob] = useState<StructuredNotesJob | null>(null);
  const [missingAssets, setMissingAssets] = useState<MissingAsset[]>([]);
  const [isLoadingJob, setIsLoadingJob] = useState(true);

  // ── Asset Creation Dialog state ──
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingIsin, setCreatingIsin] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetFormState>(defaultAssetFormState);
  const [assetActionError, setAssetActionError] = useState<string | null>(null);
  const [assetActionLoading, setAssetActionLoading] = useState(false);

  // ── Catalogs for Asset Form ──
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [countries, setCountries] = useState<Array<{ iso_code: string; name?: string | null }>>([]);
  const [industries, setIndustries] = useState<Array<{ industry_code: string; name: string; sector?: string | null }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);

  // ── Load catalogs ──
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        setIsLoadingClasses(true);
        const classes = await catalogsApi.getAssetClasses();
        setAssetClasses(classes);
      } catch (error) {
        console.error('Error loading asset classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }

      try {
        const [countriesRes, industriesRes, currenciesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/catalogs/countries`),
          fetch(`${apiBaseUrl}/api/v1/catalogs/industries`),
          fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`),
        ]);
        if (countriesRes.ok) setCountries(await countriesRes.json());
        if (industriesRes.ok) setIndustries(await industriesRes.json());
        if (currenciesRes.ok) setCurrencies(await currenciesRes.json());
      } catch (error) {
        console.error('Error loading catalogs:', error);
      }
    };
    loadCatalogs();
  }, [apiBaseUrl]);

  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` })),
    [currencies],
  );
  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.iso_code, label: `${c.name ?? c.iso_code} (${c.iso_code})` })),
    [countries],
  );
  const industryOptions = useMemo(
    () => industries.map((i) => ({ value: i.industry_code, label: i.name, secondary: i.industry_code })),
    [industries],
  );

  const valueToString = (value: unknown) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return String(value);
  };

  const dateToInputValue = (value?: string) => {
    if (!value) return '';
    return String(value).split('T')[0];
  };

  const parseFiniteNumber = (value: unknown): number | null => {
    if (value == null) return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  };

  const computePerformanceValue = (strike: number | null, spot: number | null): number | null => {
    if (strike == null || spot == null || strike === 0) return null;
    return spot / strike;
  };

  const formatPerformanceValue = (value: number | null): string => {
    if (value == null) return '';
    return value.toFixed(8).replace(/\.?0+$/, '');
  };

  const computePerformanceFromValues = (strikeValue: unknown, spotValue: unknown): string => {
    const strike = parseFiniteNumber(strikeValue);
    const spot = parseFiniteNumber(spotValue);
    return formatPerformanceValue(computePerformanceValue(strike, spot));
  };

  const createFormFromNote = useCallback((note: StructuredNote): StructuredNoteFormState => {
    const mappedUnderlyings = (note.underlyings || []).map((u) => {
      const strike = valueToString(u.strike);
      const spot = valueToString(u.spot);
      const computedPerf = computePerformanceFromValues(strike, spot);
      return {
        ticker: valueToString(u.ticker),
        strike,
        initial_fixing_level: valueToString((u as any).initial_fixing_level),
        spot,
        perf: computedPerf || valueToString(u.perf),
      };
    });

    return {
      note_id: note.note_id,
      isin: note.isin,
      upload_date: dateToInputValue(note.upload_date),
      dealer: valueToString(note.dealer),
      code: valueToString(note.code),
      status: valueToString(note.status),
      product_type: valueToString(note.product_type),
      issuer: valueToString(note.issuer),
      custodian: valueToString(note.custodian),
      advisor: valueToString(note.advisor),
      size: valueToString(note.size),
      maturity_date: dateToInputValue(note.maturity_date),
      issue_date: dateToInputValue(note.issue_date),
      strike_date: dateToInputValue(note.strike_date),
      last_autocall_obs: dateToInputValue(note.last_autocall_obs),
      next_autocall_obs: dateToInputValue(note.next_autocall_obs),
      next_coupon_obs: dateToInputValue(note.next_coupon_obs),
      next_payment_date: dateToInputValue(note.next_payment_date),
      coupon_annual_pct: valueToString(note.coupon_annual_pct),
      coupon_periodic_pct: valueToString(note.coupon_periodic_pct),
      coupon_annual_amount: valueToString(note.coupon_annual_amount),
      coupon_periodic_amount: valueToString(note.coupon_periodic_amount),
      coupon_type: valueToString(note.coupon_type),
      cap_pct: valueToString(note.cap_pct),
      capital_protected_pct: valueToString(note.capital_protected_pct),
      autocall_trigger: valueToString(note.autocall_trigger),
      step_down: valueToString(note.step_down),
      autocall_obs_count: valueToString(note.autocall_obs_count),
      protection_barrier: valueToString(note.protection_barrier),
      coupon_barrier: valueToString(note.coupon_barrier),
      observation_frequency: valueToString(note.observation_frequency),
      termsheet: valueToString(note.termsheet),
      termsheet_url: valueToString(note.termsheet_url),
      coupons_paid_count: valueToString(note.coupons_paid_count),
      coupons_paid_amount: valueToString(note.coupons_paid_amount),
      gross_yield_pct: valueToString(note.gross_yield_pct),
      bid: valueToString(note.bid),
      ask: valueToString(note.ask),
      underlyings: mappedUnderlyings.length > 0 ? mappedUnderlyings : [{ ...EMPTY_UNDERLYING }],
    };
  }, []);

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseOptionalText = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const buildNotePayload = useCallback((form: StructuredNoteFormState) => {
    const payload: Record<string, unknown> = {
      isin: form.isin.trim(),
      upload_date: parseOptionalText(form.upload_date),
      dealer: parseOptionalText(form.dealer),
      code: parseOptionalText(form.code),
      status: parseOptionalText(form.status),
      product_type: parseOptionalText(form.product_type),
      issuer: parseOptionalText(form.issuer),
      custodian: parseOptionalText(form.custodian),
      advisor: parseOptionalText(form.advisor),
      size: parseOptionalNumber(form.size),
      maturity_date: parseOptionalText(form.maturity_date),
      issue_date: parseOptionalText(form.issue_date),
      strike_date: parseOptionalText(form.strike_date),
      next_autocall_obs: parseOptionalText(form.next_autocall_obs),
      next_coupon_obs: parseOptionalText(form.next_coupon_obs),
      next_payment_date: parseOptionalText(form.next_payment_date),
      coupon_annual_pct: parseOptionalNumber(form.coupon_annual_pct),
      coupon_periodic_pct: parseOptionalNumber(form.coupon_periodic_pct),
      coupon_annual_amount: parseOptionalNumber(form.coupon_annual_amount),
      coupon_periodic_amount: parseOptionalNumber(form.coupon_periodic_amount),
      coupon_type: parseOptionalText(form.coupon_type),
      cap_pct: parseOptionalNumber(form.cap_pct),
      capital_protected_pct: parseOptionalNumber(form.capital_protected_pct),
      autocall_trigger: parseOptionalNumber(form.autocall_trigger),
      step_down: parseOptionalNumber(form.step_down),
      autocall_obs_count: parseOptionalNumber(form.autocall_obs_count),
      protection_barrier: parseOptionalNumber(form.protection_barrier),
      coupon_barrier: parseOptionalNumber(form.coupon_barrier),
      observation_frequency: parseOptionalText(form.observation_frequency),
      termsheet: parseOptionalText(form.termsheet),
      termsheet_url: parseOptionalText(form.termsheet_url),
      coupons_paid_count: parseOptionalNumber(form.coupons_paid_count),
      coupons_paid_amount: parseOptionalNumber(form.coupons_paid_amount),
      gross_yield_pct: parseOptionalNumber(form.gross_yield_pct),
      bid: parseOptionalNumber(form.bid),
      ask: parseOptionalNumber(form.ask),
      underlyings: form.underlyings
        .filter((u) => u.ticker.trim())
        .map((u) => {
          const strike = parseOptionalNumber(u.strike);
          const spot = parseOptionalNumber(u.spot);
          return {
            ticker: u.ticker.trim(),
            strike,
            initial_fixing_level: parseOptionalNumber(u.initial_fixing_level),
            spot,
            perf: computePerformanceValue(strike, spot),
          };
        }),
    };

    if ((payload.underlyings as unknown[]).length === 0) {
      payload.underlyings = null;
    }

    return payload;
  }, []);

  // ── Fetch latest STRUCTURED_NOTES job ──
  const fetchLatestJob = useCallback(async () => {
    try {
      setIsLoadingJob(true);
      const res = await fetch(`${apiBaseUrl}/api/v1/etl/jobs?report_type=STRUCTURED_NOTES&limit=1`);
      if (res.ok) {
        const data: StructuredNotesJob[] = await res.json();
        if (data.length > 0) {
          const job = data[0];
          setLatestJob(job);
          const pending = (job.extra_data?.missing_assets || []).filter((a) => !a.done);
          setMissingAssets(pending);
        } else {
          setLatestJob(null);
          setMissingAssets([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch latest structured notes job:', err);
    } finally {
      setIsLoadingJob(false);
    }
  }, [apiBaseUrl]);

  // ── Fetch available dates ──
  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1_URL}/ais-etl/notes/dates`);
      if (res.ok) {
        const dates: string[] = await res.json();
        setAvailableDates(dates);
      }
    } catch (err) {
      console.error('Failed to fetch dates:', err);
    }
  }, []);

  // ── Fetch notes for selected date (with status/issuer filters) ──
  const fetchNotes = useCallback(async (dateStr?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateStr) params.set('upload_date', dateStr);
      if (statusFilter) {
        params.set('status', statusFilter === 'All' ? 'all' : statusFilter);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_V1_URL}/ais-etl/notes${qs}`);
      if (res.ok) {
        const data: StructuredNote[] = await res.json();
        setNotes(data);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // ── Fetch holders for expanded note ──
  const fetchHolders = useCallback(async (isin: string, uploadDate?: string) => {
    setIsLoadingHolders(true);
    setHolders([]);
    try {
      const dateParam = uploadDate || (selectedDate !== ALL_TIME_VALUE ? selectedDate : '');
      const params = dateParam ? `?upload_date=${dateParam}` : '';
      const res = await fetch(`${API_V1_URL}/ais-etl/notes/${isin}/holders${params}`);
      if (res.ok) {
        const data: NoteHolder[] = await res.json();
        setHolders(data);
      }
    } catch (err) {
      console.error('Failed to fetch holders:', err);
    } finally {
      setIsLoadingHolders(false);
    }
  }, [selectedDate]);

  // ── Initial load ──
  useEffect(() => {
    fetchDates();
    fetchLatestJob();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchNotes(selectedDate);
    } else {
      fetchNotes(ALL_TIME_VALUE);
    }
  }, [selectedDate, fetchNotes, statusFilter, issuerFilter]);

  // ── Refresh: Export → Import → Refetch ──
  const handleRefresh = async () => {
    setRefreshStep('exporting');
    setRefreshMessage('Downloading from AIS...');

    try {
      // Step 1: Export products (scrape)
      const exportRes = await fetch(`${API_V1_URL}/ais-etl/export-products`, { method: 'POST' });
      if (!exportRes.ok) {
        const err = await exportRes.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(err.detail || 'Export failed');
      }

      // Step 2: Import notes
      setRefreshStep('importing');
      setRefreshMessage('Importing data...');

      const importRes = await fetch(`${API_V1_URL}/ais-etl/import-notes`, { method: 'POST' });
      if (!importRes.ok) {
        const err = await importRes.json().catch(() => ({ detail: 'Import failed' }));
        throw new Error(err.detail || 'Import failed');
      }

      const result: ImportResult = await importRes.json();

      // Step 3: Update missing assets from result directly
      if (result.job_id) {
        // Fetch the fresh job to get full state
        await fetchLatestJob();
      }

      // Step 4: Refetch data
      await fetchDates();
      await fetchNotes(selectedDate || ALL_TIME_VALUE);

      setRefreshStep('done');
      setRefreshMessage(
        `✅ ${result.created} created, ${result.updated} updated` +
        (result.missing_assets.length > 0 ? `, ${result.missing_assets.length} missing assets` : '')
      );

      // Auto-clear success message after 8 seconds
      setTimeout(() => {
        setRefreshStep((prev) => prev === 'done' ? 'idle' : prev);
        setRefreshMessage((prev) => prev.startsWith('✅') ? '' : prev);
      }, 8000);

    } catch (err: any) {
      setRefreshStep('error');
      setRefreshMessage(`❌ ${err.message || 'Unknown error'}`);
      // Still refresh job to record the error
      await fetchLatestJob();
    }
  };

  const handleOpenAddNote = () => {
    setNoteDialogMode('create');
    setNoteActionError(null);
    setNoteForm({
      ...defaultStructuredNoteFormState,
      upload_date: new Date().toISOString().split('T')[0],
      underlyings: [{ ...EMPTY_UNDERLYING }],
    });
    setIsNoteDialogOpen(true);
  };

  const handleOpenEditNote = (note: StructuredNote) => {
    setNoteDialogMode('edit');
    setNoteActionError(null);
    setNoteForm(createFormFromNote(note));
    setIsNoteDialogOpen(true);
  };

  const handleFormChange = (key: keyof StructuredNoteFormState, value: string) => {
    setNoteForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUnderlyingChange = (index: number, key: keyof UnderlyingForm, value: string) => {
    setNoteForm((prev) => ({
      ...prev,
      underlyings: prev.underlyings.map((u, i) => {
        if (i !== index) return u;
        const updated = { ...u, [key]: value };
        if (key === 'strike' || key === 'spot') {
          updated.perf = computePerformanceFromValues(updated.strike, updated.spot);
        }
        return updated;
      }),
    }));
  };

  const handleAddUnderlying = () => {
    setNoteForm((prev) => ({
      ...prev,
      underlyings: [...prev.underlyings, { ...EMPTY_UNDERLYING }],
    }));
  };

  const handleRemoveUnderlying = (index: number) => {
    setNoteForm((prev) => {
      const next = prev.underlyings.filter((_, i) => i !== index);
      return {
        ...prev,
        underlyings: next.length > 0 ? next : [{ ...EMPTY_UNDERLYING }],
      };
    });
  };

  const handleSaveNote = async () => {
    if (!noteForm.isin.trim()) {
      setNoteActionError('ISIN is required.');
      return;
    }

    try {
      setNoteActionLoading(true);
      setNoteActionError(null);

      const payload = buildNotePayload(noteForm);
      const isEdit = noteDialogMode === 'edit';
      const endpoint = isEdit
        ? `${API_V1_URL}/ais-etl/notes/${noteForm.note_id}`
        : `${API_V1_URL}/ais-etl/notes`;

      const response = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      await fetchDates();
      await fetchNotes(selectedDate || ALL_TIME_VALUE);
      setIsNoteDialogOpen(false);

      toast({
        title: isEdit ? 'Note updated' : 'Note created',
        description: `Structured note ${noteForm.isin.trim()} saved successfully.`,
        variant: 'success',
      });
    } catch (error: any) {
      setNoteActionError(error.message || 'Could not save note.');
    } finally {
      setNoteActionLoading(false);
    }
  };

  // ── Asset creation helpers ──
  const normalizeNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const buildAssetPayload = (formState: AssetFormState) => {
    const normalizedPutCall = formState.put_call.trim();
    return {
      symbol: formState.symbol.trim(),
      name: formState.name.trim() || null,
      description: formState.description.trim() || null,
      isin: formState.isin.trim() || null,
      figi: formState.figi.trim() || null,
      cusip: formState.cusip.trim() || null,
      class_id: Number(formState.class_id),
      sub_class_id: formState.sub_class_id ? Number(formState.sub_class_id) : null,
      industry_code: formState.industry_code.trim() ? formState.industry_code.trim().toUpperCase() : null,
      country_code: formState.country_code.trim() ? formState.country_code.trim().toUpperCase() : null,
      currency: formState.currency.trim() ? formState.currency.trim().toUpperCase() : null,
      multiplier: normalizeNumber(formState.multiplier),
      contract_size: normalizeNumber(formState.contract_size),
      underlying_symbol: formState.underlying_symbol.trim() || null,
      strike_price: normalizeNumber(formState.strike_price),
      expiry_date: formState.expiry_date || null,
      put_call: normalizedPutCall && normalizedPutCall !== '-' ? normalizedPutCall : null,
      maturity_date: formState.maturity_date || null,
      coupon_rate: normalizeNumber(formState.coupon_rate),
      issuer: formState.issuer.trim() || null,
      initial_fixing_date: formState.initial_fixing_date || null,
      next_autocall_date: formState.next_autocall_date || null,
      next_coupon_payment_date: formState.next_coupon_payment_date || null,
      autocall_trigger: normalizeNumber(formState.autocall_trigger),
      coupon_trigger: normalizeNumber(formState.coupon_trigger),
      capital_barrier: normalizeNumber(formState.capital_barrier),
      protection_level: normalizeNumber(formState.protection_level),
      payment_frequency: formState.payment_frequency.trim() || null,
    };
  };

  const handleOpenCreateDialog = (asset: MissingAsset) => {
    const underlyingsLabel = (asset.underlyings_label || '').trim();
    const product = (asset.product || '').trim();
    const combinedDescription = [underlyingsLabel, product].filter(Boolean).join(' / ');
    setCreatingIsin(asset.isin);
    setAssetDraft({
      ...defaultAssetFormState,
      isin: asset.isin,
      description: combinedDescription,
      issuer: asset.issuer || '',
      symbol: asset.isin, // Use ISIN as default symbol
      class_id: assetClasses.length > 0 ? String(assetClasses[0].class_id) : '',
    });
    setAssetActionError(null);
    setIsCreateOpen(true);
  };

  const handleCreateAsset = async () => {
    if (!assetDraft.symbol.trim() || !assetDraft.class_id) {
      setAssetActionError('Symbol and Asset Class are required.');
      return;
    }
    try {
      setAssetActionLoading(true);
      setAssetActionError(null);

      // 1. Create the asset
      const response = await fetch(`${apiBaseUrl}/api/v1/assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssetPayload(assetDraft)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const msg = typeof errorData.detail === 'string' ? errorData.detail : `HTTP ${response.status}`;
        throw new Error(msg);
      }

      // 2. Mark as done in the job log
      if (latestJob && creatingIsin) {
        await fetch(`${apiBaseUrl}/api/v1/etl/jobs/${latestJob.job_id}/mark-done`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: 'asset', item_key: creatingIsin }),
        });
      }

      // 3. Update local state
      setMissingAssets((prev) => prev.filter((a) => a.isin !== creatingIsin));
      setIsCreateOpen(false);
      setCreatingIsin(null);

      toast({
        title: 'Asset created',
        description: `Asset "${assetDraft.symbol.trim()}" created and marked as resolved.`,
        variant: 'success',
      });

      // Refresh the job to get updated state
      await fetchLatestJob();

    } catch (error: any) {
      setAssetActionError(error.message || 'Could not create the asset.');
    } finally {
      setAssetActionLoading(false);
    }
  };

  const hiddenColumnKeys = useMemo(() => {
    if (!productTypeFilter) return [];
    if (productTypeFilter.trim().toUpperCase() === 'KG') return KG_HIDDEN_COLUMN_KEYS;
    return NON_ALL_NON_KG_HIDDEN_COLUMN_KEYS;
  }, [productTypeFilter]);

  useEffect(() => {
    if (!productTypeFilter) {
      const allKeys = ALL_COLUMNS.map((c) => c.key);
      setVisibleKeys(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allKeys));
        return allKeys;
      });
      return;
    }

    if (hiddenColumnKeys.length === 0) return;
    setVisibleKeys((prev) => {
      const next = prev.filter((k) => !hiddenColumnKeys.includes(k));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [hiddenColumnKeys, productTypeFilter]);

  // ── Toggle column visibility ──
  const toggleColumn = (key: string) => {
    if (hiddenColumnKeys.includes(key)) return;
    setVisibleKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── Visible columns (in definition order) ──
  const visibleColumns = useMemo(() =>
    ALL_COLUMNS.filter(c => visibleKeys.includes(c.key) && !hiddenColumnKeys.includes(c.key)),
    [visibleKeys, hiddenColumnKeys]
  );

  // ── Unique issuers for filter dropdown ──
  const uniqueIssuers = useMemo(() => {
    const set = new Set(notes.map(n => n.issuer).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [notes]);

  const uniqueProductTypes = useMemo(() => {
    const set = new Set(notes.map(n => n.product_type).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [notes]);

  // ── Sorting ──
  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  // ── Filter and sort notes ──
  const filteredNotes = useMemo(() => {
    let result = notes;

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note =>
        note.isin.toLowerCase().includes(query) ||
        (note.issuer || '').toLowerCase().includes(query) ||
        (note.product_type || '').toLowerCase().includes(query) ||
        (note.underlyings || []).some(u => u.ticker.toLowerCase().includes(query)) ||
        (note.code || '').toLowerCase().includes(query)
      );
    }

    if (issuerFilter) {
      result = result.filter((note) => note.issuer === issuerFilter);
    }

    if (productTypeFilter) {
      result = result.filter((note) => note.product_type === productTypeFilter);
    }

    // Sort
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortColumn];
        const bVal = (b as any)[sortColumn];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = typeof aVal === 'string'
          ? aVal.localeCompare(bVal as string)
          : Number(aVal) - Number(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [searchQuery, notes, issuerFilter, productTypeFilter, sortColumn, sortDirection]);

  // ── Cell renderer ──
  const renderCell = (note: StructuredNote, col: ColumnDef) => {
    // Virtual columns for Underlyings data
    if (col.type === 'underlyings-data') {
      if (!note.underlyings || note.underlyings.length === 0) return '-';

      const entries = note.underlyings.map(u => {
        const key = col.key as keyof Underlying;
        const val = u[key];
        const formatted = val == null
          ? '-'
          : (key === 'perf' ? `${parseFloat((Number(val) * 100).toFixed(2))}%` : String(val));

        return (
          <Badge key={`${u.ticker}-${col.key}`} variant="secondary" className="text-xs font-mono">
            {u.ticker}: {formatted}
          </Badge>
        );
      });

      return (
        <div className="flex flex-wrap gap-1">
          {entries}
        </div>
      );
    }

    const val = (note as any)[col.key];

    if (col.type === 'underlyings') {
      if (!note.underlyings || note.underlyings.length === 0) return '-';
      return (
        <div className="flex flex-wrap gap-1">
          {note.underlyings.map(u => (
            <Badge key={u.ticker} variant="secondary" className="text-xs font-mono">
              {u.ticker}
            </Badge>
          ))}
        </div>
      );
    }

    if (col.type === 'link') {
      if (!val) return '-';
      const url = note.termsheet_url;
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {val as string} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-muted-foreground">{val as string}</span>
      );
    }

    if (col.type === 'badge') {
      return (
        <Badge variant={val === 'Vigente' || val === 'Active' ? 'default' : 'secondary'}>
          {val as string}
        </Badge>
      );
    }

    if (val == null || val === '') return '-';

    switch (col.type) {
      case 'pct': {
        const pctVal = parseFloat((Number(val) * 100).toFixed(2));
        return `${pctVal}%`;
      }
      case 'amount':
        return formatCurrency(Number(val));
      case 'number':
        return String(Number(val));
      case 'date':
        return String(val).split('T')[0];
      default:
        return String(val);
    }
  };

  // ── Expand/collapse row ──
  const toggleExpand = (note: StructuredNote) => {
    if (isEditMode) {
      handleOpenEditNote(note);
      return;
    }

    if (expandedNoteId === note.note_id) {
      setExpandedNoteId(null);
      setHolders([]);
    } else {
      setExpandedNoteId(note.note_id);
      fetchHolders(note.isin, note.upload_date);
    }
  };

  // Build filter string for save button
  const currentFilters = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedDate) params.set('date', selectedDate);
    if (statusFilter) params.set('status', statusFilter);
    if (productTypeFilter) params.set('product_type', productTypeFilter);
    return params.toString();
  }, [searchQuery, selectedDate, statusFilter, productTypeFilter]);

  const isRefreshing = refreshStep === 'exporting' || refreshStep === 'importing';

  const noteTextFields: Array<{ key: keyof StructuredNoteFormState; label: string }> = [
    { key: 'dealer', label: 'Dealer' },
    { key: 'code', label: 'Code' },
    { key: 'status', label: 'Status' },
    { key: 'product_type', label: 'Product Type' },
    { key: 'issuer', label: 'Issuer' },
    { key: 'custodian', label: 'Custodian' },
    { key: 'advisor', label: 'Advisor' },
    { key: 'coupon_type', label: 'Coupon Type' },
    { key: 'observation_frequency', label: 'Observation Frequency' },
    { key: 'termsheet', label: 'Termsheet' },
    { key: 'termsheet_url', label: 'Termsheet URL' },
  ];

  const noteDateFields: Array<{ key: keyof StructuredNoteFormState; label: string }> = [
    { key: 'upload_date', label: 'Upload Date' },
    { key: 'issue_date', label: 'Issue Date' },
    { key: 'strike_date', label: 'Strike Date' },
    { key: 'maturity_date', label: 'Maturity Date' },
    { key: 'last_autocall_obs', label: 'Last Autocall Obs' },
    { key: 'next_autocall_obs', label: 'Next Autocall Obs' },
    { key: 'next_coupon_obs', label: 'Next Coupon Obs' },
    { key: 'next_payment_date', label: 'Next Payment Date' },
  ];

  const noteNumberFields: Array<{ key: keyof StructuredNoteFormState; label: string }> = [
    { key: 'size', label: 'Size' },
    { key: 'coupon_annual_pct', label: 'Coupon Annual %' },
    { key: 'coupon_periodic_pct', label: 'Coupon Periodic %' },
    { key: 'coupon_annual_amount', label: 'Coupon Annual Amount' },
    { key: 'coupon_periodic_amount', label: 'Coupon Periodic Amount' },
    { key: 'cap_pct', label: 'Cap %' },
    { key: 'capital_protected_pct', label: 'Capital Protected %' },
    { key: 'autocall_trigger', label: 'Autocall Trigger' },
    { key: 'step_down', label: 'Step Down' },
    { key: 'autocall_obs_count', label: 'Autocall Obs Count' },
    { key: 'protection_barrier', label: 'Protection Barrier' },
    { key: 'coupon_barrier', label: 'Coupon Barrier' },
    { key: 'coupons_paid_count', label: 'Coupons Paid Count' },
    { key: 'coupons_paid_amount', label: 'Coupons Paid Amount' },
    { key: 'gross_yield_pct', label: 'Gross Yield %' },
    { key: 'bid', label: 'Bid' },
    { key: 'ask', label: 'Ask' },
  ];

  return (
    <AppLayout title="Structured Notes" subtitle="Manage and track structured products">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-border"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value={ALL_TIME_VALUE}>All Time</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="Active">Active</option>
              <option value="Call">Call</option>
              <option value="Matured">Matured</option>
              <option value="Sold">Sold</option>
              <option value="All">All Statuses</option>
            </select>
          </div>

          {/* Issuer Filter */}
          {uniqueIssuers.length > 0 && (
            <select
              value={issuerFilter}
              onChange={(e) => setIssuerFilter(e.target.value)}
              className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Issuers</option>
              {uniqueIssuers.map((iss) => (
                <option key={iss} value={iss}>{iss}</option>
              ))}
            </select>
          )}

          {/* Product Type Filter */}
          {uniqueProductTypes.length > 0 && (
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Types</option>
              {uniqueProductTypes.map((pt) => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Column Selector Toggle */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => setShowColumnSelector(!showColumnSelector)}
            >
              <Columns3 className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Columns</span>
            </Button>
            {showColumnSelector && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground mb-2">Visible Columns</div>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className={cn(
                      "flex items-center gap-2 py-1 text-sm",
                      hiddenColumnKeys.includes(col.key)
                        ? "cursor-not-allowed text-muted-foreground/50"
                        : "cursor-pointer hover:text-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      disabled={hiddenColumnKeys.includes(col.key)}
                      className="rounded border-border"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <SaveFilterButton
            currentPath={location.pathname}
            currentFilters={currentFilters}
            defaultTitle="Structured Notes"
          />
          <Button variant="outline" size="sm" className="border-border">
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* ── Persistent Missing Assets Panel (from latest job log) ── */}
      {!isLoadingJob && missingAssets.length > 0 && latestJob && (
        <div className="mb-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-500">
              {missingAssets.length} Missing Asset{missingAssets.length !== 1 ? 's' : ''} — Create them to complete import
            </span>
            <Badge variant="outline" className="ml-auto text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
              Job #{latestJob.job_id}
            </Badge>
          </div>
          <div className="space-y-2">
            {missingAssets.map((ma) => (
              <div key={ma.isin} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/30">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm text-primary">{ma.isin}</span>
                  {ma.issuer && <span className="ml-2 text-xs text-muted-foreground">— {ma.issuer}</span>}
                  {ma.underlyings_label && <span className="ml-2 text-xs text-muted-foreground/80">{ma.underlyings_label}</span>}
                  {ma.product && <span className="ml-1 text-xs text-muted-foreground/70">/ {ma.product}</span>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => handleOpenCreateDialog(ma)}
                >
                  <Plus className="h-3 w-3" />
                  Create Asset
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create Asset Dialog ── */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          setAssetActionError(null);
          if (!open) setCreatingIsin(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Create Asset — {creatingIsin}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {assetActionError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-800">
                  {assetActionError}
                </AlertDescription>
              </Alert>
            )}
            <AssetFormFields
              formState={assetDraft}
              setFormState={setAssetDraft}
              assetClasses={assetClasses}
              isLoadingClasses={isLoadingClasses}
              currencyOptions={currencyOptions}
              countryOptions={countryOptions}
              industryOptions={industryOptions}
              idPrefix="sn-create-asset"
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleCreateAsset}
                disabled={assetActionLoading}
              >
                {assetActionLoading ? 'Creating...' : 'Create Asset'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isNoteDialogOpen}
        onOpenChange={(open) => {
          setIsNoteDialogOpen(open);
          if (!open) setNoteActionError(null);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {noteDialogMode === 'edit' ? `Edit Note — ${noteForm.isin}` : 'Add Structured Note'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {noteActionError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-800">{noteActionError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ISIN</label>
                <Input
                  value={noteForm.isin}
                  disabled={noteDialogMode === 'edit'}
                  onChange={(e) => handleFormChange('isin', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Upload Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={noteForm.upload_date}
                    onChange={(e) => handleFormChange('upload_date', e.target.value)}
                    className="pr-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground font-medium mb-2">General</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {noteTextFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                    {field.key === 'termsheet_url' ? (
                      <Textarea
                        rows={2}
                        value={noteForm[field.key] as string}
                        onChange={(e) => handleFormChange(field.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        value={noteForm[field.key] as string}
                        onChange={(e) => handleFormChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground font-medium mb-2">Dates</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {noteDateFields
                  .filter((field) => field.key !== 'upload_date')
                  .map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={noteForm[field.key] as string}
                          onChange={(e) => handleFormChange(field.key, e.target.value)}
                          className="pr-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground font-medium mb-2">Numerics</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {noteNumberFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                    <Input
                      type="number"
                      step="any"
                      value={noteForm[field.key] as string}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase text-muted-foreground font-medium">Underlyings</div>
                <Button size="sm" variant="outline" onClick={handleAddUnderlying}>
                  <Plus className="h-3 w-3 mr-1" /> Add Underlying
                </Button>
              </div>
              <div className="space-y-2">
                {noteForm.underlyings.map((u, idx) => (
                  <div key={`u-${idx}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border border-border rounded-md p-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
                      <Input value={u.ticker} onChange={(e) => handleUnderlyingChange(idx, 'ticker', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Strike</label>
                      <Input type="number" step="any" value={u.strike} onChange={(e) => handleUnderlyingChange(idx, 'strike', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Initial Fixing Level</label>
                      <Input type="number" step="any" value={u.initial_fixing_level} onChange={(e) => handleUnderlyingChange(idx, 'initial_fixing_level', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Spot</label>
                      <Input type="number" step="any" value={u.spot} onChange={(e) => handleUnderlyingChange(idx, 'spot', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Performance</label>
                      <Input type="number" step="any" value={u.perf} disabled readOnly />
                    </div>
                    <div className="md:text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveUnderlying(idx)}
                        disabled={noteForm.underlyings.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveNote} disabled={noteActionLoading}>
                {noteActionLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Structured Notes Table */}
      <Card className="border-border mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Structured Products ({filteredNotes.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Refresh status message */}
              {refreshMessage && (
                <span className={cn(
                  "text-xs",
                  refreshStep === 'error' ? 'text-red-500' :
                    refreshStep === 'done' ? 'text-green-500' :
                      'text-muted-foreground'
                )}>
                  {refreshStep === 'exporting' || refreshStep === 'importing' ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {refreshMessage}
                    </span>
                  ) : refreshStep === 'done' ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3" />
                      {refreshMessage}
                    </span>
                  ) : refreshStep === 'error' ? (
                    <span className="flex items-center gap-1.5">
                      <XCircle className="h-3 w-3" />
                      {refreshMessage}
                    </span>
                  ) : null}
                </span>
              )}
              {/* Refresh Button */}
              <Button
                variant={isEditMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsEditMode((prev) => !prev);
                  setExpandedNoteId(null);
                  setHolders([]);
                }}
                className="border-border"
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">{isEditMode ? 'Editing' : 'Edit'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddNote}
                className="border-border"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Add Note</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-border"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading structured notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {notes.length === 0
                ? 'No structured notes data. Click Refresh to download from AIS.'
                : 'No notes match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    {visibleColumns.map(col => (
                      <th
                        key={col.key}
                        className={cn(
                          'cursor-pointer select-none whitespace-nowrap',
                          ['number', 'pct', 'amount'].includes(col.type) && 'text-right'
                        )}
                        onClick={() => handleSort(col.key)}
                      >
                        <div className={cn(
                          'flex items-center gap-1',
                          ['number', 'pct', 'amount'].includes(col.type) && 'justify-end'
                        )}>
                          {col.label}
                          {sortColumn === col.key ? (
                            sortDirection === 'asc'
                              ? <ArrowUp className="h-3 w-3" />
                              : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((note) => {
                    const isExpanded = expandedNoteId === note.note_id;
                    return (
                      <Fragment key={note.note_id}>
                        <tr
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors",
                            isExpanded && "bg-muted/30"
                          )}
                          onClick={() => toggleExpand(note)}
                        >
                          <td className="w-8">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          {visibleColumns.map(col => (
                            <td
                              key={col.key}
                              className={cn(
                                ['number', 'pct', 'amount'].includes(col.type) && 'text-right mono',
                                col.key === 'isin' && 'font-medium text-primary',
                                col.type === 'date' && 'text-sm text-muted-foreground',
                                col.type === 'text' && col.key !== 'isin' && 'text-sm',
                              )}
                            >
                              {renderCell(note, col)}
                            </td>
                          ))}
                        </tr>

                        {/* Expanded Holders Panel */}
                        {isExpanded && (
                          <tr key={`${note.note_id}-holders`} className="bg-muted/20">
                            <td colSpan={visibleColumns.length + 1} className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  Holders
                                  {!isLoadingHolders && ` (${holders.length})`}
                                </span>
                              </div>

                              {isLoadingHolders ? (
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Loading holders...
                                </div>
                              ) : holders.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                  No holders found in current positions.
                                </div>
                              ) : (
                                <div className="bg-card rounded-lg border border-border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border bg-muted/50">
                                        <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Name</th>
                                        <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Portfolio</th>
                                        <th className="px-4 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Quantity</th>
                                        <th className="px-4 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Mark Price</th>
                                        <th className="px-4 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Current Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {holders.map((holder, idx) => {
                                        const currentValue = holder.quantity && holder.mark_price
                                          ? holder.quantity * holder.mark_price
                                          : null;
                                        const markPriceDisplay = holder.mark_price
                                          ? holder.mark_price.toFixed(2)
                                          : '-';

                                        return (
                                          <tr key={`${holder.full_name}-${idx}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                                            <td className="px-4 py-2 font-medium">{holder.full_name}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{holder.portfolio_name}</td>
                                            <td className="px-4 py-2 text-right mono">
                                              {formatCurrency(holder.quantity, 'USD')}
                                            </td>
                                            <td className="px-4 py-2 text-right mono">
                                              {markPriceDisplay}
                                            </td>
                                            <td className="px-4 py-2 text-right mono font-medium">
                                              {currentValue != null
                                                ? formatCurrency(currentValue, 'USD')
                                                : '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default StructuredNotes;
