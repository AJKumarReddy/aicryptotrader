import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, Target, Zap } from "lucide-react";
import { LineChart, Line, PieChart as RechartsPieChart, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Pie } from 'recharts';

interface PortfolioAnalyticsProps {
  holdings: Array<{
    id: string;
    symbol: string;
    name: string;
    amount: number;
    avgPrice: number;
    currentPrice: number;
    purchaseDate: string;
    coinId: string;
  }>;
}

const PortfolioAnalytics = ({ holdings }: PortfolioAnalyticsProps) => {
  // Calculate portfolio metrics
  const totalValue = holdings.reduce((sum, holding) => sum + (holding.amount * holding.currentPrice), 0);
  const totalCost = holdings.reduce((sum, holding) => sum + (holding.amount * holding.avgPrice), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercentage = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;

  // Prepare data for charts
  const pieData = holdings.map(holding => ({
    name: holding.symbol,
    value: holding.amount * holding.currentPrice,
    percentage: ((holding.amount * holding.currentPrice) / totalValue) * 100
  }));

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899'];

  // Mock historical data for performance chart
  const performanceData = [
    { date: '1D', value: totalValue * 0.95, pnl: -5 },
    { date: '1W', value: totalValue * 0.92, pnl: -8 },
    { date: '1M', value: totalValue * 0.85, pnl: -15 },
    { date: '3M', value: totalValue * 0.78, pnl: -22 },
    { date: '6M', value: totalValue * 0.65, pnl: -35 },
    { date: 'YTD', value: totalValue * 0.45, pnl: -55 },
    { date: 'Now', value: totalValue, pnl: totalPnLPercentage }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Render pie chart only if there is at least one holding with value > 0
  const hasPieData = pieData.length > 0 && totalValue > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Portfolio Performance Chart */}
      <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform duration-300" />
            <span>Portfolio Performance</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Asset Allocation Pie Chart */}
      <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
            <PieChart className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform duration-300" />
            <span>Asset Allocation</span>
          </CardTitle>
          <Target className="w-5 h-5 text-gray-400 group-hover:rotate-180 transition-transform duration-500" />
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center">
            {hasPieData ? (
              <>
                <div className="w-2/3">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'Value']}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/3 space-y-2">
                  {pieData.slice(0, 5).map((item, index) => (
                    <div key={item.name} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-300">{item.name}</span>
                      <span className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full flex justify-center items-center h-full">
                <span className="text-gray-500">No asset data found</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Statistics */}
      <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 group">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
            <Zap className="w-6 h-6 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
            <span>Portfolio Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Best Performer</p>
                <p className="text-lg font-semibold text-green-400">
                  {holdings.length > 0 ? holdings[0].symbol : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">+34.2% gain</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Worst Performer</p>
                <p className="text-lg font-semibold text-red-400">
                  {holdings.length > 1 ? holdings[1].symbol : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">-12.1% loss</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Avg. Hold Time</p>
                <p className="text-lg font-semibold text-white">127 days</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Risk Score</p>
                <div className="flex items-center space-x-2">
                  <p className="text-lg font-semibold text-orange-400">Medium</p>
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full ${i < 3 ? 'bg-orange-400' : 'bg-gray-600'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 group">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
            <Target className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform duration-300" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button className="group relative p-4 bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-lg border border-red-500/30 hover:border-red-400/60 transition-all duration-300 hover:scale-105 transform">
              <TrendingUp className="w-6 h-6 text-red-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <p className="text-sm font-medium text-white">Rebalance</p>
              <p className="text-xs text-gray-400">Optimize allocation</p>
            </button>
            <button className="group relative p-4 bg-gradient-to-r from-orange-600/20 to-yellow-600/20 rounded-lg border border-orange-500/30 hover:border-orange-400/60 transition-all duration-300 hover:scale-105 transform">
              <DollarSign className="w-6 h-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <p className="text-sm font-medium text-white">Add Funds</p>
              <p className="text-xs text-gray-400">Increase position</p>
            </button>
            <button className="group relative p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg border border-green-500/30 hover:border-green-400/60 transition-all duration-300 hover:scale-105 transform">
              <TrendingDown className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <p className="text-sm font-medium text-white">Set Alerts</p>
              <p className="text-xs text-gray-400">Price notifications</p>
            </button>
            <button className="group relative p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 hover:scale-105 transform">
              <BarChart3 className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
              <p className="text-sm font-medium text-white">Analyze</p>
              <p className="text-xs text-gray-400">Deep insights</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioAnalytics;
