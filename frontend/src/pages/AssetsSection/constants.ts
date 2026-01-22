import { AssetFormState } from './types';

export const NONE_SELECT_VALUE = '__none__';

export const DEFAULT_ASSET_FORM_STATE: AssetFormState = {
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

export const PAGE_SIZE = 100;
export const MAX_ASSETS = 3000;
