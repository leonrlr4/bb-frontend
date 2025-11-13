import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { getUserProfile, logout } from '../services/authService';
import type { User, LoginResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  handleLoginSuccess: (response: LoginResponse) => void;
  handleSignOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      getUserProfile(currentToken)
        .then(userData => setUser(userData))
        .catch(err => {
          console.error('Auth Error:', err);
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        });
    }

    const handleForceLogout = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthModalOpen(true);
    };

    window.addEventListener('forceLogout', handleForceLogout as EventListener);

    return () => {
      window.removeEventListener('forceLogout', handleForceLogout as EventListener);
    };
  }, []);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const handleLoginSuccess = useCallback((response: LoginResponse) => {
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
    setUser(response.user);
    setIsAuthModalOpen(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      try {
        await logout(currentToken);
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }
    }
  }, []);

  const value = {
    user,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    handleLoginSuccess,
    handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
