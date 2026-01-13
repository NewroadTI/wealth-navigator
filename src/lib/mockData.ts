// Mock data for WealthRoad MVP

export interface Account {
  id: string;
  institution: string;
  accountCode: string;
  accountName: string;
  accountType: 'Brokerage' | 'Bank';
  currency: string;
  balance: number;
  costMethod: 'FIFO' | 'Average Cost';
}

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
    email?: string;
    phone?: string;
    taxId?: string;
    clientSince?: string;
  };
  advisor: string;
  accounts: Account[];
}

export interface Position {
  id: string;
  portfolioId: string;
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
  portfolioId: string;
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
  assetClass?: 'Equity' | 'Fixed Income' | 'Funds' | 'Derivatives' | 'Cash' | 'Custom';
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

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: 'Equity' | 'Fixed Income' | 'Funds' | 'Derivatives' | 'Custom';
  assetType: string;
  currency: string;
  exchange?: string;
  isin?: string;
  cusip?: string;
  sector?: string;
  // Equity specific
  dividendYield?: number;
  // Fixed Income specific
  coupon?: number;
  maturityDate?: string;
  faceValue?: number;
  rating?: string;
  // Fund specific
  expenseRatio?: number;
  // Derivative specific
  strikePrice?: number;
  expirationDate?: string;
  underlyingAsset?: string;
  optionType?: 'Call' | 'Put';
}

// Sample Portfolios with accounts
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
      email: 'james.morrison@email.com',
      phone: '+1 (555) 123-4567',
      taxId: '***-**-1234',
      clientSince: '2022-01-15',
    },
    advisor: 'Sarah Chen',
    accounts: [
      { id: 'ACC001', institution: 'Interactive Brokers', accountCode: 'IB-001', accountName: 'Main Brokerage USD', accountType: 'Brokerage', currency: 'USD', balance: 234567.89, costMethod: 'FIFO' },
      { id: 'ACC002', institution: 'Interactive Brokers', accountCode: 'IB-002', accountName: 'EUR Sub-account', accountType: 'Brokerage', currency: 'EUR', balance: 45678.90, costMethod: 'FIFO' },
      { id: 'ACC003', institution: 'JP Morgan', accountCode: 'JPM-001', accountName: 'Cash Account', accountType: 'Bank', currency: 'USD', balance: 50000.00, costMethod: 'Average Cost' },
    ],
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
      email: 'treasury@meridian.com',
      phone: '+1 (555) 234-5678',
      taxId: '12-3456789',
      clientSince: '2021-06-01',
    },
    advisor: 'Michael Torres',
    accounts: [
      { id: 'ACC004', institution: 'Pershing', accountCode: 'PSH-001', accountName: 'Corporate Custody', accountType: 'Brokerage', currency: 'USD', balance: 523489.12, costMethod: 'FIFO' },
      { id: 'ACC005', institution: 'UBS', accountCode: 'UBS-001', accountName: 'CHF Reserve', accountType: 'Bank', currency: 'CHF', balance: 125000.00, costMethod: 'Average Cost' },
    ],
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
      email: 'elena.kowalski@email.com',
      phone: '+41 78 123 4567',
      taxId: 'CHE-123.456.789',
      clientSince: '2023-03-20',
    },
    advisor: 'Sarah Chen',
    accounts: [
      { id: 'ACC006', institution: 'Interactive Brokers', accountCode: 'IB-003', accountName: 'Tech Portfolio', accountType: 'Brokerage', currency: 'USD', balance: 152345.67, costMethod: 'FIFO' },
      { id: 'ACC007', institution: 'Credit Suisse', accountCode: 'CS-001', accountName: 'Swiss Account', accountType: 'Bank', currency: 'CHF', balance: 80000.00, costMethod: 'Average Cost' },
      { id: 'ACC008', institution: 'Interactive Brokers', accountCode: 'IB-004', accountName: 'GBP Account', accountType: 'Bank', currency: 'GBP', balance: 25000.00, costMethod: 'Average Cost' },
    ],
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
      email: 'weber.family@email.de',
      phone: '+49 30 123 4567',
      taxId: 'DE-123456789',
      clientSince: '2020-11-10',
    },
    advisor: 'Michael Torres',
    accounts: [
      { id: 'ACC009', institution: 'Deutsche Bank', accountCode: 'DB-001', accountName: 'EUR Custody', accountType: 'Brokerage', currency: 'EUR', balance: 89234.56, costMethod: 'Average Cost' },
    ],
  },
];

// Sample Positions linked to portfolios
export const positions: Position[] = [
  // PF001 - Global Growth Portfolio
  {
    id: 'POS001',
    portfolioId: 'PF001',
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
    portfolioId: 'PF001',
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
    portfolioId: 'PF001',
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
    portfolioId: 'PF001',
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
  // PF002 - Conservative Income Fund
  {
    id: 'POS005',
    portfolioId: 'PF002',
    symbol: 'AGG',
    name: 'iShares Core US Aggregate Bond',
    assetClass: 'Fixed Income',
    assetType: 'ETF',
    quantity: 5000,
    avgCost: 102.45,
    currentPrice: 98.23,
    marketValue: 491150.00,
    unrealizedPL: -21100.00,
    unrealizedPLPercent: -4.12,
    dayChange: 0.08,
    dayChangePercent: 0.08,
    currency: 'USD',
    weight: 9.38,
    sector: 'Fixed Income',
  },
  {
    id: 'POS006',
    portfolioId: 'PF002',
    symbol: 'LQD',
    name: 'iShares iBoxx $ Investment Grade Corp',
    assetClass: 'Fixed Income',
    assetType: 'ETF',
    quantity: 3000,
    avgCost: 115.67,
    currentPrice: 108.45,
    marketValue: 325350.00,
    unrealizedPL: -21660.00,
    unrealizedPLPercent: -6.24,
    dayChange: 0.15,
    dayChangePercent: 0.14,
    currency: 'USD',
    weight: 6.22,
    sector: 'Fixed Income',
  },
  {
    id: 'POS007',
    portfolioId: 'PF002',
    symbol: 'JNJ',
    name: 'Johnson & Johnson',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 1500,
    avgCost: 152.34,
    currentPrice: 158.90,
    marketValue: 238350.00,
    unrealizedPL: 9840.00,
    unrealizedPLPercent: 4.31,
    dayChange: -0.45,
    dayChangePercent: -0.28,
    currency: 'USD',
    weight: 4.55,
    sector: 'Healthcare',
  },
  // PF003 - Tech Opportunities
  {
    id: 'POS008',
    portfolioId: 'PF003',
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
    weight: 11.49,
    sector: 'Technology',
  },
  {
    id: 'POS009',
    portfolioId: 'PF003',
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 800,
    avgCost: 95.45,
    currentPrice: 178.90,
    marketValue: 143120.00,
    unrealizedPL: 66760.00,
    unrealizedPLPercent: 87.45,
    dayChange: 3.45,
    dayChangePercent: 1.97,
    currency: 'USD',
    weight: 9.40,
    sector: 'Technology',
  },
  {
    id: 'POS010',
    portfolioId: 'PF003',
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    assetClass: 'Equity',
    assetType: 'Common Stock',
    quantity: 300,
    avgCost: 245.67,
    currentPrice: 198.45,
    marketValue: 59535.00,
    unrealizedPL: -14166.00,
    unrealizedPLPercent: -19.22,
    dayChange: -5.23,
    dayChangePercent: -2.57,
    currency: 'USD',
    weight: 3.91,
    sector: 'Automotive',
  },
  // PF004 - Fixed Income Strategy
  {
    id: 'POS011',
    portfolioId: 'PF004',
    symbol: 'DE10Y',
    name: 'German 10Y Government Bond',
    assetClass: 'Fixed Income',
    assetType: 'Government Bond',
    quantity: 500000,
    avgCost: 99.45,
    currentPrice: 97.23,
    marketValue: 486150.00,
    unrealizedPL: -11100.00,
    unrealizedPLPercent: -2.23,
    dayChange: 0.05,
    dayChangePercent: 0.05,
    currency: 'EUR',
    weight: 54.48,
    sector: 'Government',
  },
  {
    id: 'POS012',
    portfolioId: 'PF004',
    symbol: 'EUNA',
    name: 'iShares Core MSCI Europe',
    assetClass: 'Funds',
    assetType: 'ETF',
    quantity: 2000,
    avgCost: 65.34,
    currentPrice: 68.90,
    marketValue: 137800.00,
    unrealizedPL: 7120.00,
    unrealizedPLPercent: 5.45,
    dayChange: 0.23,
    dayChangePercent: 0.33,
    currency: 'EUR',
    weight: 15.44,
    sector: 'Diversified',
  },
];

// Sample Transactions linked to portfolios
export const transactions: Transaction[] = [
  {
    id: 'TXN001',
    portfolioId: 'PF001',
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
    assetClass: 'Equity',
  },
  {
    id: 'TXN002',
    portfolioId: 'PF001',
    date: '2024-01-11',
    type: 'Dividend',
    symbol: 'MSFT',
    description: 'Quarterly dividend - Microsoft Corp',
    amount: 245.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
    assetClass: 'Equity',
  },
  {
    id: 'TXN003',
    portfolioId: 'PF001',
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
    portfolioId: 'PF001',
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
    assetClass: 'Funds',
  },
  {
    id: 'TXN005',
    portfolioId: 'PF001',
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
    portfolioId: 'PF001',
    date: '2024-01-08',
    type: 'Fee',
    description: 'Management Fee Q4 2023',
    amount: -2847.53,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-001',
  },
  {
    id: 'TXN007',
    portfolioId: 'PF002',
    date: '2024-01-11',
    type: 'Buy',
    symbol: 'AGG',
    description: 'Buy 500 shares AGG @ $98.15',
    quantity: 500,
    price: 98.15,
    amount: -49075.00,
    currency: 'USD',
    status: 'Settled',
    account: 'PSH-001',
    assetClass: 'Fixed Income',
  },
  {
    id: 'TXN008',
    portfolioId: 'PF002',
    date: '2024-01-10',
    type: 'Interest',
    description: 'Bond interest payment - LQD',
    amount: 3450.00,
    currency: 'USD',
    status: 'Settled',
    account: 'PSH-001',
    assetClass: 'Fixed Income',
  },
  {
    id: 'TXN009',
    portfolioId: 'PF003',
    date: '2024-01-12',
    type: 'Buy',
    symbol: 'NVDA',
    description: 'Buy 25 shares NVDA @ $865.00',
    quantity: 25,
    price: 865.00,
    amount: -21625.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-003',
    assetClass: 'Equity',
  },
  {
    id: 'TXN010',
    portfolioId: 'PF003',
    date: '2024-01-11',
    type: 'Sell',
    symbol: 'TSLA',
    description: 'Sell 50 shares TSLA @ $205.30',
    quantity: 50,
    price: 205.30,
    amount: 10265.00,
    currency: 'USD',
    status: 'Settled',
    account: 'IB-003',
    assetClass: 'Equity',
  },
  {
    id: 'TXN011',
    portfolioId: 'PF004',
    date: '2024-01-10',
    type: 'Interest',
    description: 'German 10Y Bond coupon payment',
    amount: 12500.00,
    currency: 'EUR',
    status: 'Settled',
    account: 'DB-001',
    assetClass: 'Fixed Income',
  },
];

// Sample Assets catalog
export const assets: Asset[] = [
  { id: 'AST001', symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'Equity', assetType: 'Common Stock', currency: 'USD', exchange: 'NASDAQ', isin: 'US0378331005', sector: 'Technology', dividendYield: 0.52 },
  { id: 'AST002', symbol: 'MSFT', name: 'Microsoft Corporation', assetClass: 'Equity', assetType: 'Common Stock', currency: 'USD', exchange: 'NASDAQ', isin: 'US5949181045', sector: 'Technology', dividendYield: 0.74 },
  { id: 'AST003', symbol: 'NVDA', name: 'NVIDIA Corporation', assetClass: 'Equity', assetType: 'Common Stock', currency: 'USD', exchange: 'NASDAQ', isin: 'US67066G1040', sector: 'Technology', dividendYield: 0.03 },
  { id: 'AST004', symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: 'Funds', assetType: 'ETF', currency: 'USD', exchange: 'NYSE', isin: 'US9229087690', expenseRatio: 0.03 },
  { id: 'AST005', symbol: 'AGG', name: 'iShares Core US Aggregate Bond', assetClass: 'Fixed Income', assetType: 'ETF', currency: 'USD', exchange: 'NYSE', isin: 'US4642872349' },
  { id: 'AST006', symbol: 'DE10Y', name: 'German 10Y Government Bond', assetClass: 'Fixed Income', assetType: 'Government Bond', currency: 'EUR', coupon: 2.50, maturityDate: '2034-02-15', faceValue: 1000, rating: 'AAA' },
  { id: 'AST007', symbol: 'AAPL-C-200', name: 'AAPL Call 200 Mar 2024', assetClass: 'Derivatives', assetType: 'Option', currency: 'USD', strikePrice: 200, expirationDate: '2024-03-15', underlyingAsset: 'AAPL', optionType: 'Call' },
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
  { name: 'Equities', value: 55, color: 'hsl(220, 82%, 44%)' },
  { name: 'Fixed Income', value: 20, color: 'hsl(38, 70%, 55%)' },
  { name: 'Funds', value: 15, color: 'hsl(215, 76%, 56%)' },
  { name: 'Cash', value: 8, color: 'hsl(25, 60%, 60%)' },
  { name: 'Alternatives', value: 2, color: 'hsl(210, 60%, 50%)' },
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

// Helper functions
export const getPortfolioPositions = (portfolioId: string) => 
  positions.filter(p => p.portfolioId === portfolioId);

export const getPortfolioTransactions = (portfolioId: string) => 
  transactions.filter(t => t.portfolioId === portfolioId);

export const getPortfolioById = (id: string) => 
  portfolios.find(p => p.id === id);

export const getPositionsByAssetClass = (portfolioId: string, assetClass: string) => 
  positions.filter(p => p.portfolioId === portfolioId && p.assetClass === assetClass);

export const getTransactionsByAssetClass = (portfolioId: string, assetClass: string) => 
  transactions.filter(t => t.portfolioId === portfolioId && t.assetClass === assetClass);