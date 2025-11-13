
import React from 'react';
import type { NodeMetadata } from '../types';
import { ClockIcon, TokenIcon } from './icons';

interface NodesStatisticsProps {
  nodes: NodeMetadata[];
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 shadow-lg flex items-center gap-4 transition-all hover:border-slate-600 hover:bg-slate-800/80">
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm text-slate-400">{label}</div>
        <div className="text-2xl font-bold text-slate-100 mt-1">{value}</div>
      </div>
    </div>
);

export const NodesStatistics: React.FC<NodesStatisticsProps> = ({ nodes }) => {
  const totalDuration = nodes.reduce((sum, n) => sum + (n.duration_ms || 0), 0);
  const totalTokens = nodes.reduce((sum, n) => {
    // Safely access tokens: check for metadata existence first, then for the tokens property.
    const tokens = n.metadata && (n.metadata as any).tokens ? (n.metadata as any).tokens : 0;
    return sum + tokens;
  }, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StatCard
        icon={<ClockIcon className="w-8 h-8 text-cyan-400" />}
        label="Total Execution Time"
        value={`${(totalDuration / 1000).toFixed(2)}s`}
      />
      <StatCard
        icon={<TokenIcon className="w-8 h-8 text-amber-400" />}
        label="Total Tokens Used"
        value={totalTokens.toLocaleString()}
      />
    </div>
  );
};