import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // 1. Always get initial session explicitly
        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          if (session?.user) {
            console.log('Session found:', session.user.id);
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            console.log('No session found');
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        // ALWAYS resolve loading - CRITICAL for preventing infinite loading
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };
    
    // 2. Initialize first
    initializeAuth();
    
    // 3. Then set up listener with guards
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted || !initialized) return; // Guard clause
      
      // Ignore INITIAL_SESSION - we handle this manually above
      if (event === 'INITIAL_SESSION') return;
      
      console.log('Auth state change:', event, session?.user?.id);
      
      try {
        if (session?.user) {
          setUser(session.user);
          // Only navigate on SIGNED_IN event (actual login), not on other events
          const shouldNavigate = event === 'SIGNED_IN';
          await fetchProfile(session.user.id, shouldNavigate);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      }
    });
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchProfile = async (userId: string, shouldNavigate: boolean = false) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }
      
      console.log('Profile fetched:', data);
      setProfile(data);
      
      // Navigation logic ONLY after login, not on every profile fetch
      if (shouldNavigate) {
        if (data?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Profile fetch failed:', error);
      // If profile doesn't exist, create it
      if (error.code === 'PGRST116') {
        await createProfile(userId);
      } else {
        throw error;
      }
    }
  };

  const createProfile = async (userId: string) => {
    try {
      console.log('Creating profile for user:', userId);
      
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userData.user?.email || '',
          full_name: userData.user?.user_metadata?.full_name || '',
          role: 'user'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('Profile created:', data);
      setProfile(data);
      navigate('/dashboard');
    } catch (error) {
      console.error('Profile creation failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out...');
      setLoading(true);
      
      // 1. Clear state FIRST
      setUser(null);
      setProfile(null);
      
      // 2. Then sign out
      await supabase.auth.signOut();
      
      // 3. Clear localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // 4. Navigate with delay
      setTimeout(() => {
        navigate('/');
        setLoading(false);
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};