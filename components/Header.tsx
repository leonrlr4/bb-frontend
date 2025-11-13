import React from 'react';
import type { User } from '../types';
import { BrainCircuitIcon, UserIcon, LogInIcon, LogOutIcon } from './icons';

interface HeaderProps {
  user: User | null;
  onSignInClick: () => void;
  onSignOutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onSignInClick, onSignOutClick }) => {
  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg">
      <div className="flex items-center">
        <BrainCircuitIcon className="w-8 h-8 text-cyan-400" />
        <h1 className="text-xl font-bold ml-3 bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
          Bio Build
        </h1>
      </div>
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-slate-300">
                <UserIcon className="w-5 h-5"/>
                <span>{user.email}</span>
            </span>
            <button
              onClick={onSignOutClick}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-3 py-2 rounded-md transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={onSignInClick}
            className="flex items-center gap-2 text-sm text-slate-200 bg-cyan-600 hover:bg-cyan-500 font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <LogInIcon className="w-4 h-4" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
