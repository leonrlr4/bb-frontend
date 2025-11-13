import React from 'react';
import type { Workflow, Template } from '../types';
import { HistoryIcon, PlusIcon, RefreshIcon } from './icons';
import { formatRelativeTime } from '../utils';

const TEMPLATES: Template[] = [
  { value: 'count-gc', label: 'Count GC reads', prompt: 'Write Python code to count the total number of GC reads in this FASTA file' },
  { value: 'longest-sequence', label: 'Longest Sequence', prompt: 'Write Python code to print the ID and length of the longest sequence in this FASTA file' },
  { value: 'reverse-complement', label: 'Reverse Complement', prompt: 'Write Python code to reverse-complement all sequences in this FASTA file and save them to a new FASTA file' }
];

interface WorkflowPanelProps {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  onNewWorkflow: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  setInitialPrompt: (prompt: string) => void;
}

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({
  workflows, activeWorkflowId, onSelectWorkflow, onNewWorkflow,
  onRefresh, isRefreshing, setInitialPrompt
}) => {

  const handleSelectTemplate = (prompt: string) => {
    onNewWorkflow();
    setInitialPrompt(prompt);
  };

  return (
    <aside className="flex flex-col w-full h-full bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/80 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Workflows</h2>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          title="Refresh history"
        >
          <RefreshIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex-shrink-0">
        <button
          onClick={onNewWorkflow}
          className="flex items-center justify-center text-left p-3 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 w-full bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
        >
          <PlusIcon className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold ml-3 whitespace-nowrap">New Workflow</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        <h3 className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">History</h3>
        {workflows.length === 0 && !isRefreshing ? (
          <div className="flex flex-col items-center justify-center text-center text-slate-500 p-4 bg-slate-900/20 rounded-lg">
            <HistoryIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">Your past workflows will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {workflows.map((wf) => (
              <li key={wf.id}>
                <button
                  onClick={() => onSelectWorkflow(wf.id)}
                  className={`w-full text-left p-3 rounded-md transition-colors duration-200 border ${activeWorkflowId === wf.id ? 'bg-slate-700/80 border-slate-600' : 'bg-slate-800/40 border-transparent hover:bg-slate-700/50'}`}
                >
                  <p className="font-semibold text-slate-200 truncate">{wf.title}</p>
                  <p className="text-xs text-slate-500 text-right mt-2">
                    {formatRelativeTime(wf.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-slate-700/80 flex-shrink-0">
         <h3 className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Templates</h3>
         <ul className="space-y-1">
           {TEMPLATES.map((template) => (
             <li key={template.value}>
               <button
                 onClick={() => handleSelectTemplate(template.prompt)}
                 className="w-full text-left p-2 rounded-md transition-colors duration-200 text-slate-300 hover:bg-slate-700/50"
                 title={template.prompt}
               >
                 <p className="font-medium text-sm truncate">{template.label}</p>
               </button>
             </li>
           ))}
         </ul>
      </div>
    </aside>
  );
};