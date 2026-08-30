import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TrendingUp, TrendingDown, PieChart, BarChart3, DollarSign, Sparkles, RefreshCw, User, Mail, Trash2, Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import PortfolioAnalytics from "@/components/PortfolioAnalytics";
import AddAssetForm from "@/components/AddAssetForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { portfolioApiService, type AddAssetRequest, type PortfolioSummary, type AggregatedHolding } from "@/services/portfolioApiService";
import { fetchCoins } from "@/lib/api";

// Interfaces for coin components
interface CoinDropdownItem {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
}

interface CoinSearchDropdownProps {
  selectedCoin: CoinDropdownItem | null;
  onCoinSelect: (coin: CoinDropdownItem | null) => void;
  onCustomCoinRequested?: () => void;
  placeholder?: string;
  isCustomCoinMode?: boolean;
}

interface CoinSelectorProps {
  selectedCoin: CoinDropdownItem | null;
  onCoinSelect: (coin: CoinDropdownItem | null) => void;
  customCoinName: string;
  onCustomCoinNameChange: (name: string) => void;
  isCustomCoin: boolean;
  onToggleCustomCoin: (isCustom: boolean) => void;
}

// CoinSearchDropdown component inline
const CoinSearchDropdown = ({
  selectedCoin,
  onCoinSelect,
  onCustomCoinRequested,
  placeholder = "Select coin...",
  isCustomCoinMode = false,
}: CoinSearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState<CoinDropdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Coin catalogue, served and cached by our backend.
  useEffect(() => {
    let ignore = false;
    const loadCoins = async () => {
      setLoading(true);
      try {
        const marketData = await fetchCoins(250);
        
        const formattedCoins: CoinDropdownItem[] = marketData
          .map((coin: any) => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            market_cap_rank: coin.market_cap_rank,
          }))
          .sort((a: CoinDropdownItem, b: CoinDropdownItem) => {
            // Sort by market cap rank (lower rank = higher position)
            if (a.market_cap_rank === null) return 1;
            if (b.market_cap_rank === null) return -1;
            return a.market_cap_rank - b.market_cap_rank;
          });
        
        console.log('Top 10 coins by rank:', formattedCoins.slice(0, 10));
        if (!ignore) setCoins(formattedCoins);
      } catch (error) {
        console.error('Error fetching coins:', error);
        if (!ignore) setCoins([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadCoins();
    return () => { ignore = true; };
  }, []);

  // Filter by search - show all coins if no search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) {
      return coins;
    }
    const q = searchQuery.toLowerCase();
    return coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(q) ||
        coin.symbol.toLowerCase().includes(q)
    );
  }, [coins, searchQuery]);

  // Show the dropdown only if not in custom coin mode
  if (isCustomCoinMode) return null;

  /** 
   * Key fix here: 
   * Use onMouseDown instead of onSelect for mouse click, 
   * since onSelect can get triggered in keyboard events and onClick gets blocked 
   * by the menu closing. onMouseDown handles "click" before blur/close. 
   */
  const handleCoinSelect = (coin: CoinDropdownItem) => {
    onCoinSelect(coin);
    setOpen(false); // Must close after selection for both mouse and keyboard
    setSearchQuery("");
  };

  const handleCustomCoinSelect = () => {
    setOpen(false);
    onCoinSelect(null);
    if (onCustomCoinRequested) {
      onCustomCoinRequested();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          {selectedCoin ? (
            <span className="flex items-center gap-2">
              <span className="font-medium">{selectedCoin.symbol}</span>
              <span className="text-gray-400">- {selectedCoin.name}</span>
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0 bg-gray-800 border-gray-700"
        align="start"
        style={{
          width: "var(--radix-popover-trigger-width)",
          maxHeight: 400,
          overflowY: "auto",
          zIndex: 9999,
        }}
      >
        <Command className="bg-gray-800">
          <CommandInput
            placeholder="Search coins..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-white bg-gray-800 border-gray-700"
          />
          <CommandList className="max-h-60 bg-gray-800">
            <CommandEmpty className="text-gray-400 p-4">
              {loading ? "Loading coins..." : "No coins found."}
            </CommandEmpty>
            <CommandGroup className="bg-gray-800">
              {filteredCoins.map((coin) => (
                <CommandItem
                  key={coin.id}
                  value={coin.id}
                  // --- THE KEY FIX: use onMouseDown for mouse, onSelect for keyboard
                  onMouseDown={() => handleCoinSelect(coin)}
                  onSelect={() => handleCoinSelect(coin)}
                  className={cn(
                    "text-white cursor-pointer hover:bg-red-900/60 active:bg-red-900/80 transition-colors duration-200 bg-gray-800",
                    selectedCoin?.id === coin.id ? "bg-red-900/40" : ""
                  )}
                  tabIndex={0}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCoin?.id === coin.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{coin.symbol}</span>
                    <span className="text-gray-400">- {coin.name}</span>
                    {coin.market_cap_rank && (
                      <span className="text-xs text-gray-500 ml-auto">
                        #{coin.market_cap_rank}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {/* Custom coin option */}
              <CommandItem
                key="add-own-coin"
                value="add-own-coin"
                onMouseDown={handleCustomCoinSelect}
                onSelect={handleCustomCoinSelect}
                className="text-white hover:bg-green-900/60 active:bg-green-900/80 cursor-pointer border-t border-gray-700 mt-1 transition-colors duration-200 bg-gray-800"
              >
                <Plus className="mr-2 h-4 w-4 text-green-400" />
                <div className="flex items-center gap-2 flex-1 text-green-400">
                  Add Your Own Coin (Custom)
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// CoinSelector component inline
const CoinSelector = ({
  selectedCoin,
  onCoinSelect,
  customCoinName,
  onCustomCoinNameChange,
  isCustomCoin,
  onToggleCustomCoin,
}: CoinSelectorProps) => {
  // When switching between modes, clear state accordingly
  const handleCustomCoinToggle = (toCustom: boolean) => {
    console.log('CoinSelector: Toggling to custom coin mode:', toCustom);
    onToggleCustomCoin(toCustom);
    if (toCustom) {
      onCoinSelect(null);
    } else {
      onCustomCoinNameChange('');
    }
  };

  // When a custom coin is requested from dropdown button
  const handleCustomCoinRequested = () => {
    console.log('CoinSelector: Custom coin requested from dropdown');
    handleCustomCoinToggle(true);
  };

  // Enhanced coin selection handler with logging
  const handleCoinSelect = (coin: CoinDropdownItem | null) => {
    console.log('CoinSelector: handleCoinSelect called with:', coin);
    onCoinSelect(coin);
  };

  console.log('CoinSelector render - selectedCoin:', selectedCoin);
  console.log('CoinSelector render - isCustomCoin:', isCustomCoin);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant={!isCustomCoin ? "default" : "outline"}
          size="sm"
          onClick={() => handleCustomCoinToggle(false)}
          className={cn(
            "transition-all duration-200",
            !isCustomCoin
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "border-gray-600 text-gray-300 hover:bg-gray-800"
          )}
        >
          Select from CoinGecko
        </Button>
        <Button
          type="button"
          variant={isCustomCoin ? "default" : "outline"}
          size="sm"
          onClick={() => handleCustomCoinToggle(true)}
          className={cn(
            "transition-all duration-200",
            isCustomCoin
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "border-gray-600 text-gray-300 hover:bg-gray-800"
          )}
        >
          Custom Coin
        </Button>
      </div>

      {/* CoinGecko Selection Mode */}
      {!isCustomCoin && (
        <div>
          <Label className="text-gray-300">Select Cryptocurrency</Label>
          <CoinSearchDropdown
            selectedCoin={selectedCoin}
            onCoinSelect={handleCoinSelect}
            onCustomCoinRequested={handleCustomCoinRequested}
            placeholder="Search for a cryptocurrency..."
            isCustomCoinMode={isCustomCoin}
          />
          <p className="text-sm text-gray-400 mt-1">
            Choose from top cryptocurrencies ranked by market cap or add your own coin if not listed.
          </p>
        </div>
      )}

      {/* Custom Coin Mode */}
      {isCustomCoin && (
        <div>
          <Label htmlFor="custom-coin" className="text-gray-300">
            Custom Coin Name/Symbol
          </Label>
          <Input
            id="custom-coin"
            placeholder="e.g., MyToken, MTK"
            value={customCoinName}
            onChange={(e) => {
              console.log('Custom coin name changed to:', e.target.value);
              onCustomCoinNameChange(e.target.value);
            }}
            className="bg-gray-800 border-gray-700 text-white focus:border-red-500 transition-colors duration-300"
          />
          <p className="text-sm text-gray-400 mt-1">
            Enter your custom coin name or symbol. You'll need to provide the price manually.
          </p>
        </div>
      )}
    </div>
  );
};

const Portfolio = () => {
  // AuthContext, not Clerk directly: it is the single source of the
  // active session, so the page works under any sign-in path.
  const { user, refreshToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  // Optimized portfolio query with better caching
  const { data: portfolioData, isLoading, error, refetch } = useQuery({
    queryKey: ['portfolio-summary', user?.id],
    queryFn: async (): Promise<PortfolioSummary> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      // The server derives the owner from the token; no id is sent.
      return portfolioApiService.getPortfolio(refreshToken);
    },
    enabled: !!user?.id,
    refetchInterval: 600000, // Refetch every 10 minutes for better performance
    staleTime: 300000, // Consider data stale after 5 minutes
    retry: 2, // Reduce retry attempts
  });

  // Log any query errors
  useEffect(() => {
    if (error) {
      console.error('Portfolio query error:', error);
      toast({
        title: "Error loading portfolio",
        description: "Failed to load your portfolio. Please try refreshing.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Optimized mutation for adding new assets
  const addAssetMutation = useMutation({
    mutationFn: async (assetData: AddAssetRequest) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return portfolioApiService.addAsset(assetData, refreshToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      toast({
        title: "Success",
        description: "Asset added successfully!",
      });
      setShowAddForm(false);
    },
    onError: (error: any) => {
      console.error('Add asset mutation error:', error);
      toast({
        title: "Error",
        description: `Failed to add asset: ${error.message || error}`,
        variant: "destructive",
      });
    }
  });

  // Optimized mutation for deleting assets
  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return portfolioApiService.deleteAsset(assetId, refreshToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      toast({
        title: "Success",
        description: "Asset deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete asset: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Memoized handlers for better performance
  const handleRefresh = useCallback(() => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Portfolio data has been refreshed",
    });
  }, [refetch, toast]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    if (confirm('Are you sure you want to delete this asset entry?')) {
      deleteAssetMutation.mutate(assetId);
    }
  }, [deleteAssetMutation]);

  // Memoized currency formatter
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  }, []);

  // Memoized analytics holdings conversion
  const analyticsHoldings = useMemo(() => 
    portfolioData?.holdings.flatMap(holding => 
      holding.entries.map(entry => ({
        id: entry.id,
        symbol: entry.symbol,
        name: entry.name,
        amount: entry.quantity,
        avgPrice: entry.price_used,
        currentPrice: holding.current_price,
        purchaseDate: entry.purchase_date ?? '',
        coinId: entry.coin_id
      }))
    ) || [], [portfolioData?.holdings]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Simplified Background - Reduced animations for better performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-red-500/5 to-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-full blur-3xl" />
      </div>

      <Header />
      <div className="pt-20 p-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Sparkles className="w-8 h-8 text-red-400" />
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                Smart Portfolio
              </h1>
              <Sparkles className="w-8 h-8 text-orange-400" />
            </div>
            <div className="h-1 w-48 bg-gradient-to-r from-red-500 to-orange-400 mx-auto mb-4"></div>
            <p className="text-xl text-gray-400">AI-Powered Investment Tracking</p>
            {user && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-300">
                <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                  <User className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-400">Portfolio Owner:</span>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-400" />
                    <span className="text-white font-medium">{user.primaryEmailAddress?.emailAddress}</span>
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* Enhanced Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="group bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Portfolio Value</CardTitle>
                <DollarSign className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(portfolioData?.total_portfolio_value || 0)}</div>
                <p className={`text-xs flex items-center ${(portfolioData?.total_profit_or_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(portfolioData?.total_profit_or_loss || 0) >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {(portfolioData?.total_profit_or_loss_percentage || 0).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card className="group bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-orange-500/30 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Investment</CardTitle>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(portfolioData?.total_invested || 0)}</div>
                <p className="text-xs text-gray-400">Total Cost Basis</p>
              </CardContent>
            </Card>

            <Card className="group bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-purple-500/30 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total P&L</CardTitle>
                <PieChart className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(portfolioData?.total_profit_or_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(portfolioData?.total_profit_or_loss || 0)}
                </div>
                <p className="text-xs text-gray-400">Unrealized Gains/Losses</p>
              </CardContent>
            </Card>

            <Card className="group bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-green-500/30 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Unique Assets</CardTitle>
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{portfolioData?.holdings.length || 0}</div>
                <p className="text-xs text-gray-400">Different Cryptocurrencies</p>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Analytics */}
          <PortfolioAnalytics holdings={analyticsHoldings} />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-300"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {showAddForm ? 'Hide Form' : 'Add Asset'}
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-800 transition-all duration-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          {/* Add Asset Form */}
          {showAddForm && (
            <div className="mb-8">
              <AddAssetForm
                onAssetAdded={() => setShowAddForm(false)}
                onAddAsset={(data) => addAssetMutation.mutateAsync(data)}
                isLoading={addAssetMutation.isPending}
                CoinSelector={CoinSelector}
              />
            </div>
          )}

          {/* Holdings Table */}
          <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold text-white">Portfolio Holdings</CardTitle>
              <div className="text-sm text-gray-400">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </CardHeader>
            <CardContent>
              {!portfolioData?.holdings.length ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No assets found. Start building your portfolio!</p>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Add Your First Asset
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                        <th className="pb-4">Asset</th>
                        <th className="pb-4">Total Quantity</th>
                        <th className="pb-4">Avg Buy Price</th>
                        <th className="pb-4">Current Price</th>
                        <th className="pb-4">Market Value</th>
                        <th className="pb-4">P&L</th>
                        <th className="pb-4">P&L %</th>
                        <th className="pb-4">Entries</th>
                        <th className="pb-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioData.holdings.map((holding: AggregatedHolding) => (
                        <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-all duration-300">
                          <td className="py-4">
                            <div>
                              <p className="font-medium text-white">{holding.name}</p>
                              <p className="text-sm text-gray-400">{holding.symbol}</p>
                            </div>
                          </td>
                          <td className="py-4 text-white">{holding.total_quantity.toFixed(8)}</td>
                          <td className="py-4 text-white">{formatCurrency(holding.average_buy_price)}</td>
                          <td className="py-4 text-white">{formatCurrency(holding.current_price)}</td>
                          <td className="py-4 text-white font-medium">{formatCurrency(holding.current_value)}</td>
                          <td className={`py-4 font-medium ${holding.profit_or_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(holding.profit_or_loss)}
                          </td>
                          <td className={`py-4 font-medium ${holding.profit_or_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {holding.profit_or_loss_percentage.toFixed(2)}%
                          </td>
                          <td className="py-4 text-gray-400 text-sm">
                            {holding.entries.length} transaction{holding.entries.length !== 1 ? 's' : ''}
                          </td>
                          <td className="py-4">
                            <div className="flex gap-1">
                              {holding.entries.map((entry) => (
                                <Button
                                  key={entry.id}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteAsset(entry.id)}
                                  disabled={deleteAssetMutation.isPending}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300"
                                  title={`Delete entry: ${entry.quantity} ${entry.symbol} @ ${formatCurrency(entry.price_used)}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              ))}
                            </div>
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

export default Portfolio;
