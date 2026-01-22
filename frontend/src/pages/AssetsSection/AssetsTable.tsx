import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Package, ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
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
import { AssetApi } from '@/lib/api';
import { AssetSortKey, SortConfig } from './types';
import { formatDecimalValue } from './utils';

type AssetsTableProps = {
  assets: AssetApi[];
  isLoading: boolean;
  sortConfig: SortConfig;
  onSortChange: (key: AssetSortKey) => void;
  visibleColumns: AssetSortKey[];
  classNameById: Map<number, string>;
  subClassNameById: Map<number, string>;
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalAssets: number;
  onPageChange: (page: number) => void;
  onEditAsset: (asset: AssetApi) => void;
  onDeleteAsset: (asset: AssetApi) => void;
};

export const AssetsTable = ({
  assets,
  isLoading,
  sortConfig,
  onSortChange,
  visibleColumns,
  classNameById,
  subClassNameById,
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalAssets,
  onPageChange,
  onEditAsset,
  onDeleteAsset,
}: AssetsTableProps) => {
  const [assetToDelete, setAssetToDelete] = useState<AssetApi | null>(null);

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: AssetSortKey }) => (
    <th className="text-xs cursor-pointer hover:bg-muted/50 transition-colors select-none" onClick={() => onSortChange(sortKey)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'opacity-100' : 'opacity-40'}`} />
      </div>
    </th>
  );

  const columnDefinitions: Array<{
    key: AssetSortKey;
    label: string;
    getValue: (asset: AssetApi) => ReactNode;
  }> = [
    { key: 'symbol', label: 'Symbol', getValue: (asset) => asset.symbol || '-' },
    { key: 'description', label: 'Description', getValue: (asset) => asset.description || '-' },
    {
      key: 'class',
      label: 'Class',
      getValue: (asset) => (
        <span className="px-1.5 py-0.5 text-[10px] md:text-xs rounded-full bg-primary/20 text-primary">
          {classNameById.get(asset.class_id ?? -1) || '-'}
        </span>
      ),
    },
    { key: 'type', label: 'Type', getValue: (asset) => subClassNameById.get(asset.sub_class_id ?? -1) || '-' },
    { key: 'currency', label: 'Currency', getValue: (asset) => asset.currency || '-' },
    { key: 'isin', label: 'ISIN', getValue: (asset) => asset.isin || '-' },
    { key: 'country', label: 'Country', getValue: (asset) => asset.country_code || '-' },
    { key: 'industry', label: 'Industry', getValue: (asset) => asset.industry_code || '-' },
    { key: 'figi', label: 'FIGI', getValue: (asset) => asset.figi || '-' },
    { key: 'cusip', label: 'CUSIP', getValue: (asset) => asset.cusip || '-' },
    { key: 'multiplier', label: 'Multiplier', getValue: (asset) => asset.multiplier || '-' },
    {
      key: 'contract_size',
      label: 'Contract Size',
      getValue: (asset) => formatDecimalValue(asset.contract_size) || '-',
    },
    { key: 'underlying_symbol', label: 'Underlying', getValue: (asset) => asset.underlying_symbol || '-' },
    { key: 'strike_price', label: 'Strike Price', getValue: (asset) => formatDecimalValue(asset.strike_price) || '-' },
    { key: 'expiry_date', label: 'Expiry Date', getValue: (asset) => asset.expiry_date || '-' },
    { key: 'put_call', label: 'Put/Call', getValue: (asset) => asset.put_call || '-' },
    { key: 'maturity_date', label: 'Maturity Date', getValue: (asset) => asset.maturity_date || '-' },
    { key: 'coupon_rate', label: 'Coupon Rate', getValue: (asset) => asset.coupon_rate || '-' },
    { key: 'issuer', label: 'Issuer', getValue: (asset) => asset.issuer || '-' },
    { key: 'initial_fixing_date', label: 'Initial Fixing', getValue: (asset) => asset.initial_fixing_date || '-' },
    { key: 'next_autocall_date', label: 'Next Autocall', getValue: (asset) => asset.next_autocall_date || '-' },
    {
      key: 'next_coupon_payment_date',
      label: 'Next Coupon',
      getValue: (asset) => asset.next_coupon_payment_date || '-',
    },
    { key: 'autocall_trigger', label: 'Autocall Trigger', getValue: (asset) => asset.autocall_trigger || '-' },
    { key: 'coupon_trigger', label: 'Coupon Trigger', getValue: (asset) => asset.coupon_trigger || '-' },
    { key: 'capital_barrier', label: 'Capital Barrier', getValue: (asset) => asset.capital_barrier || '-' },
    { key: 'protection_level', label: 'Protection Level', getValue: (asset) => asset.protection_level || '-' },
    { key: 'payment_frequency', label: 'Payment Frequency', getValue: (asset) => asset.payment_frequency || '-' },
  ];

  const visibleColumnDefs = columnDefinitions.filter((column) => visibleColumns.includes(column.key));

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="font-semibold text-foreground text-sm md:text-base">Asset Catalog</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {isLoading ? 'Loading...' : totalAssets === 0 ? '0 assets' : `${pageStart}-${pageEnd} of ${totalAssets}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={isLoading || currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={isLoading || currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {visibleColumnDefs.map((column) => (
                  <SortableHeader key={column.key} label={column.label} sortKey={column.key} />
                ))}
                <th className="text-xs md:text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.asset_id}>
                  {visibleColumnDefs.map((column) => (
                    <td
                      key={column.key}
                      className={`text-muted-foreground text-xs md:text-sm ${
                        column.key === 'description' ? 'max-w-[220px] truncate text-foreground' : ''
                      } ${column.key === 'symbol' ? 'font-medium text-foreground' : ''} ${
                        column.key === 'isin' ? 'mono text-[10px] md:text-xs' : ''
                      }`}
                    >
                      {column.getValue(asset)}
                    </td>
                  ))}
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8" onClick={() => onEditAsset(asset)}>
                        <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                        onClick={() => setAssetToDelete(asset)}
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
      </div>

      <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete asset "{assetToDelete?.symbol}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assetToDelete) {
                  onDeleteAsset(assetToDelete);
                }
                setAssetToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
