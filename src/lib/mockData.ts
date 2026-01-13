// Mock data for WealthRoad MVP

export interface Portfolio {
  id: string;
  interfaceCode: string;
  name: string;
  type: 'Individual' | 'Corporate' | 'Joint';
  mainCurrency: string;
  country: string;
  benchmark: string;
  computePerformance: boolean;
  inceptionDate: string;
  status: 'Active' | 'Inactive' | 'Pending' | 'Closed';
  processingType: 'Full' | 'Custody';
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  ytdReturn: number;
  investor: {
    name: string;
    type: 'Individual' | 'Company';
    riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
  };
  advisor: string;
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  assetClass: 'Equity' | 'Fixed Income' | 'Funds' | 'Derivatives' | 'Cash' | 'Custom';
  assetType: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  currency: string;
  weight: number;
  sector?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal' | 'Dividend' | 'Interest' | 'Fee' | 'FX Trade';
  symbol?: string;
  description: string;
  quantity?: number;
  price?: number;
  amount: number;
  currency: string;
  status: 'Settled' | 'Pending' | 'Cancelled';
  account: string;
}

export interface CashBalance {
  currency: string;
  balance: number;
  usdEquivalent: number;
  fxRate: number;
}

export interface Advisor {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Sales Advisor' | 'Relationship Advisor' | 'Account Manager';
  portfoliosCount: number;
  aum: number;
}

// Sample Portfolios
export const portfolios: Portfolio[] = [
  {
    id: 'PF001',
    interfaceCode: 'WR-2024-001',
    name: 'Global Growth Portfolio',
    type: 'Individual',
    mainCurrency: 'USD',
    country: 'United States',
    benchmark: 'S&P 500',
    computePerformance: true,
    inceptionDate: '2022-01-15',
    status: 'Active',
    processingType: 'Full',
    totalValue: 2847532.45,
    dayChange: 12453.21,
    dayChangePercent: 0.44,
    ytdReturn: 8.72,
    investor: {
      name: 'James Morrison',
      type: 'Individual',
      riskLevel: 'Moderate',
    },
    advisor: 'Sarah Chen',
  },
  {
    id: 'PF002',
    interfaceCode: 'WR-2024-002',
    name: 'Conservative Income Fund',
    type: 'Corporate',
    mainCurrency: 'USD',
    country: 'United States',
    benchmark: 'Bloomberg US Agg',
    computePerformance: true,
    inceptionDate: '2021-06-01',
    status: 'Active',
    processingType: 'Full',
    totalValue: 5234891.12,
    dayChange: -8234.56,
    dayChangePercent: -0.16,
    ytdReturn: 3.45,
    investor: {
      name: 'Meridian Holdings LLC',
      type: 'Company',
      riskLevel: 'Conservative',
    },
    advisor: 'Michael Torres',
  },
  {
    id: 'PF003',
    interfaceCode: 'WR-2024-003',
    name: 'Tech Opportunities',
    type: 'Individual',
    mainCurrency: 'USD',
    country: 'Switzerland',
    benchmark: 'NASDAQ 100',
    computePerformance: true,
    inceptionDate: '2023-03-20',
    status: 'Active',
    processingType: 'Full',
    totalValue: 1523456.78,
    dayChange: 45678.90,
    dayChangePercent: 3.09,
    ytdReturn: 24.56,
    investor: {
      name: 'Elena Kowalski',
      type: 'Individual',
      riskLevel: 'Aggressive',
    },
    advisor: 'Sarah Chen',
  },
  {
    id: 'PF004',
    interfaceCode: 'WR-2024-004',
    name: 'Fixed Income Strategy',
    type: 'Joint',
    mainCurrency: 'EUR',
    country: 'Germany',
    benchmark: 'Euro Stoxx 50',
    computePerformance: true,
    inceptionDate: '2020-11-10',
    status: 'Pending',
    processingType: 'Custody',
    totalValue: 892345.67,
    dayChange: 1234.56,
    dayChangePercent: 0.14,
    ytdReturn: 2.89,
    investor: {
      name: 'Hans & Maria Weber',
      type: 'Individual',
      riskLevel: 'Conservative',
    },
    advisor: 'Michael Torres',
  },
];

// Sample Positions for Portfolio PF001
export const positions: Position[] = [
  {
    id: 'POS001',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 500,
    avgCost: 145.32,
    currentPrice: 189.45,
    marketValue: 94725.00,
    unrealizedPL: 22065.00,
    unrealizedPLPercent: 30.38,
    dayChange: 2.34,
    dayChangePercent: 1.25,
    currency: 'USD',
    weight: 3.33,
    sector: 'Technology',
  },
  {
    id: 'POS002',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 350,
    avgCost: 287.45,
    currentPrice: 378.92,
    marketValue: 132622.00,
    unrealizedPL: 32014.50,
    unrealizedPLPercent: 31.82,
    dayChange: -1.23,
    dayChangePercent: -0.32,
    currency: 'USD',
    weight: 4.66,
    sector: 'Technology',
  },
  {
    id: 'POS003',
    symbol: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    assetClass: 'Funds',
    assetType: 'ETF',
    quantity: 1200,
    avgCost: 198.56,
    currentPrice: 242.18,
    marketValue: 290616.00,
    unrealizedPL: 52344.00,
    unrealizedPLPercent: 21.97,
    dayChange: 0.87,
    dayChangePercent: 0.36,
    currency: 'USD',
    weight: 10.21,
    sector: 'Diversified',
  },
  {
    id: 'POS004',
    symbol: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    assetClass: 'Fixed Income',
    assetType: 'ETF',
    quantity: 800,
    avgCost: 78.34,
    currentPrice: 72.45,
    marketValue: 57960.00,
    unrealizedPL: -4712.00,
    unrealizedPLPercent: -7.52,
    dayChange: 0.12,
    dayChangePercent: 0.17,
    currency: 'USD',
    weight: 2.04,
    sector: 'Fixed Income',
  },
  {
    id: 'POS005',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 200,
    avgCost: 234.56,
    currentPrice: 875.34,
    marketValue: 175068.00,
    unrealizedPL: 128156.00,
    unrealizedPLPercent: 273.20,
    dayChange: 15.67,
    dayChangePercent: 1.82,
    currency: 'USD',
    weight: 6.15,
    sector: 'Technology',
  },
  {
    id: 'POS006',
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 400,
    avgCost: 142.78,
    currentPrice: 198.45,
    marketValue: 79380.00,
    unrealizedPL: 22268.00,
    unrealizedPLPercent: 39.00,
    dayChange: -0.89,
    dayChangePercent: -0.45,
    currency: 'USD',
    weight: 2.79,
    sector: 'Financials',
  },
];

// Sample Transactions
export const transactions: Transaction[] = [
  {
    id: 'TXN001',
    date: '2024-01-12',
    type: 'Buy',
    symbol: 'AAPL',
    description: 'Buy 50 shares AAPL @ $187.50',
    quantity: 50,
    price: 187.50,
    amount: -9375.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN002',
    date: '2024-01-11',
    type: 'Dividend',
    symbol: 'MSFT',
    description: 'Quarterly dividend - Microsoft Corp',
    amount: 245.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN003',
    date: '2024-01-10',
    type: 'Deposit',
    description: 'Wire transfer from JP Morgan',
    amount: 50000.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN004',
    date: '2024-01-09',
    type: 'Sell',
    symbol: 'VTI',
    description: 'Sell 100 shares VTI @ $240.25',
    quantity: 100,
    price: 240.25,
    amount: 24025.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN005',
    date: '2024-01-08',
    type: 'FX Trade',
    description: 'Convert EUR 10,000 to USD @ 1.0923',
    amount: 10923.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN006',
    date: '2024-01-08',
    type: 'Fee',
    description: 'Management Fee Q4 2023',
    amount: -2847.53,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
];

// Cash Balances
export const cashBalances: CashBalance[] = [
  { currency: 'USD', balance: 234567.89, usdEquivalent: 234567.89, fxRate: 1.0000 },
  { currency: 'EUR', balance: 45678.90, usdEquivalent: 49876.54, fxRate: 1.0919 },
  { currency: 'GBP', balance: 12345.67, usdEquivalent: 15678.90, fxRate: 1.2700 },
  { currency: 'CHF', balance: 8765.43, usdEquivalent: 10234.56, fxRate: 1.1676 },
];

// Advisors
export const advisors: Advisor[] = [
  {
    id: 'ADV001',
    name: 'Sarah Chen',
    email: 'sarah.chen@newroad.com',
    phone: '+1 (555) 123-4567',
    role: 'Relationship Advisor',
    portfoliosCount: 12,
    aum: 45678901.23,
  },
  {
    id: 'ADV002',
    name: 'Michael Torres',
    email: 'michael.torres@newroad.com',
    phone: '+1 (555) 234-5678',
    role: 'Sales Advisor',
    portfoliosCount: 8,
    aum: 32456789.45,
  },
  {
    id: 'ADV003',
    name: 'Jennifer Williams',
    email: 'jennifer.williams@newroad.com',
    phone: '+1 (555) 345-6789',
    role: 'Account Manager',
    portfoliosCount: 15,
    aum: 67890123.67,
  },
];

// Dashboard summary stats
export const dashboardStats = {
  totalAUM: 10498225.02,
  totalPortfolios: 4,
  activePortfolios: 3,
  pendingPortfolios: 1,
  dayChange: 51131.11,
  dayChangePercent: 0.49,
  monthChange: 312456.78,
  monthChangePercent: 3.07,
  ytdReturn: 8.24,
};

// Asset allocation for charts
export const assetAllocation = [
  { name: 'Equities', value: 55, color: 'hsl(168, 76%, 42%)' },
  { name: 'Fixed Income', value: 20, color: 'hsl(43, 96%, 56%)' },
  { name: 'Funds', value: 15, color: 'hsl(280, 65%, 60%)' },
  { name: 'Cash', value: 8, color: 'hsl(200, 80%, 50%)' },
  { name: 'Alternatives', value: 2, color: 'hsl(340, 75%, 55%)' },
];

// Performance data for charts
export const performanceData = [
  { month: 'Jan', portfolio: 2.1, benchmark: 1.8 },
  { month: 'Feb', portfolio: -0.5, benchmark: -0.8 },
  { month: 'Mar', portfolio: 1.8, benchmark: 2.1 },
  { month: 'Apr', portfolio: 0.9, benchmark: 0.5 },
  { month: 'May', portfolio: 2.4, benchmark: 1.9 },
  { month: 'Jun', portfolio: 1.2, benchmark: 1.5 },
  { month: 'Jul', portfolio: 3.1, benchmark: 2.8 },
  { month: 'Aug', portfolio: -0.3, benchmark: -0.1 },
  { month: 'Sep', portfolio: 1.6, benchmark: 1.2 },
  { month: 'Oct', portfolio: -1.2, benchmark: -1.5 },
  { month: 'Nov', portfolio: 2.8, benchmark: 2.4 },
  { month: 'Dec', portfolio: 1.5, benchmark: 1.1 },
];
