/**
 * ETL Job Details Page
 * 
 * Displays detailed information about skipped and failed records for a specific ETL job.
 * Allows users to see exactly which records were not processed and why.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  XCircle, 
  Search,
  Clock,
  CheckCircle2,
  Database
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/config';

// ==========================================================================
// TYPES
// ==========================================================================

interface ETLJobDetails {
  job_id: number;
  job_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_skipped: number;
  records_failed: number;
  skipped_records: Array<{
    row_index?: number;
    row_data: Record<string, any>;
    reason: string;
    record_type?: string;
  }>;
  failed_records: Array<{
    row_index?: number;
    row_data: Record<string, any>;
    error: string;
  }>;
  missing_assets: Array<{
    symbol: string;
    security_id?: string;
    isin?: string;
    description?: string;
    currency?: string;
    reason: string;
  }>;
  missing_accounts: Array<{
    account_code: string;
    reason: string;
  }>;
};

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    success: { variant: 'default', label: 'Success' },
    failed: { variant: 'destructive', label: 'Failed' },
    running: { variant: 'secondary', label: 'Running' },
    pending: { variant: 'secondary', label: 'Pending' },
  };

  const { variant, label } = variants[status] || { variant: 'outline' as const, label: status };

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
};


// ==========================================================================
// COMPONENTS
// ==========================================================================

const RecordDetailsCard = ({ 
  record, 
  index,
  type 
}: { 
  record: any; 
  index: number;
  type: 'skipped' | 'failed';
}) => {
  const reason = type === 'skipped' ? record.reason : record.error;
  const rowIndex = record.row_index !== undefined ? record.row_index : index;

  return (
    <AccordionItem value={`record-${index}`}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 w-full text-left">
          <div className={`p-1.5 rounded-lg ${type === 'skipped' ? 'bg-yellow-100' : 'bg-red-100'}`}>
            {type === 'skipped' ? (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Row {rowIndex}</span>
              {record.record_type && (
                <Badge variant="outline" className="text-xs">{record.record_type}</Badge>
              )}
            </div>
            <p className={`text-xs mt-1 truncate ${type === 'skipped' ? 'text-yellow-700' : 'text-red-700'}`}>
              {reason}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-2">
          <div>
            <h4 className={`text-sm font-semibold mb-2 ${type === 'skipped' ? 'text-yellow-700' : 'text-red-700'}`}>
              {type === 'skipped' ? 'Skip Reason:' : 'Error Message:'}
            </h4>
            <p className={`text-sm p-3 rounded border ${
              type === 'skipped' 
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {reason}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-2">Record Data:</h4>
            <div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-96 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(record.row_data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const MissingAssetCard = ({ asset, index }: { asset: any; index: number }) => (
  <Card className="bg-blue-50 border-blue-200">
    <CardContent className="pt-4 pb-3">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-blue-900">{asset.symbol || 'Unknown Symbol'}</p>
            <p className="text-xs text-blue-700 mt-1">{asset.description || 'No description'}</p>
          </div>
          <Badge variant="outline" className="bg-white text-xs">{asset.currency || 'USD'}</Badge>
        </div>
        
        {(asset.isin || asset.security_id) && (
          <div className="text-xs text-blue-700 space-y-1">
            {asset.isin && <p>ISIN: {asset.isin}</p>}
            {asset.security_id && <p>Security ID: {asset.security_id}</p>}
          </div>
        )}
        
        <p className="text-xs text-blue-600 pt-2 border-t border-blue-200">
          {asset.reason}
        </p>
      </div>
    </CardContent>
  </Card>
);

const MissingAccountCard = ({ account }: { account: any }) => (
  <Card className="bg-purple-50 border-purple-200">
    <CardContent className="pt-4 pb-3">
      <div className="space-y-2">
        <p className="font-semibold text-purple-900">{account.account_code}</p>
        <p className="text-xs text-purple-600">{account.reason}</p>
      </div>
    </CardContent>
  </Card>
);

// ==========================================================================
// MAIN COMPONENT
// ==========================================================================

const ETLJobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiBaseUrl = getApiBaseUrl();

  const [data, setData] = useState<ETLJobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('skipped');

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/etl/jobs/${jobId}/records`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const jobData = await response.json();
      console.log('Job data received:', jobData);
      console.log('Skipped records:', jobData.skipped_records);
      console.log('Failed records:', jobData.failed_records);
      setData(jobData);
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load job details',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = (records: any[]) => {
    if (!searchTerm) return records;
    
    return records.filter(record => {
      const searchLower = searchTerm.toLowerCase();
      const reason = record.reason || record.error || '';
      const rowData = JSON.stringify(record.row_data).toLowerCase();
      
      return reason.toLowerCase().includes(searchLower) || rowData.includes(searchLower);
    });
  };

  if (loading) {
    return (
      <AppLayout title="ETL Job Details" subtitle="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="ETL Job Details" subtitle="Job not found">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Job not found</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => navigate('/etl/ibkr')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const filteredSkipped = filterRecords(data.skipped_records || []);
  const filteredFailed = filterRecords(data.failed_records || []);

  return (
    <AppLayout 
      title={`Job #${data.job_id} - ${data.job_type}`}
      subtitle="Detailed record information"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/etl/ibkr')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-2">{getStatusBadge(data.status)}</div>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold">{data.records_processed}</p>
                </div>
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-2xl font-bold text-green-600">{data.records_created}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">{data.records_skipped}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{data.records_failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Time Info */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Started: {formatDateTime(data.started_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Completed: {formatDateTime(data.completed_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="skipped">
              Skipped ({data.records_skipped})
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed ({data.records_failed})
            </TabsTrigger>
            <TabsTrigger value="missing-assets">
              Missing Assets ({data.missing_assets?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="missing-accounts">
              Missing Accounts ({data.missing_accounts?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          {(activeTab === 'skipped' || activeTab === 'failed') && (
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records by reason or data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          <TabsContent value="skipped" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Skipped Records</CardTitle>
                <CardDescription>
                  Records that were skipped during processing ({filteredSkipped.length} {searchTerm ? 'filtered' : 'total'})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSkipped.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? 'No records match your search' : 
                       data.records_skipped > 0 
                         ? 'Detailed record data is not available for this job. This feature tracks records from newer jobs only.'
                         : 'No records were skipped'}
                    </p>
                    {data.records_skipped > 0 && !searchTerm && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {data.records_skipped} records were skipped but detailed data was not captured.
                        Re-run this ETL job to capture detailed information.
                      </p>
                    )}
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredSkipped.map((record, index) => (
                      <RecordDetailsCard
                        key={index}
                        record={record}
                        index={index}
                        type="skipped"
                      />
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Failed Records</CardTitle>
                <CardDescription>
                  Records that failed during processing ({filteredFailed.length} {searchTerm ? 'filtered' : 'total'})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredFailed.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? 'No records match your search' : 
                       data.records_failed > 0 
                         ? 'Detailed record data is not available for this job. This feature tracks records from newer jobs only.'
                         : 'No records failed'}
                    </p>
                    {data.records_failed > 0 && !searchTerm && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {data.records_failed} records failed but detailed data was not captured.
                        Re-run this ETL job to capture detailed information.
                      </p>
                    )}
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredFailed.map((record, index) => (
                      <RecordDetailsCard
                        key={index}
                        record={record}
                        index={index}
                        type="failed"
                      />
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing-assets" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Missing Assets</CardTitle>
                <CardDescription>
                  Assets that need to be created in the database ({data.missing_assets?.length || 0})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data.missing_assets || data.missing_assets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No missing assets
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.missing_assets.map((asset, index) => (
                      <MissingAssetCard key={index} asset={asset} index={index} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing-accounts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Missing Accounts</CardTitle>
                <CardDescription>
                  Accounts that need to be created in the database ({data.missing_accounts?.length || 0})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data.missing_accounts || data.missing_accounts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No missing accounts
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.missing_accounts.map((account, index) => (
                      <MissingAccountCard key={index} account={account} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ETLJobDetails;
