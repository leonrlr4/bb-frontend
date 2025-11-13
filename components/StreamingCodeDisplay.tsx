import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StreamingCodeDisplayProps {
  code: string;
  isStreaming: boolean;
}

export const StreamingCodeDisplay: React.FC<StreamingCodeDisplayProps> = ({ code, isStreaming }) => {
  if (!code && !isStreaming) {
    return null;
  }
  
  if (!code && isStreaming) {
     return (
      <div className="bg-slate-900/50 rounded-lg p-6 text-center text-slate-400 border border-slate-700/80">
        Waiting for code generation...
      </div>
    );
  }

  return (
    <div className="relative">
      {isStreaming && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-blue-600/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span>Generating...</span>
        </div>
      )}

      <div className="streaming-code-container relative rounded-lg border border-slate-700/80 max-h-[60vh] overflow-y-auto">
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            borderRadius: '0',
            backgroundColor: 'rgba(15, 23, 42, 0.5)', // slate-900/50
            fontSize: '14px',
            padding: '16px',
            minHeight: '100px',
          }}
          showLineNumbers
          wrapLines
          lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }}
        >
          {code}
        </SyntaxHighlighter>

        {isStreaming && (
            <span className="absolute bottom-4 left-[52px] inline-block w-0.5 h-5 bg-cyan-400 animate-pulse" />
        )}
      </div>
       <div className="mt-2 text-sm text-slate-500 text-right">
          {code.length.toLocaleString()} characters
        </div>
    </div>
  );
};