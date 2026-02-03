-- Migration: Add missing columns to existing tables
-- This script is idempotent - can be run multiple times safely

-- Add external_transaction_id to cash_journal if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_journal' 
        AND column_name = 'external_transaction_id'
    ) THEN
        ALTER TABLE cash_journal 
        ADD COLUMN external_transaction_id VARCHAR UNIQUE;
        
        CREATE INDEX IF NOT EXISTS idx_cash_journal_external_transaction_id 
        ON cash_journal(external_transaction_id);
        
        RAISE NOTICE 'Added external_transaction_id to cash_journal';
    ELSE
        RAISE NOTICE 'Column external_transaction_id already exists in cash_journal';
    END IF;
END $$;

-- Add action_id to cash_journal if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_journal' 
        AND column_name = 'action_id'
    ) THEN
        ALTER TABLE cash_journal 
        ADD COLUMN action_id VARCHAR;
        
        RAISE NOTICE 'Added action_id to cash_journal';
    ELSE
        RAISE NOTICE 'Column action_id already exists in cash_journal';
    END IF;
END $$;

-- Add any other missing columns for future migrations below
-- Example:
-- DO $$ 
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM information_schema.columns 
--         WHERE table_name = 'your_table' 
--         AND column_name = 'your_column'
--     ) THEN
--         ALTER TABLE your_table ADD COLUMN your_column VARCHAR;
--         RAISE NOTICE 'Added your_column to your_table';
--     END IF;
-- END $$;

-- Migration completed
SELECT 'Migration 001 completed successfully' AS status;
