/**
 * Portfolio operations, served by the backend.
 *
 * Note what these methods no longer take: a user id. The server reads the
 * owner from the verified Clerk token, so the browser cannot name whose rows
 * it wants. Valuation and aggregation happen server-side too, against one
 * batched price lookup rather than a market-wide download per session.
 */

import { apiAuthed, resolveCoin } from "@/lib/api";

export interface AddAssetRequest {
  symbol: string;
  quantity: number;
  use_real_time_price?: boolean;
  custom_price?: number;
}

export interface PortfolioEntry {
  id: string;
  symbol: string;
  quantity: number;
  price_used: number;
  total_cost: number;
  purchase_date: string | null;
  notes: string | null;
  name: string | null;
  coin_id: string | null;
}

export interface AggregatedHolding {
  symbol: string;
  name: string | null;
  coin_id: string;
  total_quantity: number;
  average_buy_price: number;
  total_invested: number;
  current_price: number;
  current_value: number;
  profit_or_loss: number;
  profit_or_loss_percentage: number;
  /** False when no live quote was found; current_price falls back to cost. */
  priced: boolean;
  entries: PortfolioEntry[];
}

export interface PortfolioSummary {
  total_portfolio_value: number;
  total_invested: number;
  total_profit_or_loss: number;
  total_profit_or_loss_percentage: number;
  holdings: AggregatedHolding[];
}

type GetToken = () => Promise<string | null>;

class PortfolioApiService {
  async getPortfolio(getToken: GetToken): Promise<PortfolioSummary> {
    return apiAuthed<PortfolioSummary>("/api/portfolio", getToken);
  }

  async addAsset(
    request: AddAssetRequest,
    getToken: GetToken,
  ): Promise<PortfolioSummary> {
    const { symbol, quantity, use_real_time_price = true, custom_price } = request;

    if (!use_real_time_price && custom_price === undefined) {
      throw new Error("A price is required when not using the live price.");
    }

    // Resolve the ticker to a canonical id, name and quote. The lookup is
    // cached on the server, so it costs the shared provider quota once.
    let name = symbol.toUpperCase();
    let coinId = symbol.toLowerCase();
    let livePrice: number | null = null;

    try {
      const resolved = await resolveCoin(symbol);
      name = resolved.name;
      coinId = resolved.coin_id;
      livePrice = resolved.current_price;
    } catch {
      // An unlisted or custom coin is fine as long as a price was supplied.
      if (use_real_time_price) {
        throw new Error(
          `Could not find a live price for ${symbol.toUpperCase()}. ` +
            "Enter a price manually to add it.",
        );
      }
    }

    const price = use_real_time_price ? livePrice : custom_price;
    if (price === null || price === undefined) {
      throw new Error(`No price available for ${symbol.toUpperCase()}.`);
    }

    return apiAuthed<PortfolioSummary>("/api/portfolio/holdings", getToken, {
      method: "POST",
      body: {
        symbol: symbol.toUpperCase(),
        name,
        coin_id: coinId,
        amount: quantity,
        avg_price: price,
        purchase_date: new Date().toISOString().split("T")[0],
      },
    });
  }

  async deleteAsset(holdingId: string, getToken: GetToken): Promise<void> {
    await apiAuthed<{ deleted: boolean }>(
      `/api/portfolio/holdings/${holdingId}`,
      getToken,
      { method: "DELETE" },
    );
  }
}

export const portfolioApiService = new PortfolioApiService();
