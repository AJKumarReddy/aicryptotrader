
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { devAuthEnabled, devSignOut, devUserFromSession, getDevSession } from '@/lib/devAuth';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  supabaseToken: string | null;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (devAuthEnabled) {
      return getDevSession()?.token ?? null;
    }

    if (!clerkUser) {
      console.log('No user available for token refresh');
      return null;
    }
    
    try {
      console.log('Refreshing Supabase token...');
      // Force a fresh token by not passing any cached token
      const token = await getToken({ template: 'supabase', skipCache: true });
      console.log('Token refreshed successfully:', !!token);
      
      if (token) {
        setSupabaseToken(token);
        return token;
      } else {
        console.error('No token returned from getToken');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Clear the expired token
      setSupabaseToken(null);
    }
    
    return null;
  }, [clerkUser, getToken]);

  // Check if token is expired (basic JWT parsing)
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error parsing token:', error);
      return true; // Consider invalid tokens as expired
    }
  }, []);

  // Get a valid token, refreshing if necessary
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!supabaseToken || isTokenExpired(supabaseToken)) {
      console.log('Token is expired or missing, refreshing...');
      return await refreshToken();
    }
    return supabaseToken;
  }, [supabaseToken, isTokenExpired, refreshToken]);

  useEffect(() => {
    // The local session has no Clerk user and no Supabase profile to sync.
    if (devAuthEnabled) {
      const session = getDevSession();
      setUser(session ? devUserFromSession(session) : null);
      setSupabaseToken(session?.token ?? null);
      setLoading(false);
      return;
    }

    const syncUserToSupabase = async () => {
      if (isLoaded && clerkUser) {
        try {
          console.log('Starting user sync for:', clerkUser.id);
          console.log('User email:', clerkUser.primaryEmailAddress?.emailAddress);
          
          // Get fresh token
          const token = await refreshToken();
          
          if (!token) {
            console.error('No token available for database operations');
            return;
          }

          // Use the regular supabase client for profile operations
          const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', clerkUser.id)
            .single();

          console.log('Profile fetch result:', { existingProfile, fetchError });

          if (!existingProfile && fetchError?.code === 'PGRST116') {
            console.log('Creating new profile...');
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: clerkUser.id,
                email: clerkUser.primaryEmailAddress?.emailAddress,
                full_name: clerkUser.fullName,
                avatar_url: clerkUser.imageUrl,
              })
              .select()
              .single();
            
            console.log('Profile creation result:', { newProfile, insertError });
          } else if (existingProfile) {
            console.log('Updating existing profile...');
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                email: clerkUser.primaryEmailAddress?.emailAddress,
                full_name: clerkUser.fullName,
                avatar_url: clerkUser.imageUrl,
                updated_at: new Date().toISOString(),
              })
              .eq('id', clerkUser.id);
            
            console.log('Profile update result:', { updateError });
          }

          // Set user data for the app
          setUser({
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
            user_metadata: {
              full_name: clerkUser.fullName,
              avatar_url: clerkUser.imageUrl,
            }
          });
          
          console.log('User sync completed successfully');
        } catch (error) {
          console.error('Error syncing user to Supabase:', error);
          // Set user anyway so the app doesn't break
          setUser({
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
            user_metadata: {
              full_name: clerkUser.fullName,
              avatar_url: clerkUser.imageUrl,
            }
          });
        }
      } else if (isLoaded && !clerkUser) {
        console.log('No user found, clearing state');
        setUser(null);
        setSupabaseToken(null);
      }
      
      if (isLoaded) {
        setLoading(false);
        console.log('Auth loading completed');
      }
    };

    syncUserToSupabase();
  }, [clerkUser, isLoaded, refreshToken]);

  // Set up automatic token refresh every 45 minutes
  useEffect(() => {
    if (!clerkUser) return;

    const interval = setInterval(() => {
      console.log('Automatic token refresh triggered');
      refreshToken();
    }, 45 * 60 * 1000); // 45 minutes

    return () => clearInterval(interval);
  }, [clerkUser, refreshToken]);

  const signOut = async () => {
    console.log('Signing out...');
    if (devAuthEnabled) {
      devSignOut();
      setUser(null);
      setSupabaseToken(null);
      window.location.assign('/auth');
      return;
    }
    await clerkSignOut();
    setUser(null);
    setSupabaseToken(null);
    console.log('Sign out completed');
  };

  const value = {
    user,
    loading,
    signOut,
    supabaseToken,
    refreshToken: getValidToken // Export the improved token getter
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
