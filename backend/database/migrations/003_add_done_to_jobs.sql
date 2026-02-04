-- Migration: Add 'done' column to etl_job_logs
-- This tracks whether a job has been reviewed/acknowledged by the user

ALTER TABLE etl_job_logs 
ADD COLUMN done BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster filtering by done status
CREATE INDEX idx_etl_job_logs_done ON etl_job_logs(done);

-- Comment for documentation
COMMENT ON COLUMN etl_job_logs.done IS 'Indicates if the job has been reviewed/acknowledged by the user';
