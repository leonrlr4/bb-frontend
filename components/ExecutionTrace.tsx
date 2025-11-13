import React, { useState } from 'react';
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

const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <span className="text-green-400">✓</span>;
      case 'failed': return <span className="text-red-400">×</span>;
      case 'running': return <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />;
      default: return <span className="text-slate-500">-</span>;
    }
};

const NodeMetadataDisplay: React.FC<{ node: NodeMetadata }> = ({ node }) => {
  const { name, metadata } = node;

  if (!metadata) {
    return <div className="text-xs text-slate-500">No metadata available for this node.</div>;
  }

  const renderSimpleMeta = (meta: { model?: string; tokens?: number }) => (
    <>
      {meta.model && <div><span className="text-slate-400">Model:</span> {meta.model}</div>}
      {meta.tokens && <div><span className="text-slate-400">Tokens:</span> {meta.tokens.toLocaleString()}</div>}
    </>
  );

  const renderSpecificMeta = () => {
    switch (name) {
      case 'intent': {
        const intentMeta = metadata as IntentMetadata;
        return (
          <>
            {renderSimpleMeta(intentMeta)}
            {intentMeta.intent && <div><span className="text-slate-400">Intent:</span> {intentMeta.intent}</div>}
            {intentMeta.complexity && (
              <div>
                <span className="text-slate-400">Complexity:</span>{' '}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  intentMeta.complexity === 'high' ? 'bg-red-200/20 text-red-300' :
                  intentMeta.complexity === 'medium' ? 'bg-yellow-200/20 text-yellow-300' :
                  'bg-green-200/20 text-green-300'
                }`}>{intentMeta.complexity}</span>
              </div>
            )}
            {intentMeta.domain && <div><span className="text-slate-400">Domain:</span> {intentMeta.domain}</div>}
          </>
        );
      }
      case 'codegen': {
        const codegenMeta = metadata as CodegenMetadata;
        return (
          <>
            {renderSimpleMeta(codegenMeta)}
            {codegenMeta.code_length && <div><span className="text-slate-400">Code Length:</span> {codegenMeta.code_length} chars</div>}
            {codegenMeta.retry_count !== undefined && codegenMeta.retry_count > 0 && (
              <div><span className="text-slate-400">Retries:</span> <span className="text-orange-400">{codegenMeta.retry_count}</span></div>
            )}
          </>
        );
      }
      case 'execution': {
        const execMeta = metadata as ExecutionMetadata;
        return (
          <>
            <div>
                <span className="text-slate-400">Status:</span>{' '}
                {execMeta.success ? <span className="text-green-400">Success</span> : <span className="text-red-400">Failed</span>}
            </div>
            {execMeta.output_files_count !== undefined && <div><span className="text-slate-400">Output Files:</span> {execMeta.output_files_count}</div>}
            {execMeta.uploaded_files_count !== undefined && <div><span className="text-slate-400">Uploaded Files:</span> {execMeta.uploaded_files_count}</div>}
            {execMeta.error && <div className="col-span-2 text-red-400"><span className="text-slate-400">Error:</span> {execMeta.error}</div>}
          </>
        );
      }
       case 'review': {
        const reviewMeta = metadata as ReviewMetadata;
        return renderSimpleMeta(reviewMeta);
       }
      case 'qa': {
        const qaMeta = metadata as QAMetadata;
        return (
          <>
            {renderSimpleMeta(qaMeta)}
            {qaMeta.test_cases_length && <div><span className="text-slate-400">Test Cases:</span> {qaMeta.test_cases_length} chars</div>}
          </>
        );
      }
      default:
        return <pre className="text-xs bg-slate-900 p-2 rounded overflow-auto">{JSON.stringify(metadata, null, 2)}</pre>;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-300">
      {renderSpecificMeta()}
    </div>
  );
};


const NodeCard: React.FC<{ node: NodeMetadata, isStreaming?: boolean, streamingCode?: string }> = ({ node, isStreaming, streamingCode }) => {
  const [isExpanded, setIsExpanded] = useState(node.status === 'running');
  
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
                        {node.duration_ms > 0 ? `${(node.duration_ms / 1000).toFixed(2)}s` : '0.00s'}
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
                             <NodeMetadataDisplay node={node} />
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