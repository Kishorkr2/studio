'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {Skeleton} from './ui/skeleton';
import * as dbActions from '@/lib/server/db-actions';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (
    email: string,
    pass: string
  ) => Promise<{success: boolean; message?: string}>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
        } else {
          localStorage.removeItem('authData');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.warn('Could not read auth status from localStorage.', error);
      setIsAuthenticated(false);
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
  ): Promise<{success: boolean; message?: string}> => {
    try {
      const {success, message, user} = await dbActions.verifyUserLogin(email, pass);
      if (success && user) {
        const expiry = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 hours
        const authData = {
          isAuthenticated: true,
          expiry,
          user: {id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin},
        };
        localStorage.setItem('authData', JSON.stringify(authData));
        setIsAuthenticated(true);
        return {success: true};
      }
      return {success: false, message};
    } catch (error) {
      return {success: false, message: 'An unexpected error occurred.'};
    }
  };

  const logout = () => {
    localStorage.removeItem('authData');
    setIsAuthenticated(false);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 w-full max-w-sm">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{isAuthenticated, login, logout}}>
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
