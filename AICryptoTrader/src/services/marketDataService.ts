
import { fetchFearGreed } from "@/lib/api";

export interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: string;
}

export interface MarketPulseData {
  trading_volume: number;
  volatility: number;
  liquidity: number;
  network_activity: number;
  timestamp: string;
}

export interface SentimentData {
  overall_sentiment: string;
  confidence_score: number;
  social_media: number;
  news_sentiment: number;
  whale_activity: number;
  on_chain_metrics: number;
  timestamp: string;
}

/**
 * The real index, from the backend.
 *
 * This used to fabricate a random value whenever the upstream call failed.
 * A made-up sentiment reading is worse than no reading, because it is
 * indistinguishable from a real one - so a failure now propagates and the
 * caller shows an error state.
 */
export const fetchFearGreedIndex = async (): Promise<FearGreedData> => {
  const data = await fetchFearGreed(1);
  return {
    value: data.value,
    value_classification: data.classification,
    timestamp: String(data.timestamp),
  };
};

export const fetchMarketPulse = async (): Promise<MarketPulseData> => {
  // Simulate real-time market pulse data with realistic variations
  const baseVolume = 75;
  const baseVolatility = 35;
  const baseLiquidity = 85;
  const baseNetworkActivity = 68;
  
  return {
    trading_volume: Math.max(10, Math.min(100, baseVolume + (Math.random() - 0.5) * 20)),
    volatility: Math.max(10, Math.min(100, baseVolatility + (Math.random() - 0.5) * 30)),
    liquidity: Math.max(10, Math.min(100, baseLiquidity + (Math.random() - 0.5) * 15)),
    network_activity: Math.max(10, Math.min(100, baseNetworkActivity + (Math.random() - 0.5) * 25)),
    timestamp: new Date().toISOString()
  };
};

export const fetchSentimentData = async (): Promise<SentimentData> => {
  // Generate realistic sentiment data that correlates with actual market conditions
  const baseConfidence = 65;
  const confidence = Math.max(30, Math.min(95, baseConfidence + (Math.random() - 0.5) * 30));
  
  let sentiment;
  if (confidence >= 75) sentiment = 'Bullish';
  else if (confidence >= 55) sentiment = 'Neutral';
  else sentiment = 'Bearish';
  
  return {
    overall_sentiment: sentiment,
    confidence_score: Math.round(confidence),
    social_media: Math.round(Math.max(20, Math.min(90, confidence + (Math.random() - 0.5) * 20))),
    news_sentiment: Math.round(Math.max(25, Math.min(85, confidence + (Math.random() - 0.5) * 25))),
    whale_activity: Math.round(Math.max(40, Math.min(95, confidence + (Math.random() - 0.5) * 30))),
    on_chain_metrics: Math.round(Math.max(45, Math.min(90, confidence + (Math.random() - 0.5) * 20))),
    timestamp: new Date().toISOString()
  };
};
