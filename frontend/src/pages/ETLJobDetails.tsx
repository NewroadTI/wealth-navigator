/**
 * ETL Job Details Page
 * 
 * Displays detailed information about skipped and failed records for a specific ETL job.
 * Allows users to see exactly which records were not processed and why.
 * Includes inline resolution for Missing Accounts and Missing Assets.
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
    Database,
    UserPlus,
    Loader2,
    Check
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
import { Label } from '@/components/ui/label';
import { AssetFormFields, defaultAssetFormState, formatDecimalValue, AssetFormState } from './AssetsSection';
import { assetsApi, catalogsApi, AssetClass } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
    filename?: string; // Important for account resolution
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
    // Determine styles based on type (Dark Mode friendly)
    const isSkipped = type === 'skipped';

    // Header Colors
    const iconBg = isSkipped ? 'bg-amber-900/30' : 'bg-red-900/30';
    const iconColor = isSkipped ? 'text-amber-500' : 'text-red-500';
    const textColor = isSkipped ? 'text-amber-400' : 'text-red-400';
    const reasonColor = isSkipped ? 'text-amber-200/70' : 'text-red-200/70';

    // Content Colors
    const contentTitleColor = isSkipped ? 'text-amber-500' : 'text-red-500';
    const contentBg = isSkipped ? 'bg-amber-950/30 border-amber-900/50 text-amber-100' : 'bg-red-950/30 border-red-900/50 text-red-100';
    const jsonBg = 'bg-slate-950';
    const jsonBorder = 'border-slate-800';
    const jsonText = 'text-slate-300';

    const reason = isSkipped ? record.reason : record.error;
    const rowIndex = record.row_index !== undefined ? record.row_index : index;

    // Enhanced details for better error context
    const clientName = record.client_name || record.row_data?.cliente || record.row_data?.client_name;
    const assetDesc = record.asset_description || record.row_data?.security_description || record.row_data?.description;

    return (
        <AccordionItem value={`record-${index}`} className="border-slate-800">
            <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 w-full text-left">
                    <div className={`p-1.5 rounded-lg ${iconBg}`}>
                        {isSkipped ? (
                            <AlertCircle className={`h-4 w-4 ${iconColor}`} />
                        ) : (
                            <XCircle className={`h-4 w-4 ${iconColor}`} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${textColor}`}>Row {rowIndex}</span>
                            {record.record_type && (
                                <Badge variant="outline" className={`text-xs border-slate-700 ${reasonColor}`}>{record.record_type}</Badge>
                            )}
                        </div>
                        <p className={`text-xs mt-1 truncate ${reasonColor}`}>
                            {reason}
                        </p>
                        {/* New: Display Client Name or Asset Description in the header summary if available */}
                        {(clientName || assetDesc) && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {clientName && <span className="text-[10px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">Client: {clientName}</span>}
                                {assetDesc && <span className="text-[10px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">Asset: {assetDesc}</span>}
                            </div>
                        )}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-3 pt-2 px-1">
                    <div>
                        <h4 className={`text-xs font-semibold mb-2 uppercase tracking-wider ${contentTitleColor}`}>
                            {isSkipped ? 'Skip Reason' : 'Error Message'}
                        </h4>
                        <div className={`p-3 rounded border ${contentBg} space-y-2`}>
                            <p className="text-sm font-medium">{reason}</p>
                            {(clientName || assetDesc) && (
                                <div className="text-xs space-y-1 pt-2 border-t border-amber-900/30">
                                    {clientName && <div className="flex gap-2"><span className="text-amber-500/70 w-20">Client:</span> <span className="text-amber-100">{clientName}</span></div>}
                                    {assetDesc && <div className="flex gap-2"><span className="text-amber-500/70 w-20">Asset:</span> <span className="text-amber-100">{assetDesc}</span></div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider text-slate-400">Record Data</h4>
                        <div className={`p-3 rounded border ${jsonBg} ${jsonBorder} max-h-96 overflow-auto`}>
                            <pre className={`text-xs font-mono whitespace-pre-wrap break-all ${jsonText}`}>
                                {JSON.stringify(record.row_data, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};

const MissingAssetCard = ({
    asset,
    index,
    jobId,
    onResolve
}: {
    asset: any;
    index: number;
    jobId: number;
    onResolve: (asset: any) => void
}) => {
    const [isDone, setIsDone] = useState(asset.done || false);
    const apiBaseUrl = getApiBaseUrl();

    // Sync isDone with prop when data refreshes
    useEffect(() => {
        setIsDone(asset.done || false);
    }, [asset.done]);

    // If already done, show completed state
    if (isDone) {
        return (
            <Card className="bg-gray-800 border-green-700">
                <CardContent className="pt-4 pb-3">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-green-400">{asset.symbol || 'Unknown Symbol'}</p>
                            <p className="text-xs text-gray-300 mt-1">{asset.description || 'No description'}</p>
                        </div>
                        <Badge className="bg-green-600 text-white border-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Completed
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-4 pb-3">
                <div className="space-y-2">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="font-semibold text-amber-400">{asset.symbol || 'Unknown Symbol'}</p>
                            <p className="text-xs text-gray-300 mt-1">{asset.description || 'No description'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className="bg-gray-900 text-amber-400 border-amber-500 text-xs">{asset.currency || 'USD'}</Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-gray-900 text-amber-400 hover:bg-gray-700 border-gray-600"
                                onClick={() => onResolve(asset)}
                            >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Resolve
                            </Button>
                        </div>
                    </div>

                    {(asset.isin || asset.security_id) && (
                        <div className="text-xs text-gray-400 space-y-1">
                            {asset.isin && <p>ISIN: {asset.isin}</p>}
                            {asset.security_id && <p>Security ID: {asset.security_id}</p>}
                        </div>
                    )}

                    <p className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                        {asset.reason}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Account Resolution Components ---

interface CreateInvestorFormProps {
    initialName: string;
    accountCode: string;
    onSuccess: () => void;
    onCancel: () => void;
}

function CreateInvestorForm({ initialName, accountCode, onSuccess, onCancel }: CreateInvestorFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Auto-generate user data from parsed name with unique suffix
    const nameParts = initialName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Generate unique suffix (random 4-digit number)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const baseUsername = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    const uniqueUsername = `${baseUsername}${randomSuffix}`;

    const [formData, setFormData] = useState({
        full_name: initialName,
        email: `${uniqueUsername}@example.com`,
        username: uniqueUsername,
        phone: `+519${randomSuffix}${randomSuffix}`,
        tax_id: `TAX-${uniqueUsername.toUpperCase()}`,
        password: 'Investor2024!', // Default password
    });

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const apiBaseUrl = getApiBaseUrl();

            // 1. Get INVESTOR role ID
            const rolesRes = await fetch(`${apiBaseUrl}/api/v1/roles/`);
            const roles = await rolesRes.json();
            const investorRole = roles.find((r: any) => r.name === 'INVESTOR');

            if (!investorRole) throw new Error('Investor role not found');

            // 2. Create User
            const userRes = await fetch(`${apiBaseUrl}/api/v1/users/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    role_id: investorRole.role_id,
                    is_active: true
                }),
            });

            if (!userRes.ok) {
                const error = await userRes.json();
                throw new Error(error.detail || 'Failed to create user');
            }

            const newUser = await userRes.json();

            // 3. Create Account linked to User
            const accRes = await fetch(`${apiBaseUrl}/api/v1/persh-accounts/create-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_code: accountCode,
                    user_id: newUser.user_id
                }),
            });

            if (!accRes.ok) {
                const error = await accRes.json();
                throw new Error(error.detail || 'Failed to link account');
            }

            toast({
                title: 'Success',
                description: `Created investor and linked account ${accountCode}`,
            });
            await onSuccess(); // Wait for markAsDone to complete

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create investor',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg space-y-4">
            <h4 className="font-semibold text-sm text-white">Create New Investor</h4>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Full Name</Label>
                    <Input
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        className="h-8 text-sm bg-gray-900 text-white border-gray-600 focus:border-blue-500"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Email</Label>
                    <Input
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="h-8 text-sm bg-gray-900 text-white border-gray-600 focus:border-blue-500"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Username</Label>
                    <Input
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        className="h-8 text-sm bg-gray-900 text-white border-gray-600 focus:border-blue-500"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Initial Password</Label>
                    <Input
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="h-8 text-sm bg-gray-900 text-white border-gray-600 focus:border-blue-500"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={onCancel} disabled={loading} className="border-gray-600 text-gray-300 hover:bg-gray-700">Cancel</Button>
                <Button size="sm" onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    Create & Link
                </Button>
            </div>
        </div>
    );
}

const MissingAccountCard = ({
    account,
    csvFilename,
    jobId,
    onResolved
}: {
    account: any;
    csvFilename?: string;
    jobId: number;
    onResolved: () => void;
}) => {
    const [isResolving, setIsResolving] = useState(false);
    // Initialize parsedName from account prop if available (backend provided)
    const [parsedName, setParsedName] = useState<string | null>(account.parsed_name || null);
    const [loadingName, setLoadingName] = useState(false);
    // Changed: Store multiple candidates instead of single matchedUser
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isDone, setIsDone] = useState(account.done || false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [linkingUserId, setLinkingUserId] = useState<number | null>(null);
    const apiBaseUrl = getApiBaseUrl();
    const { toast } = useToast();

    // Sync isDone with prop when data refreshes
    useEffect(() => {
        setIsDone(account.done || false);
    }, [account.done]);

    // Sync parsedName if prop updates
    useEffect(() => {
        if (account.parsed_name) {
            setParsedName(account.parsed_name);
        }
    }, [account.parsed_name]);


    // Mark the account as done in the backend
    const markAsDone = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/api/v1/etl/jobs/${jobId}/mark-done`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_type: 'account',
                    item_key: account.account_code
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `Failed to mark as done: ${res.status}`);
            }

            setIsDone(true);
        } catch (e) {
            console.error('Failed to mark as done:', e);
            toast({
                variant: 'destructive',
                title: 'Mark as Done Failed',
                description: e instanceof Error ? e.message : 'Could not mark account as resolved',
            });
            throw e; // Re-throw to prevent onResolved from being called
        }
    };

    const handleLinkExistingUser = async (userId: number) => {
        setLinkingUserId(userId);
        try {
            const res = await fetch(`${apiBaseUrl}/api/v1/persh-accounts/create-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_code: account.account_code,
                    user_id: userId
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Failed to link account');
            }

            toast({
                title: 'Success',
                description: `Linked account ${account.account_code} to user`,
            });

            // Mark as done and notify parent - ensure markAsDone completes first
            await markAsDone();
            onResolved();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to link account',
            });
        } finally {
            setLinkingUserId(null);
        }
    };

    const startResolution = async () => {
        setIsResolving(true);
        setLoadingName(true);
        setCandidates([]);
        setShowCreateForm(false);

        try {
            // Get name to match (from backend or CSV extraction)
            let nameToMatch = parsedName;

            // If no parsed name from backend, try CSV extraction (legacy flow)
            if (!nameToMatch && csvFilename) {
                const res = await fetch(`${apiBaseUrl}/api/v1/persh-accounts/extract-names`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csv_filename: csvFilename }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const match = data.names?.find((n: any) => n.account_code === account.account_code);
                    if (match?.parsed_name) {
                        nameToMatch = match.parsed_name;
                        setParsedName(match.parsed_name);
                    }
                }
            }

            // Call match-users endpoint (now returns multiple candidates)
            if (nameToMatch) {
                const matchRes = await fetch(`${apiBaseUrl}/api/v1/persh-accounts/match-users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        missing_accounts: [{
                            account_code: account.account_code,
                            parsed_name: nameToMatch
                        }]
                    }),
                });

                if (matchRes.ok) {
                    const matchData = await matchRes.json();
                    const result = matchData.results?.[0];
                    if (result?.candidates && result.candidates.length > 0) {
                        setCandidates(result.candidates);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch matches", e);
        } finally {
            setLoadingName(false);
        }
    };

    // Handle successful investor creation from the form
    const handleFormSuccess = async () => {
        await markAsDone();
        onResolved();
    };

    // If already done, show completed state
    if (isDone) {
        return (
            <Card className="bg-gray-800 border-green-700 overflow-hidden">
                <CardContent className="pt-4 pb-3">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-green-400">{account.account_code}</p>
                            <p className="text-xs text-gray-400">{account.reason}</p>
                        </div>
                        <Badge className="bg-green-600 text-white border-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Completed
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gray-800 border-gray-700 overflow-hidden">
            <CardContent className="pt-4 pb-3">
                <div className="space-y-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold text-blue-400">{account.account_code}</p>
                            <p className="text-xs text-gray-400">{account.reason}</p>
                            {parsedName && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Parsed name: <span className="text-gray-300">{parsedName}</span>
                                </p>
                            )}
                        </div>
                        {!isResolving && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-gray-900 text-blue-400 hover:bg-gray-700 border-gray-600"
                                onClick={startResolution}
                            >
                                <UserPlus className="h-3 w-3 mr-1" />
                                Resolve
                            </Button>
                        )}
                    </div>

                    {isResolving && (
                        <div className="mt-4 pt-4 border-t border-gray-700 animate-in slide-in-from-top-2 fade-in">
                            {loadingName ? (
                                <div className="flex items-center gap-2 text-xs text-gray-300 py-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Searching for matching users...
                                </div>
                            ) : showCreateForm ? (
                                <CreateInvestorForm
                                    initialName={parsedName || account.account_code}
                                    accountCode={account.account_code}
                                    onSuccess={handleFormSuccess}
                                    onCancel={() => setShowCreateForm(false)}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {/* Show candidates if any */}
                                    {candidates.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-300 font-medium">
                                                Potential Matches Found ({candidates.length}):
                                            </p>
                                            {candidates.map((candidate, idx) => (
                                                <div
                                                    key={candidate.user_id}
                                                    className="bg-blue-900/20 p-3 rounded border border-blue-800 flex justify-between items-center"
                                                >
                                                    <div className="space-y-1">
                                                        <p className="text-sm text-blue-300 font-medium">
                                                            {candidate.full_name}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {candidate.email}
                                                        </p>
                                                        <Badge
                                                            className={`text-xs ${candidate.confidence >= 90
                                                                ? 'bg-green-900 text-green-200'
                                                                : candidate.confidence >= 80
                                                                    ? 'bg-blue-900 text-blue-200'
                                                                    : 'bg-amber-900 text-amber-200'
                                                                }`}
                                                        >
                                                            {candidate.confidence}% match
                                                        </Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleLinkExistingUser(candidate.user_id)}
                                                        disabled={linkingUserId !== null}
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                    >
                                                        {linkingUserId === candidate.user_id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>Link</>
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* No matches message */}
                                    {candidates.length === 0 && (
                                        <div className="bg-amber-900/20 p-3 rounded border border-amber-800">
                                            <p className="text-sm text-amber-300">
                                                No matching users found above threshold.
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                You can create a new investor below.
                                            </p>
                                        </div>
                                    )}

                                    {/* Separator and Create New option */}
                                    <div className="flex items-center gap-3 my-3">
                                        <Separator className="flex-1 bg-gray-700" />
                                        <span className="text-xs text-gray-500">OR</span>
                                        <Separator className="flex-1 bg-gray-700" />
                                    </div>

                                    <div className="flex justify-between">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsResolving(false)}
                                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowCreateForm(true)}
                                            className="border-blue-600 text-blue-400 hover:bg-blue-900/30"
                                        >
                                            <UserPlus className="h-3 w-3 mr-1" />
                                            Create New Investor
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

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

    // Asset Creation State
    const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
    const [newAssetDraft, setNewAssetDraft] = useState<AssetFormState>(defaultAssetFormState);
    const [assetActionError, setAssetActionError] = useState<string | null>(null);
    const [assetActionLoading, setAssetActionLoading] = useState(false);
    const [currentResolvingAsset, setCurrentResolvingAsset] = useState<any | null>(null);

    // Catalogs State
    const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [countries, setCountries] = useState<Array<{ value: string; label: string }>>([]);
    const [industries, setIndustries] = useState<Array<{ value: string; label: string; secondary?: string }>>([]);
    const [currencyOptions, setCurrencyOptions] = useState<Array<{ value: string; label: string }>>([]);

    // Load Catalogs
    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                setIsLoadingClasses(true);

                // Load Asset Classes
                const classes = await catalogsApi.getAssetClasses();
                setAssetClasses(classes);
                if (classes.length > 0) {
                    setNewAssetDraft((prev) => ({ ...prev, class_id: String(classes[0].class_id) }));
                }

                // Load other catalogs
                const [countriesRes, industriesRes, currenciesRes] = await Promise.all([
                    fetch(`${apiBaseUrl}/api/v1/catalogs/countries`),
                    fetch(`${apiBaseUrl}/api/v1/catalogs/industries`),
                    fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`),
                ]);

                if (countriesRes.ok) {
                    const data = await countriesRes.json();
                    setCountries(data.map((c: any) => ({ value: c.iso_code, label: `${c.name} (${c.iso_code})` })));
                }

                if (industriesRes.ok) {
                    const data = await industriesRes.json();
                    setIndustries(data.map((i: any) => ({ value: i.industry_code, label: i.name, secondary: i.industry_code })));
                }

                if (currenciesRes.ok) {
                    const data = await currenciesRes.json();
                    setCurrencyOptions(data.map((c: any) => ({ value: c.code, label: `${c.code} - ${c.name}` })));
                }

            } catch (error) {
                console.error('Error loading catalogs:', error);
            } finally {
                setIsLoadingClasses(false);
            }
        };
        loadCatalogs();
    }, [apiBaseUrl]);

    // Fetch Job Details on mount
    useEffect(() => {
        if (jobId) {
            fetchJobDetails();
        }
    }, [jobId]);

    const normalizeNumber = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? null : parsed;
    };

    const handleCreateAsset = async () => {
        if (!newAssetDraft.symbol.trim() || !newAssetDraft.class_id) {
            setAssetActionError('Symbol and Asset Class are required.');
            return;
        }
        try {
            setAssetActionLoading(true);
            setAssetActionError(null);

            const payload = {
                symbol: newAssetDraft.symbol.trim(),
                name: newAssetDraft.name.trim() || null,
                description: newAssetDraft.description.trim() || null,
                isin: newAssetDraft.isin.trim() || null,
                figi: newAssetDraft.figi.trim() || null,
                cusip: newAssetDraft.cusip.trim() || null,
                class_id: Number(newAssetDraft.class_id),
                sub_class_id: newAssetDraft.sub_class_id ? Number(newAssetDraft.sub_class_id) : null,
                industry_code: newAssetDraft.industry_code.trim() ? newAssetDraft.industry_code.trim().toUpperCase() : null,
                country_code: newAssetDraft.country_code.trim() ? newAssetDraft.country_code.trim().toUpperCase() : null,
                currency: newAssetDraft.currency.trim() ? newAssetDraft.currency.trim().toUpperCase() : null,
                multiplier: normalizeNumber(newAssetDraft.multiplier),
                contract_size: normalizeNumber(newAssetDraft.contract_size),
                underlying_symbol: newAssetDraft.underlying_symbol.trim() || null,
                strike_price: normalizeNumber(newAssetDraft.strike_price),
                expiry_date: newAssetDraft.expiry_date || null,
                put_call: newAssetDraft.put_call.trim() && newAssetDraft.put_call.trim() !== '-' ? newAssetDraft.put_call.trim() : null,
                maturity_date: newAssetDraft.maturity_date || null,
                coupon_rate: normalizeNumber(newAssetDraft.coupon_rate),
                issuer: newAssetDraft.issuer.trim() || null,
                initial_fixing_date: newAssetDraft.initial_fixing_date || null,
                next_autocall_date: newAssetDraft.next_autocall_date || null,
                next_coupon_payment_date: newAssetDraft.next_coupon_payment_date || null,
                autocall_trigger: normalizeNumber(newAssetDraft.autocall_trigger),
                coupon_trigger: normalizeNumber(newAssetDraft.coupon_trigger),
                capital_barrier: normalizeNumber(newAssetDraft.capital_barrier),
                protection_level: normalizeNumber(newAssetDraft.protection_level),
                payment_frequency: newAssetDraft.payment_frequency.trim() || null,
            };

            const response = await fetch(`${apiBaseUrl}/api/v1/assets/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            toast({
                title: 'Asset created',
                description: `Asset "${newAssetDraft.symbol.trim()}" has been created successfully.`,
                className: 'bg-green-600 text-white border-green-700',
            });

            // Mark asset as done in job
            if (currentResolvingAsset && data?.job_id) {
                const itemKey = currentResolvingAsset.isin || currentResolvingAsset.symbol;
                try {
                    await fetch(`${apiBaseUrl}/api/v1/etl/jobs/${data.job_id}/mark-done`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            item_type: 'asset',
                            item_key: itemKey
                        }),
                    });
                } catch (e) {
                    console.error('Failed to mark asset as done:', e);
                }
            }

            setIsNewAssetOpen(false);
            setCurrentResolvingAsset(null);
            fetchJobDetails(); // Refresh to show as completed

        } catch (error: any) {
            setAssetActionError(error.message || 'Could not create the asset.');
        } finally {
            setAssetActionLoading(false);
        }
    };

    const openAssetResolution = (asset: any) => {
        setCurrentResolvingAsset(asset);  // Save reference for mark-done
        setNewAssetDraft({
            ...defaultAssetFormState,
            symbol: asset.symbol || '',
            description: asset.description || '',
            isin: asset.isin || asset.security_id || '',
            currency: asset.currency || 'USD',
            // Default to Equity if unknown, or try to guess? For now default is fine.
            class_id: assetClasses.length > 0 ? String(assetClasses[0].class_id) : '',
        });
        setIsNewAssetOpen(true);
    };

    const fetchJobDetails = async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/etl/jobs/${jobId}/records`);

            if (!response.ok) {
                throw new Error('Failed to fetch job details');
            }

            const jobData = await response.json();
            console.log('Job data received:', jobData);
            setData(jobData);

            // Auto-switch tab if there are missing accounts
            if (jobData.missing_accounts?.length > 0) {
                setActiveTab('missing-accounts');
            } else if (jobData.missing_assets?.length > 0) {
                setActiveTab('missing-assets');
            }

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

    const handleResolveSuccess = () => {
        // Refresh data to remove resolved item
        fetchJobDetails();
    }

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
                            <Button onClick={() => navigate('/pershing')}>
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
            subtitle="Detailed record information and error resolution"
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (data.job_type && data.job_type.includes('PERSHING')) {
                                navigate('/etl/pershing');
                            } else {
                                navigate('/etl/ibkr');
                            }
                        }}
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
                                    <div className="space-y-3">
                                        {data.missing_assets.map((asset, index) => (
                                            <MissingAssetCard
                                                key={index}
                                                asset={asset}
                                                index={index}
                                                jobId={data.job_id}
                                                onResolve={openAssetResolution}
                                            />
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
                                        {data.records_processed > 0 && !data.missing_accounts ? (
                                            <div className="flex flex-col items-center">
                                                <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                                                <span className="text-green-700 font-medium">All accounts resolved</span>
                                            </div>
                                        ) : 'No missing accounts'}
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {data.missing_accounts.map((account, index) => (
                                            <MissingAccountCard
                                                key={index}
                                                account={account}
                                                csvFilename={data.filename}
                                                jobId={data.job_id}
                                                onResolved={handleResolveSuccess}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Asset Creation Dialog */}
            <Dialog
                open={isNewAssetOpen}
                onOpenChange={(open) => {
                    setIsNewAssetOpen(open);
                    setAssetActionError(null);
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Register New Asset</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2">
                        <div className="space-y-5 mt-4">
                            {assetActionError && (
                                <Alert variant="destructive" className="border-red-900 bg-red-900/20 text-red-200">
                                    <AlertDescription>
                                        {assetActionError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <AssetFormFields
                                formState={newAssetDraft}
                                setFormState={setNewAssetDraft}
                                assetClasses={assetClasses}
                                isLoadingClasses={isLoadingClasses}
                                currencyOptions={currencyOptions}
                                countryOptions={countries}
                                industryOptions={industries}
                                idPrefix="new-asset"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 mt-auto border-t border-gray-800">
                        <Button variant="outline" onClick={() => setIsNewAssetOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleCreateAsset}
                            disabled={assetActionLoading}
                        >
                            {assetActionLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : 'Create Asset'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
};

export default ETLJobDetails;
