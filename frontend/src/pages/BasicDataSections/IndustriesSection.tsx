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
import { Plus, Edit2, Trash2, ArrowUpDown } from 'lucide-react';
import type { IndustryApi, SortConfig } from '../BasicData';

type IndustryDraft = { industry_code: string; name: string; sector: string };

type Props = {
  industriesLoading: boolean;
  industriesError: string | null;
  filteredIndustries: IndustryApi[];
  industrySort: SortConfig;
  onSort: (key: string) => void;
  industryDraft: IndustryDraft;
  setIndustryDraft: React.Dispatch<React.SetStateAction<IndustryDraft>>;
  isCreateIndustryOpen: boolean;
  setIsCreateIndustryOpen: (open: boolean) => void;
  isEditIndustryOpen: boolean;
  setIsEditIndustryOpen: (open: boolean) => void;
  industryActionError: string | null;
  industryActionLoading: boolean;
  setIndustryActionError: (value: string | null) => void;
  handleCreateIndustry: () => void;
  handleUpdateIndustry: () => void;
  handleEditIndustry: (industry: IndustryApi) => void;
  industryToDelete: IndustryApi | null;
  setIndustryToDelete: React.Dispatch<React.SetStateAction<IndustryApi | null>>;
  handleDeleteIndustry: (industryCode: string) => void;
  industrySectorOptions: string[];
  SortableHeader: React.FC<{ label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }>;
};

const IndustriesSection = ({
  industriesLoading,
  industriesError,
  filteredIndustries,
  industrySort,
  onSort,
  industryDraft,
  setIndustryDraft,
  isCreateIndustryOpen,
  setIsCreateIndustryOpen,
  isEditIndustryOpen,
  setIsEditIndustryOpen,
  industryActionError,
  industryActionLoading,
  setIndustryActionError,
  handleCreateIndustry,
  handleUpdateIndustry,
  handleEditIndustry,
  industryToDelete,
  setIndustryToDelete,
  handleDeleteIndustry,
  industrySectorOptions,
  SortableHeader,
}: Props) => (
  <TabsContent value="industries">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Industries</h3>
        <Dialog
          open={isCreateIndustryOpen}
          onOpenChange={(open) => {
            setIsCreateIndustryOpen(open);
            setIndustryActionError(null);
            if (open) {
              setIndustryDraft({ industry_code: '', name: '', sector: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Industry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Industry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {industryActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {industryActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label>Code</Label>
                <Input
                  placeholder="TECH"
                  className="mt-1"
                  value={industryDraft.industry_code}
                  onChange={(e) => setIndustryDraft({ ...industryDraft, industry_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="Technology"
                  className="mt-1"
                  value={industryDraft.name}
                  onChange={(e) => setIndustryDraft({ ...industryDraft, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="industry-sector">Sector</Label>
                <Input
                  id="industry-sector"
                  list="industry-sector-options"
                  placeholder="Information Technology"
                  className="mt-1"
                  value={industryDraft.sector}
                  onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                />
                <datalist id="industry-sector-options">
                  {industrySectorOptions.map((sector) => (
                    <option key={sector} value={sector} />
                  ))}
                </datalist>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateIndustryOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateIndustry}
                  disabled={industryActionLoading}
                >
                  {industryActionLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditIndustryOpen} onOpenChange={setIsEditIndustryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Industry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {industryActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {industryActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label>Code</Label>
                <Input className="mt-1" value={industryDraft.industry_code} disabled />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  className="mt-1"
                  value={industryDraft.name}
                  onChange={(e) => setIndustryDraft({ ...industryDraft, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-industry-sector">Sector</Label>
                <Input
                  id="edit-industry-sector"
                  list="industry-sector-options"
                  className="mt-1"
                  value={industryDraft.sector}
                  onChange={(e) => setIndustryDraft({ ...industryDraft, sector: e.target.value })}
                />
                <datalist id="industry-sector-options">
                  {industrySectorOptions.map((sector) => (
                    <option key={sector} value={sector} />
                  ))}
                </datalist>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditIndustryOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateIndustry}
                  disabled={industryActionLoading}
                >
                  {industryActionLoading ? 'Saving...' : 'Save'}
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
              <SortableHeader label="Code" sortKey="industry_code" currentSort={industrySort} onSort={onSort} />
              <SortableHeader label="Name" sortKey="name" currentSort={industrySort} onSort={onSort} />
              <th className="text-xs md:text-sm hidden sm:table-cell cursor-pointer hover:bg-muted/50" onClick={() => onSort('sector')}>
                <div className="flex items-center gap-1">Sector <ArrowUpDown className={`h-3 w-3 ${industrySort.key === 'sector' ? 'opacity-100' : 'opacity-40'}`} /></div>
              </th>
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {industriesLoading && (
              <tr>
                <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading industries...
                </td>
              </tr>
            )}
            {!industriesLoading && industriesError && (
              <tr>
                <td colSpan={4} className="text-destructive text-xs md:text-sm text-center py-6">
                  {industriesError}
                </td>
              </tr>
            )}
            {!industriesLoading && !industriesError && filteredIndustries.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No industries to display.
                </td>
              </tr>
            )}
            {!industriesLoading && !industriesError && filteredIndustries.map((industry) => (
              <tr key={industry.industry_code}>
                <td className="font-medium text-foreground text-xs md:text-sm">{industry.industry_code}</td>
                <td className="text-foreground text-xs md:text-sm">{industry.name}</td>
                <td className="text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                  {industry.sector ?? '—'}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                      onClick={() => handleEditIndustry(industry)}
                    >
                      <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                      onClick={() => setIndustryToDelete(industry)}
                      disabled={industryActionLoading}
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
      <AlertDialog open={!!industryToDelete} onOpenChange={(open) => !open && setIndustryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete industry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete industry "{industryToDelete?.name ?? industryToDelete?.industry_code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (industryToDelete) {
                  handleDeleteIndustry(industryToDelete.industry_code);
                }
                setIndustryToDelete(null);
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

export default IndustriesSection;
