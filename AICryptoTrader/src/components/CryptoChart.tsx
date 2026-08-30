
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";
import { fetchChart } from "@/lib/api";



const CryptoChart = () => {
  const [timeframe, setTimeframe] = useState(7);

  const { data, isLoading } = useQuery({
    queryKey: ['bitcoinChart', timeframe],
    queryFn: () => fetchChart("BTC", timeframe),
    refetchInterval: 30000, // 30 seconds for real-time data
  });

  // The backend returns OHLC candles oldest-first; the line plots closes.
  const chartData = data?.candles?.map((candle) => ({
    timestamp: new Date(candle.time * 1000).toLocaleDateString(),
    price: candle.close,
  })) || [];

  const timeframes = [
    { label: '1D', days: 1 },
    { label: '7D', days: 7 },
    { label: '30D', days: 30 }
  ];

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const previousPrice = chartData.length > 1 ? chartData[chartData.length - 2].price : currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice ? ((priceChange / previousPrice) * 100) : 0;

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-red-400" />
            <CardTitle className="text-lg font-semibold text-white">Bitcoin Mini Chart</CardTitle>
          </div>
          <div className="flex space-x-1">
            {timeframes.map((tf) => (
              <Button
                key={tf.days}
                variant={timeframe === tf.days ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf.days)}
                className={timeframe === tf.days 
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white h-7 px-2 text-xs" 
                  : "border-gray-600 text-gray-300 hover:bg-gray-800 h-7 px-2 text-xs"
                }
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
        {!isLoading && (
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-white">
              ${currentPrice.toLocaleString()}
            </span>
            <span className={`text-sm flex items-center ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${priceChange < 0 ? 'rotate-180' : ''}`} />
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="text-gray-400">Loading chart data...</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9CA3AF"
                fontSize={10}
                tick={false}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={10}
                tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#EF4444" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#EF4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default CryptoChart;
