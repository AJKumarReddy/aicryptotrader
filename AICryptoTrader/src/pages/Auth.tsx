
import { SignIn, SignUp } from '@clerk/clerk-react';
import { devAuthEnabled } from '@/lib/devAuth';
import DevSignInForm from '@/components/DevSignInForm';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Sparkles className="w-8 h-8 text-red-400 animate-pulse" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Portfolio Manager
            </h1>
            <Sparkles className="w-8 h-8 text-orange-400 animate-pulse" />
          </div>
          <div className="h-1 w-32 bg-gradient-to-r from-red-500 to-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isLogin ? 'Welcome back to your portfolio' : 'Start tracking your crypto journey'}
          </p>
        </div>

        {/* Local dev sign-in has no separate sign-up, so the toggle would
            only mislead. */}
        <div className={devAuthEnabled ? "hidden" : "flex justify-center mb-6"}>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <Button
              variant={isLogin ? "default" : "ghost"}
              onClick={() => setIsLogin(true)}
              className={isLogin ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}
            >
              Sign In
            </Button>
            <Button
              variant={!isLogin ? "default" : "ghost"}
              onClick={() => setIsLogin(false)}
              className={!isLogin ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}
            >
              Sign Up
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          {devAuthEnabled ? (
            <div className="w-full max-w-md">
              <DevSignInForm />
            </div>
          ) : isLogin ? (
            <SignIn 
              afterSignInUrl="/portfolio"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "bg-gray-900 border-gray-700",
                  headerTitle: "text-white",
                  headerSubtitle: "text-gray-400",
                  socialButtonsBlockButton: "bg-gray-800 border-gray-600 text-white hover:bg-gray-700",
                  formButtonPrimary: "bg-red-600 hover:bg-red-700",
                  formFieldInput: "bg-gray-800 border-gray-600 text-white",
                  footerActionLink: "text-red-400 hover:text-red-300"
                }
              }}
            />
          ) : (
            <SignUp 
              afterSignUpUrl="/portfolio"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "bg-gray-900 border-gray-700",
                  headerTitle: "text-white",
                  headerSubtitle: "text-gray-400",
                  socialButtonsBlockButton: "bg-gray-800 border-gray-600 text-white hover:bg-gray-700",
                  formButtonPrimary: "bg-red-600 hover:bg-red-700",
                  formFieldInput: "bg-gray-800 border-gray-600 text-white",
                  footerActionLink: "text-red-400 hover:text-red-300"
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
