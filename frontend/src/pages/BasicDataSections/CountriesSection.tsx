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
import type { CountryApi, SortConfig } from '../BasicData';

type CountryDraft = { iso_code: string; name: string };

type Props = {
  countriesLoading: boolean;
  countriesError: string | null;
  filteredCountries: CountryApi[];
  countrySort: SortConfig;
  onSort: (key: string) => void;
  countryDraft: CountryDraft;
  setCountryDraft: React.Dispatch<React.SetStateAction<CountryDraft>>;
  isCreateCountryOpen: boolean;
  setIsCreateCountryOpen: (open: boolean) => void;
  isEditCountryOpen: boolean;
  setIsEditCountryOpen: (open: boolean) => void;
  countryActionError: string | null;
  countryActionLoading: boolean;
  setCountryActionError: (value: string | null) => void;
  handleCreateCountry: () => void;
  handleUpdateCountry: () => void;
  handleEditCountry: (country: CountryApi) => void;
  countryToDelete: CountryApi | null;
  setCountryToDelete: React.Dispatch<React.SetStateAction<CountryApi | null>>;
  handleDeleteCountry: (isoCode: string) => void;
  SortableHeader: React.FC<{ label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }>;
};

const CountriesSection = ({
  countriesLoading,
  countriesError,
  filteredCountries,
  countrySort,
  onSort,
  countryDraft,
  setCountryDraft,
  isCreateCountryOpen,
  setIsCreateCountryOpen,
  isEditCountryOpen,
  setIsEditCountryOpen,
  countryActionError,
  countryActionLoading,
  setCountryActionError,
  handleCreateCountry,
  handleUpdateCountry,
  handleEditCountry,
  countryToDelete,
  setCountryToDelete,
  handleDeleteCountry,
  SortableHeader,
}: Props) => (
  <TabsContent value="countries">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Countries</h3>
        <Dialog
          open={isCreateCountryOpen}
          onOpenChange={(open) => {
            setIsCreateCountryOpen(open);
            setCountryActionError(null);
            if (open) {
              setCountryDraft({ iso_code: '', name: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Country
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Country</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {countryActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {countryActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="country-iso">ISO Code *</Label>
                <Input
                  id="country-iso"
                  placeholder="US"
                  className="mt-1"
                  maxLength={2}
                  value={countryDraft.iso_code}
                  onChange={(e) => setCountryDraft({ ...countryDraft, iso_code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="country-name">Name *</Label>
                <Input
                  id="country-name"
                  placeholder="United States"
                  className="mt-1"
                  value={countryDraft.name}
                  onChange={(e) => setCountryDraft({ ...countryDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateCountryOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateCountry}
                  disabled={countryActionLoading}
                >
                  {countryActionLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditCountryOpen} onOpenChange={setIsEditCountryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Country</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {countryActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {countryActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="edit-country-iso">ISO Code</Label>
                <Input
                  id="edit-country-iso"
                  className="mt-1"
                  value={countryDraft.iso_code}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="edit-country-name">Name *</Label>
                <Input
                  id="edit-country-name"
                  className="mt-1"
                  value={countryDraft.name}
                  onChange={(e) => setCountryDraft({ ...countryDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditCountryOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateCountry}
                  disabled={countryActionLoading}
                >
                  {countryActionLoading ? 'Saving...' : 'Save'}
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
              <SortableHeader label="Code" sortKey="iso_code" currentSort={countrySort} onSort={onSort} />
              <SortableHeader label="Name" sortKey="name" currentSort={countrySort} onSort={onSort} />
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {countriesLoading && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading countries...
                </td>
              </tr>
            )}
            {!countriesLoading && countriesError && (
              <tr>
                <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                  {countriesError}
                </td>
              </tr>
            )}
            {!countriesLoading && !countriesError && filteredCountries.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No countries to display.
                </td>
              </tr>
            )}
            {!countriesLoading && !countriesError && filteredCountries.map((country) => (
              <tr key={country.iso_code}>
                <td className="font-medium text-foreground text-xs md:text-sm">{country.iso_code}</td>
                <td className="text-foreground text-xs md:text-sm">{country.name ?? '—'}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                      onClick={() => handleEditCountry(country)}
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                      onClick={() => setCountryToDelete(country)}
                      disabled={countryActionLoading}
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
      <AlertDialog open={!!countryToDelete} onOpenChange={(open) => !open && setCountryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete country</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete country "{countryToDelete?.name ?? countryToDelete?.iso_code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (countryToDelete) {
                  handleDeleteCountry(countryToDelete.iso_code);
                }
                setCountryToDelete(null);
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

export default CountriesSection;
