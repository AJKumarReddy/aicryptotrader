
import { useQuery } from "@tanstack/react-query";
import { ArrowUpIcon, ArrowDownIcon, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCoins, fetchGlobalStats, fetchTrending } from "@/lib/api";



const Market = () => {
  const { data: globalData, isLoading: globalLoading } = useQuery({
    queryKey: ['globalData'],
    queryFn: fetchGlobalStats,
    refetchInterval: 60000,
  });

  const { data: coins, isLoading: coinsLoading } = useQuery({
    queryKey: ['topCoins'],
    queryFn: () => fetchCoins(100),
    refetchInterval: 30000,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: fetchTrending,
    refetchInterval: 300000,
  });

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="pt-20 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Global Crypto Market
            </h1>
            <p className="text-gray-400">Real-time cryptocurrency market data and analytics</p>
          </header>

          {/* Global Market Stats */}
          {globalLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Total Market Cap</CardTitle>
                  <DollarSign className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {formatNumber(globalData?.total_market_cap_usd || 0)}
                  </div>
                  <p className={`text-xs flex items-center ${
                    globalData?.market_cap_change_percentage_24h_usd >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {globalData?.market_cap_change_percentage_24h_usd >= 0 ? (
                      <ArrowUpIcon className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDownIcon className="w-3 h-3 mr-1" />
                    )}
                    {formatPercentage(globalData?.market_cap_change_percentage_24h_usd || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">24h Volume</CardTitle>
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {formatNumber(globalData?.total_volume_usd || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">BTC Dominance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {globalData?.market_cap_percentage?.btc?.toFixed(1) || 0}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Active Cryptocurrencies</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {globalData?.active_cryptocurrencies?.toLocaleString() || 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trending Coins */}
          {!trendingLoading && (
            <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white flex items-center">
                  <span className="mr-2">🔥</span> Trending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {trending?.slice(0, 7).map((coin, index: number) => (
                    <div key={coin.id} className="flex items-center space-x-2 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <span className="text-gray-400 text-sm">#{index + 1}</span>
                      <img src={coin.thumb ?? undefined} alt={coin.name} className="w-6 h-6" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{coin.symbol}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cryptocurrency Table */}
          <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white">Cryptocurrency Prices</CardTitle>
            </CardHeader>
            <CardContent>
              {coinsLoading ? (
                <div className="space-y-4">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                      <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-700 rounded w-1/6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                        <th className="pb-4">#</th>
                        <th className="pb-4">Name</th>
                        <th className="pb-4">Price</th>
                        <th className="pb-4">1h%</th>
                        <th className="pb-4">24h%</th>
                        <th className="pb-4">7d%</th>
                        <th className="pb-4">Market Cap</th>
                        <th className="pb-4">Volume(24h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coins?.map((coin: any) => (
                        <tr key={coin.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                          <td className="py-4 text-gray-400">{coin.market_cap_rank}</td>
                          <td className="py-4">
                            <div className="flex items-center space-x-3">
                              <img src={coin.image} alt={coin.name} className="w-8 h-8" />
                              <div>
                                <p className="font-medium text-white">{coin.name}</p>
                                <p className="text-sm text-gray-400">{coin.symbol.toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-white font-medium">
                            ${coin.current_price?.toLocaleString() || 'N/A'}
                          </td>
                          <td className={`py-4 ${
                            (coin.price_change_percentage_1h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatPercentage(coin.price_change_percentage_1h || 0)}
                          </td>
                          <td className={`py-4 ${
                            (coin.price_change_percentage_24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatPercentage(coin.price_change_percentage_24h || 0)}
                          </td>
                          <td className={`py-4 ${
                            (coin.price_change_percentage_7d || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatPercentage(coin.price_change_percentage_7d || 0)}
                          </td>
                          <td className="py-4 text-white">
                            {formatNumber(coin.market_cap || 0)}
                          </td>
                          <td className="py-4 text-white">
                            {formatNumber(coin.total_volume || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Market;
