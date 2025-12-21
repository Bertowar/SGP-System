-- Migration: Add is_productive column to sectors table
ALTER TABLE sectors 
ADD COLUMN IF NOT EXISTS is_productive BOOLEAN DEFAULT FALSE;

-- Update existing records if needed (Optional, defaulting to false is usually safer)
-- UPDATE sectors SET is_productive = FALSE WHERE is_productive IS NULL;
