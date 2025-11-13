
import React, { useEffect, useState } from 'react';
import type { NodeMetadata } from '../types';
import { ClockIcon, TokenIcon } from './icons';

interface NodesStatisticsProps {
  nodes: NodeMetadata[];
}

const StatItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 px-2 py-1">
    <div className="flex-shrink-0">
      {icon}
    </div>
    <div>
      <div className="text-[10px] tracking-wider text-slate-400 uppercase">{label}</div>
      <div className="text-base font-bold text-slate-100 font-mono motion-safe:transition-opacity motion-safe:duration-150">{value}</div>
    </div>
  </div>
);

export const NodesStatistics: React.FC<NodesStatisticsProps> = ({ nodes }) => {
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    if (nodes.some(n => n.status === 'running')) {
      const id = setInterval(() => setNowTs(Date.now()), 200);
      return () => clearInterval(id);
    }
  }, [nodes]);

  const normalizeDateString = (dateStr: string | undefined): string | undefined => {
    if (!dateStr) return dateStr;
    let normalized = dateStr.replace(' ', 'T');
    if (!normalized.endsWith('Z') && !normalized.includes('+') && normalized.lastIndexOf('-') < 10) {
      normalized += 'Z';
    }
    return normalized;
  };

  const totalDuration = nodes.reduce((sum, n) => {
    if (n.status === 'running' && n.started_at) {
      const started = Date.parse(normalizeDateString(n.started_at)!);
      const elapsed = Math.max(0, nowTs - started);
      return sum + elapsed;
    }
    return sum + (n.duration_ms || 0);
  }, 0);
  const totalTokens = nodes.reduce((sum, n) => {
    const meta: any = n.metadata || {};
    const tokens = meta.tokens ?? meta.tokens_used ?? 0;
    return sum + (typeof tokens === 'number' ? tokens : 0);
  }, 0);

  return (
    <div className="flex flex-col md:flex-row items-center md:items-stretch gap-1 md:gap-3 divide-y md:divide-y-0 md:divide-x divide-slate-700/40">
      <StatItem icon={<ClockIcon className="w-4 h-4 text-cyan-400" />} label="Total Execution Time" value={`${(totalDuration / 1000).toFixed(2)}s`} />
      <StatItem icon={<TokenIcon className="w-4 h-4 text-amber-400" />} label="Total Tokens Used" value={totalTokens.toLocaleString()} />
    </div>
  );
};
