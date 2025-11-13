import React, { useState, useEffect, useRef } from 'react';
import { PaperclipIcon, XIcon, FileIcon } from '../icons';

interface MessageInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSendMessage: (prompt: string, files: File[]) => void;
  isStreaming: boolean;
  error: string | null;
}

export const MessageInput: React.FC<MessageInputProps> = ({ prompt, setPrompt, onSendMessage, isStreaming, error }) => {
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const MAX_FILES = 5;
  const MAX_FILE_SIZE_MB = 100;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const handleSendMessageClick = () => {
    if (prompt.trim() || files.length > 0) {
      onSendMessage(prompt, files);
      setPrompt('');
      setFiles([]);
      setLocalError(null);
    }
  };

  const addFiles = (incoming: File[]) => {
    if (!incoming || incoming.length === 0) return;
    const limitBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    const map = new Map<string, File>();
    files.forEach(f => map.set(`${f.name}-${f.size}-${f.lastModified}`, f));
    const rejected: string[] = [];
    incoming.forEach(f => {
      if (f.size > limitBytes) {
        rejected.push(`${f.name}`);
        return;
      }
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (!map.has(key)) map.set(key, f);
    });
    let list = Array.from(map.values());
    if (list.length > MAX_FILES) {
      list = list.slice(0, MAX_FILES);
      setLocalError(`最多上傳 ${MAX_FILES} 個檔案，已自動截斷`);
    } else if (rejected.length > 0) {
      setLocalError(`以下檔案超過大小限制 (${MAX_FILE_SIZE_MB}MB)：${rejected.join(', ')}`);
    } else {
      setLocalError(null);
    }
    setFiles(list);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 border-t border-slate-700/80 bg-slate-800/10 backdrop-blur-sm">
      {error && (
        <div className="mb-3 p-3 bg-red-900/40 text-red-300 border border-red-500/30 rounded-lg text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      {localError && (
        <div className="mb-3 p-3 bg-yellow-900/30 text-yellow-200 border border-yellow-500/30 rounded-lg text-sm">
          {localError}
        </div>
      )}

          {files.length > 0 && (
            <div className="mb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {files.map((file) => (
            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between bg-slate-700 p-2 rounded-md text-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="truncate" title={file.name}>{file.name}</span>
              </div>
              <button onClick={() => removeFile(files.findIndex(f => f === file))} className="p-1 rounded-full hover:bg-slate-600">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
            </div>
          )}

      <div
        className={`relative bg-slate-700/60 rounded-lg border border-slate-600/80 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500 transition ${isDragging ? 'ring-2 ring-cyan-500 border-cyan-500 border-dashed' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const dt = e.dataTransfer; if (dt?.files && dt.files.length) addFiles(Array.from(dt.files)); }}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessageClick();
            }
          }}
          placeholder="Describe the next step..."
          className="w-full bg-transparent text-slate-200 p-3 pr-44 border-none focus:ring-0 resize-none"
          rows={1}
          style={{ maxHeight: '200px' }}
        />
        <div className="absolute right-2 bottom-2 h-9 flex items-center gap-2">
          <button type="button" className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-md cursor-pointer transition-colors" onClick={() => fileInputRef.current?.click()} aria-label="Attach files">
            <PaperclipIcon className="w-5 h-5" />
            {files.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] px-1 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] leading-none text-center">
                {files.length}
              </span>
            )}
          </button>
          <input ref={fileInputRef} id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
          <button
            onClick={handleSendMessageClick}
            disabled={!isStreaming && !prompt.trim() && files.length === 0}
            className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {isStreaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
