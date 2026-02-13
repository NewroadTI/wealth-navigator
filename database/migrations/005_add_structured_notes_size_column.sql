DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'structured_notes'
          AND column_name = 'size'
    ) THEN
        ALTER TABLE structured_notes
        ADD COLUMN size DOUBLE PRECISION NULL;

        RAISE NOTICE 'Added size column to structured_notes';
    ELSE
        RAISE NOTICE 'Column size already exists in structured_notes';
    END IF;
END $$;
