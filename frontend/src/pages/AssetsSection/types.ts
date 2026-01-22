export type AssetSortKey =
  | 'symbol'
  | 'description'
  | 'class'
  | 'type'
  | 'currency'
  | 'isin'
  | 'country'
  | 'industry'
  | 'figi'
  | 'cusip'
  | 'multiplier'
  | 'contract_size'
  | 'underlying_symbol'
  | 'strike_price'
  | 'expiry_date'
  | 'put_call'
  | 'maturity_date'
  | 'coupon_rate'
  | 'issuer'
  | 'initial_fixing_date'
  | 'next_autocall_date'
  | 'next_coupon_payment_date'
  | 'autocall_trigger'
  | 'coupon_trigger'
  | 'capital_barrier'
  | 'protection_level'
  | 'payment_frequency';

export type SortConfig = { key: AssetSortKey; direction: 'asc' | 'desc' };

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

export type SelectOption = {
  value: string;
  label: string;
  secondary?: string;
};
