import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AssetApi, AssetClass } from '@/lib/api';
import { AssetFormState, SelectOption } from './types';
import { buildAssetPayload, formatDecimalValue, getErrorMessage } from './utils';
import { AssetFormFields } from './AssetFormFields';

type AssetEditDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetApi | null;
  formState: AssetFormState;
  onFormChange: (updates: Partial<AssetFormState>) => void;
  assetClasses: AssetClass[];
  isLoadingClasses: boolean;
  currencyOptions: SelectOption[];
  countryOptions: SelectOption[];
  industryOptions: SelectOption[];
  getSubclassesByClassId: (classId: string) => Array<{ sub_class_id: number; name: string }>;
  onAssetUpdated: () => void;
  error: string | null;
  setError: (error: string | null) => void;
};

export const AssetEditDialog = ({
  isOpen,
  onOpenChange,
  asset,
  formState,
  onFormChange,
  assetClasses,
  isLoadingClasses,
  currencyOptions,
  countryOptions,
  industryOptions,
  getSubclassesByClassId,
  onAssetUpdated,
  error,
  setError,
}: AssetEditDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

  const handleSubmit = async () => {
    if (!asset || !formState.symbol.trim() || !formState.class_id) {
      setError('Symbol and Asset Class are required.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/v1/assets/${asset.asset_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssetPayload(formState)),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, 'Failed to update asset'));
      }

      onOpenChange(false);
      onAssetUpdated();
    } catch (err: any) {
      setError(err.message || 'Could not update the asset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 mb-4">
              <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          <AssetFormFields
            formState={formState}
            onChange={onFormChange}
            assetClasses={assetClasses}
            isLoadingClasses={isLoadingClasses}
            currencyOptions={currencyOptions}
            countryOptions={countryOptions}
            industryOptions={industryOptions}
            getSubclassesByClassId={getSubclassesByClassId}
          />
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Update Asset'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
