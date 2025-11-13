import React, { useState } from 'react';
import { UserIcon, FileIcon, EyeIcon, DownloadIcon, RefreshIcon } from '../icons';
import { formatRelativeTime } from '../../utils';
import type { Message } from '../../types';

const ActionableFileChip: React.FC<{
    file: { name: string; downloadUrl: string };
    onPreview: (name: string, url: string) => void;
    onDownload: (name: string, url: string) => void;
    isDownloading: boolean;
}> = ({ file, onPreview, onDownload, isDownloading }) => {
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
                    onClick={() => onPreview(file.name, file.downloadUrl)} 
                    className="p-1.5 rounded-md hover:bg-slate-700 text-slate-300 transition-colors" 
                    title="Preview file"
                >
                    <EyeIcon className="w-4 h-4" />
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

const NewFileChip: React.FC<{ name: string; }> = ({ name }) => (
    <div className="flex items-center gap-2 bg-slate-700/50 p-2 rounded-md text-sm cursor-default" title={name}>
        <FileIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
        <span className="truncate flex-1">{name}</span>
    </div>
);

export const UserMessage: React.FC<{ 
    message: Message;
    onPreviewFile: (name: string, url: string) => void;
    onDownloadFile: (name: string, url: string) => void;
    downloadingFile: string | null;
}> = ({ message, onPreviewFile, onDownloadFile, downloadingFile }) => (
    <div className="flex items-start gap-4 p-4 my-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-slate-300" />
        </div>
        <div className="flex-1">
            <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-200">You</p>
                <p className="text-xs text-slate-500" title={message.timestamp.toLocaleString()}>
                    {formatRelativeTime(message.timestamp)}
                </p>
            </div>
            <div className="mt-2 space-y-3">
                {message.prompt && <p className="text-slate-200 whitespace-pre-wrap">{message.prompt}</p>}
                {(message.files?.length > 0 || message.inputFiles?.length > 0) && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {message.inputFiles?.map((file, index) => (
                             <ActionableFileChip 
                                key={`${file.name}-${index}`} 
                                file={file} 
                                onPreview={onPreviewFile} 
                                onDownload={onDownloadFile}
                                isDownloading={downloadingFile === file.name}
                            />
                        ))}
                        {message.files.map((file) => (
                            <NewFileChip key={file.name} name={file.name} />
                        ))}
                     </div>
                )}
            </div>
        </div>
    </div>
);
