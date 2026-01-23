import type React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { CurrencyApi, SortConfig } from '../BasicData';

type CurrencyDraft = { code: string; name: string };

type Props = {
  currenciesLoading: boolean;
  currenciesError: string | null;
  filteredCurrencies: CurrencyApi[];
  currencySort: SortConfig;
  onSort: (key: string) => void;
  currencyDraft: CurrencyDraft;
  setCurrencyDraft: React.Dispatch<React.SetStateAction<CurrencyDraft>>;
  isCreateCurrencyOpen: boolean;
  setIsCreateCurrencyOpen: (open: boolean) => void;
  isEditCurrencyOpen: boolean;
  onEditCurrencyOpenChange: (open: boolean) => void;
  currencyActionError: string | null;
  currencyActionLoading: boolean;
  setCurrencyActionError: (value: string | null) => void;
  handleCreateCurrency: () => void;
  handleUpdateCurrency: () => void;
  handleEditCurrency: (currency: CurrencyApi) => void;
  currencyToDelete: CurrencyApi | null;
  setCurrencyToDelete: React.Dispatch<React.SetStateAction<CurrencyApi | null>>;
  handleDeleteCurrency: (code: string) => void;
  SortableHeader: React.FC<{ label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }>;
};

const CurrenciesSection = ({
  currenciesLoading,
  currenciesError,
  filteredCurrencies,
  currencySort,
  onSort,
  currencyDraft,
  setCurrencyDraft,
  isCreateCurrencyOpen,
  setIsCreateCurrencyOpen,
  isEditCurrencyOpen,
  onEditCurrencyOpenChange,
  currencyActionError,
  currencyActionLoading,
  setCurrencyActionError,
  handleCreateCurrency,
  handleUpdateCurrency,
  handleEditCurrency,
  currencyToDelete,
  setCurrencyToDelete,
  handleDeleteCurrency,
  SortableHeader,
}: Props) => (
  <TabsContent value="currencies">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Currencies</h3>
        <Dialog
          open={isCreateCurrencyOpen}
          onOpenChange={(open) => {
            setIsCreateCurrencyOpen(open);
            setCurrencyActionError(null);
            if (open) {
              setCurrencyDraft({ code: '', name: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Currency
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Currency</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {currencyActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {currencyActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="currency-code">Code *</Label>
                <Input
                  id="currency-code"
                  placeholder="USD"
                  className="mt-1"
                  value={currencyDraft.code}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="currency-name">Name *</Label>
                <Input
                  id="currency-name"
                  placeholder="US Dollar"
                  className="mt-1"
                  value={currencyDraft.name}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateCurrencyOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateCurrency}
                  disabled={currencyActionLoading}
                >
                  {currencyActionLoading ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditCurrencyOpen}
          onOpenChange={(open) => {
            setCurrencyActionError(null);
            onEditCurrencyOpenChange(open);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Currency</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {currencyActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {currencyActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="edit-currency-code">Code</Label>
                <Input
                  id="edit-currency-code"
                  className="mt-1"
                  value={currencyDraft.code}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="edit-currency-name">Name *</Label>
                <Input
                  id="edit-currency-name"
                  className="mt-1"
                  value={currencyDraft.name}
                  onChange={(e) => setCurrencyDraft({ ...currencyDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => onEditCurrencyOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateCurrency}
                  disabled={currencyActionLoading}
                >
                  {currencyActionLoading ? 'Saving...' : 'Save'}
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
              <SortableHeader label="Code" sortKey="code" currentSort={currencySort} onSort={onSort} />
              <SortableHeader label="Name" sortKey="name" currentSort={currencySort} onSort={onSort} />
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currenciesLoading && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading...
                </td>
              </tr>
            )}
            {currenciesError && (
              <tr>
                <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                  {currenciesError}
                </td>
              </tr>
            )}
            {!currenciesLoading && !currenciesError && filteredCurrencies.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No currencies found.
                </td>
              </tr>
            )}
            {!currenciesLoading && !currenciesError && filteredCurrencies.map((currency) => (
              <tr key={currency.code}>
                <td className="font-medium text-foreground text-xs md:text-sm">{currency.code}</td>
                <td className="text-foreground text-xs md:text-sm">{currency.name}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                      onClick={() => handleEditCurrency(currency)}
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                      onClick={() => setCurrencyToDelete(currency)}
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
      <AlertDialog open={!!currencyToDelete} onOpenChange={(open) => !open && setCurrencyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete currency</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete currency "{currencyToDelete?.code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currencyToDelete) {
                  handleDeleteCurrency(currencyToDelete.code);
                }
                setCurrencyToDelete(null);
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

export default CurrenciesSection;
