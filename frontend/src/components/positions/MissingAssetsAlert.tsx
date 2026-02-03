import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { getApiBaseUrl } from '@/lib/config';

export interface MissingAsset {
  symbol: string;
  security_id: string;
  isin: string;
  description: string;
  currency: string;
  asset_class: string;
  asset_type: string;
  quantity: string;
  position_value: string;
  mark_price: string;
  reason: string;
}

interface ETLJob {
  job_id: number;
  job_type: string;
  job_name: string;
  status: string;
  records_processed: number;
  records_skipped: number;
  started_at: string;
  completed_at: string;
  extra_data?: {
    missing_assets?: MissingAsset[];
    missing_accounts?: Array<{ account_code: string; reason: string }>;
  };
}

interface MissingAssetsAlertProps {
  onCreateAsset?: (asset: MissingAsset) => void;
  onRefresh?: () => void;
}

export function MissingAssetsAlert({ onCreateAsset, onRefresh }: MissingAssetsAlertProps) {
  const [searchParams] = useSearchParams();
  const showMissing = searchParams.get('show_missing') === 'true';
  const jobIdParam = searchParams.get('job_id');
  
  const [isOpen, setIsOpen] = useState(showMissing);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ETLJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    jobIdParam ? parseInt(jobIdParam) : null
  );

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (showMissing) {
      setIsOpen(true);
    }
  }, [showMissing]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/etl/jobs?report_type=OPENPOSITIONS&limit=5`
      );
      if (!response.ok) return;
      
      const data = await response.json();
      // Show all jobs, including those without missing assets
      setJobs(data);
      
      // Auto-select the first job if none selected
      if (!selectedJobId && data.length > 0) {
        setSelectedJobId(data[0].job_id);
      }
      
      // Notify parent if refresh callback exists
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to fetch ETL jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedJob = jobs.find(j => j.job_id === selectedJobId);
  const missingAssets = selectedJob?.extra_data?.missing_assets || [];
  const totalMissingCount = jobs.reduce(
    (acc, j) => acc + (j.extra_data?.missing_assets?.length || 0), 
    0
  );

  if (jobs.length === 0 && !loading) {
    return null; // No ETL jobs found
  }

  // Determine if we have any missing assets across all jobs
  const hasAnyMissingAssets = totalMissingCount > 0;

  const getCreateAssetUrl = (asset: MissingAsset) => {
    const params = new URLSearchParams();
    params.set('symbol', asset.symbol);
    if (asset.isin) params.set('isin', asset.isin);
    if (asset.description) params.set('description', asset.description);
    if (asset.currency) params.set('currency', asset.currency);
    if (asset.asset_class) params.set('asset_class', asset.asset_class);
    return `/assets/create?${params.toString()}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "mb-4",
        hasAnyMissingAssets ? "border-warning/50" : "border-green-500/50",
        isOpen && (hasAnyMissingAssets ? "border-warning" : "border-green-500")
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  hasAnyMissingAssets ? "bg-warning/10" : "bg-green-500/10"
                )}>
                  {hasAnyMissingAssets ? (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">
                    {hasAnyMissingAssets ? 'Missing Assets Detected' : 'All Assets Available'}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {hasAnyMissingAssets 
                      ? `${totalMissingCount} asset(s) need to be created to complete position sync`
                      : 'All recent ETL jobs completed successfully with no missing assets'
                    }
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn(
                    hasAnyMissingAssets 
                      ? "bg-warning/10 text-warning border-warning/30"
                      : "bg-green-500/10 text-green-500 border-green-500/30"
                  )}
                >
                  {hasAnyMissingAssets ? `${totalMissingCount} pending` : 'All clear'}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Job Selector */}
            {jobs.length > 1 && (
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                <span className="text-sm text-muted-foreground">From job:</span>
                <div className="flex gap-1 flex-wrap">
                  {jobs.map(job => (
                    <Badge
                      key={job.job_id}
                      variant={selectedJobId === job.job_id ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedJobId(job.job_id)}
                    >
                      #{job.job_id} ({job.extra_data?.missing_assets?.length || 0})
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-auto"
                  onClick={fetchJobs}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                </Button>
              </div>
            )}

            {/* Missing Assets Table */}
            {missingAssets.length > 0 ? (
              <ScrollArea className="max-h-[400px]">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Symbol</TableHead>
                    <TableHead>ISIN / Security ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingAssets.map((asset, index) => (
                    <TableRow key={`${asset.symbol}-${index}`}>
                      <TableCell className="font-mono text-sm font-medium">
                        {asset.symbol}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {asset.isin || asset.security_id || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={asset.description}>
                        {asset.description}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(parseFloat(asset.position_value || '0'), asset.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            asset.asset_type === 'option' && "bg-purple-500/10 text-purple-500 border-purple-500/30"
                          )}
                        >
                          {asset.asset_class || asset.asset_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {onCreateAsset ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => onCreateAsset(asset)}
                          >
                            <Plus className="h-3 w-3" />
                            Create
                          </Button>
                        ) : (
                          <Link to={getCreateAssetUrl(asset)}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Plus className="h-3 w-3" />
                              Create
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 rounded-full bg-green-500/10 mb-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-sm font-medium">No Missing Assets</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This job completed successfully with all assets available
                </p>
              </div>
            )}

            {/* Footer Info */}
            {selectedJob && (
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                <p>
                  From ETL Job #{selectedJob.job_id} • {selectedJob.records_processed} records processed • {selectedJob.records_skipped} skipped
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
