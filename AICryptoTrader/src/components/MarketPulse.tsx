
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp, TrendingDown, Activity, Heart, Signal, Waves } from "lucide-react";
import { fetchMarketPulse, MarketPulseData } from '../services/marketDataService';

const MarketPulse = () => {
  const [pulseData, setPulseData] = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await fetchMarketPulse();
      setPulseData(data);
      setLoading(false);
    };
    
    fetchData();
    // Refresh data every 30 seconds for market pulse
    const interval = setInterval(fetchData, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = (value: number) => {
    if (value >= 80) return { label: 'Excellent', trend: 'up' };
    if (value >= 60) return { label: 'Strong', trend: 'up' };
    if (value >= 40) return { label: 'Medium', trend: 'neutral' };
    if (value >= 20) return { label: 'Low', trend: 'down' };
    return { label: 'Very Low', trend: 'down' };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'excellent':
      case 'strong': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'low':
      case 'very low': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const pulseItems = pulseData ? [
    { 
      name: 'Trading Volume', 
      status: getStatus(pulseData.trading_volume).label,
      trend: getStatus(pulseData.trading_volume).trend,
      value: `${pulseData.trading_volume}%`,
      icon: Activity
    },
    { 
      name: 'Volatility', 
      status: getStatus(100 - pulseData.volatility).label, // Lower volatility is better
      trend: pulseData.volatility < 50 ? 'up' : 'down',
      value: `${pulseData.volatility}%`,
      icon: Waves
    },
    { 
      name: 'Liquidity', 
      status: getStatus(pulseData.liquidity).label,
      trend: getStatus(pulseData.liquidity).trend,
      value: `${pulseData.liquidity}%`,
      icon: Signal
    },
    { 
      name: 'Network Activity', 
      status: getStatus(pulseData.network_activity).label,
      trend: getStatus(pulseData.network_activity).trend,
      value: `${pulseData.network_activity}%`,
      icon: Heart
    }
  ] : [];

  const getOverallStatus = () => {
    if (!pulseData) return 'Loading...';
    const average = (pulseData.trading_volume + pulseData.liquidity + pulseData.network_activity + (100 - pulseData.volatility)) / 4;
    if (average >= 70) return 'Strong';
    if (average >= 50) return 'Medium';
    return 'Weak';
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">Market Pulse</CardTitle>
        <Zap className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(getOverallStatus())}`}>
                {getOverallStatus()}
              </div>
              <p className="text-xs text-gray-400">Market Momentum</p>
            </div>

            <div className="space-y-3">
              {pulseItems.map((signal, index) => {
                const Icon = signal.icon;
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-3 h-3 text-red-400" />
                      <div>
                        <p className="text-sm text-gray-300">{signal.name}</p>
                        <p className={`text-xs ${getStatusColor(signal.status)}`}>
                          {signal.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-white font-medium">
                        {signal.value}
                      </span>
                      {signal.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3 text-green-500" />
                      ) : signal.trend === 'down' ? (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-gray-700">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-xs text-gray-400">Live market analysis</p>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Last updated: {pulseData ? new Date(pulseData.timestamp).toLocaleTimeString() : 'Loading...'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketPulse;
