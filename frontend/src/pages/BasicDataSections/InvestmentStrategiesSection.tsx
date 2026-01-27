import type React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { InvestmentStrategyApi, SortConfig } from './types';
import { SortableHeader } from './utils.tsx';

type StrategyDraft = { name: string; description: string };

type Props = {
    strategiesLoading: boolean;
    strategiesError: string | null;
    filteredStrategies: InvestmentStrategyApi[];
    strategySort: SortConfig;
    onSort: (key: string) => void;
    strategyDraft: StrategyDraft;
    setStrategyDraft: React.Dispatch<React.SetStateAction<StrategyDraft>>;
    isCreateStrategyOpen: boolean;
    setIsCreateStrategyOpen: (open: boolean) => void;
    isEditStrategyOpen: boolean;
    setIsEditStrategyOpen: (open: boolean) => void;
    strategyActionError: string | null;
    strategyActionLoading: boolean;
    setStrategyActionError: (value: string | null) => void;
    handleCreateStrategy: () => void;
    handleUpdateStrategy: () => void;
    handleEditStrategy: (strategy: InvestmentStrategyApi) => void;
    strategyToDelete: InvestmentStrategyApi | null;
    setStrategyToDelete: React.Dispatch<React.SetStateAction<InvestmentStrategyApi | null>>;
    handleDeleteStrategy: (strategyId: number) => void;
};

const InvestmentStrategiesSection = ({
    strategiesLoading,
    strategiesError,
    filteredStrategies,
    strategySort,
    onSort,
    strategyDraft,
    setStrategyDraft,
    isCreateStrategyOpen,
    setIsCreateStrategyOpen,
    isEditStrategyOpen,
    setIsEditStrategyOpen,
    strategyActionError,
    strategyActionLoading,
    setStrategyActionError,
    handleCreateStrategy,
    handleUpdateStrategy,
    handleEditStrategy,
    strategyToDelete,
    setStrategyToDelete,
    handleDeleteStrategy,
}: Props) => (
    <TabsContent value="strategies">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="font-semibold text-foreground text-sm md:text-base">Investment Strategies</h3>
                <Dialog
                    open={isCreateStrategyOpen}
                    onOpenChange={(open) => {
                        setIsCreateStrategyOpen(open);
                        setStrategyActionError(null);
                        if (open) {
                            setStrategyDraft({ name: '', description: '' });
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
                            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                            Add Strategy
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Strategy</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            {strategyActionError && (
                                <Alert variant="destructive" className="border-red-200 bg-red-50">
                                    <AlertDescription className="text-sm text-red-800">
                                        {strategyActionError}
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div>
                                <Label>Name</Label>
                                <Input
                                    placeholder="Growth"
                                    className="mt-1"
                                    value={strategyDraft.name}
                                    onChange={(e) => setStrategyDraft({ ...strategyDraft, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    placeholder="Strategy description..."
                                    className="mt-1"
                                    value={strategyDraft.description}
                                    onChange={(e) => setStrategyDraft({ ...strategyDraft, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setIsCreateStrategyOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-primary text-primary-foreground"
                                    onClick={handleCreateStrategy}
                                    disabled={strategyActionLoading}
                                >
                                    {strategyActionLoading ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                <Dialog open={isEditStrategyOpen} onOpenChange={setIsEditStrategyOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Strategy</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            {strategyActionError && (
                                <Alert variant="destructive" className="border-red-200 bg-red-50">
                                    <AlertDescription className="text-sm text-red-800">
                                        {strategyActionError}
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div>
                                <Label>Name</Label>
                                <Input
                                    className="mt-1"
                                    value={strategyDraft.name}
                                    onChange={(e) => setStrategyDraft({ ...strategyDraft, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    className="mt-1"
                                    value={strategyDraft.description}
                                    onChange={(e) => setStrategyDraft({ ...strategyDraft, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setIsEditStrategyOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-primary text-primary-foreground"
                                    onClick={handleUpdateStrategy}
                                    disabled={strategyActionLoading}
                                >
                                    {strategyActionLoading ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <SortableHeader label="Name" sortKey="name" currentSort={strategySort} onSort={onSort} />
                            <th className="text-xs md:text-sm hidden sm:table-cell">Description</th>
                            <th className="text-xs md:text-sm">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {strategiesLoading && (
                            <tr>
                                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                                    Loading strategies...
                                </td>
                            </tr>
                        )}
                        {!strategiesLoading && strategiesError && (
                            <tr>
                                <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                                    {strategiesError}
                                </td>
                            </tr>
                        )}
                        {!strategiesLoading && !strategiesError && filteredStrategies.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                                    No strategies to display.
                                </td>
                            </tr>
                        )}
                        {!strategiesLoading && !strategiesError && filteredStrategies.map((strategy) => (
                            <tr key={strategy.strategy_id}>
                                <td className="font-medium text-foreground text-xs md:text-sm">{strategy.name}</td>
                                <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell max-w-xs truncate">
                                    {strategy.description ?? '—'}
                                </td>
                                <td>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 md:h-8 md:w-8"
                                            onClick={() => handleEditStrategy(strategy)}
                                        >
                                            <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                                            onClick={() => setStrategyToDelete(strategy)}
                                            disabled={strategyActionLoading}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <AlertDialog open={!!strategyToDelete} onOpenChange={(open) => !open && setStrategyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete strategy</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete strategy "{strategyToDelete?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (strategyToDelete) {
                                    handleDeleteStrategy(strategyToDelete.strategy_id);
                                }
                                setStrategyToDelete(null);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    </TabsContent>
);

export default InvestmentStrategiesSection;
