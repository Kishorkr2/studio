
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

interface AuthContextType {
  isAuthenticated: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const validUsername = 'Ralson';
const validPassword = 'ralson@123';

export function AuthProvider({children}: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for auth status and expiry
    try {
      const authDataString = localStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        if (new Date().getTime() < authData.expiry) {
          setIsAuthenticated(true);
        } else {
          // If expired, clear the storage
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
    if (loading) return; // Wait until we've checked local storage

    if (!isAuthenticated && pathname !== '/login') {
      router.push('/login');
    } else if (isAuthenticated && pathname === '/login') {
      router.push('/');
    }
  }, [isAuthenticated, pathname, router, loading]);

  const login = (user: string, pass: string): boolean => {
    if (
      user.toLowerCase() === validUsername.toLowerCase() &&
      pass === validPassword
    ) {
      const expiry = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 hours
      const authData = {isAuthenticated: true, expiry};
      localStorage.setItem('authData', JSON.stringify(authData));
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('authData');
    setIsAuthenticated(false);
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
