-- Add confirmed column to users table with default value of false
ALTER TABLE users ADD COLUMN confirmed BOOLEAN DEFAULT FALSE;

-- Update existing users to be confirmed (optional, you can remove this if you want all existing users to be unconfirmed)
UPDATE users SET confirmed = TRUE;
