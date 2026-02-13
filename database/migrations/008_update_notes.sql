-- Migration: Recreate structured_notes table and update assets schema
-- Replicates logic from backend/seed_data/update_schema.py

-- 1. DROP structured_notes table to recreate with new schema
DROP TABLE IF EXISTS structured_notes CASCADE;

-- 2. Create structured_notes table with updated schema
CREATE TABLE structured_notes (
    note_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(asset_id),
    isin VARCHAR NOT NULL,
    upload_date DATE NOT NULL,
    
    -- Inception fields
    dealer VARCHAR,
    code VARCHAR,
    status VARCHAR,
    product_type VARCHAR,
    issuer VARCHAR,
    custodian VARCHAR,
    advisor VARCHAR,
    nominal NUMERIC,
    size DOUBLE PRECISION,
    
    -- Underlyings
    underlyings JSONB,
    
    -- Dates
    maturity_date DATE,
    issue_date DATE,
    strike_date DATE,
    last_autocall_obs DATE,
    next_autocall_obs DATE,
    next_coupon_obs DATE,
    next_payment_date DATE,
    
    -- Coupon data                                  bro, ya escribiste tus cartitas?                                
    coupon_annual_pct NUMERIC,
    coupon_periodic_pct NUMERIC,
    coupon_annual_amount NUMERIC,
    coupon_periodic_amount NUMERIC,
    coupon_type VARCHAR,
    
    -- Barriers & Triggers
    cap_pct NUMERIC,
    capital_protected_pct NUMERIC,
    autocall_trigger NUMERIC,
    step_down NUMERIC,
    autocall_obs_count NUMERIC,
    protection_barrier NUMERIC,
    coupon_barrier NUMERIC,
    
    -- Observation frequency
    observation_frequency VARCHAR,
    
    -- Additional fields
    termsheet VARCHAR,
    termsheet_url VARCHAR,
    coupons_paid_count NUMERIC,
    coupons_paid_amount NUMERIC,
    gross_yield_pct NUMERIC,
    
    -- AIS-only fields
    bid NUMERIC,
    ask NUMERIC,
    
    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT uq_structured_notes_isin_date UNIQUE (isin, upload_date)
);

-- Indices
CREATE INDEX ix_structured_notes_note_id ON structured_notes (note_id);
CREATE INDEX ix_structured_notes_isin ON structured_notes (isin);
CREATE INDEX ix_structured_notes_upload_date ON structured_notes (upload_date);
CREATE INDEX ix_structured_notes_status ON structured_notes (status);


-- 3. MIGRATION: ASSETS -> COUNTRIES
DO $$ 
BEGIN 
    -- Add constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_countries') THEN 
        ALTER TABLE assets 
        ADD CONSTRAINT fk_assets_countries 
        FOREIGN KEY (country_code) 
        REFERENCES countries (iso_code);
    END IF; 
END $$;


-- 4. MIGRATION: ASSETS -> INDUSTRIES
DO $$ 
BEGIN 
    -- A. Add column industry_code if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='industry_code') THEN 
        ALTER TABLE assets ADD COLUMN industry_code VARCHAR;
    END IF; 

    -- B. Add FK Constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_industries') THEN 
        ALTER TABLE assets 
        ADD CONSTRAINT fk_assets_industries 
        FOREIGN KEY (industry_code) 
        REFERENCES industries (industry_code);
    END IF; 
END $$;


-- 5. MIGRATION: ASSETS -> INVIU_CODE
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='inviu_code') THEN 
        ALTER TABLE assets ADD COLUMN inviu_code VARCHAR;
    END IF; 
END $$;