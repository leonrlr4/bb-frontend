import type { Workflow, Message, AIResponsePayload, NodeMetadata, Statistics, StreamCallbacks } from '../types';
import { fetchWithAuth } from './apiClient';
import { API_BASE_URL } from '@/config';

/**
 * Normalizes a date string from the API to a valid ISO 8601 format
 * that can be reliably parsed as UTC by the JavaScript Date constructor.
 * @param dateStr The raw date string from the API.
 * @returns A normalized date string, or the original string if it's invalid.
 */
const normalizeDateString = (dateStr: string | null | undefined): string | null | undefined => {
    if (!dateStr) return dateStr;

    // 1. Replace space with 'T' to conform to ISO 8601
    let normalized = dateStr.replace(' ', 'T');
    
    // 2. Append 'Z' to specify UTC if no timezone info is present
    if (!normalized.endsWith('Z') && !normalized.includes('+') && normalized.lastIndexOf('-') < 10) { // Check for timezone offsets
        normalized += 'Z';
    }
    
    return normalized;
};


export const runWorkflowStream = async (
  prompt: string,
  files: File[],
  conversationId: string | null,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> => {
  let __seq = 0;
  const formData = new FormData();
  formData.append('query', prompt);
  
  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }

  files.forEach(file => {
    formData.append('files', file);
  });

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/generate/stream`, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'text/event-stream' },
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
      const errorMessage = errorBody.detail || 'An unknown error occurred while calling the backend API.';
      throw new Error(errorMessage);
    }
    
    if (!response.body) {
        throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processMessage = async (messageBlock: string) => {
        if (messageBlock.trim() === '') return;

        const lines = messageBlock.split(/\r?\n/).filter(l => l.length > 0);
        let eventType: string | undefined;
        const dataLines: string[] = [];
        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.substring(5).trimStart());
            }
        }

        const rawData = dataLines.join('\n');
        if (rawData.length === 0) return;
        let eventData: any;
        try {
            eventData = JSON.parse(rawData);
        } catch (e) {
            console.error('Failed to parse SSE JSON payload:', rawData, e);
            return;
        }

        const resolvedType = eventType || String(eventData.type || eventData.event || 'message');
        const debug = Boolean((import.meta as any).env?.VITE_STREAM_DEBUG);
        const normalizedData = { ...eventData, _seq: (++__seq), _ts: Date.now(), type: resolvedType };
        if (debug) console.debug('[SSE]', resolvedType, normalizedData);
        switch (resolvedType) {
                    case 'workflow_start':
                        callbacks.onWorkflowStart?.();
                        break;
                    case 'conversation_created':
                        callbacks.onConversationCreated?.(normalizedData.conversation_id);
                        break;
                    case 'files_uploaded':
                        callbacks.onFilesUploaded?.(normalizedData.count);
                        break;
                    case 'llm_token':
                        callbacks.onLlmToken?.(normalizedData);
                        break;
                    case 'node_progress':
                        callbacks.onNodeProgress?.(normalizedData);
                        break;
                    case 'result_stream_chunk':
                        callbacks.onResultStreamChunk?.(normalizedData);
                        break;
                    case 'execution_output':
                        callbacks.onResultStreamChunk?.({
                          node: normalizedData.node,
                          chunk: normalizedData.output_preview ?? normalizedData.chunk ?? '',
                          success: normalizedData.success
                        });
                        break;
                    case 'code_generated':
                        callbacks.onResultStreamChunk?.({
                          node: normalizedData.node,
                          code_preview: normalizedData.code_preview,
                          code_length: normalizedData.code_length
                        });
                        break;
                    case 'node_start':
                        callbacks.onNodeStart?.(normalizedData);
                        break;
                    case 'node_complete':
                        callbacks.onNodeComplete?.(normalizedData);
                        break;
                    case 'final_result':
                        await callbacks.onFinalResult?.(normalizedData);
                        break;
                    case 'done':
                        callbacks.onDone?.(normalizedData.status);
                        break;
                    case 'node_error':
                    case 'workflow_error':
                        callbacks.onError?.(normalizedData.error || `An error occurred during the '${resolvedType}' event.`);
                        break;
                    case 'error':
                        callbacks.onError?.(normalizedData.error || 'An unspecified error occurred on the stream.');
                        break;
                    default:
                        if (normalizedData) {
                            if (normalizedData.node && normalizedData.status === 'started') {
                                callbacks.onNodeStart?.(normalizedData);
                                break;
                            }
                            if (normalizedData.node && (normalizedData.status === 'completed' || normalizedData.status === 'error' || normalizedData.status === 'success' || normalizedData.status === 'failed')) {
                                callbacks.onNodeComplete?.(normalizedData);
                                break;
                            }
                            if (typeof normalizedData.token === 'string') {
                                callbacks.onLlmToken?.(normalizedData);
                                break;
                            }
                            if (typeof normalizedData.chunk === 'string') {
                                callbacks.onResultStreamChunk?.(normalizedData);
                                break;
                            }
                            if (normalizedData.node && typeof normalizedData.message === 'string') {
                                callbacks.onNodeProgress?.(normalizedData);
                                break;
                            }
                            if (Array.isArray(normalizedData.nodes)) {
                                await callbacks.onFinalResult?.(normalizedData);
                                break;
                            }
                            if (normalizedData.status === 'success' || normalizedData.status === 'error') {
                                callbacks.onDone?.(normalizedData.status);
                                break;
                            }
                        }
                        break;
                }
    };
    
    const processBuffer = async () => {
        let idxLF = buffer.indexOf('\n\n');
        let idxCRLF = buffer.indexOf('\r\n\r\n');
        while (idxLF >= 0 || idxCRLF >= 0) {
            const useCRLF = idxCRLF >= 0 && (idxCRLF < idxLF || idxLF < 0);
            const boundaryIndex = useCRLF ? idxCRLF : idxLF;
            const sepLen = useCRLF ? 4 : 2;
            const messageBlock = buffer.substring(0, boundaryIndex);
            buffer = buffer.substring(boundaryIndex + sepLen);
            await processMessage(messageBlock);
            idxLF = buffer.indexOf('\n\n');
            idxCRLF = buffer.indexOf('\r\n\r\n');
        }
    };

    // Main loop to read from the stream
    while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
            buffer += decoder.decode(value, { stream: true });
        }
        
        await processBuffer();

        if (done) {
            if (buffer.trim()) {
                await processMessage(buffer);
            }
            break;
        }
    }

  } catch (error) {
     if (signal.aborted) {
      console.log('Stream aborted by user.');
      return; 
    }
    console.error("Error calling backend stream API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    callbacks.onError?.(`Failed to connect to the streaming API. Error: ${errorMessage}`);
  }
};

export const getWorkflowHistory = async (): Promise<Workflow[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/conversations/`, {
        method: 'GET',
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Failed to fetch history.' }));
        throw new Error(errorBody.detail || 'An unknown error occurred.');
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.conversations)) {
        throw new Error('Unexpected response format from history API.');
    }
    
    const workflows: Workflow[] = data.conversations.map((conv: any) => {
        const normalizedDate = normalizeDateString(conv.created_at);
        return {
            id: conv.id,
            conversationId: conv.id,
            title: conv.title,
            createdAt: new Date(normalizedDate || Date.now()),
            history: [],
        };
    });

    return workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const getConversationDetails = async (conversationId: string): Promise<Message[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        method: 'GET',
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: 'Failed to fetch conversation details.' }));
        throw new Error(errorBody.detail || 'An unknown error occurred.');
    }

    const conv = await response.json();

    if (!conv || !Array.isArray(conv.messages)) {
         throw new Error('Unexpected response format from conversation details API.');
    }

    const historyPromises = conv.messages.map(async (msg: any, index: number, allMessages: any[]): Promise<Message | null> => {
        const normalizedDate = normalizeDateString(msg.created_at);
        const timestamp = new Date(normalizedDate || Date.now());

        if (msg.role === 'user') {
            const userMessage: Message = {
                id: msg.id,
                role: 'user',
                prompt: msg.content,
                files: [], 
                timestamp: timestamp,
            };

            // Associate input files from the next assistant message with this user message
            if (index + 1 < allMessages.length && allMessages[index + 1].role === 'assistant') {
                const nextMsg = allMessages[index + 1];
                if (nextMsg.metadata && nextMsg.metadata.input_files) {
                     userMessage.inputFiles = nextMsg.metadata.input_files.map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url, filePath: f.file_path }));
                }
            }
            return userMessage;

        } else if (msg.role === 'assistant') { 
            const metadata = msg.metadata || {};

            const outputFiles = metadata?.output_files?.map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url, filePath: f.file_path })) || [];
            
            let statistics: Statistics | string = "Statistics are not available for this step.";
            const statsFile = outputFiles.find((f: { name: string; }) => f.name === 'statistics.json');
    
            if (statsFile) {
                try {
                    // This fetch is for a public URL and does not need authentication
                    const statsResponse = await fetch(statsFile.downloadUrl);
                    if (statsResponse.ok) {
                        statistics = await statsResponse.json();
                    } else {
                        console.warn(`Failed to fetch statistics.json: ${statsResponse.statusText}`);
                        statistics = "Could not load statistics data.";
                    }
                } catch (error) {
                    console.error('Error fetching or parsing statistics.json:', error);
                    statistics = "Error parsing statistics file. It may be corrupted.";
                }
            }

            const responsePayload: AIResponsePayload = {
              description: msg.content || "Workflow step executed.",
              code: metadata.code || msg.code || "",
              toolsUsed: [],
              statistics: statistics,
              outputFiles: outputFiles,
              inputFiles: (metadata?.input_files || []).map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url, filePath: f.file_path })),
              executionTrace: metadata?.nodes || [],
            };

            return {
                id: msg.id,
                role: 'model',
                prompt: '',
                files: [],
                response: responsePayload,
                timestamp: timestamp,
            };
        }
        return null;
    });

    const resolvedHistory = await Promise.all(historyPromises);
  const history: Message[] = resolvedHistory.filter((item): item is Message => item !== null);

  return history;
};

export const getConversationFiles = async (conversationId: string): Promise<{ input: { name: string; downloadUrl: string; filePath?: string }[]; output: { name: string; downloadUrl: string; filePath?: string }[] }> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/files?conversation_id=${encodeURIComponent(conversationId)}`, {
        method: 'GET'
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to fetch files list');
    }
    const data = await response.json();
    const input = (data.files_by_type?.input || []).map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url, filePath: f.file_path }));
    const output = (data.files_by_type?.output || []).map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url, filePath: f.file_path }));
    return { input, output };
};
