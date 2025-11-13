import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuitIcon, RefreshIcon } from './icons';
import { MessageList } from './messages/MessageList';
import { MessageInput } from './input/MessageInput';
import type { Workflow, Template, StreamingState } from '../types';

interface MainPanelProps {
  workflow: Workflow | null;
  onSendMessage: (prompt: string, files: File[]) => void;
  isLoading: boolean;
  error: string | null;
  initialPrompt: string;
  onInitialPromptConsumed: () => void;
  isStreaming: boolean;
  liveStreamingState: StreamingState | null;
  streamingMessageId: string | null;
}

const TEMPLATES: Template[] = [
  { value: 'count-gc', label: 'Count GC reads', prompt: 'Write Python code to count the total number of GC reads in this FASTA file' },
  { value: 'longest-sequence', label: 'Longest Sequence', prompt: 'Write Python code to print the ID and length of the longest sequence in this FASTA file' },
  { value: 'reverse-complement', label: 'Reverse Complement', prompt: 'Write Python code to reverse-complement all sequences in this FASTA file and save them to a new FASTA file' }
];

const WelcomeMessage: React.FC<{ onSelectTemplate: (prompt: string) => void; templates: Template[] }> = ({ onSelectTemplate, templates }) => (
  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8">
      <BrainCircuitIcon className="w-16 h-16 mb-4 text-slate-500" />
      <h2 className="text-2xl font-bold text-slate-200">Bio Build Workflow</h2>
      <p className="mt-2 max-w-md">
          Start a new workflow by describing a task, or select a template to begin.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
          {templates.map(template => (
              <button
                  key={template.value}
                  onClick={() => onSelectTemplate(template.prompt)}
                  className="bg-slate-900/30 backdrop-blur-lg p-5 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 hover:border-cyan-500/50 transition-all text-left"
              >
                  <p className="font-semibold text-slate-200">{template.label}</p>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-3">{template.prompt}</p>
              </button>
          ))}
      </div>
  </div>
);

export const MainPanel: React.FC<MainPanelProps> = ({
  workflow, onSendMessage, isLoading, error, initialPrompt, onInitialPromptConsumed,
  isStreaming, liveStreamingState, streamingMessageId
}) => {
  const [prompt, setPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      onInitialPromptConsumed();
    }
  }, [initialPrompt, onInitialPromptConsumed]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [workflow?.history, liveStreamingState]);

  return (
    <main className="flex flex-col w-full h-full bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl">
      <div className="flex-1 overflow-y-auto p-4">
        {workflow ? (
          <>
            <MessageList
              workflow={workflow}
              isStreaming={isStreaming}
              liveStreamingState={liveStreamingState}
              streamingMessageId={streamingMessageId}
            />
            <div ref={messagesEndRef} />
          </>
        ) : (
          <WelcomeMessage onSelectTemplate={(p) => setPrompt(p)} templates={TEMPLATES} />
        )}
        {isLoading && !isStreaming && (
          <div className="flex justify-center items-center p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshIcon className="w-5 h-5 animate-spin" />
              <span>Loading workflow details...</span>
            </div>
          </div>
        )}
      </div>

      <MessageInput
        prompt={prompt}
        setPrompt={setPrompt}
        onSendMessage={onSendMessage}
        isStreaming={isStreaming}
        error={error}
      />
    </main>
  );
};