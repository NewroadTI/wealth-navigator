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
import type { CountryApi, ExchangeApi, IndexApi, SortConfig } from '../BasicData';

type IndexDraft = { index_code: string; name: string; country_code: string; exchange_code: string };

type Props = {
  indicesLoading: boolean;
  indicesError: string | null;
  filteredIndices: IndexApi[];
  indexSort: SortConfig;
  onSort: (key: string) => void;
  exchanges: ExchangeApi[];
  countries: CountryApi[];
  countryNameByIso: Map<string, string>;
  exchangeNameByCode: Map<string, string>;
  indexDraft: IndexDraft;
  setIndexDraft: React.Dispatch<React.SetStateAction<IndexDraft>>;
  isCreateIndexOpen: boolean;
  setIsCreateIndexOpen: (open: boolean) => void;
  isEditIndexOpen: boolean;
  setIsEditIndexOpen: (open: boolean) => void;
  indexActionError: string | null;
  indexActionLoading: boolean;
  setIndexActionError: (value: string | null) => void;
  handleCreateIndex: () => void;
  handleUpdateIndex: () => void;
  handleEditIndex: (index: IndexApi) => void;
  indexToDelete: IndexApi | null;
  setIndexToDelete: React.Dispatch<React.SetStateAction<IndexApi | null>>;
  handleDeleteIndex: (indexCode: string) => void;
  indexCountryOpen: boolean;
  setIndexCountryOpen: (open: boolean) => void;
  indexExchangeOpen: boolean;
  setIndexExchangeOpen: (open: boolean) => void;
  indexEditCountryOpen: boolean;
  setIndexEditCountryOpen: (open: boolean) => void;
  indexEditExchangeOpen: boolean;
  setIndexEditExchangeOpen: (open: boolean) => void;
  SortableHeader: React.FC<{ label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }>;
};

const IndicesSection = ({
  indicesLoading,
  indicesError,
  filteredIndices,
  indexSort,
  onSort,
  exchanges,
  countries,
  countryNameByIso,
  exchangeNameByCode,
  indexDraft,
  setIndexDraft,
  isCreateIndexOpen,
  setIsCreateIndexOpen,
  isEditIndexOpen,
  setIsEditIndexOpen,
  indexActionError,
  indexActionLoading,
  setIndexActionError,
  handleCreateIndex,
  handleUpdateIndex,
  handleEditIndex,
  indexToDelete,
  setIndexToDelete,
  handleDeleteIndex,
  indexCountryOpen,
  setIndexCountryOpen,
  indexExchangeOpen,
  setIndexExchangeOpen,
  indexEditCountryOpen,
  setIndexEditCountryOpen,
  indexEditExchangeOpen,
  setIndexEditExchangeOpen,
  SortableHeader,
}: Props) => (
  <TabsContent value="indices">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Market Indices</h3>
        <Dialog
          open={isCreateIndexOpen}
          onOpenChange={(open) => {
            setIsCreateIndexOpen(open);
            setIndexActionError(null);
            if (open) {
              setIndexDraft({ index_code: '', name: '', country_code: '', exchange_code: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Index
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Market Index</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {indexActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {indexActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="index-code">Code *</Label>
                  <Input
                    id="index-code"
                    placeholder="SPX"
                    className="mt-1"
                    value={indexDraft.index_code}
                    onChange={(e) => setIndexDraft({ ...indexDraft, index_code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="index-exchange">Exchange</Label>
                  <div className="mt-1">
                    <Popover open={indexExchangeOpen} onOpenChange={setIndexExchangeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          id="index-exchange"
                          className="w-full justify-between"
                        >
                          {indexDraft.exchange_code || '-'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full p-0"
                        align="start"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <Command>
                          <CommandInput placeholder="Search exchange..." />
                          <CommandEmpty>No exchange found.</CommandEmpty>
                          <CommandList className="max-h-60 overflow-auto">
                            <CommandGroup>
                              <CommandItem
                                value="-"
                                onSelect={() => {
                                  setIndexDraft({ ...indexDraft, exchange_code: '' });
                                  setIndexExchangeOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === '' ? 'opacity-100' : 'opacity-0'}`} />
                                -
                              </CommandItem>
                              {exchanges.map((exchange) => (
                                <CommandItem
                                  key={exchange.exchange_code}
                                  value={`${exchange.exchange_code} ${exchange.name}`}
                                  onSelect={() => {
                                    setIndexDraft({
                                      ...indexDraft,
                                      exchange_code: exchange.exchange_code,
                                    });
                                    setIndexExchangeOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === exchange.exchange_code ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span>{exchange.exchange_code}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{exchange.name}</span>
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
                <Label htmlFor="index-name">Name *</Label>
                <Input
                  id="index-name"
                  placeholder="S&P 500"
                  className="mt-1"
                  value={indexDraft.name}
                  onChange={(e) => setIndexDraft({ ...indexDraft, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="index-country">Country</Label>
                <div className="mt-1">
                  <Popover open={indexCountryOpen} onOpenChange={setIndexCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        id="index-country"
                        className="w-full justify-between"
                      >
                        {indexDraft.country_code
                          ? (countryNameByIso.get(indexDraft.country_code) ?? indexDraft.country_code)
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
                                  setIndexDraft({
                                    ...indexDraft,
                                    country_code: country.iso_code,
                                  });
                                  setIndexCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${indexDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
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
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateIndexOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateIndex}
                  disabled={indexActionLoading}
                >
                  {indexActionLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditIndexOpen} onOpenChange={setIsEditIndexOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Market Index</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {indexActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {indexActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-index-code">Code</Label>
                  <Input
                    id="edit-index-code"
                    className="mt-1"
                    value={indexDraft.index_code}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="edit-index-exchange">Exchange</Label>
                  <div className="mt-1">
                    <Popover open={indexEditExchangeOpen} onOpenChange={setIndexEditExchangeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          id="edit-index-exchange"
                          className="w-full justify-between"
                        >
                          {indexDraft.exchange_code || '-'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-full p-0"
                        align="start"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <Command>
                          <CommandInput placeholder="Search exchange..." />
                          <CommandEmpty>No exchange found.</CommandEmpty>
                          <CommandList className="max-h-60 overflow-auto">
                            <CommandGroup>
                              <CommandItem
                                value="-"
                                onSelect={() => {
                                  setIndexDraft({ ...indexDraft, exchange_code: '' });
                                  setIndexEditExchangeOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === '' ? 'opacity-100' : 'opacity-0'}`} />
                                -
                              </CommandItem>
                              {exchanges.map((exchange) => (
                                <CommandItem
                                  key={exchange.exchange_code}
                                  value={`${exchange.exchange_code} ${exchange.name}`}
                                  onSelect={() => {
                                    setIndexDraft({
                                      ...indexDraft,
                                      exchange_code: exchange.exchange_code,
                                    });
                                    setIndexEditExchangeOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${indexDraft.exchange_code === exchange.exchange_code ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span>{exchange.exchange_code}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{exchange.name}</span>
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
                <Label htmlFor="edit-index-name">Name *</Label>
                <Input
                  id="edit-index-name"
                  className="mt-1"
                  value={indexDraft.name}
                  onChange={(e) => setIndexDraft({ ...indexDraft, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-index-country">Country</Label>
                <div className="mt-1">
                  <Popover open={indexEditCountryOpen} onOpenChange={setIndexEditCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        id="edit-index-country"
                        className="w-full justify-between"
                      >
                        {indexDraft.country_code
                          ? (countryNameByIso.get(indexDraft.country_code) ?? indexDraft.country_code)
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
                                  setIndexDraft({
                                    ...indexDraft,
                                    country_code: country.iso_code,
                                  });
                                  setIndexEditCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${indexDraft.country_code === country.iso_code ? 'opacity-100' : 'opacity-0'}`}
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
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditIndexOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateIndex}
                  disabled={indexActionLoading}
                >
                  {indexActionLoading ? 'Saving...' : 'Save'}
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
              <SortableHeader label="Code" sortKey="index_code" currentSort={indexSort} onSort={onSort} />
              <SortableHeader label="Name" sortKey="name" currentSort={indexSort} onSort={onSort} />
              <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => onSort('exchange_code')}>
                <div className="flex items-center gap-1">Exchange <ArrowUpDown className={`h-3 w-3 ${indexSort.key === 'exchange_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
              </th>
              <th className="text-xs md:text-sm hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => onSort('country_code')}>
                <div className="flex items-center gap-1">Country <ArrowUpDown className={`h-3 w-3 ${indexSort.key === 'country_code' ? 'opacity-100' : 'opacity-40'}`} /></div>
              </th>
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {indicesLoading && (
              <tr>
                <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading indices...
                </td>
              </tr>
            )}
            {!indicesLoading && indicesError && (
              <tr>
                <td colSpan={5} className="text-destructive text-xs md:text-sm text-center py-6">
                  {indicesError}
                </td>
              </tr>
            )}
            {!indicesLoading && !indicesError && filteredIndices.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No indices to display.
                </td>
              </tr>
            )}
            {!indicesLoading && !indicesError && filteredIndices.map((index) => (
              <tr key={index.index_code}>
                <td className="font-medium text-foreground text-xs md:text-sm">{index.index_code}</td>
                <td className="text-foreground text-xs md:text-sm">{index.name}</td>
                <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                  {index.exchange_code
                    ? `${exchangeNameByCode.get(index.exchange_code) ?? index.exchange_code} (${index.exchange_code})`
                    : '—'}
                </td>
                <td className="text-muted-foreground text-xs md:text-sm hidden md:table-cell">
                  {index.country_code
                    ? (countryNameByIso.get(index.country_code) ?? index.country_code)
                    : '—'}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                      onClick={() => handleEditIndex(index)}
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                      onClick={() => setIndexToDelete(index)}
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
      <AlertDialog open={!!indexToDelete} onOpenChange={(open) => !open && setIndexToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete market index</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete index "{indexToDelete?.index_code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (indexToDelete) {
                  handleDeleteIndex(indexToDelete.index_code);
                }
                setIndexToDelete(null);
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

export default IndicesSection;
