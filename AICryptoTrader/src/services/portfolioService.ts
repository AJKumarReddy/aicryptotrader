
import { createAuthedSupabaseClient } from "@/integrations/supabase/client";

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  purchaseDate: string;
  coinId: string;
  notes?: string;
}

export interface CreateHoldingData {
  symbol: string;
  name: string;
  amount: number;
  avgPrice: number;
  purchaseDate: string;
  coinId: string;
  notes?: string;
}

export class PortfolioService {
  private async getAuthedClient(getValidToken: () => Promise<string | null>) {
    const token = await getValidToken();
    if (!token) {
      throw new Error('Failed to get valid authentication token');
    }
    console.log('Using token for Supabase client');
    return createAuthedSupabaseClient(token);
  }

  async fetchHoldings(userId: string, getValidToken: () => Promise<string | null>): Promise<PortfolioHolding[]> {
    console.log('Fetching holdings for user:', userId);
    
    const authedSupabase = await this.getAuthedClient(getValidToken);
    
    const { data, error } = await authedSupabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching holdings:', error);
      throw error;
    }
    
    console.log('Fetched holdings:', data);
    
    return (data || []).map(holding => ({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      amount: holding.amount,
      avgPrice: holding.avg_price,
      currentPrice: holding.avg_price, // Will be updated with real-time prices
      purchaseDate: holding.purchase_date,
      coinId: holding.coin_id,
      notes: holding.notes
    }));
  }

  async createHolding(
    userId: string, 
    getValidToken: () => Promise<string | null>,
    holdingData: CreateHoldingData
  ) {
    console.log('Creating holding for user:', userId, 'holding:', holdingData);
    
    const authedSupabase = await this.getAuthedClient(getValidToken);
    
    const { data, error } = await authedSupabase
      .from('portfolio_holdings')
      .insert({
        user_id: userId,
        symbol: holdingData.symbol,
        name: holdingData.name,
        amount: holdingData.amount,
        avg_price: holdingData.avgPrice,
        coin_id: holdingData.coinId,
        purchase_date: holdingData.purchaseDate,
        notes: holdingData.notes || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error details:', error);
      throw error;
    }
    
    console.log('Successfully created holding:', data);
    return data;
  }

  async updateHolding(
    userId: string,
    getValidToken: () => Promise<string | null>,
    holdingId: string,
    updateData: Partial<CreateHoldingData>
  ) {
    console.log('Updating holding:', holdingId, 'with data:', updateData);
    
    const authedSupabase = await this.getAuthedClient(getValidToken);
    
    const updatePayload: any = {};
    if (updateData.symbol) updatePayload.symbol = updateData.symbol;
    if (updateData.name) updatePayload.name = updateData.name;
    if (updateData.amount !== undefined) updatePayload.amount = updateData.amount;
    if (updateData.avgPrice !== undefined) updatePayload.avg_price = updateData.avgPrice;
    if (updateData.coinId) updatePayload.coin_id = updateData.coinId;
    if (updateData.purchaseDate) updatePayload.purchase_date = updateData.purchaseDate;
    if (updateData.notes !== undefined) updatePayload.notes = updateData.notes;
    
    const { data, error } = await authedSupabase
      .from('portfolio_holdings')
      .update(updatePayload)
      .eq('id', holdingId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Update error:', error);
      throw error;
    }
    
    console.log('Successfully updated holding:', data);
    return data;
  }

  async deleteHolding(
    userId: string,
    getValidToken: () => Promise<string | null>,
    holdingId: string
  ) {
    console.log('Deleting holding:', holdingId);
    
    const authedSupabase = await this.getAuthedClient(getValidToken);
    
    const { error } = await authedSupabase
      .from('portfolio_holdings')
      .delete()
      .eq('id', holdingId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Delete error:', error);
      throw error;
    }
    
    console.log('Successfully deleted holding');
  }
}

export const portfolioService = new PortfolioService();
