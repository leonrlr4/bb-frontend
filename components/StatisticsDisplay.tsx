import React from 'react';
import type { Statistics } from '../types';

// Helper to format numbers, especially floats, and handle N/A cases.
const formatNumber = (num: any, precision = 2) => {
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return <span className="text-slate-500 text-lg">N/A</span>;
    // Avoid unnecessary decimals for integers
    return parsed % 1 === 0 ? parsed.toLocaleString() : parsed.toFixed(precision);
};

// A redesigned card for metrics that have multiple sub-values (min, max, mean).
const MetricDetailCard: React.FC<{ metric: any }> = ({ metric }) => {
    if (!metric || typeof metric !== 'object') return null;
    const name = metric.name?.replace(/_/g, ' ') || 'Metric';

    // Renders a single sub-metric item.
    const SubMetric: React.FC<{ label: string, value: any }> = ({ label, value }) => (
         <div className="text-center">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold text-slate-200 mt-1">{formatNumber(value)}</p>
        </div>
    );

    return (
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50 col-span-1 md:col-span-2">
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-3">{name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {'min' in metric && <SubMetric label="Min" value={metric.min} />}
                {'max' in metric && <SubMetric label="Max" value={metric.max} />}
                {'mean' in metric && <SubMetric label="Mean" value={metric.mean} />}
                {'median' in metric && <SubMetric label="Median" value={metric.median} />}
                {'stdev' in metric && <SubMetric label="Std Dev" value={metric.stdev} />}
            </div>
        </div>
    );
};

// A simple card for single-value categorical data.
const CategoricalCard: React.FC<{ cat: any }> = ({ cat }) => (
    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{cat.name?.replace(/_/g, ' ') || 'Category'}</p>
        <p className="text-slate-100 text-2xl font-semibold mt-1">
            {formatNumber(cat.value)}
        </p>
    </div>
);

// Updated table for object-based distributions.
const DistributionTable: React.FC<{ distribution: any }> = ({ distribution }) => {
    const name = distribution?.name ?? 'Distribution';
    const bins = distribution?.bins;

    if (!bins || typeof bins !== 'object' || Object.keys(bins).length === 0) {
        return (
            <div>
                <h4 className="text-md font-semibold text-slate-200 mb-2 capitalize">{name.replace(/_/g, ' ')}</h4>
                <p className="text-sm text-amber-400">Could not display distribution: Data is malformed or empty.</p>
            </div>
        );
    }
    
    const entries = Object.entries(bins);

    return (
        <div>
            <h4 className="text-md font-semibold text-slate-200 mb-3 capitalize">{name.replace(/_/g, ' ')}</h4>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-700/50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-slate-300 font-medium">Bin</th>
                            <th scope="col" className="px-4 py-2 text-slate-300 font-medium text-right">Count</th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-800/50">
                        {entries.map(([bin, count], index) => (
                            <tr key={index} className="border-t border-slate-700">
                                <td className="px-4 py-2 font-mono text-slate-300">{bin}</td>
                                <td className="px-4 py-2 font-mono text-slate-300 text-right">{String(count)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const StatisticsDisplay: React.FC<{ stats: Statistics }> = ({ stats }) => {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
        return <p className="text-sm text-slate-400">{stats || 'No statistics available to display.'}</p>;
    }

    const { summary, metrics, distributions, categorical } = stats;

    return (
        <div className="space-y-8">
             {/* --- Summary Section for Categorical Data --- */}
            {(summary || (Array.isArray(categorical) && categorical.length > 0)) && (
                 <div>
                    <h3 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-700 pb-2">Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {summary?.total_records != null && <CategoricalCard cat={{name: 'Total Records', value: summary.total_records}} />}
                       {Array.isArray(categorical) && categorical.map((cat, i) => (
                           <CategoricalCard key={i} cat={cat} />
                       ))}
                    </div>
                </div>
            )}
            
            {/* --- Detailed Metrics Section --- */}
            {Array.isArray(metrics) && metrics.length > 0 && (
                 <div>
                    <h3 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-700 pb-2">Detailed Metrics</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {metrics.map((metric, i) => (
                           <MetricDetailCard key={i} metric={metric} />
                        ))}
                    </div>
                </div>
            )}

            {/* --- Distributions Section --- */}
            {Array.isArray(distributions) && distributions.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-700 pb-2">Distributions</h3>
                    <div className="space-y-6">
                        {distributions.map((dist, i) => (
                           <DistributionTable key={i} distribution={dist} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};