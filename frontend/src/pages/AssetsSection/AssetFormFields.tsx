import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, X } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import type { AssetClass } from '@/lib/api';

export type AssetFormState = {
    symbol: string;
    name: string;
    description: string;
    isin: string;
    figi: string;
    cusip: string;
    class_id: string;
    sub_class_id: string;
    industry_code: string;
    country_code: string;
    currency: string;
    multiplier: string;
    contract_size: string;
    underlying_symbol: string;
    strike_price: string;
    expiry_date: string;
    put_call: string;
    maturity_date: string;
    coupon_rate: string;
    issuer: string;
    initial_fixing_date: string;
    next_autocall_date: string;
    next_coupon_payment_date: string;
    autocall_trigger: string;
    coupon_trigger: string;
    capital_barrier: string;
    protection_level: string;
    payment_frequency: string;
};

export const defaultAssetFormState: AssetFormState = {
    symbol: '',
    name: '',
    description: '',
    isin: '',
    figi: '',
    cusip: '',
    class_id: '',
    sub_class_id: '',
    industry_code: '',
    country_code: '',
    currency: '',
    multiplier: '1.0',
    contract_size: '0.0',
    underlying_symbol: '',
    strike_price: '0.0',
    expiry_date: '',
    put_call: '',
    maturity_date: '',
    coupon_rate: '0.0',
    issuer: '',
    initial_fixing_date: '',
    next_autocall_date: '',
    next_coupon_payment_date: '',
    autocall_trigger: '',
    coupon_trigger: '',
    capital_barrier: '',
    protection_level: '',
    payment_frequency: '',
};

const NONE_SELECT_VALUE = '__none__';

export const formatDecimalValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return String(value);
    }
    return Number.isInteger(parsed) ? parsed.toFixed(1) : String(parsed);
};

type SearchableSelectProps = {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; secondary?: string }>;
    placeholder: string;
    emptyLabel?: string;
};

const SearchableSelect = ({ value, onChange, options, placeholder, emptyLabel }: SearchableSelectProps) => {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandList>
                        <CommandGroup>
                            {emptyLabel && (
                                <CommandItem
                                    value={NONE_SELECT_VALUE}
                                    onSelect={() => {
                                        onChange('');
                                        setOpen(false);
                                    }}
                                >
                                    {emptyLabel}
                                </CommandItem>
                            )}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        {option.secondary && (
                                            <span className="text-xs text-muted-foreground">{option.secondary}</span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

type DateFieldProps = {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
};

const DateField = ({ id, label, value, onChange }: DateFieldProps) => (
    <div>
        <Label htmlFor={id} className="text-sm">
            {label}
        </Label>
        <div className="relative mt-1">
            <Input
                id={id}
                type="date"
                placeholder="No setup"
                className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border focus:ring-0 focus:border-border focus:outline-none focus-visible:outline-none ${value ? '' : 'text-muted-foreground'
                    }`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ colorScheme: 'dark' }}
            />
            {value ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                    onClick={() => onChange('')}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            ) : null}
        </div>
    </div>
);

type AssetFormFieldsProps = {
    formState: AssetFormState;
    setFormState: React.Dispatch<React.SetStateAction<AssetFormState>>;
    assetClasses: AssetClass[];
    isLoadingClasses: boolean;
    currencyOptions: Array<{ value: string; label: string }>;
    countryOptions: Array<{ value: string; label: string }>;
    industryOptions: Array<{ value: string; label: string; secondary?: string }>;
    idPrefix?: string;
};

const AssetFormFields = ({
    formState,
    setFormState,
    assetClasses,
    isLoadingClasses,
    currencyOptions,
    countryOptions,
    industryOptions,
    idPrefix = 'asset',
}: AssetFormFieldsProps) => {
    const getSubclassesByClassId = (classId: string) => {
        const numericId = Number(classId);
        if (!Number.isFinite(numericId)) {
            return [];
        }
        return assetClasses.find((cls) => cls.class_id === numericId)?.sub_classes ?? [];
    };

    const subclasses = getSubclassesByClassId(formState.class_id);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label className="text-sm">Asset Class *</Label>
                    <Select
                        value={formState.class_id}
                        onValueChange={(value) => {
                            setFormState((prev) => ({ ...prev, class_id: value, sub_class_id: '' }));
                        }}
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
                        onValueChange={(value) =>
                            setFormState((prev) => ({
                                ...prev,
                                sub_class_id: value === NONE_SELECT_VALUE ? '' : value,
                            }))
                        }
                        disabled={subclasses.length === 0}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select subclass" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                            {subclasses.map((subclass) => (
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
                    <Label htmlFor={`${idPrefix}-symbol`} className="text-sm">Symbol *</Label>
                    <Input
                        id={`${idPrefix}-symbol`}
                        placeholder="AAPL"
                        className="mt-1"
                        value={formState.symbol}
                        onChange={(e) => setFormState((prev) => ({ ...prev, symbol: e.target.value }))}
                    />
                </div>
                <div>
                    <Label htmlFor={`${idPrefix}-description`} className="text-sm">Description</Label>
                    <Input
                        id={`${idPrefix}-description`}
                        placeholder="Asset description"
                        className="mt-1"
                        value={formState.description}
                        onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                    />
                </div>
                <div>
                    <Label className="text-sm">Currency</Label>
                    <div className="mt-1">
                        <SearchableSelect
                            value={formState.currency}
                            onChange={(value) => setFormState((prev) => ({ ...prev, currency: value }))}
                            options={currencyOptions}
                            placeholder="Select currency"
                            emptyLabel="None"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor={`${idPrefix}-isin`} className="text-sm">ISIN</Label>
                    <Input
                        id={`${idPrefix}-isin`}
                        placeholder="US0378331005"
                        className="mt-1"
                        value={formState.isin}
                        onChange={(e) => setFormState((prev) => ({ ...prev, isin: e.target.value }))}
                    />
                </div>
                <div>
                    <Label className="text-sm">Country</Label>
                    <div className="mt-1">
                        <SearchableSelect
                            value={formState.country_code}
                            onChange={(value) => setFormState((prev) => ({ ...prev, country_code: value }))}
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
                            onChange={(value) => setFormState((prev) => ({ ...prev, industry_code: value }))}
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
                            <Label htmlFor={`${idPrefix}-figi`} className="text-sm">FIGI</Label>
                            <Input
                                id={`${idPrefix}-figi`}
                                className="mt-1"
                                value={formState.figi}
                                onChange={(e) => setFormState((prev) => ({ ...prev, figi: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-cusip`} className="text-sm">CUSIP</Label>
                            <Input
                                id={`${idPrefix}-cusip`}
                                className="mt-1"
                                value={formState.cusip}
                                onChange={(e) => setFormState((prev) => ({ ...prev, cusip: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-multiplier`} className="text-sm">Multiplier</Label>
                            <Input
                                id={`${idPrefix}-multiplier`}
                                type="number"
                                className="mt-1"
                                value={formState.multiplier}
                                onChange={(e) => setFormState((prev) => ({ ...prev, multiplier: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-contract`} className="text-sm">Contract Size</Label>
                            <Input
                                id={`${idPrefix}-contract`}
                                type="number"
                                className="mt-1"
                                value={formState.contract_size}
                                onChange={(e) => setFormState((prev) => ({ ...prev, contract_size: e.target.value }))}
                                onBlur={() =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        contract_size: formatDecimalValue(prev.contract_size),
                                    }))
                                }
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-underlying`} className="text-sm">Underlying Symbol</Label>
                            <Input
                                id={`${idPrefix}-underlying`}
                                className="mt-1"
                                value={formState.underlying_symbol}
                                onChange={(e) => setFormState((prev) => ({ ...prev, underlying_symbol: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-strike`} className="text-sm">Strike Price</Label>
                            <Input
                                id={`${idPrefix}-strike`}
                                type="number"
                                className="mt-1"
                                value={formState.strike_price}
                                onChange={(e) => setFormState((prev) => ({ ...prev, strike_price: e.target.value }))}
                                onBlur={() =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        strike_price: formatDecimalValue(prev.strike_price),
                                    }))
                                }
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <DateField
                            id={`${idPrefix}-expiry`}
                            label="Expiry Date"
                            value={formState.expiry_date}
                            onChange={(value) => setFormState((prev) => ({ ...prev, expiry_date: value }))}
                        />
                        <div>
                            <Label className="text-sm">Put/Call</Label>
                            <Select
                                value={formState.put_call || NONE_SELECT_VALUE}
                                onValueChange={(value) =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        put_call: value === NONE_SELECT_VALUE ? '' : value,
                                    }))
                                }
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
                        <DateField
                            id={`${idPrefix}-maturity`}
                            label="Maturity Date"
                            value={formState.maturity_date}
                            onChange={(value) => setFormState((prev) => ({ ...prev, maturity_date: value }))}
                        />
                        <div>
                            <Label htmlFor={`${idPrefix}-coupon`} className="text-sm">Coupon Rate</Label>
                            <Input
                                id={`${idPrefix}-coupon`}
                                type="number"
                                className="mt-1"
                                value={formState.coupon_rate}
                                onChange={(e) => setFormState((prev) => ({ ...prev, coupon_rate: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-issuer`} className="text-sm">Issuer</Label>
                            <Input
                                id={`${idPrefix}-issuer`}
                                className="mt-1"
                                value={formState.issuer}
                                onChange={(e) => setFormState((prev) => ({ ...prev, issuer: e.target.value }))}
                            />
                        </div>
                        <DateField
                            id={`${idPrefix}-initial-fixing`}
                            label="Initial Fixing Date"
                            value={formState.initial_fixing_date}
                            onChange={(value) => setFormState((prev) => ({ ...prev, initial_fixing_date: value }))}
                        />
                        <DateField
                            id={`${idPrefix}-next-autocall`}
                            label="Next Autocall Date"
                            value={formState.next_autocall_date}
                            onChange={(value) => setFormState((prev) => ({ ...prev, next_autocall_date: value }))}
                        />
                        <DateField
                            id={`${idPrefix}-next-coupon`}
                            label="Next Coupon Date"
                            value={formState.next_coupon_payment_date}
                            onChange={(value) => setFormState((prev) => ({ ...prev, next_coupon_payment_date: value }))}
                        />
                        <div>
                            <Label htmlFor={`${idPrefix}-autocall`} className="text-sm">Autocall Trigger</Label>
                            <Input
                                id={`${idPrefix}-autocall`}
                                type="number"
                                className="mt-1"
                                value={formState.autocall_trigger}
                                onChange={(e) => setFormState((prev) => ({ ...prev, autocall_trigger: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-coupon-trigger`} className="text-sm">Coupon Trigger</Label>
                            <Input
                                id={`${idPrefix}-coupon-trigger`}
                                type="number"
                                className="mt-1"
                                value={formState.coupon_trigger}
                                onChange={(e) => setFormState((prev) => ({ ...prev, coupon_trigger: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-capital-barrier`} className="text-sm">Capital Barrier</Label>
                            <Input
                                id={`${idPrefix}-capital-barrier`}
                                type="number"
                                className="mt-1"
                                value={formState.capital_barrier}
                                onChange={(e) => setFormState((prev) => ({ ...prev, capital_barrier: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-protection`} className="text-sm">Protection Level</Label>
                            <Input
                                id={`${idPrefix}-protection`}
                                type="number"
                                className="mt-1"
                                value={formState.protection_level}
                                onChange={(e) => setFormState((prev) => ({ ...prev, protection_level: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${idPrefix}-payment`} className="text-sm">Payment Frequency</Label>
                            <Input
                                id={`${idPrefix}-payment`}
                                className="mt-1"
                                value={formState.payment_frequency}
                                onChange={(e) => setFormState((prev) => ({ ...prev, payment_frequency: e.target.value }))}
                            />
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

export default AssetFormFields;
