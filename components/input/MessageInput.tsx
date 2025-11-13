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
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
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

      {files.length > 0 && (
        <div className="mb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-slate-700 p-2 rounded-md text-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="truncate" title={file.name}>{file.name}</span>
              </div>
              <button onClick={() => removeFile(index)} className="p-1 rounded-full hover:bg-slate-600">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative bg-slate-700/60 rounded-lg border border-slate-600/80 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500 transition">
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
          className="w-full bg-transparent text-slate-200 p-3 pr-32 border-none focus:ring-0 resize-none"
          rows={1}
          style={{ maxHeight: '200px' }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <label htmlFor="file-upload" className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-md cursor-pointer transition-colors">
            <PaperclipIcon className="w-5 h-5" />
            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
          </label>
          <button
            onClick={handleSendMessageClick}
            disabled={isStreaming && !prompt.trim() && files.length === 0}
            className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {isStreaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};