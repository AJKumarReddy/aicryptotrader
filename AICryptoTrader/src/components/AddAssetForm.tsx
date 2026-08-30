
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AddAssetRequest, PortfolioSummary } from "@/services/portfolioApiService";

// Move the interfaces here since the components are now inline in Portfolio.tsx
interface CoinDropdownItem {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
}

interface CoinSelectorProps {
  selectedCoin: CoinDropdownItem | null;
  onCoinSelect: (coin: CoinDropdownItem | null) => void;
  customCoinName: string;
  onCustomCoinNameChange: (name: string) => void;
  isCustomCoin: boolean;
  onToggleCustomCoin: (isCustom: boolean) => void;
}

interface AddAssetFormProps {
  onAssetAdded: () => void;
  onAddAsset: (data: AddAssetRequest) => Promise<PortfolioSummary>;
  isLoading: boolean;
  CoinSelector: React.ComponentType<CoinSelectorProps>;
}

const AddAssetForm = ({ onAssetAdded, onAddAsset, isLoading, CoinSelector }: AddAssetFormProps) => {
  const { toast } = useToast();
  const [selectedCoin, setSelectedCoin] = useState<CoinDropdownItem | null>(null);
  const [customCoinName, setCustomCoinName] = useState('');
  const [isCustomCoin, setIsCustomCoin] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    use_real_time_price: true,
    custom_price: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine the symbol to use
    let symbol = '';
    if (isCustomCoin) {
      if (!customCoinName.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a custom coin name/symbol",
          variant: "destructive",
        });
        return;
      }
      symbol = customCoinName.trim();
    } else {
      if (!selectedCoin) {
        toast({
          title: "Validation Error",
          description: "Please select a cryptocurrency",
          variant: "destructive",
        });
        return;
      }
      symbol = selectedCoin.symbol;
    }

    if (!formData.quantity) {
      toast({
        title: "Validation Error",
        description: "Quantity is required",
        variant: "destructive",
      });
      return;
    }

    // For custom coins, force custom price input
    const shouldUseRealTimePrice = !isCustomCoin && formData.use_real_time_price;

    if (!shouldUseRealTimePrice && !formData.custom_price) {
      toast({
        title: "Validation Error",
        description: isCustomCoin
          ? "Custom price is required for custom coins"
          : "Custom price is required when not using real-time price",
        variant: "destructive",
      });
      return;
    }

    try {
      await onAddAsset({
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(formData.quantity),
        use_real_time_price: shouldUseRealTimePrice,
        custom_price: formData.custom_price ? parseFloat(formData.custom_price) : undefined
      });

      // Reset form
      setSelectedCoin(null);
      setCustomCoinName('');
      setIsCustomCoin(false);
      setFormData({
        quantity: '',
        use_real_time_price: true,
        custom_price: ''
      });

      onAssetAdded();

      toast({
        title: "Success",
        description: "Asset added to portfolio successfully!",
      });
    } catch (error) {
      console.error('Add asset error:', error);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
          <TrendingUp className="w-6 h-6 text-red-400" />
          <span>Add New Asset</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Coin Selection */}
          <CoinSelector
            selectedCoin={selectedCoin}
            onCoinSelect={setSelectedCoin}
            customCoinName={customCoinName}
            onCustomCoinNameChange={setCustomCoinName}
            isCustomCoin={isCustomCoin}
            onToggleCustomCoin={setIsCustomCoin}
          />

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity" className="text-gray-300">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.00000001"
              placeholder="0.5"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white focus:border-red-500 transition-colors duration-300"
            />
          </div>

          {/* Price Settings - Only show for CoinGecko coins */}
          {!isCustomCoin && (
            <div className="flex items-center space-x-2">
              <Switch
                id="use-real-time"
                checked={formData.use_real_time_price}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  use_real_time_price: checked,
                  custom_price: checked ? '' : formData.custom_price
                })}
                className="data-[state=checked]:bg-red-600"
              />
              <Label htmlFor="use-real-time" className="text-gray-300">
                Use real-time price from CoinGecko
              </Label>
            </div>
          )}

          {/* Custom Price Input - Show when not using real-time price OR when using custom coin */}
          {(isCustomCoin || !formData.use_real_time_price) && (
            <div>
              <Label htmlFor="custom-price" className="text-gray-300">
                {isCustomCoin ? 'Price (USD) *' : 'Custom Price (USD)'}
              </Label>
              <Input
                id="custom-price"
                type="number"
                step="0.01"
                placeholder="28000"
                value={formData.custom_price}
                onChange={(e) => setFormData({...formData, custom_price: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white focus:border-red-500 transition-colors duration-300"
              />
              {isCustomCoin && (
                <p className="text-sm text-gray-400 mt-1">
                  Since this is a custom coin, you must specify the price manually
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all duration-300 hover:scale-105 transform"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isLoading ? 'Adding Asset...' : 'Add Asset'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddAssetForm;
