// API client configuration and services
import { getApiBaseUrl } from './config';
import { forceHttpsApiUrl, safeFetch } from './force-https';

// Helper function to get API base URL - ensures runtime evaluation
const getBaseUrl = () => forceHttpsApiUrl(); // Use hardcoded HTTPS

// API_BASE_URL is centrally configured in src/lib/config.ts

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
    const response = await safeFetch(`${getBaseUrl()}/api/v1/catalogs/asset-classes`);
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
    const response = await safeFetch(`${getBaseUrl()}/api/v1/assets/${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error('Failed to fetch assets');
    }
    return response.json();
  },

  async getAssetById(assetId: number): Promise<AssetApi> {
    const response = await safeFetch(`${getBaseUrl()}/api/v1/assets/${assetId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset ${assetId}`);
    }
    return response.json();
  },
};

// User interface
export interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  tax_id: string;
  entity_type: string;
  is_active: number;
  created_at: string;
  role_id: number;
}

// Portfolio Simple interface (for dropdowns)
export interface PortfolioSimple {
  portfolio_id: number;
  owner_user_id: number;
  interface_code: string;
  name: string;
  main_currency: string;
  residence_country: string;
  inception_date: string;
  active_status: boolean;
}

// Portfolio interface
export interface Portfolio {
  portfolio_id: number;
  owner_user_id: number;
  interface_code: string;
  name: string;
  type: string;
  main_currency: string;
  residence_country: string;
  inception_date: string;
  active_status: number;
}

// Account interface
export interface Account {
  account_id: number;
  portfolio_id: number;
  institution: string;
  account_code: string;
  account_alias: string;
  account_type: string;
  currency: string;
}

// Transaction interfaces
export interface Trade {
  ib_exec_id: string | null;
  ib_transaction_id: string | null;
  ib_order_id: string | null;
  trade_date: string;
  settlement_date: string | null;
  report_date: string | null;
  transaction_type: string | null;
  side: string;
  exchange: string | null;
  quantity: string;
  price: string;
  gross_amount: string;
  net_amount: string | null;
  proceeds: string | null;
  commission: string | null;
  tax: string | null;
  cost_basis: string | null;
  realized_pnl: string | null;
  mtm_pnl: string | null;
  currency: string;
  description: string;
  notes: string | null;
  transaction_id: number;
  account_id: number;
  asset_id: number;
}

export interface CashJournal {
  date: string;
  ex_date: string | null;
  type: string;
  amount: string;
  currency: string;
  quantity: string | null;
  rate_per_share: string | null;
  description: string;
  reference_code: string | null;
  extra_details: Record<string, any> | null;
  journal_id: number;
  account_id: number;
  asset_id: number | null;
}

export interface FxTransaction {
  trade_date: string;
  source_currency: string;
  source_amount: string;
  target_currency: string;
  target_amount: string;
  side: string;
  exchange_rate: string;
  external_id: string;
  fx_id: number;
  account_id: number;
  target_account_id: number;
}

export interface CorporateAction {
  ib_action_id: string | null;
  transaction_id: string | null;
  action_type: string;
  report_date: string;
  execution_date: string;
  description: string;
  ratio_old: string | null;
  ratio_new: string | null;
  quantity_adjustment: string;
  symbol: string | null;
  isin: string | null;
  amount: string | null;
  proceeds: string | null;
  value: string | null;
  fifo_pnl_realized: string | null;
  currency: string | null;
  action_id: number;
  account_id: number;
  asset_id: number | null;
}

// Transactions API
export const transactionsApi = {
  async getTrades(skip: number = 0, limit: number = 100, accountId?: number): Promise<Trade[]> {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (accountId !== undefined) {
      params.set('account_id', String(accountId));
    }
    const response = await safeFetch(`${getBaseUrl()}/api/v1/transactions/trades?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch trades');
    }
    return response.json();
  },

  async getCashJournal(skip: number = 0, limit: number = 100, accountId?: number, type?: string): Promise<CashJournal[]> {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (accountId !== undefined) {
      params.set('account_id', String(accountId));
    }
    if (type !== undefined) {
      params.set('type', type);
    }
    const response = await safeFetch(`${getBaseUrl()}/api/v1/transactions/cash-journal?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch cash journal');
    }
    return response.json();
  },

  async getFxTransactions(skip: number = 0, limit: number = 100, accountId?: number): Promise<FxTransaction[]> {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (accountId !== undefined) {
      params.set('account_id', String(accountId));
    }
    const response = await safeFetch(`${getBaseUrl()}/api/v1/transactions/fx-transactions?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch FX transactions');
    }
    return response.json();
  },

  async getCorporateActions(skip: number = 0, limit: number = 100, accountId?: number): Promise<CorporateAction[]> {
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (accountId !== undefined) {
      params.set('account_id', String(accountId));
    }
    const response = await safeFetch(`${getBaseUrl()}/api/v1/transactions/corporate-actions?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch corporate actions');
    }
    return response.json();
  },
};

// Account API
export const accountsApi = {
  async getAccounts(): Promise<Account[]> {
    const response = await safeFetch(`${getBaseUrl()}/api/v1/accounts`);
    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }
    return response.json();
  },
};

// Users API
export const usersApi = {
  async getUsers(): Promise<User[]> {
    const response = await safeFetch(`${getBaseUrl()}/api/v1/users`);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },
};

// Portfolio API
export const portfoliosApi = {
  async getPortfolios(): Promise<Portfolio[]> {
    const response = await safeFetch(`${getBaseUrl()}/api/v1/portfolios`);
    if (!response.ok) {
      throw new Error('Failed to fetch portfolios');
    }
    return response.json();
  },

  async getPortfoliosSimple(options?: { skip?: number; limit?: number; active_only?: boolean }): Promise<PortfolioSimple[]> {
    const params = new URLSearchParams();
    if (options?.skip !== undefined) {
      params.set('skip', String(options.skip));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.active_only !== undefined) {
      params.set('active_only', String(options.active_only));
    }
    const query = params.toString();
    const response = await safeFetch(`${getBaseUrl()}/api/v1/portfolios/simple${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error('Failed to fetch portfolios simple');
    }
    return response.json();
  },
};

// Account Balance interface
export interface AccountBalance {
  account_id: number;
  balance: string;
  position_count: number;
}

// Position interface
export interface Position {
  position_id: number;
  account_id: number;
  asset_id: number;
  report_date: string;
  quantity: string;
  mark_price: string | null;
  position_value: string | null;
  cost_basis_money: string | null;
  cost_basis_price: string | null;
  open_price: string | null;
  fifo_pnl_unrealized: string | null;
  percent_of_nav: string | null;
  side: string | null;
  level_of_detail: string | null;
  open_date_time: string | null;
  vesting_date: string | null;
  accrued_interest: string | null;
  fx_rate_to_base: string | null;
  asset?: AssetApi | null;
}

// Positions API
export const positionsApi = {
  async getAccountBalances(accountIds?: number[]): Promise<AccountBalance[]> {
    const params = new URLSearchParams();
    if (accountIds?.length) {
      // backend expects repeated `account_id` query params (one per id)
      accountIds.forEach(id => params.append('account_ids', String(id)));
    }
    const query = params.toString();
    const response = await safeFetch(`${getBaseUrl()}/api/v1/positions/account-balances${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error('Failed to fetch account balances');
    }
    return response.json();
  },

  async get_positions(accountId?: number, skip: number = 0, limit: number = 100): Promise<Position[]> {
    const params = new URLSearchParams();
    if (accountId !== undefined) {
      params.set('account_id', String(accountId));
    }
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    const query = params.toString();
    const response = await safeFetch(`${getBaseUrl()}/api/v1/positions/${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error('Failed to fetch positions');
    }
    return response.json();
  },
  // Backwards-compatible camelCase alias used by some components
  async getPositions(accountId?: number, skip: number = 0, limit: number = 100): Promise<Position[]> {
    return this.get_positions(accountId, skip, limit);
  },
};
