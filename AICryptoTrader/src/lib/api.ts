/**
 * Client for the AICryptoTrader backend.
 *
 * Every call to a third-party provider now goes through our own API, so no
 * provider key ships in this bundle. Authenticated calls send the Clerk token
 * the app already mints; the server derives the user from it, which is why
 * none of these functions take a user id.
 */

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    throw new ApiError(0, "Cannot reach the API. Is the backend running?");
  }

  // The backend answers errors as { error, request_id }. Surfacing the id
  // lets a user quote it and an operator grep the logs for that one request.
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let requestId: string | undefined;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
      requestId = payload?.request_id;
    } catch {
      /* a non-JSON error body is not worth reporting verbatim */
    }
    throw new ApiError(response.status, message, requestId);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fetch a public endpoint. */
export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  request<T>(path, { signal });

/** Fetch an endpoint that requires a signed-in user. */
export async function apiAuthed<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: Omit<RequestOptions, "token"> = {},
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiError(401, "You need to be signed in for this.");
  }
  return request<T>(path, { ...options, token });
}

/* ---------------------------------------------------------------- market */

export interface GlobalStats {
  active_cryptocurrencies: number | null;
  markets: number | null;
  total_market_cap_usd: number | null;
  total_volume_usd: number | null;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number | null;
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_1h: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number | null;
}

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  thumb: string | null;
  market_cap_rank: number | null;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartSeries {
  symbol: string;
  days: number;
  granularity_seconds: number;
  source: string;
  candles: Candle[];
}

export interface ResolvedCoin {
  coin_id: string;
  symbol: string;
  name: string;
  current_price: number | null;
}

export const fetchGlobalStats = () => apiGet<GlobalStats>("/api/market/global");

export const fetchCoins = (limit = 100, page = 1) =>
  apiGet<MarketCoin[]>(`/api/market/coins?limit=${limit}&page=${page}`);

export const fetchTrending = () => apiGet<TrendingCoin[]>("/api/market/trending");

export const fetchChart = (symbol: string, days: number) =>
  apiGet<ChartSeries>(
    `/api/market/chart/${encodeURIComponent(symbol)}?days=${days}`,
  );

export const resolveCoin = (symbol: string) =>
  apiGet<ResolvedCoin>(`/api/market/coin/${encodeURIComponent(symbol)}`);

/* ------------------------------------------------------------- sentiment */

export interface FearGreed {
  value: number;
  classification: string;
  timestamp: number;
  seconds_until_update: number | null;
  history: { value: number; classification: string; timestamp: number }[];
}

export const fetchFearGreed = (limit = 30) =>
  apiGet<FearGreed>(`/api/sentiment/fear-greed?limit=${limit}`);

/* --------------------------------------------------------------- account */

export interface Identity {
  user_id: string;
  email: string | null;
  session_id: string | null;
}

export const fetchIdentity = (getToken: () => Promise<string | null>) =>
  apiAuthed<Identity>("/api/me", getToken);
