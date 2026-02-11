/**
 * ETL Dashboard Page
 * 
 * Displays the status of ETL jobs for IBKR data synchronization.
 * Shows stats, report statuses, and recent activity.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { getApiBaseUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Play,
  Activity,
  FileText,
  Database,
  Upload,
  ArrowRightLeft,
  Banknote,
  TrendingUp,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ==========================================================================
// TYPES
// ==========================================================================

interface ETLDashboardStats {
  active_report_types: number;
  syncs_today: number;
  records_processed_today: number;
  success_rate_today: number;
  last_sync_at: string | null;
}

interface ETLReportStatus {
  report_type: string;
  display_name: string;
  description: string;
  status: 'success' | 'failed' | 'pending' | 'never_run' | 'running';
  last_run_at: string | null;
  last_success_at: string | null;
  records_last_run: number;
  error_message: string | null;
  is_enabled: boolean;
  auto_sync_enabled: boolean;
}

interface ETLActivityLog {
  job_id: number;
  job_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_skipped: number;
  records_failed: number;
  error_message: string | null;
  duration_seconds: number | null;
  report_type?: string;
  extra_data?: {
    missing_assets?: Array<{ symbol: string }>;
    missing_accounts?: Array<{ account_code: string; reason: string }>;
  };
}

interface ETLDashboardResponse {
  stats: ETLDashboardStats;
  report_statuses: ETLReportStatus[];
  recent_activity: ETLActivityLog[];
  last_updated: string;
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'never_run':
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    success: { variant: 'default', label: 'Success' },
    failed: { variant: 'destructive', label: 'Failed' },
    running: { variant: 'secondary', label: 'Running' },
    pending: { variant: 'secondary', label: 'Pending' },
    never_run: { variant: 'outline', label: 'Never Run' },
  };

  const { variant, label } = variants[status] || { variant: 'outline' as const, label: status };

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
};

const getReportIcon = (reportType: string) => {
  const icons: Record<string, React.ReactNode> = {
    CORPORATES: <Layers className="h-5 w-5" />,
    OPENPOSITIONS: <Database className="h-5 w-5" />,
    PRICES: <TrendingUp className="h-5 w-5" />,
    STATEMENTFUNDS: <Banknote className="h-5 w-5" />,
    TRADES: <ArrowRightLeft className="h-5 w-5" />,
    TRANSACCIONES: <FileText className="h-5 w-5" />,
    TRANSFERS: <Upload className="h-5 w-5" />,
  };
  return icons[reportType] || <FileText className="h-5 w-5" />;
};

const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);

  // Always show the date and time for better tracking
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
};

// ==========================================================================
// COMPONENTS
// ==========================================================================

const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-full">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ReportStatusCard = ({
  report,
  onTrigger
}: {
  report: ETLReportStatus;
  onTrigger: (reportType: string) => void;
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="pt-4 pb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted rounded-lg">
            {getReportIcon(report.report_type)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{report.display_name}</h4>
              {getStatusBadge(report.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(report.last_run_at)}
              </span>
              {report.records_last_run > 0 && (
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {report.records_last_run} records
                </span>
              )}
            </div>
            {report.error_message && (
              <p className="text-xs text-red-500 mt-2 line-clamp-1">
                {report.error_message}
              </p>
            )}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTrigger(report.report_type)}
              disabled={report.status === 'running' || report.report_type === 'PRICES'}
            >
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{report.report_type === 'PRICES' ? 'Not available' : 'Run sync'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </CardContent>
  </Card>
);

const ActivityLogItem = ({ log }: { log: ETLActivityLog }) => {
  const navigate = useNavigate();

  // Show missing assets link for jobs that track them
  const jobsWithMissingAssets = ['OPENPOSITIONS', 'STATEMENTFUNDS'];
  const canHaveMissingAssets = jobsWithMissingAssets.includes(log.job_type) ||
    (log.report_type && jobsWithMissingAssets.includes(log.report_type));
  const hasMissingAssets = Boolean(log.extra_data?.missing_assets && log.extra_data.missing_assets.length > 0);
  const hasMissingAccounts = Boolean(log.extra_data?.missing_accounts && log.extra_data.missing_accounts.length > 0);
  const hasSkippedOrFailed = (log.records_skipped || 0) > 0 || (log.records_failed || 0) > 0;

  // Support both 'error_message' and 'error' fields from backend
  const errorText = log.error_message || (log as any).error;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-1">{getStatusIcon(log.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{log.job_type} job id #{log.job_id}</p>
            {hasSkippedOrFailed && (
              <button
                onClick={() => navigate(`/etl-job/${log.job_id}`)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
              >
                View details
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            {canHaveMissingAssets && hasMissingAssets && (
              <Link
                to={`/assets?show_missing=true&job_id=${log.job_id}`}
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline"
              >
                View missing assets
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
            {hasMissingAccounts && (
              <span className="text-xs text-amber-600" title={`Missing accounts: ${log.extra_data?.missing_accounts?.map(a => a.account_code).join(', ')}`}>
                ({log.extra_data?.missing_accounts?.length} missing accounts)
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(log.started_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {log.status === 'success' && (
            <>
              <span className="text-xs text-muted-foreground">
                {log.records_processed} processed
              </span>
              {log.records_created > 0 && (
                <span className="text-xs text-green-600">
                  +{log.records_created} created
                </span>
              )}
              {log.records_skipped > 0 && (
                <span className="text-xs text-amber-600">
                  {log.records_skipped} skipped
                </span>
              )}
            </>
          )}
          {log.records_failed > 0 && (
            <span className="text-xs text-red-500">
              {log.records_failed} failed
            </span>
          )}
          {log.duration_seconds && (
            <span className="text-xs text-muted-foreground">
              ({formatDuration(log.duration_seconds)})
            </span>
          )}
        </div>
        {errorText && (
          <p className="text-xs text-red-500 mt-1 font-mono bg-red-50 p-2 rounded border border-red-200" title={errorText}>
            {errorText.length > 100 ? `${errorText.substring(0, 100)}...` : errorText}
          </p>
        )}
      </div>
    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT
// ==========================================================================

const IBKRDashboard = () => {
  const { toast } = useToast();
  const apiBaseUrl = getApiBaseUrl();

  const [data, setData] = useState<ETLDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const fetchDashboard = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/etl/dashboard`);

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();

      // Filter out PERSHING jobs for IBKR dashboard
      if (dashboardData.recent_activity) {
        dashboardData.recent_activity = dashboardData.recent_activity.filter(
          (job: any) => !job.job_type.includes('PERSHING')
        );
      }

      setData(dashboardData);
    } catch (error) {
      console.error('Error fetching ETL dashboard:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load ETL dashboard data',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const triggerJob = async (reportType: string) => {
    setTriggeringJob(reportType);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/etl/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ report_type: reportType }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger job');
      }

      const result = await response.json();

      toast({
        title: 'Job Started',
        description: `ETL job for ${reportType} has been started (ID: ${result.job_id})`,
      });

      // Refresh after a short delay
      setTimeout(() => fetchDashboard(true), 1000);

    } catch (error) {
      console.error('Error triggering job:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to trigger ETL job for ${reportType}`,
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  useEffect(() => {
    fetchDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchDashboard(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <AppLayout title="IBKR ETL Dashboard" subtitle="Monitor IBKR data synchronization">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="ETL Dashboard" subtitle="Monitor IBKR data synchronization">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {data?.last_updated && (
              <span className="text-sm text-muted-foreground">
                Updated: {formatRelativeTime(data.last_updated)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {data?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatsCard
              title="Report Types"
              value={data.stats.active_report_types}
              subtitle="Active pipelines"
              icon={FileText}
            />
            <StatsCard
              title="Syncs Today"
              value={data.stats.syncs_today}
              subtitle={data.stats.last_sync_at ? `Last: ${formatRelativeTime(data.stats.last_sync_at)}` : 'No syncs yet'}
              icon={RefreshCw}
            />
            <StatsCard
              title="Records Processed"
              value={data.stats.records_processed_today.toLocaleString()}
              subtitle="Today's total"
              icon={Database}
            />
            <StatsCard
              title="Success Rate"
              value={`${data.stats.success_rate_today}%`}
              subtitle="Today's jobs"
              icon={Activity}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Statuses */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Report Pipelines</CardTitle>
                <CardDescription>
                  Status of each IBKR data feed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.report_statuses.map((report) => (
                  <ReportStatusCard
                    key={report.report_type}
                    report={report}
                    onTrigger={triggerJob}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Activity Log */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Latest ETL job executions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {data?.recent_activity && data.recent_activity.length > 0 ? (
                    <div className="divide-y">
                      {data.recent_activity
                        .filter(log => log.job_type !== 'PERSHING')
                        .map((log) => (
                          <ActivityLogItem key={log.job_id} log={log} />
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2" />
                      <p className="text-sm">No activity yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default IBKRDashboard;