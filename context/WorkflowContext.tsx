import React, { createContext, useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { getWorkflowHistory, getConversationDetails, runWorkflowStream, getConversationFiles } from '../services/workflowService';
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
  const liveStateRef = useRef<StreamingState | null>(null);
  const activeWorkflowIdRef = useRef<string | null>(null);
  const nodeBuffersRef = useRef<Record<string, { progress: string[]; llm: string; codePreview?: string }>>({});

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
  useEffect(() => { liveStateRef.current = liveStreamingState; }, [liveStreamingState]);
  useEffect(() => { activeWorkflowIdRef.current = activeWorkflowId; }, [activeWorkflowId]);
  
  const streamCallbacks: StreamCallbacks = useMemo(() => {
    const progressMap: { [key: string]: number } = { 'intent': 20, 'codegen': 40, 'execution': 60, 'review': 80, 'qa': 95 };

    return {
      onWorkflowStart: () => setLiveStreamingState(s => {
        const base = s || getInitialStreamingState();
        return { ...base, currentNode: 'Workflow Started', progress: 10, nodes: base.nodes };
      }),
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
      onFilesUploaded: async () => {
        const convId = activeWorkflowIdRef.current;
        if (!convId) return;
        try {
          const files = await getConversationFiles(convId);
          setWorkflows(prev => prev.map(w => {
            if (w.id !== convId) return w;
            const lastUserIndex = w.history.findIndex(m => m.role === 'user');
            if (lastUserIndex === -1) return w;
            const userMsg = w.history[lastUserIndex];
            const updatedUserMsg = { ...userMsg, inputFiles: files.input };
            const history = [...w.history];
            history[lastUserIndex] = updatedUserMsg;
            return { ...w, history };
          }));
        } catch (e) {
          console.warn('Failed to fetch conversation files during streaming:', e);
        }
      },
      onLlmToken: (data) => setLiveStreamingState(s => {
        if (!s || !data.token) return s;
        const hasNode = (s.nodes || []).some(n => n.name === data.node);
        if (!hasNode) {
          const buf = nodeBuffersRef.current[data.node] || { progress: [], llm: '' };
          buf.llm += data.token;
          nodeBuffersRef.current[data.node] = buf;
          const placeholder: NodeMetadata = { name: data.node, status: 'running', duration_ms: 0, started_at: new Date().toISOString(), metadata: {} as any, progressMessages: [] };
          return { ...s, nodes: [...(s.nodes || []), placeholder], currentNode: data.node, progress: ( { 'intent': 20, 'codegen': 40, 'execution': 60, 'review': 80, 'qa': 95 } as any )[data.node] || s.progress };
        }
        if (data.content_type === 'code' || (!data.content_type && data.node === 'codegen')) {
          return { ...s, streamingCode: (s.streamingCode || '') + data.token };
        }
        const updatedNodes = (s.nodes || []).map(node => {
          if (node.name !== data.node) return node;
          const msgs = [...(node.progressMessages || [])];
          const lastIndex = msgs.length - 1;
          if (lastIndex >= 0 && msgs[lastIndex].startsWith('[stream] ')) {
            msgs[lastIndex] = msgs[lastIndex] + data.token;
          } else {
            msgs.push('[stream] ' + data.token);
          }
          return { ...node, progressMessages: msgs };
        });
        return { ...s, nodes: updatedNodes };
      }),
      onNodeProgress: (data) => setLiveStreamingState(s => {
        if (!s) return null;
        const hasNode = s.nodes.some(n => n.name === data.node);
        if (!hasNode) {
          const buf = nodeBuffersRef.current[data.node] || { progress: [], llm: '' };
          buf.progress.push(data.message);
          nodeBuffersRef.current[data.node] = buf;
          return s;
        }
        const updatedNodes = s.nodes.map(node => {
          if (node.name !== data.node || node.status !== 'running') return node;
          const msgs = [...(node.progressMessages || [])];
          const last = msgs[msgs.length - 1];
          if (last === data.message) return node; // 去重複
          return { ...node, progressMessages: [...msgs, data.message] };
        });
        return { ...s, nodes: updatedNodes };
      }),
      onResultStreamChunk: (data) => setLiveStreamingState(s => {
        const base = s || getInitialStreamingState();
        let streamingDescription = base.streamingDescription || '';
        let streamingCode = base.streamingCode || '';
        let nodes = base.nodes || [];
        if (data.code_preview) {
          const hasCodegen = nodes.some(n => n.name === 'codegen');
          if (!hasCodegen) {
            const buf = nodeBuffersRef.current['codegen'] || { progress: [], llm: '' };
            buf.codePreview = data.code_preview;
            nodeBuffersRef.current['codegen'] = buf;
          } else {
            streamingCode = data.code_preview;
            nodes = nodes.map(n => n.name === 'codegen' ? { ...n, metadata: { ...(n.metadata || {}), code_length: data.code_length || (data.code_preview?.length || 0) } as any } : n);
          }
        }
        if (data.chunk) {
          streamingDescription = streamingDescription + data.chunk;
        }
        return { ...base, streamingDescription, streamingCode, nodes };
      }),
      onNodeStart: (data) => setLiveStreamingState(s => {
        const state = s || getInitialStreamingState();
        const newNode: NodeMetadata = { name: data.node, status: 'running', duration_ms: 0, started_at: data.started_at || new Date().toISOString(), metadata: {} as any, progressMessages: [] };
        const existingNodeIndex = state.nodes.findIndex(n => n.name === data.node);
        let updatedNodes = existingNodeIndex !== -1 ? state.nodes.map((node, index) => index === existingNodeIndex ? newNode : node) : [...state.nodes, newNode];
        const buf = nodeBuffersRef.current[data.node];
        if (buf) {
          updatedNodes = updatedNodes.map(n => n.name === data.node ? { ...n, progressMessages: buf.progress.length ? buf.progress : n.progressMessages } : n);
          if (data.node === 'codegen') {
            const codeAccum = (state.streamingCode || '') + (buf.llm || '') + (buf.codePreview || '');
            nodeBuffersRef.current[data.node] = { progress: [], llm: '', codePreview: undefined };
            return { ...state, currentNode: data.node, progress: progressMap[data.node] || state.progress, nodes: updatedNodes, streamingCode: codeAccum };
          }
          nodeBuffersRef.current[data.node] = { progress: [], llm: '', codePreview: undefined };
        }
        return { ...state, currentNode: data.node, progress: progressMap[data.node] || state.progress, nodes: updatedNodes };
      }),
      onNodeComplete: (data) => setLiveStreamingState(s => {
        if (!s) return null;
        const mappedStatus: 'success' | 'failed' = data.status === 'completed' ? 'success' : data.status === 'error' ? 'failed' : (data.status as 'success' | 'failed');
        const meta = data.metadata || {};
        let mappedMeta: any = meta;
        if (data.node === 'intent') {
          mappedMeta = { model: meta.model_used || meta.model, tokens: meta.tokens_used || meta.tokens };
        } else if (data.node === 'codegen') {
          mappedMeta = { model: meta.model_used || meta.model, tokens: meta.tokens_used || meta.tokens, code_length: meta.code_length };
        } else if (data.node === 'execution') {
          mappedMeta = { success: (meta.execution_success ?? meta.success) as boolean | undefined, output_files_count: meta.output_files_count, uploaded_files_count: meta.uploaded_files_count, error: meta.error };
        } else if (data.node === 'review') {
          mappedMeta = { model: meta.model_used || meta.model, tokens: meta.tokens_used || meta.tokens };
        } else if (data.node === 'qa') {
          mappedMeta = { model: meta.model_used || meta.model, tokens: meta.tokens_used || meta.tokens, test_cases_length: meta.test_cases_length, final_status: meta.final_status };
        }
        let updatedNodes = s.nodes.map(node => node.name === data.node ? { ...node, status: mappedStatus, duration_ms: data.duration_ms, completed_at: new Date().toISOString(), metadata: mappedMeta } : node);
        if (!updatedNodes.some(n => n.name === data.node)) {
          updatedNodes.push({ name: data.node, status: mappedStatus, duration_ms: data.duration_ms, started_at: new Date(Date.now() - (data.duration_ms || 0)).toISOString(), completed_at: new Date().toISOString(), metadata: mappedMeta });
        }
        return { ...s, nodes: updatedNodes };
      }),
      onFinalResult: async (finalResult: FinalResultPayload) => {
        const prevNodes = liveStateRef.current?.nodes || [];
        const mappedFinalNodes = (finalResult.nodes || []).map((n: any) => ({
          name: n.name,
          status: (n.status === 'completed' ? 'success' : (n.status === 'error' ? 'failed' : n.status)) as 'success' | 'failed' | 'running',
          duration_ms: Number(n.duration_ms || 0),
          metadata: ({} as any),
          progressMessages: Array.isArray(n.progress_messages) ? n.progress_messages : []
        }));
        const mergedNodes = mappedFinalNodes.map(n => {
          const prev = prevNodes.find(p => p.name === n.name);
          if (prev) {
            return {
              ...prev,
              status: n.status,
              duration_ms: n.duration_ms,
              progressMessages: (prev.progressMessages && prev.progressMessages.length > 0) ? prev.progressMessages : n.progressMessages
            };
          }
          return n;
        });

        setLiveStreamingState(s => ({ ...(s || getInitialStreamingState()), nodes: mergedNodes, currentNode: 'Completed', progress: 100 }));

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
            inputFiles: finalResult.input_files.map(f => ({ name: f.file_name, downloadUrl: f.download_url })),
            toolsUsed: [],
            executionTrace: mergedNodes,
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
          nodeBuffersRef.current = {};
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
    const trimmed = (prompt || '').trim();
    if (trimmed.length === 0) {
      setError('Please input something before sending.');
      return;
    }
    if (isStreaming) {
      abortControllerRef.current?.abort();
      return;
    }

    setIsStreaming(true);
    setError(null);

    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', prompt: trimmed, files: rawFiles, timestamp: new Date() };
    const placeholderModelMessage: Message = { id: `msg-${Date.now()}-ai`, role: 'model', prompt: '', files: [], timestamp: new Date() };
    
    setStreamingMessageId(placeholderModelMessage.id);
    streamingMessageIdRef.current = placeholderModelMessage.id;
    setLiveStreamingState(getInitialStreamingState());

    setWorkflows(prev => {
      if (!activeWorkflowId) {
        const newWorkflow: Workflow = { id: `wf-${Date.now()}`, title: trimmed.substring(0, 40) + '...', createdAt: new Date(), history: [userMessage, placeholderModelMessage] };
        setActiveWorkflowId(newWorkflow.id);
        return [newWorkflow, ...prev];
      }
      return prev.map(w => w.id === activeWorkflowId ? { ...w, history: [...w.history, userMessage, placeholderModelMessage] } : w);
    });

    abortControllerRef.current = new AbortController();
    runWorkflowStream(trimmed, rawFiles, activeWorkflowId, streamCallbacks, abortControllerRef.current.signal);

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
