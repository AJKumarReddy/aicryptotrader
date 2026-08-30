
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, X, TrendingUp, PieChart, MessageSquare, Palette, Filter, LogOut, User } from "lucide-react";
import { useUser } from '@clerk/clerk-react';
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user: clerkUser } = useUser();
  const { user: contextUser, signOut } = useAuth();

  // Clerk in normal use; the auth context also carries a local dev session,
  // so the header shows a signed-in user either way.
  const account = clerkUser
    ? {
        name: clerkUser.fullName || 'User',
        email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
        imageUrl: clerkUser.imageUrl as string | undefined,
      }
    : contextUser
      ? {
          name: contextUser.user_metadata?.full_name || 'User',
          email: contextUser.email ?? '',
          imageUrl: contextUser.user_metadata?.avatar_url ?? undefined,
        }
      : null;
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    if (account?.name && account.name !== 'User') {
      return account.name
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return account?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <TrendingUp className="w-8 h-8 text-red-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              CryptoTracker
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/dashboard"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/market"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <PieChart className="w-4 h-4" />
              <span>Market</span>
            </Link>
            <Link
              to="/portfolio"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <PieChart className="w-4 h-4" />
              <span>Portfolio</span>
            </Link>
            <Link
              to="/screener"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <Filter className="w-4 h-4" />
              <span>Screener</span>
            </Link>
            <Link
              to="/chat"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Chat</span>
            </Link>
            <Link
              to="/nft"
              className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
            >
              <Palette className="w-4 h-4" />
              <span>NFT</span>
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {account ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={account.imageUrl} alt={account.name} />
                      <AvatarFallback className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-gray-900 border-gray-700" align="end" forceMount>
                  <DropdownMenuItem className="flex items-center space-x-2 text-gray-300 hover:text-white hover:bg-gray-800">
                    <User className="w-4 h-4" />
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {account.name}
                      </p>
                      <p className="text-xs leading-none text-gray-400">
                        {account.email}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center space-x-2 text-gray-300 hover:text-white hover:bg-gray-800"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
              >
                Sign In
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-gray-300 hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-800">
              <Link
                to="/dashboard"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/market"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Market
              </Link>
              <Link
                to="/portfolio"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Portfolio
              </Link>
              <Link
                to="/screener"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Screener
              </Link>
              <Link
                to="/chat"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                AI Chat
              </Link>
              <Link
                to="/nft"
                className="text-gray-300 hover:text-white block px-3 py-2 text-base font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                NFT
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
