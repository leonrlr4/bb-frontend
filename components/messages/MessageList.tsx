import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { API_BASE_URL } from '@/config';
import { fetchWithAuth } from '../../services/apiClient';
import { UserMessage } from './UserMessage';
import { ModelMessage } from './ModelMessage';
import type { Workflow, StreamingState } from '../../types';
import { DownloadIcon, ClipboardIcon } from '../icons';

interface MessageListProps {
  workflow: Workflow;
  isStreaming: boolean;
  liveStreamingState: StreamingState | null;
  streamingMessageId: string | null;
}

export const forceDownload = async (url: string, fileName: string) => {
    try {
        if (url.startsWith('blob:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Download failed:", error);
        alert(`Could not download the file. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const MessageList: React.FC<MessageListProps> = ({ workflow, isStreaming, liveStreamingState, streamingMessageId }) => {
  const [previewFile, setPreviewFile] = useState<{ name: string; contentType: string; contentText?: string; contentUrl?: string } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [previewingFile, setPreviewingFile] = useState<string | null>(null);
  
  const handleDownloadFile = async (name: string, url: string) => {
      setDownloadingFile(name);
      try {
          await forceDownload(url, name);
      } finally {
          setDownloadingFile(null);
      }
  };

  const handlePreviewFile = async (file: { name: string; downloadUrl: string; filePath?: string }) => {
    try {
      setPreviewingFile(file.name);
      setPreviewFile({ name: file.name, contentType: 'loading' });
      let previewUrl = file.downloadUrl;
      if (file.filePath) {
        previewUrl = `${API_BASE_URL}/api/files/preview?file_path=${encodeURIComponent(file.filePath)}`;
      }

      let response: Response;
      if (previewUrl.startsWith(API_BASE_URL)) {
        response = await fetchWithAuth(previewUrl, { method: 'GET' });
      } else {
        response = await fetch(previewUrl);
      }
      if (!response.ok) {
        response = await fetch(file.downloadUrl);
        if (!response.ok) throw new Error("Could not fetch file content.");
      }
      const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

      if (contentType.startsWith('image/')) {
        const blob = await response.blob();
        const urlObj = URL.createObjectURL(blob);
        setPreviewFile({ name: file.name, contentType, contentUrl: urlObj });
        return;
      }

      if (contentType === 'application/pdf') {
        const blob = await response.blob();
        const urlObj = URL.createObjectURL(blob);
        setPreviewFile({ name: file.name, contentType, contentUrl: urlObj });
        return;
      }

      const raw = await response.text();
      if (contentType.includes('json') || /\.json$/i.test(file.name)) {
        try {
          const obj = JSON.parse(raw);
          const pretty = JSON.stringify(obj, null, 2);
          setPreviewFile({ name: file.name, contentType: 'application/json', contentText: pretty });
          return;
        } catch {
          // fall through to plain text
        }
      }
      // Best-effort pretty print if looks like JSON but content type is text
      if ((raw.trim().startsWith('{') && raw.trim().endsWith('}')) || (raw.trim().startsWith('[') && raw.trim().endsWith(']'))) {
        try {
          const obj = JSON.parse(raw);
          const pretty = JSON.stringify(obj, null, 2);
          setPreviewFile({ name: file.name, contentType: 'application/json', contentText: pretty });
          return;
        } catch {}
      }
      setPreviewFile({ name: file.name, contentType, contentText: raw });
    } catch (err) {
      alert("Could not load file preview.");
    } finally {
      setPreviewingFile(null);
    }
  };

  const getLanguage = (name: string, contentType: string | undefined): string => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.js')) return 'javascript';
    if (lower.endsWith('.ts')) return 'typescript';
    if (lower.endsWith('.sh')) return 'bash';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
    if (lower.endsWith('.fa') || lower.endsWith('.fasta') || lower.endsWith('.txt')) return 'text';
    if (contentType === 'application/pdf') return 'pdf';
    return 'text';
  };

  return (
    <div>
      {workflow.history.map((message) =>
        message.role === 'user' ? (
          <UserMessage
            key={message.id}
            message={message}
            onPreviewFile={handlePreviewFile}
            onDownloadFile={handleDownloadFile}
            downloadingFile={downloadingFile}
          />
        ) : (
          <ModelMessage
            key={message.id}
            message={message}
            isStreaming={isStreaming && message.id === streamingMessageId}
            liveStreamingState={isStreaming && message.id === streamingMessageId ? liveStreamingState : null}
            onPreviewFile={handlePreviewFile}
            onDownloadFile={handleDownloadFile}
            downloadingFile={downloadingFile}
            previewingFile={previewingFile}
          />
        )
      )}
      {previewFile && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
          <div className="relative mx-auto mt-16 w-[min(95vw,1000px)] max-h-[80vh] bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-2xl ring-1 ring-slate-300/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
              <h4 className="text-sm font-semibold text-slate-200 truncate" title={previewFile.name}>{previewFile.name}</h4>
              <div className="flex items-center gap-2">
                {previewFile.contentText && (
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200"
                    onClick={() => navigator.clipboard.writeText(previewFile.contentText!)}
                    title="Copy content"
                  >
                    <ClipboardIcon className="w-4 h-4" />
                  </button>
                )}
                {previewFile.contentText && (
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200"
                    onClick={() => {
                      const blob = new Blob([previewFile.contentText!], { type: 'text/plain' });
                      const urlObj = URL.createObjectURL(blob);
                      forceDownload(urlObj, previewFile.name);
                    }}
                    title="Download"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                )}
                <button className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200" onClick={() => setPreviewFile(null)}>Close</button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(80vh-48px)]">
              {previewFile.contentType === 'loading' && (
                <div className="flex items-center gap-2 text-slate-300"><span className="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin inline-block" /> Loading preview...</div>
              )}
              {previewFile.contentUrl && previewFile.contentType?.startsWith('image/') && (
                <div className="flex items-center justify-center">
                  <img src={previewFile.contentUrl} alt={previewFile.name} className="max-h-[70vh] w-auto rounded" />
                </div>
              )}
              {previewFile.contentUrl && previewFile.contentType === 'application/pdf' && (
                <iframe src={previewFile.contentUrl} className="w-full h-[70vh] rounded" />
              )}
              {previewFile.contentText && (
                <div className="rounded-lg border border-slate-700/80 overflow-hidden">
                  <SyntaxHighlighter language={getLanguage(previewFile.name, previewFile.contentType)} style={vscDarkPlus} showLineNumbers customStyle={{ margin: 0, borderRadius: '0', backgroundColor: 'rgba(15, 23, 42, 0.5)', fontSize: '13px', padding: '16px' }} wrapLines lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }}>
                    {previewFile.contentText}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
