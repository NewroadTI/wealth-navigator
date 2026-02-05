/**
 * Pershing Dashboard Page
 * 
 * Upload and process Pershing XLSX transaction files.
 * Shows upload progress, preview, and import results.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Upload,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Loader2,
    Trash2,
    ArrowUpCircle,
    Clock,
    AlertTriangle,
    Activity,
    RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/config';
import { ExcelPreview } from '@/components/pershing/ExcelPreview';
import { useNotifications } from '@/contexts/NotificationsContext';

// ==========================================================================
// TYPES
// ==========================================================================

interface ImportWarning {
    type: string;
    count: number;
    details: string[];
}

interface ImportStats {
    trades: number;
    cash_journal: number;
    corporate_actions: number;
    trades_cancelled: number;
    duplicates: number;
    skipped_no_account: number;
    skipped_no_asset: number;
}

interface ImportResult {
    id: string;
    filename: string;
    status: 'uploading' | 'converting' | 'importing' | 'success' | 'partial' | 'failed' | 'no_new_data';
    stats?: ImportStats;
    warnings?: ImportWarning[];
    errors?: string[];
    timestamp: Date;
    message?: string;
}

interface JobHistory {
    job_id: number;
    job_type: string;
    job_name: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    records_processed: number;
    records_created: number;
    records_skipped: number;
    records_failed: number;
    file_name: string | null;
    error_message: string | null;
    done: boolean;
}

// ==========================================================================
// HELPER COMPONENTS
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
        default:
            return <Clock className="h-4 w-4 text-gray-400" />;
    }
};

const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const ActivityLogItem = ({ log }: { log: JobHistory }) => {
    const hasSkippedOrFailed = (log.records_skipped || 0) > 0 || (log.records_failed || 0) > 0;

    return (
        <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
            <div className="mt-1">{getStatusIcon(log.status)}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{log.job_type} job id #{log.job_id}</p>
                        {hasSkippedOrFailed && (
                            <a
                                href={`/etl-job/${log.job_id}`}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
                            >
                                View details
                                <ArrowUpCircle className="h-3 w-3 rotate-45" />
                            </a>
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
                </div>
                {log.error_message && (
                    <p className="text-xs text-red-500 mt-1 font-mono bg-red-50 p-2 rounded border border-red-200" title={log.error_message}>
                        {log.error_message.length > 100 ? `${log.error_message.substring(0, 100)}...` : log.error_message}
                    </p>
                )}
            </div>
        </div>
    );
};

// ==========================================================================
// HELPER COMPONENTS
// ==========================================================================



// ==========================================================================
// MAIN COMPONENT
// ==========================================================================

const PershingDashboard = () => {
    const { toast } = useToast();
    const { addNotification } = useNotifications();
    const apiBaseUrl = getApiBaseUrl();

    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
    const [csvFilename, setCsvFilename] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    // Removed recentImports - replaced by jobHistory from API
    const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(true);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
                handleFileSelect(droppedFile);
            } else {
                toast({
                    variant: "destructive",
                    title: "Invalid file type",
                    description: "Please upload a .xlsx or .xls file",
                });
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setIsProcessing(true);
        setProcessingStep('Converting XLSX to CSV...');

        try {
            // Convert XLSX to CSV via API
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch(`${apiBaseUrl}/api/v1/persh-etl/convert-xlsx`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to convert file');
            }

            const result = await response.json();

            setPreviewData(result.preview || []);
            setCsvFilename(result.csv_filename);

            toast({
                title: "File ready",
                description: `${result.row_count} rows loaded. Review and click Upload to import.`,
            });

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Conversion failed",
                description: error instanceof Error ? error.message : 'Unknown error',
            });
            setFile(null);
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const handleClear = () => {
        setFile(null);
        setPreviewData([]);
        setCsvFilename(null);
    };

    const handleUpload = async () => {
        if (!csvFilename) return;

        const importId = Date.now().toString();
        const filename = file?.name || csvFilename;

        // Add to recent imports as "importing"
        const newImport: ImportResult = {
            id: importId,
            filename,
            status: 'importing',
            timestamp: new Date(),
        };
        // No longer tracking local imports - using jobHistory from API

        setIsProcessing(true);
        setProcessingStep('Importing transactions...');

        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/persh-etl/import-transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv_filename: csvFilename }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to import transactions');
            }

            const result = await response.json();

            // Refresh job history to show the new job
            await fetchJobs();

            toast({
                title: result.status === 'success' ? "Import complete" : "Import completed with warnings",
                description: result.message,
                variant: result.status === 'failed' ? 'destructive' : 'default',
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Refresh job history to show failed job (if logged)
            await fetchJobs();

            // Add critical error to notifications bell
            addNotification({
                type: 'persh_import_error',
                title: 'Pershing Import Failed',
                message: `File "${filename}" could not be imported: ${errorMessage}`,
                data: { filename },
            });

            toast({
                variant: "destructive",
                title: "Import failed",
                description: errorMessage,
            });
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
            handleClear();
        }
    };

    const fetchJobs = async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/etl/jobs?limit=50`);
            if (!response.ok) {
                throw new Error('Failed to fetch jobs');
            }
            const jobs: JobHistory[] = await response.json();
            // Filter only PERSHING jobs
            const pershingJobs = jobs.filter(job => job.job_type === 'PERSHING');
            setJobHistory(pershingJobs);
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoadingJobs(false);
        }
    };

    // Auto-fetch jobs on mount
    useEffect(() => {
        fetchJobs();
        // Refresh every 30 seconds
        const interval = setInterval(fetchJobs, 30000);
        return () => clearInterval(interval);
    }, []);

    // ========================================================================
    // HELPERS
    // ========================================================================

    const getStatusIcon = (status: ImportResult['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'partial':
                return <AlertTriangle className="h-4 w-4 text-amber-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'no_new_data':
                return <Clock className="h-4 w-4 text-muted-foreground" />;
            default:
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        }
    };

    const getStatusBadge = (status: ImportResult['status']) => {
        const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
            success: { variant: 'default', label: 'Complete' },
            partial: { variant: 'secondary', label: 'Partial' },
            failed: { variant: 'destructive', label: 'Failed' },
            no_new_data: { variant: 'outline', label: 'No New Data' },
            uploading: { variant: 'secondary', label: 'Uploading' },
            converting: { variant: 'secondary', label: 'Converting' },
            importing: { variant: 'secondary', label: 'Importing' },
        };
        const { variant, label } = variants[status] || { variant: 'outline' as const, label: status };
        return <Badge variant={variant} className="text-xs">{label}</Badge>;
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <AppLayout title="Pershing ETL Dashboard" subtitle="Upload and process Pershing transaction files">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Upload Section */}
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Upload className="h-5 w-5" />
                                    Data Import
                                </CardTitle>
                                <CardDescription>
                                    Upload Pershing transaction files (.xlsx) to import into the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Drop Zone */}
                                {!file && (
                                    <div
                                        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                            }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="p-4 bg-muted rounded-full">
                                                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-medium">
                                                    Drag and drop your XLSX file here
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Or click to browse from your computer
                                                </p>
                                            </div>
                                            <div className="relative">
                                                <Button variant="outline">Browse Files</Button>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept=".xlsx,.xls"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Processing Indicator */}
                                {isProcessing && (
                                    <div className="flex items-center justify-center gap-3 py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-sm text-muted-foreground">{processingStep}</span>
                                    </div>
                                )}

                                {/* File Preview */}
                                {file && !isProcessing && previewData.length > 0 && (
                                    <div className="space-y-4">
                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                                <span className="font-medium">{file.name}</span>
                                                <Badge variant="outline">{previewData.length} rows</Badge>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleClear}
                                                    disabled={isProcessing}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                    Remove
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={handleUpload}
                                                    disabled={isProcessing}
                                                >
                                                    <ArrowUpCircle className="h-4 w-4 mr-1" />
                                                    Upload
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Excel Preview */}
                                        <ExcelPreview data={previewData} maxRows={10} />
                                    </div>
                                )}

                                {/* Info Box */}
                                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-md flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium">Supported Format</p>
                                        <p className="mt-1 opacity-90">
                                            Daily Pershing transaction exports (.xlsx). The file will be converted to CSV
                                            and processed automatically.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Job History Sidebar */}
                    {/* Recent Activity Section */}
                    {/* Replaces Job History Sidebar */}
                    <div className="lg:col-span-1">
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-5 w-5" />
                                        <CardTitle>Recent Activity</CardTitle>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={fetchJobs}
                                        disabled={loadingJobs}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                                <CardDescription>Latest Pershing import jobs</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingJobs ? (
                                    <div className="flex flex-col gap-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="flex gap-3">
                                                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                                                    <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : jobHistory.length > 0 ? (
                                    <ScrollArea className="h-[500px]">
                                        <div className="space-y-1">
                                            {jobHistory.map((job) => (
                                                <ActivityLogItem key={job.job_id} log={job} />
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                        <Clock className="h-10 w-10 mb-3 opacity-20" />
                                        <p>No activity recorded yet</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>


            </div>
        </AppLayout>
    );
};

export default PershingDashboard;
