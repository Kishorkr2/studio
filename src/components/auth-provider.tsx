'use client';

import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        return { success: true, user: data.user };
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
