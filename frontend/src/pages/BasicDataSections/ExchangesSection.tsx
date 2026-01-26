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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit2, Trash2, ArrowUpDown, Check, ChevronsUpDown } from 'lucide-react';
import type { CountryApi, ExchangeApi, SortConfig } from '../BasicData';

type ExchangeDraft = { exchange_code: string; name: string; country_code: string };

type Props = {
  exchangesLoading: boolean;
  exchangesError: string | null;
  filteredExchanges: ExchangeApi[];
  exchangeSort: SortConfig;
  onSort: (key: string) => void;
  countries: CountryApi[];
  countryNameByIso: Map<string, string>;
  exchangeDraft: ExchangeDraft;
  setExchangeDraft: React.Dispatch<React.SetStateAction<ExchangeDraft>>;
  isCreateExchangeOpen: boolean;
  setIsCreateExchangeOpen: (open: boolean) => void;
  isEditExchangeOpen: boolean;
  setIsEditExchangeOpen: (open: boolean) => void;
  exchangeActionError: string | null;
  exchangeActionLoading: boolean;
  setExchangeActionError: (value: string | null) => void;
  handleCreateExchange: () => void;
  handleUpdateExchange: () => void;
  handleEditExchange: (exchange: ExchangeApi) => void;
  exchangeToDelete: ExchangeApi | null;
  setExchangeToDelete: React.Dispatch<React.SetStateAction<ExchangeApi | null>>;
  handleDeleteExchange: (exchangeCode: string) => void;
  exchangeCountryOpen: boolean;
  setExchangeCountryOpen: (open: boolean) => void;
  exchangeEditCountryOpen: boolean;
  setExchangeEditCountryOpen: (open: boolean) => void;
  SortableHeader: React.FC<{ label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }>;
};

const ExchangesSection = ({
  exchangesLoading,
  exchangesError,
  filteredExchanges,
  exchangeSort,
  onSort,
  countries,
  countryNameByIso,
  exchangeDraft,
  setExchangeDraft,
  isCreateExchangeOpen,
  setIsCreateExchangeOpen,
  isEditExchangeOpen,
  setIsEditExchangeOpen,
  exchangeActionError,
  exchangeActionLoading,
  setExchangeActionError,
  handleCreateExchange,
  handleUpdateExchange,
  handleEditExchange,
  exchangeToDelete,
  setExchangeToDelete,
  handleDeleteExchange,
  exchangeCountryOpen,
  setExchangeCountryOpen,
  exchangeEditCountryOpen,
  setExchangeEditCountryOpen,
  SortableHeader,
}: Props) => (
  <TabsContent value="exchanges">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Stock Exchanges</h3>
        <Dialog
          open={isCreateExchangeOpen}
          onOpenChange={(open) => {
            setIsCreateExchangeOpen(open);
            setExchangeActionError(null);
            if (open) {
              setExchangeDraft({ exchange_code: '', name: '', country_code: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Exchange
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Stock Exchange</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {exchangeActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {exchangeActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exchange-code">Code *</Label>
                  <Input
                    id="exchange-code"
                    placeholder="NYSE"
                    className="mt-1"
                    value={exchangeDraft.exchange_code}
                    onChange={(e) => setExchangeDraft({ ...exchangeDraft, exchange_code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="exchange-country">Country</Label>
                  <div className="mt-1">
                    <Popover open={exchangeCountryOpen} onOpenChange={setExchangeCountryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          id="exchange-country"
                          className="w-full justify-between"
                        >
                          {exchangeDraft.country_code
                            ? (countryNameByIso.get(exchangeDraft.country_code) ?? exchangeDraft.country_code)
                            : 'Select country'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full p-0"
                        align="start"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <Command>
                          <CommandInput placeholder="Search country..." />
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandList className="max-h-60 overflow-auto">
                            <CommandGroup>
                              {countries.map((country) => (
                                <CommandItem
                                  key={country.iso_code}
                                  value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                  onSelect={() => {
                                    setExchangeDraft({
                                      ...exchangeDraft,
                                      country_code: country.iso_code,
                                    });
                                    setExchangeCountryOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${exchangeDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span>{country.name ?? country.iso_code}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="exchange-name">Name *</Label>
                <Input
                  id="exchange-name"
                  placeholder="New York Stock Exchange"
                  className="mt-1"
                  value={exchangeDraft.name}
                  onChange={(e) => setExchangeDraft({ ...exchangeDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateExchangeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateExchange}
                  disabled={exchangeActionLoading}
                >
                  {exchangeActionLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditExchangeOpen} onOpenChange={setIsEditExchangeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Stock Exchange</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {exchangeActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {exchangeActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-exchange-code">Code</Label>
                  <Input
                    id="edit-exchange-code"
                    className="mt-1"
                    value={exchangeDraft.exchange_code}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="edit-exchange-country">Country</Label>
                  <div className="mt-1">
                    <Popover open={exchangeEditCountryOpen} onOpenChange={setExchangeEditCountryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          id="edit-exchange-country"
                          className="w-full justify-between"
                        >
                          {exchangeDraft.country_code
                            ? (countryNameByIso.get(exchangeDraft.country_code) ?? exchangeDraft.country_code)
                            : 'Select country'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full p-0"
                        align="start"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <Command>
                          <CommandInput placeholder="Search country..." />
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandList className="max-h-60 overflow-auto">
                            <CommandGroup>
                              {countries.map((country) => (
                                <CommandItem
                                  key={country.iso_code}
                                  value={`${country.name ?? country.iso_code} ${country.iso_code}`}
                                  onSelect={() => {
                                    setExchangeDraft({
                                      ...exchangeDraft,
                                      country_code: country.iso_code,
                                    });
                                    setExchangeEditCountryOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${exchangeDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span>{country.name ?? country.iso_code}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">{country.iso_code}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-exchange-name">Name *</Label>
                <Input
                  id="edit-exchange-name"
                  className="mt-1"
                  value={exchangeDraft.name}
                  onChange={(e) => setExchangeDraft({ ...exchangeDraft, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditExchangeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateExchange}
                  disabled={exchangeActionLoading}
                >
                  {exchangeActionLoading ? 'Saving...' : 'Save'}
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
              <SortableHeader label="Code" sortKey="exchange_code" currentSort={exchangeSort} onSort={onSort} />
              <SortableHeader label="Name" sortKey="name" currentSort={exchangeSort} onSort={onSort} />
              <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => onSort('country_code')}>
                <div className="flex items-center gap-1">Country <ArrowUpDown className={`h-3 w-3 ${exchangeSort.key === 'country_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
              </th>
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exchangesLoading && (
              <tr>
                <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading exchanges...
                </td>
              </tr>
            )}
            {!exchangesLoading && exchangesError && (
              <tr>
                <td colSpan={4} className="text-destructive text-xs md:text-sm text-center py-6">
                  {exchangesError}
                </td>
              </tr>
            )}
            {!exchangesLoading && !exchangesError && filteredExchanges.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No exchanges to display.
                </td>
              </tr>
            )}
            {!exchangesLoading && !exchangesError && filteredExchanges.map((exchange) => (
              <tr key={exchange.exchange_code}>
                <td className="font-medium text-foreground text-xs md:text-sm">{exchange.exchange_code}</td>
                <td className="text-foreground text-xs md:text-sm">{exchange.name}</td>
                <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                  {exchange.country_code
                    ? (countryNameByIso.get(exchange.country_code) ?? exchange.country_code)
                    : '—'}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                      onClick={() => handleEditExchange(exchange)}
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                      onClick={() => setExchangeToDelete(exchange)}
                      disabled={exchangeActionLoading}
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
      <AlertDialog open={!!exchangeToDelete} onOpenChange={(open) => !open && setExchangeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exchange</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete exchange "{exchangeToDelete?.exchange_code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (exchangeToDelete) {
                  handleDeleteExchange(exchangeToDelete.exchange_code);
                }
                setExchangeToDelete(null);
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

export default ExchangesSection;
