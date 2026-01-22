import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus } from 'lucide-react';
import { AssetClass } from '@/lib/api';
import { AssetFormState, SelectOption } from './types';
import { DEFAULT_ASSET_FORM_STATE } from './constants';
import { buildAssetPayload, getErrorMessage } from './utils';
import { AssetFormFields } from './AssetFormFields';

type AssetCreateDialogProps = {
  assetClasses: AssetClass[];
  isLoadingClasses: boolean;
  currencyOptions: SelectOption[];
  countryOptions: SelectOption[];
  industryOptions: SelectOption[];
  getSubclassesByClassId: (classId: string) => Array<{ sub_class_id: number; name: string }>;
  onAssetCreated: () => void;
};

export const AssetCreateDialog = ({
  assetClasses,
  isLoadingClasses,
  currencyOptions,
  countryOptions,
  industryOptions,
  getSubclassesByClassId,
  onAssetCreated,
}: AssetCreateDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState<AssetFormState>(DEFAULT_ASSET_FORM_STATE);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError(null);
    if (open) {
      setFormState({
        ...DEFAULT_ASSET_FORM_STATE,
        class_id: assetClasses[0]?.class_id ? String(assetClasses[0].class_id) : '',
      });
    }
  };

  const handleSubmit = async () => {
    if (!formState.symbol.trim() || !formState.class_id) {
      setError('Symbol and Asset Class are required.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/v1/assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssetPayload(formState)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, 'Failed to create asset'));
      }

      setIsOpen(false);
      setFormState(DEFAULT_ASSET_FORM_STATE);
      onAssetCreated();
    } catch (err: any) {
      setError(err.message || 'Could not create the asset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm h-8 md:h-9">
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
          <span className="hidden sm:inline">New Asset</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Asset</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 mb-4">
              <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          <AssetFormFields
            formState={formState}
            onChange={(updates) => setFormState((prev) => ({ ...prev, ...updates }))}
            assetClasses={assetClasses}
            isLoadingClasses={isLoadingClasses}
            currencyOptions={currencyOptions}
            countryOptions={countryOptions}
            industryOptions={industryOptions}
            getSubclassesByClassId={getSubclassesByClassId}
          />
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Create Asset'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
