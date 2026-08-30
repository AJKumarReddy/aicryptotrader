
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, TrendingUp, TrendingDown } from "lucide-react";
import { fetchSentimentData, SentimentData } from '../services/marketDataService';

const SentimentAnalysis = () => {
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await fetchSentimentData();
      setSentimentData(data);
      setLoading(false);
    };
    
    fetchData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      case 'bullish': return 'text-green-500';
      case 'bearish': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const sentimentSignals = sentimentData ? [
    { source: "Social Media", sentiment: sentimentData.social_media > 60 ? "Positive" : sentimentData.social_media > 40 ? "Neutral" : "Negative", percentage: sentimentData.social_media },
    { source: "News Sentiment", sentiment: sentimentData.news_sentiment > 60 ? "Positive" : sentimentData.news_sentiment > 40 ? "Neutral" : "Negative", percentage: sentimentData.news_sentiment },
    { source: "Whale Activity", sentiment: sentimentData.whale_activity > 60 ? "Positive" : sentimentData.whale_activity > 40 ? "Neutral" : "Negative", percentage: sentimentData.whale_activity },
    { source: "On-Chain Metrics", sentiment: sentimentData.on_chain_metrics > 60 ? "Positive" : sentimentData.on_chain_metrics > 40 ? "Neutral" : "Negative", percentage: sentimentData.on_chain_metrics }
  ] : [];

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border-gray-800 hover:border-red-500/30 transition-all duration-300 glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">AI Sentiment Analysis</CardTitle>
        <MessageCircle className="h-4 w-4 text-red-500" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getSentimentColor(sentimentData?.overall_sentiment || '')}`}>
                {sentimentData?.overall_sentiment}
              </div>
              <div className="text-3xl font-bold text-white">
                {sentimentData?.confidence_score}%
              </div>
              <p className="text-xs text-gray-400">Confidence Score</p>
            </div>

            <div className="space-y-3">
              {sentimentSignals.map((signal, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${getSentimentColor(signal.sentiment).replace('text-', 'bg-')}`}></div>
                    <span className="text-sm text-gray-300">{signal.source}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm ${getSentimentColor(signal.sentiment)}`}>
                      {signal.percentage}%
                    </span>
                    {signal.sentiment.toLowerCase() === 'positive' ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : signal.sentiment.toLowerCase() === 'negative' ? (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center">
                Real-time analysis of market sentiment across multiple data sources
              </p>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Last updated: {sentimentData ? new Date(sentimentData.timestamp).toLocaleTimeString() : 'Loading...'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SentimentAnalysis;
