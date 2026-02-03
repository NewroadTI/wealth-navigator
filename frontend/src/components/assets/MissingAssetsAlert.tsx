import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';

interface MissingAsset {
  symbol: string;
  security_id?: string;
  isin?: string;
  description: string;
  currency: string;
  asset_class?: string;
  asset_type: string;
  quantity: string;
  position_value: string;
  mark_price?: string;
  reason: string;
}

interface ETLJob {
  job_id: number;
  job_type: string;
  job_name: string;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  started_at: string;
  completed_at: string;
  extra_data?: {
    missing_assets?: MissingAsset[];
    missing_accounts?: Array<{ account_code: string; reason: string }>;
  };
}

interface MissingAssetsAlertProps {
  onCreateAsset?: (asset: MissingAsset) => void;
}

export function MissingAssetsAlert({ onCreateAsset }: MissingAssetsAlertProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [latestJob, setLatestJob] = useState<ETLJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLatestJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/etl/jobs?report_type=OPENPOSITIONS&limit=1`
      );
      if (!response.ok) throw new Error('Failed to load ETL jobs');
      const jobs: ETLJob[] = await response.json();
      if (jobs.length > 0) {
        setLatestJob(jobs[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatestJob();
  }, []);

  const missingAssets = latestJob?.extra_data?.missing_assets || [];
  const missingAccounts = latestJob?.extra_data?.missing_accounts || [];

  if (loading) {
    return (
      <Card className="mb-4 border-muted">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading ETL status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !latestJob) {
    return null;
  }

  // Si no hay missing assets ni accounts, no mostrar nada
  if (missingAssets.length === 0 && missingAccounts.length === 0) {
    return null;
  }

  const totalMissing = missingAssets.length + missingAccounts.length;
  const totalValue = missingAssets.reduce((sum, asset) => {
    return sum + (parseFloat(asset.position_value) || 0);
  }, 0);

  const handleCreateAsset = (asset: MissingAsset) => {
    if (onCreateAsset) {
      onCreateAsset(asset);
    } else {
      // Fallback: open in new tab with query params
      const params = new URLSearchParams({
        symbol: asset.symbol || '',
        description: asset.description || '',
        isin: asset.isin || asset.security_id || '',
        currency: asset.currency || 'USD',
      });
      window.open(`/assets?create=true&${params.toString()}`, '_blank');
    }
  };

  return (
    <Card className="mb-4 border-amber-500/50 bg-amber-500/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3 px-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Missing Assets from ETL Import
                    <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      {totalMissing} items
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last sync: {formatDistanceToNow(new Date(latestJob.completed_at), { addSuffix: true })}
                    {' • '}
                    Total value: {formatCurrency(totalValue, 'USD')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadLatestJob();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {missingAssets.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  Assets Not Found
                  <Badge variant="secondary" className="text-xs">
                    {missingAssets.length}
                  </Badge>
                </h4>
                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="p-2 space-y-2">
                    {missingAssets.map((asset, index) => (
                      <div
                        key={`${asset.symbol}-${index}`}
                        className="p-3 rounded-lg bg-card border hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-sm">
                                {asset.symbol}
                              </span>
                              {asset.asset_type === 'option' && (
                                <Badge variant="outline" className="text-xs">
                                  Option
                                </Badge>
                              )}
                              {asset.asset_class && (
                                <Badge variant="secondary" className="text-xs">
                                  {asset.asset_class}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {asset.description}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {(asset.isin || asset.security_id) && (
                                <span>
                                  ISIN: <span className="font-mono">{asset.isin || asset.security_id}</span>
                                </span>
                              )}
                              <span>Currency: {asset.currency}</span>
                              <span>Qty: {asset.quantity}</span>
                              <span>Value: {formatCurrency(parseFloat(asset.position_value) || 0, asset.currency)}</span>
                              {asset.mark_price && (
                                <span>Price: {formatCurrency(parseFloat(asset.mark_price) || 0, asset.currency)}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => handleCreateAsset(asset)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {missingAccounts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  Accounts Not Found
                  <Badge variant="secondary" className="text-xs">
                    {missingAccounts.length}
                  </Badge>
                </h4>
                <ScrollArea className="h-[150px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {missingAccounts.map((account, index) => (
                      <div
                        key={`${account.account_code}-${index}`}
                        className="p-2 rounded bg-muted/50 flex items-center justify-between"
                      >
                        <span className="font-mono text-sm">{account.account_code}</span>
                        <span className="text-xs text-muted-foreground">{account.reason}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
