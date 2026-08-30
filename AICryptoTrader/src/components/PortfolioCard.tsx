
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { portfolioApiService } from "@/services/portfolioApiService";

const PortfolioCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshToken } = useAuth();

  // Fetch portfolio data with longer intervals for better performance
  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio-summary-card', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return portfolioApiService.getPortfolio(refreshToken);
    },
    enabled: !!user?.id,
    refetchInterval: 300000, // Refetch every 5 minutes
    staleTime: 120000, // Consider data stale after 2 minutes
  });

  // Use real data if available, otherwise fallback to mock data
  const totalValue = portfolioData?.total_portfolio_value || 41550.00;
  const totalCost = portfolioData?.total_invested || 28940.00;
  const totalPnL = portfolioData?.total_profit_or_loss || 12610.00;
  const topHoldings = portfolioData?.holdings.slice(0, 2).map(holding => ({
    symbol: holding.symbol,
    name: holding.name,
    value: holding.current_value,
    percentage: ((holding.current_value / totalValue) * 100)
  })) || [
    { symbol: 'BTC', name: 'Bitcoin', value: 33500.00, percentage: 48.89 },
    { symbol: 'ETH', name: 'Ethereum', value: 8050.00, percentage: 25.00 }
  ];

  const pnlPercentage = totalCost > 0 ? ((totalPnL / totalCost) * 100) : 0;
  const totalHoldings = portfolioData?.holdings.length || 2;

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold text-white">Portfolio Overview</CardTitle>
        <PieChart className="h-6 w-6 text-red-500" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Portfolio Stats */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">Total Value</p>
            <p className="text-2xl font-bold text-white">
              ${totalValue.toLocaleString()}
            </p>
            <div className={`flex items-center text-sm ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              ${Math.abs(totalPnL).toLocaleString()} ({pnlPercentage.toFixed(2)}%)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total Cost</p>
              <p className="text-lg font-semibold text-white">
                ${totalCost.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Holdings</p>
              <p className="text-lg font-semibold text-white">
                {totalHoldings} Assets
              </p>
            </div>
          </div>
        </div>

        {/* Top Holdings */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Top Holdings</h4>
          <div className="space-y-3">
            {topHoldings.map((holding, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">{holding.name}</p>
                  <p className="text-sm text-gray-400">{holding.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">${holding.value.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">{holding.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Button
            onClick={() => navigate('/portfolio')}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
          >
            View Details
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/portfolio')}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioCard;
