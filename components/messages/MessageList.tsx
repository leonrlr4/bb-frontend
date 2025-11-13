import React, { useState } from 'react';
import { UserMessage } from './UserMessage';
import { ModelMessage } from './ModelMessage';
import type { Workflow, StreamingState } from '../../types';

interface MessageListProps {
  workflow: Workflow;
  isStreaming: boolean;
  liveStreamingState: StreamingState | null;
  streamingMessageId: string | null;
}

export const forceDownload = async (url: string, fileName: string) => {
    try {
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
  const [previewFile, setPreviewFile] = useState<{ name: string; content: string } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  
  const handleDownloadFile = async (name: string, url: string) => {
      setDownloadingFile(name);
      try {
          await forceDownload(url, name);
      } finally {
          setDownloadingFile(null);
      }
  };

  const handlePreviewFile = async (name: string, url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not fetch file content.");
      const content = await response.text();
      setPreviewFile({ name, content });
    } catch (err) {
      alert("Could not load file preview.");
    }
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
          />
        )
      )}
    </div>
  );
};
