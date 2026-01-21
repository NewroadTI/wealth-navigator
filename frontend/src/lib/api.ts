// API client configuration and services

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Asset Class and Sub-class interfaces
export interface AssetSubClass {
  sub_class_id: number;
  code: string;
  name: string;
}

export interface AssetClass {
  class_id: number;
  code: string;
  name: string;
  description: string | null;
  sub_classes: AssetSubClass[];
}

export interface AssetApi {
  asset_id: number;
  symbol: string;
  name?: string | null;
  description?: string | null;
  isin?: string | null;
  figi?: string | null;
  cusip?: string | null;
  ib_conid?: string | null;
  class_id?: number | null;
  sub_class_id?: number | null;
  industry_code?: string | null;
  country_code?: string | null;
  currency?: string | null;
  multiplier?: string | null;
  contract_size?: string | null;
  underlying_symbol?: string | null;
  strike_price?: string | null;
  expiry_date?: string | null;
  put_call?: string | null;
  maturity_date?: string | null;
  coupon_rate?: string | null;
  issuer?: string | null;
  product_category?: string | null;
  initial_fixing_date?: string | null;
  next_autocall_date?: string | null;
  next_coupon_payment_date?: string | null;
  autocall_trigger?: string | null;
  coupon_trigger?: string | null;
  capital_barrier?: string | null;
  protection_level?: string | null;
  payment_frequency?: string | null;
  structured_note_details?: string | null;
  is_active?: boolean | null;
}

// Catalogs API
export const catalogsApi = {
  async getAssetClasses(): Promise<AssetClass[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/catalogs/asset-classes`);
    if (!response.ok) {
      throw new Error('Failed to fetch asset classes');
    }
    return response.json();
  },
};

export const assetsApi = {
  async getAssets(options?: { skip?: number; limit?: number }): Promise<AssetApi[]> {
    const params = new URLSearchParams();
    if (options?.skip !== undefined) {
      params.set('skip', String(options.skip));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/api/v1/assets/${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error('Failed to fetch assets');
    }
    return response.json();
  },
};
