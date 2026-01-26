// Shared types for BasicData sections

export type ExchangeApi = {
    exchange_code: string;
    name: string;
    country_code?: string | null;
};

export type CountryApi = {
    iso_code: string;
    name?: string | null;
};

export type IndustryApi = {
    industry_code: string;
    name: string;
    sector?: string | null;
};

export type IndexApi = {
    index_code: string;
    name: string;
    country_code?: string | null;
    exchange_code?: string | null;
};

export type CurrencyApi = {
    code: string;
    name: string;
};

export type AssetSubClassApi = {
    sub_class_id?: number;
    code: string;
    name: string;
};

export type AssetClassApi = {
    class_id: number;
    code: string;
    name: string;
    description?: string | null;
    sub_classes: AssetSubClassApi[];
};

export type InvestmentStrategyApi = {
    strategy_id: number;
    name: string;
    description?: string | null;
};

export type SortConfig = { key: string; direction: 'asc' | 'desc' };
