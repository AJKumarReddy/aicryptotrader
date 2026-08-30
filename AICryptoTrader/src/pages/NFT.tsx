
import React from 'react';
import Header from "@/components/Header";
import { Sparkles, Star, Zap } from "lucide-react";

const NFT = () => {
  // Use local NFT images served from public/lovable-uploads/toto images/
  const nftImages = [
    "/lovable-uploads/toto images/toto1.jpg",
    "/lovable-uploads/toto images/toto2.jpg",
    "/lovable-uploads/toto images/toto3.jpg",
    "/lovable-uploads/toto images/toto4.jpg",
    "/lovable-uploads/toto images/toto5.jpg"
  ];

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-red-500/10 to-yellow-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-r from-yellow-500/10 to-red-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-gradient-to-r from-red-500/10 to-yellow-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>
      
      <Header />
      
      <div className="pt-32 pb-16 relative z-10">
        <div className="max-w-7xl mx-auto px-8 text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <div className="flex items-center justify-center space-x-4 mb-6">
              <Sparkles className="w-8 h-8 text-red-400 animate-pulse" />
              <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-red-400 via-yellow-400 to-red-400 bg-clip-text text-transparent animate-fade-in">
                NFTs Coming Soon
              </h1>
              <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            
            <div className="h-1 w-48 bg-gradient-to-r from-red-500 to-yellow-400 mx-auto mb-8 animate-fade-in"></div>
            
            <p className="text-2xl md:text-3xl text-gray-300 mb-6 max-w-4xl mx-auto leading-relaxed animate-fade-in">
              Revolutionary AI-Powered NFT Collection
            </p>
            
            <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto animate-fade-in">
              Get ready for the most advanced NFT collection powered by artificial intelligence. 
              Each piece will be uniquely generated and backed by cutting-edge blockchain technology.
            </p>
            
            <div className="flex items-center justify-center space-x-6 text-yellow-400 animate-fade-in">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5" />
                <span className="text-lg font-semibold">Stay Ready</span>
              </div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span className="text-lg font-semibold">Be First</span>
              </div>
            </div>
          </div>
          
          {/* Infinite Scrolling NFT Preview */}
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent z-10"></div>
            
            <div className="flex animate-scroll-infinite space-x-6">
              {/* First set of images */}
              {nftImages.map((image, index) => (
                <div
                  key={`first-${index}`}
                  className="relative flex-shrink-0 w-64 h-64 rounded-xl overflow-hidden border-2 border-red-500/30 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105 group"
                >
                  <img 
                    src={image} 
                    alt={`NFT Preview ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-sm font-semibold text-white">AI Genesis #{index + 1}</div>
                    <div className="text-xs text-gray-300">Coming Soon</div>
                  </div>
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-yellow-400/50 rounded-xl transition-all duration-300"></div>
                </div>
              ))}
              
              {/* Duplicate set for seamless loop */}
              {nftImages.map((image, index) => (
                <div
                  key={`second-${index}`}
                  className="relative flex-shrink-0 w-64 h-64 rounded-xl overflow-hidden border-2 border-red-500/30 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105 group"
                >
                  <img 
                    src={image} 
                    alt={`NFT Preview ${index + nftImages.length + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-sm font-semibold text-white">AI Genesis #{index + nftImages.length + 1}</div>
                    <div className="text-xs text-gray-300">Coming Soon</div>
                  </div>
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-yellow-400/50 rounded-xl transition-all duration-300"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-red-900/20 via-black/40 to-yellow-900/20 border border-red-500/30 shadow-2xl shadow-red-500/20">
            <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text text-transparent">
              Be Among the First
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join our exclusive waitlist to get early access to the most revolutionary NFT collection in the crypto space.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold text-red-400">Launching Soon</span>
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse animation-delay-2000"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFT;
