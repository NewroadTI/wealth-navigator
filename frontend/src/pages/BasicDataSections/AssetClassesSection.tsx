import { Fragment, type Dispatch, type SetStateAction } from 'react';
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
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import type { AssetClassApi, AssetSubClassApi } from '../BasicData';

type AssetClassDraft = {
  class_id: number;
  code: string;
  name: string;
  description: string;
  sub_classes: AssetSubClassApi[];
};

type Props = {
  assetClassesLoading: boolean;
  assetClassesError: string | null;
  filteredAssetClasses: AssetClassApi[];
  assetClassDraft: AssetClassDraft;
  setAssetClassDraft: Dispatch<SetStateAction<AssetClassDraft>>;
  isCreateAssetClassOpen: boolean;
  setIsCreateAssetClassOpen: (open: boolean) => void;
  isEditAssetClassOpen: boolean;
  setIsEditAssetClassOpen: (open: boolean) => void;
  assetClassActionError: string | null;
  assetClassActionLoading: boolean;
  setAssetClassActionError: (value: string | null) => void;
  handleCreateAssetClass: () => void;
  handleUpdateAssetClass: () => void;
  handleEditAssetClass: (assetClass: AssetClassApi) => void;
  assetClassToDelete: AssetClassApi | null;
  setAssetClassToDelete: Dispatch<SetStateAction<AssetClassApi | null>>;
  handleDeleteAssetClass: (classId: number) => void;
};

const AssetClassesSection = ({
  assetClassesLoading,
  assetClassesError,
  filteredAssetClasses,
  assetClassDraft,
  setAssetClassDraft,
  isCreateAssetClassOpen,
  setIsCreateAssetClassOpen,
  isEditAssetClassOpen,
  setIsEditAssetClassOpen,
  assetClassActionError,
  assetClassActionLoading,
  setAssetClassActionError,
  handleCreateAssetClass,
  handleUpdateAssetClass,
  handleEditAssetClass,
  assetClassToDelete,
  setAssetClassToDelete,
  handleDeleteAssetClass,
}: Props) => (
  <TabsContent value="asset-classes">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Asset Classes</h3>
        <Dialog
          open={isCreateAssetClassOpen}
          onOpenChange={(open) => {
            setIsCreateAssetClassOpen(open);
            setAssetClassActionError(null);
            if (open) {
              setAssetClassDraft({ class_id: 0, code: '', name: '', description: '', sub_classes: [] });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs md:text-sm">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
              Add Asset Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Asset Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {assetClassActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {assetClassActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="asset-class-code">Code *</Label>
                  <Input
                    id="asset-class-code"
                    placeholder="EQUITY"
                    className="mt-1"
                    value={assetClassDraft.code}
                    onChange={(e) => setAssetClassDraft({ ...assetClassDraft, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="asset-class-name">Name *</Label>
                  <Input
                    id="asset-class-name"
                    placeholder="Equities"
                    className="mt-1"
                    value={assetClassDraft.name}
                    onChange={(e) => setAssetClassDraft({ ...assetClassDraft, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subclasses</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAssetClassDraft({
                        ...assetClassDraft,
                        sub_classes: [...assetClassDraft.sub_classes, { code: '', name: '' }],
                      })
                    }
                  >
                    Add Subclass
                  </Button>
                </div>
                {assetClassDraft.sub_classes.length === 0 && (
                  <p className="text-xs text-muted-foreground">No subclasses added.</p>
                )}
                {assetClassDraft.sub_classes.map((sub, index) => (
                  <div key={sub.sub_class_id ?? `new-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      placeholder="CODE"
                      value={sub.code}
                      onChange={(e) => {
                        const next = [...assetClassDraft.sub_classes];
                        next[index] = { ...next[index], code: e.target.value.toUpperCase() };
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    />
                    <Input
                      placeholder="Subclass name"
                      value={sub.name}
                      onChange={(e) => {
                        const next = [...assetClassDraft.sub_classes];
                        next[index] = { ...next[index], name: e.target.value };
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = assetClassDraft.sub_classes.filter((_, subIndex) => subIndex !== index);
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateAssetClassOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleCreateAssetClass}
                  disabled={assetClassActionLoading}
                >
                  {assetClassActionLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditAssetClassOpen}
          onOpenChange={(open) => {
            setIsEditAssetClassOpen(open);
            setAssetClassActionError(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Asset Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {assetClassActionError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-sm text-red-800">
                    {assetClassActionError}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-asset-class-code">Code *</Label>
                  <Input
                    id="edit-asset-class-code"
                    className="mt-1"
                    value={assetClassDraft.code}
                    onChange={(e) => setAssetClassDraft({ ...assetClassDraft, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-asset-class-name">Name *</Label>
                  <Input
                    id="edit-asset-class-name"
                    className="mt-1"
                    value={assetClassDraft.name}
                    onChange={(e) => setAssetClassDraft({ ...assetClassDraft, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subclasses</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAssetClassDraft({
                        ...assetClassDraft,
                        sub_classes: [...assetClassDraft.sub_classes, { code: '', name: '' }],
                      })
                    }
                  >
                    Add Subclass
                  </Button>
                </div>
                {assetClassDraft.sub_classes.length === 0 && (
                  <p className="text-xs text-muted-foreground">No subclasses added.</p>
                )}
                {assetClassDraft.sub_classes.map((sub, index) => (
                  <div key={sub.sub_class_id ?? `edit-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      placeholder="CODE"
                      value={sub.code}
                      onChange={(e) => {
                        const next = [...assetClassDraft.sub_classes];
                        next[index] = { ...next[index], code: e.target.value.toUpperCase() };
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    />
                    <Input
                      placeholder="Subclass name"
                      value={sub.name}
                      onChange={(e) => {
                        const next = [...assetClassDraft.sub_classes];
                        next[index] = { ...next[index], name: e.target.value };
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = assetClassDraft.sub_classes.filter((_, subIndex) => subIndex !== index);
                        setAssetClassDraft({ ...assetClassDraft, sub_classes: next });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditAssetClassOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={handleUpdateAssetClass}
                  disabled={assetClassActionLoading}
                >
                  {assetClassActionLoading ? 'Saving...' : 'Save'}
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
              <th className="text-xs md:text-sm">Code</th>
              <th className="text-xs md:text-sm">Name</th>
              <th className="text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assetClassesLoading && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  Loading asset classes...
                </td>
              </tr>
            )}
            {!assetClassesLoading && assetClassesError && (
              <tr>
                <td colSpan={3} className="text-destructive text-xs md:text-sm text-center py-6">
                  {assetClassesError}
                </td>
              </tr>
            )}
            {!assetClassesLoading && !assetClassesError && filteredAssetClasses.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted-foreground text-xs md:text-sm text-center py-6">
                  No asset classes to display.
                </td>
              </tr>
            )}
            {!assetClassesLoading && !assetClassesError && filteredAssetClasses.map((assetClass) => (
              <Fragment key={assetClass.class_id}>
                <tr>
                  <td className="font-medium text-foreground text-xs md:text-sm">{assetClass.code}</td>
                  <td className="text-foreground text-xs md:text-sm">{assetClass.name}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8"
                        onClick={() => handleEditAssetClass(assetClass)}
                      >
                        <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                        onClick={() => setAssetClassToDelete(assetClass)}
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {assetClass.sub_classes.map((sub) => (
                  <tr key={sub.sub_class_id ?? `${assetClass.class_id}-${sub.code}`} className="bg-muted/20">
                    <td className="text-xs md:text-sm text-muted-foreground pl-8">{sub.code}</td>
                    <td className="text-xs md:text-sm text-muted-foreground">{sub.name}</td>
                    <td />
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!assetClassToDelete} onOpenChange={(open) => !open && setAssetClassToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete asset class "{assetClassToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assetClassToDelete) {
                  handleDeleteAssetClass(assetClassToDelete.class_id);
                }
                setAssetClassToDelete(null);
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

export default AssetClassesSection;
