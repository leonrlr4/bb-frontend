import React, { useEffect, useState } from 'react';
import type { NodeMetadata, NodeSpecificMetadata, IntentMetadata, CodegenMetadata, ExecutionMetadata, ReviewMetadata, QAMetadata } from '../types';
import { ChevronDownIcon, LinkIcon } from './icons';
import { StreamingCodeDisplay } from './StreamingCodeDisplay';


const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'border-green-500/50 bg-green-500/10';
      case 'failed': return 'border-red-500/50 bg-red-500/10';
      case 'running': return 'border-blue-500/50 bg-blue-500/10 animate-pulse';
      default: return 'border-slate-600/50 bg-slate-500/10';
    }
};

const getPillColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/15 border-green-500/40 text-green-300';
      case 'failed': return 'bg-red-500/15 border-red-500/40 text-red-300';
      case 'running': return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
      default: return 'bg-slate-700/30 border-slate-600/50 text-slate-300';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <span className="text-green-400">✓</span>;
      case 'failed': return <span className="text-red-400">×</span>;
      case 'running': return <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />;
      default: return <span className="text-slate-500">-</span>;
    }
};

const normalizeDateString = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return dateStr;
  let normalized = dateStr.replace(' ', 'T');
  if (!normalized.endsWith('Z') && !normalized.includes('+') && normalized.lastIndexOf('-') < 10) {
    normalized += 'Z';
  }
  return normalized;
};

const NodeMetadataDisplay: React.FC<{ node: NodeMetadata; nowTs?: number }> = ({ node, nowTs }) => {
  const { name, metadata } = node;

  const statusBadge = (status: string) => {
    const color = status === 'success' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-slate-400';
    return <span className={color}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  const renderLlmOutput = (n: NodeMetadata) => {
    const msgs = n.progressMessages || [];
    const stream = msgs.filter(m => m.startsWith('[stream] ')).join('').replace(/^\[stream\]\s*/g, '');
    if (!stream) return null;
    return (
      <div className="col-span-2 mt-2">
        <span className="text-slate-400">LLM Output:</span>
        <pre className="mt-1 bg-slate-900/60 p-2 rounded text-xs whitespace-pre-wrap text-slate-200 max-h-40 overflow-auto">{stream}</pre>
      </div>
    );
  };

  const model = (metadata as any)?.model ?? (metadata as any)?.model_used;
  const tokens = (metadata as any)?.tokens ?? (metadata as any)?.tokens_used;

  const durationMs = (node.status === 'running' && node.started_at)
    ? Math.max(0, (nowTs ?? Date.now()) - Date.parse(normalizeDateString(node.started_at)!))
    : (node.duration_ms || 0);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-300">
      <div><span className="text-slate-400">Status:</span> {statusBadge(node.status)}</div>
      {model && <div><span className="text-slate-400">Model:</span> {model}</div>}
      {tokens !== undefined && <div><span className="text-slate-400">Tokens:</span> {Number(tokens).toLocaleString()}</div>}

      {name === 'intent' && (
        <>
          {(metadata as IntentMetadata).intent && <div><span className="text-slate-400">Intent:</span> {(metadata as IntentMetadata).intent}</div>}
          {(metadata as IntentMetadata).complexity && (
            <div>
              <span className="text-slate-400">Complexity:</span>{' '}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                (metadata as IntentMetadata).complexity === 'high' ? 'bg-red-200/20 text-red-300' :
                (metadata as IntentMetadata).complexity === 'medium' ? 'bg-yellow-200/20 text-yellow-300' :
                'bg-green-200/20 text-green-300'
              }`}>
                {(metadata as IntentMetadata).complexity}
              </span>
            </div>
          )}
          {(metadata as IntentMetadata).domain && <div><span className="text-slate-400">Domain:</span> {(metadata as IntentMetadata).domain}</div>}
        </>
      )}

      {name === 'codegen' && (
        <>
          {(metadata as CodegenMetadata).code_length && <div><span className="text-slate-400">Code Length:</span> {(metadata as CodegenMetadata).code_length} chars</div>}
          {(metadata as CodegenMetadata).retry_count !== undefined && (metadata as CodegenMetadata).retry_count! > 0 && (
            <div><span className="text-slate-400">Retries:</span> <span className="text-orange-400">{(metadata as CodegenMetadata).retry_count}</span></div>
          )}
        </>
      )}

      {name === 'execution' && (
        <>
          {(metadata as ExecutionMetadata).output_files_count !== undefined && <div><span className="text-slate-400">Output Files:</span> {(metadata as ExecutionMetadata).output_files_count}</div>}
          {(metadata as ExecutionMetadata).uploaded_files_count !== undefined && <div><span className="text-slate-400">Uploaded Files:</span> {(metadata as ExecutionMetadata).uploaded_files_count}</div>}
          {(metadata as ExecutionMetadata).error && <div className="col-span-2 text-red-400"><span className="text-slate-400">Error:</span> {(metadata as ExecutionMetadata).error}</div>}
        </>
      )}

      {name === 'qa' && (
        <>
          {(metadata as QAMetadata).test_cases_length && <div><span className="text-slate-400">Test Cases:</span> {(metadata as QAMetadata).test_cases_length} chars</div>}
          {(metadata as QAMetadata).final_status && <div><span className="text-slate-400">Final Status:</span> {(metadata as QAMetadata).final_status}</div>}
        </>
      )}

      {node.started_at && <div><span className="text-slate-400">Started:</span> {new Date(Date.parse(normalizeDateString(node.started_at)!)).toLocaleString()}</div>}
      {node.completed_at && <div><span className="text-slate-400">Completed:</span> {new Date(Date.parse(normalizeDateString(node.completed_at)!)).toLocaleString()}</div>}
      <div><span className="text-slate-400">Duration:</span> {(durationMs / 1000).toFixed(2)}s</div>
      {node.progressMessages && node.progressMessages.length > 0 && (
        <div><span className="text-slate-400">Progress Messages:</span> {node.progressMessages.length}</div>
      )}

      {renderLlmOutput(node)}
    </div>
  );
};


const NodeCard: React.FC<{ node: NodeMetadata, isStreaming?: boolean, streamingCode?: string }> = ({ node, isStreaming, streamingCode }) => {
  const [isExpanded, setIsExpanded] = useState(node.status === 'running');
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    if (node.status === 'running') {
      const id = setInterval(() => setNowTs(Date.now()), 200);
      return () => clearInterval(id);
    }
  }, [node.status, node.started_at]);

  const headerDurationMs = (node.status === 'running' && node.started_at)
    ? Math.max(0, nowTs - Date.parse(normalizeDateString(node.started_at)!))
    : (node.duration_ms || 0);
  
  const isCodegenStreaming = isStreaming && node.name === 'codegen' && node.status === 'running';

  return (
    <div className={`pl-8 relative`}>
        <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            {getStatusIcon(node.status)}
        </div>
        <div className={`flex items-start gap-4 transition-all duration-300`}>
            <div className="flex-shrink-0">
                <div className={`p-2 rounded-full ${isExpanded ? 'bg-slate-700/50' : ''}`}>
                    <LinkIcon className="w-5 h-5 text-slate-400" />
                </div>
            </div>
            <div className="flex-1 min-w-0">
                 <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold capitalize text-slate-200">{node.name.replace(/_/g, ' ')}</h4>
                    <span className="text-sm text-slate-400 font-mono">
                        {(headerDurationMs / 1000).toFixed(2)}s
                    </span>
                 </div>
                 <div className="mt-2 space-y-3">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    >
                        {isExpanded ? 'Hide' : 'Show'} Details <ChevronDownIcon className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                         <div className={`mt-2 p-4 rounded-lg border bg-slate-800/50 ${getStatusColor(node.status)}`}>
                             <NodeMetadataDisplay node={node} nowTs={nowTs} />
                             {isCodegenStreaming && streamingCode !== undefined && (
                                 <div className="mt-4">
                                     <StreamingCodeDisplay code={streamingCode} isStreaming={true} />
                                 </div>
                             )}
                            {node.progressMessages && node.progressMessages.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Progress</h5>
                                <div className="space-y-1.5">
                                    {node.progressMessages.map((msg, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="text-cyan-400">→</span>
                                        <span>{msg}</span>
                                    </div>
                                    ))}
                                </div>
                                </div>
                            )}
                         </div>
                     )}
                 </div>
            </div>
        </div>
    </div>
  );
};


export const ExecutionTrace: React.FC<{ trace: NodeMetadata[] | undefined, isStreaming?: boolean, streamingCode?: string }> = ({ trace, isStreaming, streamingCode }) => {

  if (!trace || trace.length === 0) {
    return (
        <div className="text-center py-8 text-slate-500">
            {isStreaming ? 'Waiting for workflow to start...' : 'No execution data available'}
        </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-slate-700/50 rounded-full" />
      <div className="space-y-6">
          {trace.map((node, index) => (
            <NodeCard key={`${node.name}-${index}`} node={node} isStreaming={isStreaming} streamingCode={streamingCode} />
          ))}
      </div>
    </div>
  );
};
// removed duplicate helpers
