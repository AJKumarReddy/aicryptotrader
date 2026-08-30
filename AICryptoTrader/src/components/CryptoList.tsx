
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fetchCoins } from "@/lib/api";



const CryptoList = () => {
  const { data: coins, isLoading } = useQuery({
    queryKey: ['topCoins'],
    queryFn: () => fetchCoins(20),
    refetchInterval: 30000,
  });

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString()}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toLocaleString()}`;
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-white">Top Cryptocurrencies</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
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
                  <th className="pb-4">24h Change</th>
                  <th className="pb-4">Market Cap</th>
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
                      {formatPrice(coin.current_price)}
                    </td>
                    <td className={`py-4 ${
                      coin.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      <div className="flex items-center space-x-1">
                        {coin.price_change_percentage_24h >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span>{Math.abs(coin.price_change_percentage_24h).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="py-4 text-white">
                      {formatMarketCap(coin.market_cap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CryptoList;
