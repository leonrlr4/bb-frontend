import type { Workflow, Message, AIResponsePayload, NodeMetadata, Statistics, StreamCallbacks } from '../types';
import { fetchWithAuth } from './apiClient';

const API_BASE_URL = 'https://1f78112e7eab.ngrok-free.app';

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
        
        // Use regex to extract event and data, which is more robust
        const eventMatch = messageBlock.match(/event: (.*)/);
        // The 's' flag allows '.' to match newlines, in case the JSON data is multi-line.
        const dataMatch = messageBlock.match(/data: (.*)/s); 

        if (eventMatch && dataMatch) {
            try {
                const eventType = eventMatch[1].trim();
                const dataString = dataMatch[1].trim();
                const eventData = JSON.parse(dataString);
                
                // Route event to the correct callback
                switch (eventType) {
                    case 'workflow_start':
                        callbacks.onWorkflowStart?.();
                        break;
                    case 'conversation_created':
                        callbacks.onConversationCreated?.(eventData.conversation_id);
                        break;
                    case 'files_uploaded':
                        callbacks.onFilesUploaded?.(eventData.count);
                        break;
                    case 'llm_token':
                        callbacks.onLlmToken?.(eventData);
                        break;
                    case 'node_progress':
                        callbacks.onNodeProgress?.(eventData);
                        break;
                    case 'result_stream_chunk':
                        callbacks.onResultStreamChunk?.(eventData);
                        break;
                    case 'node_start':
                        callbacks.onNodeStart?.(eventData);
                        break;
                    case 'node_complete':
                        callbacks.onNodeComplete?.(eventData);
                        break;
                    case 'final_result':
                        await callbacks.onFinalResult?.(eventData);
                        break;
                    case 'done':
                        callbacks.onDone?.(eventData.status);
                        break;
                    case 'node_error':
                    case 'workflow_error':
                        callbacks.onError?.(eventData.error || `An error occurred during the '${eventType}' event.`);
                        break;
                    case 'error':
                        callbacks.onError?.(eventData.error || 'An unspecified error occurred on the stream.');
                        break;
                }
            } catch (e) {
                console.error("Failed to parse SSE data JSON:", dataMatch[1], e);
            }
        }
    };
    
    const processBuffer = async () => {
        let boundaryIndex;
        while ((boundaryIndex = buffer.indexOf('\n\n')) >= 0) {
            const messageBlock = buffer.substring(0, boundaryIndex);
            buffer = buffer.substring(boundaryIndex + 2);
            await processMessage(messageBlock);
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
                     userMessage.inputFiles = nextMsg.metadata.input_files.map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url }));
                }
            }
            return userMessage;

        } else if (msg.role === 'assistant') { 
            const metadata = msg.metadata || {};

            const outputFiles = metadata?.output_files?.map((f: any) => ({ name: f.file_name, downloadUrl: f.download_url })) || [];
            
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
