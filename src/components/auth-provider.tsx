
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import * as dbActions from '@/lib/server/db-actions';
import type { User } from '@/lib/types';
import { Loader } from './ui/loader';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (
    email: string,
    pass: string
  ) => Promise<{ success: boolean; message?: string; user?: User }>;
  logout: () => { name: string | null };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const authDataString = localStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        if (new Date().getTime() < authData.expiry) {
          setIsAuthenticated(true);
          setUser(authData.user);
        } else {
          localStorage.removeItem('authData');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.warn('Could not read auth status from localStorage.', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const publicPaths = ['/login', '/signup'];
    if (!isAuthenticated && !publicPaths.includes(pathname)) {
      router.push('/login');
    } else if (isAuthenticated && publicPaths.includes(pathname)) {
      router.push('/');
    }
  }, [isAuthenticated, pathname, router, loading]);

  const login = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; message?: string; user?: User }> => {
    try {
      const result = await dbActions.verifyUserLogin(
        email,
        pass
      );
      if (result.success && result.user) {
        const expiry = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 hours
        const authData = {
          isAuthenticated: true,
          expiry,
          user: result.user,
        };
        localStorage.setItem('authData', JSON.stringify(authData));
        setIsAuthenticated(true);
        setUser(authData.user);
        return { success: true, user: authData.user };
      }
      return { success: false, message: result.message };
    } catch (error) {
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  const logout = () => {
    const currentUser = user;
    localStorage.removeItem('authData');
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
    return { name: currentUser?.name || null };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

    