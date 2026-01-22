import { AssetFormState } from './types';

/**
 * Normaliza un valor string a number o null
 */
export const normalizeNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Extrae el mensaje de error de la respuesta del API
 */
export const getErrorMessage = (errorData: any, fallback: string): string => {
  if (!errorData) {
    return fallback;
  }
  if (typeof errorData.detail === 'string') {
    return errorData.detail;
  }
  if (Array.isArray(errorData.detail) && errorData.detail.length > 0 && errorData.detail[0]?.msg) {
    return errorData.detail[0].msg;
  }
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }
  return fallback;
};

/**
 * Formatea un valor decimal para mostrar (asegura que enteros tengan .0)
 */
export const formatDecimalValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return String(value);
  }
  return Number.isInteger(parsed) ? parsed.toFixed(1) : String(parsed);
};

/**
 * Construye el payload para crear/actualizar un asset
 */
export const buildAssetPayload = (formState: AssetFormState) => {
  const normalizedPutCall = formState.put_call.trim();
  return {
    symbol: formState.symbol.trim(),
    name: formState.name.trim() || null,
    description: formState.description.trim() || null,
    isin: formState.isin.trim() || null,
    figi: formState.figi.trim() || null,
    cusip: formState.cusip.trim() || null,
    class_id: Number(formState.class_id),
    sub_class_id: formState.sub_class_id ? Number(formState.sub_class_id) : null,
    industry_code: formState.industry_code.trim() ? formState.industry_code.trim().toUpperCase() : null,
    country_code: formState.country_code.trim() ? formState.country_code.trim().toUpperCase() : null,
    currency: formState.currency.trim() ? formState.currency.trim().toUpperCase() : null,
    multiplier: normalizeNumber(formState.multiplier),
    contract_size: normalizeNumber(formState.contract_size),
    underlying_symbol: formState.underlying_symbol.trim() || null,
    strike_price: normalizeNumber(formState.strike_price),
    expiry_date: formState.expiry_date || null,
    put_call: normalizedPutCall && normalizedPutCall !== '-' ? normalizedPutCall : null,
    maturity_date: formState.maturity_date || null,
    coupon_rate: normalizeNumber(formState.coupon_rate),
    issuer: formState.issuer.trim() || null,
    initial_fixing_date: formState.initial_fixing_date || null,
    next_autocall_date: formState.next_autocall_date || null,
    next_coupon_payment_date: formState.next_coupon_payment_date || null,
    autocall_trigger: normalizeNumber(formState.autocall_trigger),
    coupon_trigger: normalizeNumber(formState.coupon_trigger),
    capital_barrier: normalizeNumber(formState.capital_barrier),
    protection_level: normalizeNumber(formState.protection_level),
    payment_frequency: formState.payment_frequency.trim() || null,
  };
};
