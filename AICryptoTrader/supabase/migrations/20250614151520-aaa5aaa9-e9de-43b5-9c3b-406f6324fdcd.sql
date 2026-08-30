
-- Since profiles table already exists, let's just create the portfolio_holdings table if it doesn't exist
-- and set up the proper structure

-- First, let's drop the existing portfolio_holdings table if it exists to ensure clean setup
DROP TABLE IF EXISTS public.portfolio_holdings CASCADE;

-- Create the portfolio_holdings table with proper types for Clerk integration
CREATE TABLE public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Using TEXT to match Clerk's string-based user IDs
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  coin_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for portfolio_holdings updated_at
CREATE TRIGGER update_portfolio_holdings_updated_at
    BEFORE UPDATE ON public.portfolio_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for portfolio_holdings table using Clerk JWT claims
CREATE POLICY "Users can view their own holdings"
  ON public.portfolio_holdings
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own holdings"
  ON public.portfolio_holdings
  FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own holdings"
  ON public.portfolio_holdings
  FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own holdings"
  ON public.portfolio_holdings
  FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create indexes for better performance
CREATE INDEX idx_portfolio_holdings_user_id ON public.portfolio_holdings(user_id);
CREATE INDEX idx_portfolio_holdings_symbol ON public.portfolio_holdings(symbol);
