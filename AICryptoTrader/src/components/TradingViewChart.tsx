
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingViewChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          container_id: "tradingview_chart",
          width: "100%",
          height: "500",
          symbol: "BINANCE:BTCUSDT",
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#000000",
          enable_publishing: false,
          allow_symbol_change: true,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          save_image: false,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          gridColor: "rgba(239, 68, 68, 0.1)",
          studies: [
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies"
          ]
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold text-white flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-red-400" />
          <span>Advanced Trading View</span>
        </CardTitle>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </CardHeader>
      <CardContent>
        <div
          id="tradingview_chart"
          ref={containerRef}
          className="h-[500px] w-full rounded-lg overflow-hidden"
        />
      </CardContent>
    </Card>
  );
};

export default TradingViewChart;
