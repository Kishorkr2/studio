'use client';

import {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {Loader} from './ui/loader';
import type {User} from '@/lib/types';
import * as actions from '@/app/actions';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => {name: string | undefined};
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = !!user;

  const loadUserFromStorage = useCallback(() => {
    try {
      const authDataString = localStorage.getItem('auth');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        if (authData && authData.user && new Date().getTime() < authData.expiry) {
          setUser(authData.user);
        } else {
          localStorage.removeItem('auth');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to load auth data from storage', error);
      localStorage.removeItem('auth');
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return {
          success: false,
          message: err?.message || 'Invalid credentials or server error.',
        };
      }

      const data = await res.json();
      if (data?.success && data?.user) {
        setUser(data.user);
        const expiry = new Date().getTime() + 7 * 24 * 60 * 60 * 1000; // 7 days
        localStorage.setItem(
          'auth',
          JSON.stringify({user: data.user, expiry})
        );
        return {success: true, user: data.user};
      }

      return {
        success: false,
        message: data?.message || 'Invalid response from server.',
      };
    } catch (error: any) {
      console.error('AuthProvider login error:', error);
      return {
        success: false,
        message: error.message || 'Network error occurred.',
      };
    }
  };

  const logout = () => {
    const loggedOutUser = user;
    setUser(null);
    localStorage.removeItem('auth');
    router.push('/login');
    return {name: loggedOutUser?.name};
  };

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';

    if (!isAuthenticated && !isAuthPage) {
      router.push('/login');
    }
    if (isAuthenticated && isAuthPage) {
      router.push('/');
    }
  }, [isAuthenticated, pathname, router, loading]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (!isAuthenticated && !isAuthPage) {
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{user, isAuthenticated, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
