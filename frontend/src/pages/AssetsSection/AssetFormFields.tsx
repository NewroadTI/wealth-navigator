import { AssetClass } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { AssetFormState, SelectOption } from './types';
import { NONE_SELECT_VALUE } from './constants';
import { formatDecimalValue } from './utils';
import { SearchableSelect } from './SearchableSelect';
import { DateField } from './DateField';

type AssetFormFieldsProps = {
  formState: AssetFormState;
  onChange: (updates: Partial<AssetFormState>) => void;
  assetClasses: AssetClass[];
  isLoadingClasses: boolean;
  currencyOptions: SelectOption[];
  countryOptions: SelectOption[];
  industryOptions: SelectOption[];
  getSubclassesByClassId: (classId: string) => Array<{ sub_class_id: number; name: string }>;
};

/**
 * Componente con todos los campos del formulario de asset (reutilizable para crear/editar)
 */
export const AssetFormFields = ({
  formState,
  onChange,
  assetClasses,
  isLoadingClasses,
  currencyOptions,
  countryOptions,
  industryOptions,
  getSubclassesByClassId,
}: AssetFormFieldsProps) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Asset Class *</Label>
          <Select
            value={formState.class_id}
            onValueChange={(value) => onChange({ class_id: value, sub_class_id: '' })}
            disabled={isLoadingClasses}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={isLoadingClasses ? 'Loading...' : 'Select class'} />
            </SelectTrigger>
            <SelectContent>
              {assetClasses.map((assetClass) => (
                <SelectItem key={assetClass.class_id} value={String(assetClass.class_id)}>
                  {assetClass.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Asset Subclass</Label>
          <Select
            value={formState.sub_class_id || NONE_SELECT_VALUE}
            onValueChange={(value) => onChange({ sub_class_id: value === NONE_SELECT_VALUE ? '' : value })}
            disabled={getSubclassesByClassId(formState.class_id).length === 0}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select subclass" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
              {getSubclassesByClassId(formState.class_id).map((subclass) => (
                <SelectItem key={subclass.sub_class_id} value={String(subclass.sub_class_id)}>
                  {subclass.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="asset-symbol" className="text-sm">
            Symbol *
          </Label>
          <Input
            id="asset-symbol"
            placeholder="AAPL"
            className="mt-1"
            value={formState.symbol}
            onChange={(e) => onChange({ symbol: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="asset-description" className="text-sm">
            Description
          </Label>
          <Input
            id="asset-description"
            placeholder="Asset description"
            className="mt-1"
            value={formState.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-sm">Currency</Label>
          <div className="mt-1">
            <SearchableSelect
              value={formState.currency}
              onChange={(value) => onChange({ currency: value })}
              options={currencyOptions}
              placeholder="Select currency"
              emptyLabel="None"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="asset-isin" className="text-sm">
            ISIN
          </Label>
          <Input
            id="asset-isin"
            placeholder="US0378331005"
            className="mt-1"
            value={formState.isin}
            onChange={(e) => onChange({ isin: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-sm">Country</Label>
          <div className="mt-1">
            <SearchableSelect
              value={formState.country_code}
              onChange={(value) => onChange({ country_code: value })}
              options={countryOptions}
              placeholder="Select country"
              emptyLabel="None"
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Industry</Label>
          <div className="mt-1">
            <SearchableSelect
              value={formState.industry_code}
              onChange={(value) => onChange({ industry_code: value })}
              options={industryOptions}
              placeholder="Select industry"
              emptyLabel="None"
            />
          </div>
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            Additional Fields
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="asset-figi" className="text-sm">
                FIGI
              </Label>
              <Input
                id="asset-figi"
                className="mt-1"
                value={formState.figi}
                onChange={(e) => onChange({ figi: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="asset-cusip" className="text-sm">
                CUSIP
              </Label>
              <Input
                id="asset-cusip"
                className="mt-1"
                value={formState.cusip}
                onChange={(e) => onChange({ cusip: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="asset-multiplier" className="text-sm">
                Multiplier
              </Label>
              <Input
                id="asset-multiplier"
                type="number"
                className="mt-1"
                value={formState.multiplier}
                onChange={(e) => onChange({ multiplier: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-contract" className="text-sm">
                Contract Size
              </Label>
              <Input
                id="asset-contract"
                type="number"
                className="mt-1"
                value={formState.contract_size}
                onChange={(e) => onChange({ contract_size: e.target.value })}
                onBlur={() => onChange({ contract_size: formatDecimalValue(formState.contract_size) })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-underlying" className="text-sm">
                Underlying Symbol
              </Label>
              <Input
                id="asset-underlying"
                className="mt-1"
                value={formState.underlying_symbol}
                onChange={(e) => onChange({ underlying_symbol: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="asset-strike" className="text-sm">
                Strike Price
              </Label>
              <Input
                id="asset-strike"
                type="number"
                className="mt-1"
                value={formState.strike_price}
                onChange={(e) => onChange({ strike_price: e.target.value })}
                onBlur={() => onChange({ strike_price: formatDecimalValue(formState.strike_price) })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <DateField
                id="asset-expiry"
                label="Expiry Date"
                value={formState.expiry_date}
                onChange={(value) => onChange({ expiry_date: value })}
              />
            </div>
            <div>
              <Label className="text-sm">Put/Call</Label>
              <Select
                value={formState.put_call || NONE_SELECT_VALUE}
                onValueChange={(value) => onChange({ put_call: value === NONE_SELECT_VALUE ? '' : value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>-</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="CALL">CALL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <DateField
                id="asset-maturity"
                label="Maturity Date"
                value={formState.maturity_date}
                onChange={(value) => onChange({ maturity_date: value })}
              />
            </div>
            <div>
              <Label htmlFor="asset-coupon" className="text-sm">
                Coupon Rate
              </Label>
              <Input
                id="asset-coupon"
                type="number"
                className="mt-1"
                value={formState.coupon_rate}
                onChange={(e) => onChange({ coupon_rate: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-issuer" className="text-sm">
                Issuer
              </Label>
              <Input
                id="asset-issuer"
                className="mt-1"
                value={formState.issuer}
                onChange={(e) => onChange({ issuer: e.target.value })}
              />
            </div>
            <div>
              <DateField
                id="asset-initial-fixing"
                label="Initial Fixing Date"
                value={formState.initial_fixing_date}
                onChange={(value) => onChange({ initial_fixing_date: value })}
              />
            </div>
            <div>
              <DateField
                id="asset-next-autocall"
                label="Next Autocall Date"
                value={formState.next_autocall_date}
                onChange={(value) => onChange({ next_autocall_date: value })}
              />
            </div>
            <div>
              <DateField
                id="asset-next-coupon"
                label="Next Coupon Date"
                value={formState.next_coupon_payment_date}
                onChange={(value) => onChange({ next_coupon_payment_date: value })}
              />
            </div>
            <div>
              <Label htmlFor="asset-autocall" className="text-sm">
                Autocall Trigger
              </Label>
              <Input
                id="asset-autocall"
                type="number"
                className="mt-1"
                value={formState.autocall_trigger}
                onChange={(e) => onChange({ autocall_trigger: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-coupon-trigger" className="text-sm">
                Coupon Trigger
              </Label>
              <Input
                id="asset-coupon-trigger"
                type="number"
                className="mt-1"
                value={formState.coupon_trigger}
                onChange={(e) => onChange({ coupon_trigger: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-capital-barrier" className="text-sm">
                Capital Barrier
              </Label>
              <Input
                id="asset-capital-barrier"
                type="number"
                className="mt-1"
                value={formState.capital_barrier}
                onChange={(e) => onChange({ capital_barrier: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-protection" className="text-sm">
                Protection Level
              </Label>
              <Input
                id="asset-protection"
                type="number"
                className="mt-1"
                value={formState.protection_level}
                onChange={(e) => onChange({ protection_level: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <Label htmlFor="asset-payment" className="text-sm">
                Payment Frequency
              </Label>
              <Input
                id="asset-payment"
                className="mt-1"
                value={formState.payment_frequency}
                onChange={(e) => onChange({ payment_frequency: e.target.value })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
