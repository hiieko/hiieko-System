/**
 * Auth Context for HIIEKO Mobile
 * 
 * Provides global auth state management across the app.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, login, logout, initializeAuth, getCurrentUser } from '../services/auth';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  authState: AuthState;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  // Refresh auth state
  async function refreshAuth() {
    try {
      setAuthState('loading');
      
      // Try to initialize auth with backend verification
      const user = await initializeAuth();
      
      if (user) {
        setCurrentUser(user);
        setAuthState('authenticated');
        console.log('✅ Auth refreshed - user:', user.email);
      } else {
        // No valid session - check for cached user (offline mode)
        const cachedUser = await getCurrentUser();
        if (cachedUser) {
          // We have a cached user but couldn't verify with backend
          // Might be offline with expired token
          setCurrentUser(cachedUser);
          setAuthState('authenticated');
          console.log('✅ Using cached user (offline mode):', cachedUser.email);
        } else {
          setCurrentUser(null);
          setAuthState('unauthenticated');
          console.log('ℹ️ No authenticated user found');
        }
      }
    } catch (error) {
      console.error('❌ Auth refresh failed:', error);
      setCurrentUser(null);
      setAuthState('unauthenticated');
    }
  }

  // Handle login
  async function handleLogin(email: string, password: string): Promise<User> {
    setAuthState('loading');
    try {
      const user = await login(email, password);
      setCurrentUser(user);
      setAuthState('authenticated');
      return user;
    } catch (error) {
      setAuthState('unauthenticated');
      throw error;
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      await logout();
      setCurrentUser(null);
      setAuthState('unauthenticated');
      console.log('✅ Logout complete');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  }

  const value: AuthContextType = {
    authState,
    currentUser,
    login: handleLogin,
    logout: handleLogout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
