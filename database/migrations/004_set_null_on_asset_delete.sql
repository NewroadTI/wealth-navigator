-- Migration to set NULL on asset_id when an asset is deleted
-- This allows deleting assets without violating foreign key constraints

-- Drop existing foreign key constraints and recreate them with ON DELETE SET NULL

-- Trades table
ALTER TABLE trades 
DROP CONSTRAINT IF EXISTS trades_asset_id_fkey;

ALTER TABLE trades 
ADD CONSTRAINT trades_asset_id_fkey 
FOREIGN KEY (asset_id) 
REFERENCES assets(asset_id) 
ON DELETE SET NULL;

-- Positions table
ALTER TABLE positions 
DROP CONSTRAINT IF EXISTS positions_asset_id_fkey;

ALTER TABLE positions 
ADD CONSTRAINT positions_asset_id_fkey 
FOREIGN KEY (asset_id) 
REFERENCES assets(asset_id) 
ON DELETE SET NULL;

-- Cash Journal table
ALTER TABLE cash_journal 
DROP CONSTRAINT IF EXISTS cash_journal_asset_id_fkey;

ALTER TABLE cash_journal 
ADD CONSTRAINT cash_journal_asset_id_fkey 
FOREIGN KEY (asset_id) 
REFERENCES assets(asset_id) 
ON DELETE SET NULL;

-- Corporate Actions table
ALTER TABLE corporate_actions 
DROP CONSTRAINT IF EXISTS corporate_actions_asset_id_fkey;

ALTER TABLE corporate_actions 
ADD CONSTRAINT corporate_actions_asset_id_fkey 
FOREIGN KEY (asset_id) 
REFERENCES assets(asset_id) 
ON DELETE SET NULL;

-- Market Prices table -這個可能需要 CASCADE 而不是 SET NULL
-- 因為沒有 asset_id 的市場價格沒有意義
ALTER TABLE market_prices 
DROP CONSTRAINT IF EXISTS market_prices_asset_id_fkey;

ALTER TABLE market_prices 
ADD CONSTRAINT market_prices_asset_id_fkey 
FOREIGN KEY (asset_id) 
REFERENCES assets(asset_id) 
ON DELETE CASCADE;
