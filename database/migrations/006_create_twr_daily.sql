-- Migration 005: Create twr_daily table and add twr_cutoff_date to portfolios
-- ===========================================================================
-- TWR (Time-Weighted Return) daily tracking table.
-- Stores daily NAV snapshots plus cash flow sums for TWR calculation.

BEGIN;

-- 1) Create twr_daily table
CREATE TABLE IF NOT EXISTS twr_daily (
    twr_daily_id    SERIAL PRIMARY KEY,
    account_id      INTEGER NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    nav             NUMERIC,                  -- Total NAV from NLV_HISTORY CSV (column "Total")
    sum_cash_journal NUMERIC DEFAULT 0,       -- Sum of cash_journal amounts for TWR-relevant types on this date
    twr             NUMERIC,                  -- Calculated TWR (cumulative from initial_hp_date)
    hp              NUMERIC,                  -- Holding-period return for this single day
    initial_hp_date DATE,                     -- Start date for the current TWR calculation window
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    -- One record per account per day
    CONSTRAINT uq_twr_daily_account_date UNIQUE (account_id, date)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_twr_daily_account_date ON twr_daily (account_id, date);
CREATE INDEX IF NOT EXISTS idx_twr_daily_date ON twr_daily (date);

-- 2) Add twr_cutoff_date to portfolios (the "contract renewal" date)
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS twr_cutoff_date DATE;

COMMIT;
