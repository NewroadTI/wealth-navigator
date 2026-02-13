import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { getApiBaseUrl } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Loader2,
  Settings2,
  Database,
} from 'lucide-react';

// Types
interface AccountSyncStatus {
  account_id: number;
  account_code: string;
  last_twr_date: string | null;
  last_nav_date: string | null;
  is_synced: boolean;
}

interface USDAccount {
  account_id: number;
  account_code: string;
  account_alias: string | null;
  currency: string;
  twr_cutoff_date: string | null;
  last_twr_date: string | null;
  last_twr_value: number | null;
  last_nav: number | null;
}

interface TWRStatus {
  is_synced: boolean;
  last_complete_date: string | null;
  expected_date: string;
  missing_etl_jobs: string[];
  accounts_status: AccountSyncStatus[];
  cutoff_date: string | null;
  message?: string;
}

interface TWRTableRow {
  twr_daily_id: number;
  account_id: number;
  date: string;
  nav: number | null;
  sum_cash_journal: number | null;
  twr: number | null;
  hp: number | null;
  initial_hp_date: string | null;
  is_complete: boolean;
}

interface TWRTableResponse {
  total: number;
  page: number;
  page_size: number;
  data: TWRTableRow[];
}

const PerformanceConfiguration = () => {
  const { id } = useParams();
  const apiBaseUrl = getApiBaseUrl();
  const { toast } = useToast();

  const [status, setStatus] = useState<TWRStatus | null>(null);
  const [accounts, setAccounts] = useState<USDAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<USDAccount | null>(null);
  const [tableData, setTableData] = useState<TWRTableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [cutoffDate, setCutoffDate] = useState('');
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [portfolioName, setPortfolioName] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [statusRes, accountsRes, portRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/twr/${id}/status`),
        fetch(`${apiBaseUrl}/api/v1/twr/portfolio/${id}/accounts`),
        fetch(`${apiBaseUrl}/api/v1/portfolios/${id}`),
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
      }
      
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const accs = accountsData.accounts || [];
        setAccounts(accs);
        
        // Auto-select first account if none selected
        if (accs.length > 0 && !selectedAccount) {
          setSelectedAccount(accs[0]);
          setCutoffDate(accs[0].twr_cutoff_date || '');
        }
      }
      
      if (portRes.ok) {
        const p = await portRes.json();
        setPortfolioName(p.name || p.interface_code);
      }
    } catch (error) {
      console.error('Error loading TWR configuration:', error);
    } finally {
      setLoading(false);
    }
  }, [id, apiBaseUrl, selectedAccount]);

  // Load table data separately when account or page changes
  useEffect(() => {
    const loadTableData = async () => {
      if (!id || !selectedAccount) return;
      try {
        const tableRes = await fetch(
          `${apiBaseUrl}/api/v1/twr/${id}/table?account_id=${selectedAccount.account_id}&page=${tablePage}&page_size=30`
        );
        if (tableRes.ok) {
          setTableData(await tableRes.json());
        }
      } catch (error) {
        console.error('Error loading table data:', error);
      }
    };
    loadTableData();
  }, [id, selectedAccount, tablePage, apiBaseUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecalculate = async () => {
    if (!selectedAccount) return;
    setRecalculating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/twr/account/${selectedAccount.account_id}/recalculate`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        toast({
          title: 'TWR Recalculated',
          description: `${result.twr_calculated} data points recalculated for ${selectedAccount.account_code}.`,
        });
        await loadData();
      } else {
        toast({ title: 'Error', description: 'Failed to recalculate TWR.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error during recalculation.', variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

  const handleSaveCutoff = async () => {
    if (!selectedAccount || !cutoffDate) return;
    setSavingCutoff(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/twr/account/${selectedAccount.account_id}/cutoff-date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoff_date: cutoffDate }),
      });
      if (res.ok) {
        const result = await res.json();
        toast({
          title: 'Cutoff Date Updated',
          description: `Set to ${result.cutoff_date} for ${selectedAccount.account_code}. TWR recalculated for ${result.twr_calculated} points.`,
        });
        await loadData();
      } else {
        toast({ title: 'Error', description: 'Failed to update cutoff date.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setSavingCutoff(false);
    }
  };

  const handleAccountChange = (accountId: number) => {
    const account = accounts.find((a) => a.account_id === accountId);
    if (account) {
      setSelectedAccount(account);
      setCutoffDate(account.twr_cutoff_date || '');
      setTablePage(1); // Reset to first page
    }
  };

  const SyncStatusBadge = ({ synced }: { synced: boolean }) => (
    <Badge variant={synced ? 'default' : 'destructive'} className={cn(
      'gap-1',
      synced ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''
    )}>
      {synced ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {synced ? 'Synced' : 'Needs Update'}
    </Badge>
  );

  if (loading) {
    return (
      <AppLayout title="Performance Configuration" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Performance Configuration"
      subtitle={portfolioName ? `${portfolioName}` : 'Configure TWR Settings'}
    >
      {/* Back Button */}
      <div className="mb-4">
        <Link to={`/portfolios/${id}/performance`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Performance
          </Button>
        </Link>
      </div>

      {/* Overall Status Card */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">TWR Sync Status</h3>
          </div>
          {status && <SyncStatusBadge synced={status.is_synced} />}
        </div>

        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Expected Date</p>
              <p className="text-sm font-medium text-foreground">{status.expected_date}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Last Complete</p>
              <p className="text-sm font-medium text-foreground">{status.last_complete_date || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Selected Account</p>
              <p className="text-sm font-medium text-foreground mono">{selectedAccount?.account_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Accounts</p>
              <p className="text-sm font-medium text-foreground">{accounts.length}</p>
            </div>
          </div>
        )}

        {/* Missing ETL Jobs Warning */}
        {status && status.missing_etl_jobs.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Missing ETL Jobs</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The following jobs need to complete before TWR can be fully calculated:{' '}
              <span className="font-mono text-foreground">{status.missing_etl_jobs.join(', ')}</span>
            </p>
            <Link to="/etl/ibkr">
              <Button variant="outline" size="sm" className="gap-1 mt-2">
                <Database className="h-3 w-3" />
                Go to ETL
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Account Selector */}
      {accounts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-3">Select Account</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((account) => (
              <button
                key={account.account_id}
                onClick={() => handleAccountChange(account.account_id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  selectedAccount?.account_id === account.account_id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <p className="font-mono text-sm font-medium text-foreground">{account.account_code}</p>
                {account.account_alias && (
                  <p className="text-xs text-muted-foreground mt-0.5">{account.account_alias}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {account.last_twr_value !== null ? `TWR: ${account.last_twr_value.toFixed(2)}%` : 'No data'}
                  </span>
                  {selectedAccount?.account_id === account.account_id && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Cutoff Date Config */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Cutoff Date (Contract Inception)</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Set the start date for TWR calculation for {selectedAccount?.account_code || 'selected account'}. 
            All TWR will be computed from this date forward.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="cutoff" className="text-xs">Cutoff Date</Label>
              <Input
                id="cutoff"
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="mt-1"
                disabled={!selectedAccount}
              />
            </div>
            <Button
              onClick={handleSaveCutoff}
              disabled={savingCutoff || !cutoffDate || !selectedAccount}
              size="sm"
              className="gap-1"
            >
              {savingCutoff && <Loader2 className="h-3 w-3 animate-spin" />}
              Save & Recalculate
            </Button>
          </div>
        </div>

        {/* Recalculate Button */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Recalculate TWR</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Recompute all TWR values for {selectedAccount?.account_code || 'selected account'}. 
            Use after manual edits or if data seems inconsistent.
          </p>
          <Button
            onClick={handleRecalculate}
            disabled={recalculating || !selectedAccount}
            variant="outline"
            className="gap-2"
          >
            {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {recalculating ? 'Recalculating...' : 'Recalculate'}
          </Button>
        </div>
      </div>

      {/* Account Status Table */}
      {status && status.accounts_status.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-4">Account Status</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Account</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Last TWR Date</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Last NAV Date</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {status.accounts_status.map((acc) => (
                  <tr key={acc.account_id} className="border-b border-border/50">
                    <td className="py-2 px-3 font-mono text-foreground">{acc.account_code}</td>
                    <td className="py-2 px-3 text-muted-foreground">{acc.last_twr_date || '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{acc.last_nav_date || '—'}</td>
                    <td className="py-2 px-3 text-right">
                      <SyncStatusBadge synced={acc.is_synced} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TWR Daily Data Table */}
      {selectedAccount && tableData && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">
              TWR Daily Data - {selectedAccount.account_code} ({tableData.total} rows)
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Page {tableData.page} of {Math.ceil(tableData.total / tableData.page_size)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">NAV</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Cash Flows</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">HP %</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">TWR %</th>
                  <th className="text-center py-2 px-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableData.data.map((row) => (
                  <tr key={row.twr_daily_id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-1.5 px-2 text-foreground">{row.date}</td>
                    <td className="py-1.5 px-2 text-right text-foreground">
                      {row.nav != null ? row.nav.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">
                      {row.sum_cash_journal != null ? row.sum_cash_journal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right', row.hp != null && row.hp >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {row.hp != null ? `${row.hp.toFixed(4)}%` : '—'}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right font-medium', row.twr != null && row.twr >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {row.twr != null ? `${row.twr.toFixed(4)}%` : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {row.is_complete ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 inline" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-yellow-400 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {tableData.total > tableData.page_size && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={tablePage <= 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {tablePage} / {Math.ceil(tableData.total / tableData.page_size)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={tablePage >= Math.ceil(tableData.total / tableData.page_size)}
                onClick={() => setTablePage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default PerformanceConfiguration;
