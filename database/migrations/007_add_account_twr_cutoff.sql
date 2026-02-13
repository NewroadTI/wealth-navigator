-- Migration 006: Add twr_cutoff_date to accounts table
-- Each account can have its own TWR inception date for separate tracking

-- Add twr_cutoff_date column to accounts table
ALTER TABLE accounts 
ADD COLUMN twr_cutoff_date DATE DEFAULT NULL;

COMMENT ON COLUMN accounts.twr_cutoff_date IS 'TWR calculation inception date for this account (contract/initial deposit date)';
