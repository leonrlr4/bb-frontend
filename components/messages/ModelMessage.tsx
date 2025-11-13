import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon, CheckIcon, FileIcon, BrainCircuitIcon, DownloadIcon, ChevronDownIcon, RefreshIcon, EyeIcon } from '../icons';
import { StatisticsDisplay } from '../StatisticsDisplay';
import { ExecutionTrace } from '../ExecutionTrace';
import { NodesStatistics } from '../NodesStatistics';
import type { Message, StreamingState } from '../../types';
import { formatRelativeTime } from '../../utils';

const ActionableFileChip: React.FC<{
    file: { name: string; downloadUrl: string; filePath?: string };
    onPreview: (file: { name: string; downloadUrl: string; filePath?: string }) => void;
    onDownload: (name: string, url: string) => void;
    isDownloading: boolean;
    isPreviewing?: boolean;
}> = ({ file, onPreview, onDownload, isDownloading, isPreviewing }) => {
    const [showActions, setShowActions] = useState(false);
    return (
        <div 
          className="relative flex items-center justify-between bg-slate-800/70 p-2 rounded-md text-sm col-span-1"
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <FileIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="truncate" title={file.name}>{file.name}</span>
            </div>
            <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
                <button 
                    onClick={() => onPreview(file)} 
                    disabled={Boolean(isPreviewing)}
                    className="p-1.5 rounded-md hover:bg-slate-700 disabled:cursor-not-allowed text-slate-300 transition-colors" 
                    title="Preview file"
                >
                    {isPreviewing ? <RefreshIcon className="w-4 h-4 text-slate-300 animate-spin" /> : <EyeIcon className="w-4 h-4" />}
                </button>
                <button 
                    onClick={() => onDownload(file.name, file.downloadUrl)} 
                    disabled={isDownloading}
                    className="p-1.5 rounded-md hover:bg-slate-700 disabled:cursor-not-allowed" 
                    title="Download file"
                >
                    {isDownloading 
                        ? <RefreshIcon className="w-4 h-4 text-slate-300 animate-spin" /> 
                        : <DownloadIcon className="w-4 h-4 text-slate-300" />}
                </button>
            </div>
        </div>
    );
};

const LogDisplay: React.FC<{ content: string }> = ({ content }) => {
  const sections = content.split(/(?===.*?===)/).filter(s => s.trim());
  return (
    <div className="font-mono text-sm text-slate-300 space-y-4">
      {sections.map((section, index) => {
        const lines = section.trim().split('\n');
        const header = lines.shift()?.replace(/=/g, '').trim();
        return (
          <div key={index}>
            {header && <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 pb-1 border-b border-slate-700/50">{header}</h4>}
            <div className="space-y-1.5 pl-2">
              {lines.map((line, lineIndex) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;
                if (trimmedLine.startsWith('✓')) return <div key={lineIndex} className="flex items-center gap-2 text-green-400"><CheckIcon className="w-4 h-4 flex-shrink-0" /><span>{trimmedLine.substring(1).trim()}</span></div>;
                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex > 0 && colonIndex < trimmedLine.length - 1) {
                  const key = trimmedLine.substring(0, colonIndex);
                  const value = trimmedLine.substring(colonIndex + 1);
                  return <div key={lineIndex} className="grid grid-cols-[max-content,1fr] gap-x-4 items-start"><span className="text-slate-500 text-right">{key}:</span><span className="text-slate-300 whitespace-pre-wrap">{value.trim()}</span></div>;
                }
                return <p key={lineIndex} className="text-slate-400">{trimmedLine}</p>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    return (
        <div className="relative">
            <button onClick={handleCopy} className="absolute top-3 right-3 z-10 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors" title="Copy code">
                {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
            </button>
            <div className="rounded-lg border border-slate-700/80 max-h-[60vh] overflow-y-auto">
                 <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0', backgroundColor: 'rgba(15, 23, 42, 0.5)', fontSize: '14px', padding: '16px' }} showLineNumbers wrapLines lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }}>
                  {code}
                </SyntaxHighlighter>
            </div>
            <div className="mt-2 text-sm text-slate-500 text-right">{code.length.toLocaleString()} characters</div>
        </div>
    );
};

export const ModelMessage: React.FC<{ 
    message: Message;
    isStreaming: boolean;
    liveStreamingState: StreamingState | null;
    onPreviewFile: (file: { name: string; downloadUrl: string; filePath?: string }) => void;
    onDownloadFile: (name: string, url: string) => void;
    downloadingFile: string | null;
    previewingFile?: string | null;
}> = ({ message, isStreaming, liveStreamingState, onPreviewFile, onDownloadFile, downloadingFile, previewingFile }) => {
  const response = message.response;
  const [activeTab, setActiveTab] = useState('result');
  const [isTraceExpanded, setIsTraceExpanded] = useState(true);

  const isLogOutput = response?.description?.includes('===');
  const totalDuration = (liveStreamingState?.nodes || response?.executionTrace || []).reduce((sum, n) => sum + (n.duration_ms || 0), 0);
  
  if (isStreaming && liveStreamingState) {
    return (
      <div className="flex items-start gap-4 p-4 my-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <BrainCircuitIcon className="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
        <div className="flex-1">
            <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-200">Assistant</p>
                <p className="text-xs text-slate-500" title={message.timestamp.toLocaleString()}>{formatRelativeTime(message.timestamp)}</p>
            </div>
            <div className="mt-2 pt-1 space-y-6">
                {liveStreamingState.streamingDescription && <p className="text-slate-300 whitespace-pre-wrap">{liveStreamingState.streamingDescription}<span className="inline-block w-0.5 h-4 bg-cyan-400 ml-1 animate-pulse" /></p>}
                 <div className="bg-slate-800/20 backdrop-blur-sm border border-slate-700/40 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-slate-700/60 cursor-pointer" onClick={() => setIsTraceExpanded(!isTraceExpanded)}>
                        <div className="flex items-center gap-2"><h3 className="text-md font-semibold text-slate-200 flex items-center">LangGraph Execution</h3><span className="ml-2 text-sm text-blue-400 animate-pulse">Running...</span></div>
                        <div className="flex items-center gap-4"><span className="text-sm font-mono text-slate-400">{(totalDuration / 1000).toFixed(2)}s</span><ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${isTraceExpanded ? 'rotate-180' : ''}`} /></div>
                    </div>
                    {isTraceExpanded && <div className="p-4 space-y-4"><NodesStatistics nodes={liveStreamingState.nodes || []} /><ExecutionTrace trace={liveStreamingState.nodes} isStreaming={true} streamingCode={liveStreamingState.streamingCode} /></div>}
                 </div>
            </div>
        </div>
      </div>
    );
  }

  if (!response) return null;

  const hasCode = response.code?.trim().length > 0;
  const hasStats = response.statistics && (typeof response.statistics === 'object' || !String(response.statistics).includes('not available'));
  const hasTrace = response.executionTrace?.length > 0;
  const hasOutputFiles = response.outputFiles?.length > 0;
  const tabs = [{ id: 'result', label: 'Result' }, ...(hasCode ? [{ id: 'code', label: 'Code' }] : []), ...(hasStats ? [{ id: 'statistics', label: 'Statistics' }] : []), { id: 'files', label: 'Files' }, ...(hasTrace ? [{ id: 'trace', label: 'Execution Trace' }] : [])];

  return (
    <div className="flex items-start gap-4 p-4 my-2">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"><BrainCircuitIcon className="w-5 h-5 text-cyan-400" /></div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2"><p className="font-semibold text-slate-200">Assistant</p><p className="text-xs text-slate-500" title={message.timestamp.toLocaleString()}>{formatRelativeTime(message.timestamp)}</p></div>
        <div className="bg-slate-800/20 backdrop-blur-sm border border-slate-700/40 rounded-lg overflow-hidden">
            <div className="border-b border-slate-700/60 px-2"><nav className="-mb-px flex space-x-2" aria-label="Tabs">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'} whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors`}>{tab.label}</button>)}</nav></div>
            <div className="p-4">
              {activeTab === 'result' && <div className="space-y-4">{isLogOutput ? <LogDisplay content={response.description} /> : <p className="text-slate-300 whitespace-pre-wrap">{response.description}</p>}</div>}
              {activeTab === 'files' && <div className="space-y-4"><div><h4 className="text-sm font-semibold text-slate-300 mb-2">Input Files</h4><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{(response.inputFiles || []).map(file => <ActionableFileChip key={`in-${file.name}`} file={file} onPreview={onPreviewFile} onDownload={onDownloadFile} isDownloading={downloadingFile === file.name} isPreviewing={previewingFile === file.name} />)}</div></div><div><h4 className="text-sm font-semibold text-slate-300 mb-2">Output Files</h4><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{response.outputFiles.map(file => <ActionableFileChip key={`out-${file.name}`} file={file} onPreview={onPreviewFile} onDownload={onDownloadFile} isDownloading={downloadingFile === file.name} isPreviewing={previewingFile === file.name} />)}</div></div></div>}
              {activeTab === 'code' && hasCode && <CodeBlock code={response.code} />}
              {activeTab === 'statistics' && hasStats && <StatisticsDisplay stats={response.statistics} />}
              {activeTab === 'trace' && hasTrace && <div className="space-y-4"><NodesStatistics nodes={response.executionTrace} /><ExecutionTrace trace={response.executionTrace} /></div>}
            </div>
        </div>
      </div>
    </div>
  );
};
