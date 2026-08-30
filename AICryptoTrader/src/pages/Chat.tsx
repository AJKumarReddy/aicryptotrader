
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, Brain, Zap, Sparkles, MessageSquare } from "lucide-react";
import Header from "@/components/Header";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hello! I'm your AI trading assistant. I can help you analyze crypto markets, provide trading insights, and answer questions about your portfolio. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(input),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('bitcoin') || input.includes('btc')) {
      return "Based on current market analysis, Bitcoin is showing strong momentum above the $65,000 support level. Technical indicators suggest a potential breakout towards $75,000, but watch for resistance at $70,000. Consider dollar-cost averaging if you're looking to accumulate.";
    }
    
    if (input.includes('ethereum') || input.includes('eth')) {
      return "Ethereum is displaying bullish patterns with the upcoming network upgrades. The ETH/BTC ratio is strengthening, indicating outperformance potential. Key levels to watch: Support at $3,200, resistance at $4,000.";
    }
    
    if (input.includes('portfolio') || input.includes('holdings')) {
      return "Your portfolio shows a healthy diversification across major cryptocurrencies. Consider rebalancing if any single asset exceeds 40% of your total holdings. The current risk-reward ratio looks favorable for long-term growth.";
    }
    
    if (input.includes('market') || input.includes('trend')) {
      return "The overall crypto market sentiment is cautiously optimistic. We're seeing increased institutional adoption and regulatory clarity. Key factors to monitor: Federal Reserve policy, institutional inflows, and regulatory developments.";
    }
    
    if (input.includes('buy') || input.includes('sell') || input.includes('trade')) {
      return "For trading decisions, I recommend analyzing multiple timeframes and using proper risk management. Set stop-losses at 2-3% below entry points and consider taking profits at predefined targets. Never risk more than 1-2% of your portfolio on a single trade.";
    }
    
    return "I can help you with crypto market analysis, trading strategies, portfolio management, and technical analysis. Try asking about specific cryptocurrencies, market trends, or trading advice!";
  };

  const quickQuestions = [
    "What's the Bitcoin outlook?",
    "Analyze my portfolio",
    "Market sentiment today?",
    "Best trading strategy?"
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="pt-20 p-4 sm:p-6 lg:p-8">
        {/* Animated background matching landing page */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/3 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <header className="mb-6 sm:mb-8 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
              <div className="relative p-3 sm:p-4 rounded-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-xl blur-lg"></div>
                <div className="relative bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-3 sm:p-4">
                  <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                  AI Neural Assistant
                </h1>
                <p className="text-gray-400 text-sm sm:text-base lg:text-lg">Advanced Crypto Analysis Engine</p>
              </div>
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400 animate-pulse" />
            </div>
            <div className="h-1 w-16 sm:w-24 bg-gradient-to-r from-red-500 to-orange-400 mx-auto"></div>
          </header>

          {/* Enhanced Chat Container */}
          <Card className="bg-gradient-to-br from-gray-900/80 to-black/80 border border-red-500/20 backdrop-blur-sm mb-6 shadow-2xl shadow-red-500/10">
            <CardHeader className="border-b border-gray-800/50 p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl font-semibold text-white flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
                <div className="flex items-center">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-red-400" />
                  Neural Chat Interface
                </div>
                <div className="sm:ml-auto flex items-center space-x-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>AI Online</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Messages */}
              <div className="h-80 sm:h-96 overflow-y-auto mb-4 sm:mb-6 space-y-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-red-500">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-4 sm:px-6 py-3 sm:py-4 rounded-xl relative ${
                        message.type === 'user'
                          ? 'bg-gradient-to-r from-red-600/90 to-orange-600/90 text-white shadow-lg shadow-red-500/20'
                          : 'bg-gradient-to-r from-gray-800/90 to-gray-900/90 text-gray-100 border border-red-500/20 shadow-lg shadow-gray-900/20'
                      }`}
                    >
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {message.type === 'user' ? (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center">
                              <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-red-400 to-orange-400 flex items-center justify-center">
                              <Bot className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm leading-relaxed">{message.content}</p>
                          <p className="text-xs opacity-70 mt-2">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 border border-red-500/20 px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-red-400 to-orange-400 flex items-center justify-center">
                          <Bot className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                        </div>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Quick Questions */}
              <div className="mb-4 sm:mb-6">
                <p className="text-xs sm:text-sm text-gray-400 mb-3 flex items-center">
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-red-400" />
                  Quick questions:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(question)}
                      className="text-xs border-red-500/30 text-gray-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-white transition-all duration-300 bg-gradient-to-r from-gray-800/50 to-gray-900/50"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Enhanced Input Area */}
              <div className="flex space-x-2 sm:space-x-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask me anything about crypto trading..."
                  className="flex-1 bg-gradient-to-r from-gray-800/80 to-gray-900/80 border-red-500/30 text-white placeholder:text-gray-400 focus:border-red-500/50 focus:ring-red-500/20 transition-all duration-300 text-sm sm:text-base"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-lg shadow-red-500/20 transition-all duration-300 hover:scale-105 px-3 sm:px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chat;
