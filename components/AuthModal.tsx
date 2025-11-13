import React, { useState } from 'react';
import { XIcon } from './icons';
import { login, register } from '../services/authService';
import type { LoginResponse } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (response: LoginResponse) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    // Reset state on close
    setEmail('');
    setPassword('');
    setError(null);
    setIsLoading(false);
    setMode('login');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const loginResponse = await login(email, password);
        onSuccess(loginResponse);
      } else {
        // Register and then login
        await register(email, password);
        const loginResponse = await login(email, password);
        onSuccess(loginResponse);
      }
      handleClose(); // Close on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleMode = () => {
    setError(null);
    setMode(prevMode => prevMode === 'login' ? 'register' : 'login');
  }

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
    >
      <div 
        className="bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-2xl shadow-cyan-500/10 w-full max-w-md m-4 transform transition-all duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{mode === 'login' ? 'Access Your Account' : 'Create an Account'}</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 p-3 rounded-lg border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-200"
                    placeholder="you@example.com"
                    disabled={isLoading}
                />
            </div>

            <div>
                 <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 p-3 rounded-lg border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-200"
                    placeholder="••••••••"
                    disabled={isLoading}
                />
            </div>
            
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-cyan-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-cyan-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
            </div>
            
            <p className="text-center text-sm text-slate-400">
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button type="button" onClick={toggleMode} className="font-medium text-cyan-400 hover:text-cyan-300">
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
            </p>
        </form>
      </div>
    </div>
  );
};
