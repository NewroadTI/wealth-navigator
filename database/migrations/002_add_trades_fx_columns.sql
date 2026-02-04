-- Migration: Add new columns to trades and fx_transactions tables
-- Date: 2026-02-03
-- Description: Add options fields to trades, add commission and identifiers to fx_transactions

-- =============================================
-- TRADES TABLE: Add options/derivatives columns
-- =============================================
ALTER TABLE trades ADD COLUMN IF NOT EXISTS multiplier NUMERIC DEFAULT NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS strike NUMERIC DEFAULT NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS expiry DATE DEFAULT NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS put_call VARCHAR(10) DEFAULT NULL;

-- =============================================
-- FX_TRANSACTIONS TABLE: Add commission and identifiers
-- =============================================
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS commission_currency CHAR(3) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS ib_transaction_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS ib_exec_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS ib_order_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS exchange VARCHAR(100) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(100) DEFAULT NULL;
ALTER TABLE fx_transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Create index for ib_transaction_id on fx_transactions
CREATE INDEX IF NOT EXISTS ix_fx_transactions_ib_transaction_id ON fx_transactions(ib_transaction_id);

-- Make external_id nullable (it was NOT NULL before, now it's optional)
ALTER TABLE fx_transactions ALTER COLUMN external_id DROP NOT NULL;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON COLUMN trades.multiplier IS 'Contract multiplier (100 for options)';
COMMENT ON COLUMN trades.strike IS 'Strike price for options';
COMMENT ON COLUMN trades.expiry IS 'Expiration date for options/futures';
COMMENT ON COLUMN trades.put_call IS 'C for Call, P for Put';

COMMENT ON COLUMN fx_transactions.commission IS 'IBCommission charged on the FX trade';
COMMENT ON COLUMN fx_transactions.commission_currency IS 'Currency of the commission (IBCommissionCurrency)';
COMMENT ON COLUMN fx_transactions.ib_transaction_id IS 'IBKR TransactionID for deduplication';
COMMENT ON COLUMN fx_transactions.ib_exec_id IS 'IBKR execution ID';
COMMENT ON COLUMN fx_transactions.ib_order_id IS 'IBKR order ID';
COMMENT ON COLUMN fx_transactions.exchange IS 'Exchange where FX trade was executed (IDEALFX, etc)';
COMMENT ON COLUMN fx_transactions.transaction_type IS 'Transaction type (ExchTrade, TradeCancel, etc)';
