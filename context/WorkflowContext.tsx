import React, { createContext, useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { getWorkflowHistory, getConversationDetails, runWorkflowStream } from '../services/workflowService';
import { useAuth } from './AuthContext';
import type { Workflow, Message, Template, AIResponsePayload, User, FinalResultPayload, NodeMetadata, StreamingState, Statistics, StreamCallbacks } from '../types';

const getInitialStreamingState = (): StreamingState => ({
  currentNode: 'Initializing...',
  progress: 5,
  nodes: [],
  streamingCode: '',
  streamingDescription: '',
});

interface WorkflowContextType {
  workflows: Workflow[];
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
  activeWorkflow: Workflow | null;
  isHistoryLoading: boolean;
  isDetailsLoading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  selectWorkflow: (workflowId: string) => void;
  createNewWorkflow: () => void;
  sendMessage: (prompt: string, files: File[]) => void;
  fetchHistory: () => void;
  isStreaming: boolean;
  liveStreamingState: StreamingState | null;
  streamingMessageId: string | null;
  initialPrompt: string;
  setInitialPrompt: React.Dispatch<React.SetStateAction<string>>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState('');

  const [isStreaming, setIsStreaming] = useState(false);
  const [liveStreamingState, setLiveStreamingState] = useState<StreamingState | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchHistory = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;

    setIsHistoryLoading(true);
    setError(null);
    try {
      const serverWorkflows = await getWorkflowHistory();
      setWorkflows(serverWorkflows);
    } catch (error) {
      console.error("Failed to fetch workflow history:", error);
      setError('Could not load your past workflows.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setWorkflows([]);
      setActiveWorkflowId(null);
    }
  }, [user, fetchHistory]);
  
  const streamCallbacks: StreamCallbacks = useMemo(() => {
    const progressMap: { [key: string]: number } = { 'intent': 20, 'codegen': 40, 'execution': 60, 'review': 80, 'qa': 95 };

    return {
      onWorkflowStart: () => setLiveStreamingState(s => ({ ...(s || getInitialStreamingState()), currentNode: 'Workflow Started', progress: 10 })),
      onConversationCreated: (newConvId: string) => {
        setWorkflows(prev => {
          const currentStreamingMessageId = streamingMessageIdRef.current;
          if (!currentStreamingMessageId) return prev;
          const workflowIndex = prev.findIndex(w => w.history.some(m => m.id === currentStreamingMessageId));
          if (workflowIndex === -1) return prev;
          setActiveWorkflowId(newConvId);
          const updatedWorkflows = [...prev];
          updatedWorkflows[workflowIndex] = { ...updatedWorkflows[workflowIndex], id: newConvId, conversationId: newConvId };
          return updatedWorkflows;
        });
      },
      onLlmToken: (data) => setLiveStreamingState(s => (!s || data.node !== 'codegen' || !data.token) ? s : { ...s, streamingCode: (s.streamingCode || '') + data.token }),
      onNodeProgress: (data) => setLiveStreamingState(s => {
        if (!s) return null;
        const updatedNodes = s.nodes.map(node => node.name === data.node && node.status === 'running' ? { ...node, progressMessages: [...(node.progressMessages || []), data.message] } : node);
        return { ...s, nodes: updatedNodes };
      }),
      onResultStreamChunk: (data) => setLiveStreamingState(s => ({ ...(s || getInitialStreamingState()), streamingDescription: ((s?.streamingDescription || '') + data.chunk) })),
      onNodeStart: (data) => setLiveStreamingState(s => {
        const state = s || getInitialStreamingState();
        const newNode: NodeMetadata = { name: data.node, status: 'running', duration_ms: 0, started_at: data.started_at || new Date().toISOString(), metadata: {} as any, progressMessages: [] };
        const existingNodeIndex = state.nodes.findIndex(n => n.name === data.node);
        const updatedNodes = existingNodeIndex !== -1 ? state.nodes.map((node, index) => index === existingNodeIndex ? newNode : node) : [...state.nodes, newNode];
        return { ...state, currentNode: data.node, progress: progressMap[data.node] || state.progress, nodes: updatedNodes };
      }),
      onNodeComplete: (data) => setLiveStreamingState(s => {
        if (!s) return null;
        let updatedNodes = s.nodes.map(node => node.name === data.node ? { ...node, status: data.status as 'success' | 'failed', duration_ms: data.duration_ms, completed_at: new Date().toISOString(), metadata: data.metadata || {} } : node);
        if (!updatedNodes.some(n => n.name === data.node)) {
          updatedNodes.push({ name: data.node, status: data.status as 'success' | 'failed', duration_ms: data.duration_ms, started_at: new Date(Date.now() - (data.duration_ms || 0)).toISOString(), completed_at: new Date().toISOString(), metadata: data.metadata || {} });
        }
        return { ...s, nodes: updatedNodes };
      }),
      onFinalResult: async (finalResult: FinalResultPayload) => {
        const currentStreamingMessageId = streamingMessageIdRef.current;
        if (!currentStreamingMessageId) return;

        let statisticsData: Statistics | string = "Statistics not available.";
        const statsFile = finalResult.output_files.find(f => f.file_name === 'statistics.json');
        if (statsFile?.download_url) {
            try {
                const statsResponse = await fetch(statsFile.download_url);
                statisticsData = statsResponse.ok ? await statsResponse.json() : "Could not load statistics data.";
            } catch (error) {
                statisticsData = "Error parsing statistics file.";
            }
        }

        setWorkflows(prev => prev.map(w => {
          if (!w.history.some(m => m.id === currentStreamingMessageId)) return w;
          
          const responsePayload: AIResponsePayload = {
            description: finalResult.description || finalResult.execution?.stdout || "Workflow completed.",
            code: finalResult.code,
            statistics: statisticsData,
            outputFiles: finalResult.output_files.map(f => ({ name: f.file_name, downloadUrl: f.download_url })),
            toolsUsed: [],
            executionTrace: finalResult.nodes,
          };
          const finalModelMessage: Message = { id: finalResult.message_id || currentStreamingMessageId, role: 'model', prompt: '', files: [], timestamp: new Date(), response: responsePayload };
          
          const updatedHistory = w.history.map(msg => {
            if (msg.id === currentStreamingMessageId) return finalModelMessage;
            const userMessageId = w.history[w.history.findIndex(m => m.id === currentStreamingMessageId) - 1]?.id;
            if (msg.id === userMessageId) return { ...msg, inputFiles: finalResult.input_files.map(f => ({ name: f.file_name, downloadUrl: f.download_url })) };
            return msg;
          });
          return { ...w, history: updatedHistory };
        }));
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setTimeout(() => {
          setLiveStreamingState(null);
          setStreamingMessageId(null);
          streamingMessageIdRef.current = null;
        }, 500);
      },
      onError: (errorMessage) => {
        setError(errorMessage);
        setIsStreaming(false);
        const currentStreamingMessageId = streamingMessageIdRef.current;
        if (currentStreamingMessageId) {
          setWorkflows(prev => prev.map(w => ({ ...w, history: w.history.filter(m => m.id !== currentStreamingMessageId) })));
        }
        abortControllerRef.current = null;
        setLiveStreamingState(null);
        setStreamingMessageId(null);
        streamingMessageIdRef.current = null;
      },
    };
  }, []);

  const selectWorkflow = useCallback(async (workflowId: string) => {
    setActiveWorkflowId(workflowId);
    setError(null);

    const selectedWorkflow = workflows.find(w => w.id === workflowId);
    const needsFetching = selectedWorkflow && (selectedWorkflow.history.length === 0 || (selectedWorkflow.history.length > 1 && !selectedWorkflow.history[1].response));

    if (needsFetching) {
      setIsDetailsLoading(true);
      try {
        const history = await getConversationDetails(workflowId);
        setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, history } : w));
      } catch (err) {
        setError("Could not load the selected workflow's history.");
      } finally {
        setIsDetailsLoading(false);
      }
    }
  }, [workflows]);
  
  const createNewWorkflow = useCallback(() => {
    setActiveWorkflowId(null);
    setError(null);
  }, []);

  const sendMessage = useCallback((prompt: string, rawFiles: File[]) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      return;
    }

    setIsStreaming(true);
    setError(null);

    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', prompt, files: rawFiles, timestamp: new Date() };
    const placeholderModelMessage: Message = { id: `msg-${Date.now()}-ai`, role: 'model', prompt: '', files: [], timestamp: new Date() };
    
    setStreamingMessageId(placeholderModelMessage.id);
    streamingMessageIdRef.current = placeholderModelMessage.id;
    setLiveStreamingState(getInitialStreamingState());

    setWorkflows(prev => {
      if (!activeWorkflowId) {
        const newWorkflow: Workflow = { id: `wf-${Date.now()}`, title: prompt.substring(0, 40) + '...', createdAt: new Date(), history: [userMessage, placeholderModelMessage] };
        setActiveWorkflowId(newWorkflow.id);
        return [newWorkflow, ...prev];
      }
      return prev.map(w => w.id === activeWorkflowId ? { ...w, history: [...w.history, userMessage, placeholderModelMessage] } : w);
    });

    abortControllerRef.current = new AbortController();
    runWorkflowStream(prompt, rawFiles, activeWorkflowId, streamCallbacks, abortControllerRef.current.signal);

  }, [isStreaming, activeWorkflowId, streamCallbacks]);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId) || null;

  const value = {
    workflows,
    setWorkflows,
    activeWorkflow,
    isHistoryLoading,
    isDetailsLoading,
    error,
    setError,
    selectWorkflow,
    createNewWorkflow,
    sendMessage,
    fetchHistory,
    isStreaming,
    liveStreamingState,
    streamingMessageId,
    initialPrompt,
    setInitialPrompt,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
};

export const useWorkflow = (): WorkflowContextType => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};