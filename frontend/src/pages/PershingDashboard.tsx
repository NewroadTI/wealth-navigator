import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PershingDashboard = () => {
    const { toast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);

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
            if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx')) {
                setFile(droppedFile);
                toast({
                    title: "File selected",
                    description: `Ready to upload: ${droppedFile.name}`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Invalid file type",
                    description: "Please upload a .csv or .xlsx file",
                });
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (!file) return;

        // Placeholder for actual upload logic
        toast({
            title: "Upload initiated",
            description: `Processing ${file.name}... (Not implemented yet)`,
        });

        // Reset after simulation
        setTimeout(() => {
            setFile(null);
            toast({
                title: "Process Complete",
                description: "File processed successfully (Simulated)",
            });
        }, 2000);
    };

    return (
        <AppLayout title="Pershing ETL Dashboard" subtitle="Upload and process Pershing data files">
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
                                    Upload Pershing data files (CSV, XLSX) to update the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                        }`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <div className="p-4 bg-muted rounded-full">
                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium">
                                                {file ? file.name : "Drag and drop your file here"}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {file ? (
                                                    <span className="text-green-600 flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Ready to process
                                                    </span>
                                                ) : (
                                                    "Or click to browse from your computer"
                                                )}
                                            </p>
                                        </div>

                                        {!file && (
                                            <div className="relative">
                                                <Button variant="outline">Browse Files</Button>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept=".csv, .xlsx"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                        )}

                                        {file && (
                                            <div className="flex gap-2 mt-2">
                                                <Button variant="outline" onClick={() => setFile(null)}>Cancel</Button>
                                                <Button onClick={handleUpload}>Process File</Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-md flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium">Supported Formats</p>
                                        <p className="mt-1 opacity-90">
                                            Currently supporting Pershing standard export files (.csv) and Excel reports (.xlsx).
                                            Ensure headers match the standard template.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Uploads / Status Sidebar (Placeholder) */}
                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Imports</CardTitle>
                                <CardDescription>History of uploaded files</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground text-center py-8">
                                    No recent imports found.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default PershingDashboard;
