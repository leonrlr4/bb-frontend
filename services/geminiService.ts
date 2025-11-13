export interface StreamCallbacks {
  onConversationCreated?: (conversationId: string) => void;
  onFilesUploaded?: (count: number) => void;
  onNodeStart?: (nodeName: string) => void;
  onNodeComplete?: (nodeName: string) => void;
  onCodeGenerated?: (codePreview: string) => void;
  onExecutionOutput?: (output: string) => void;
  onFinalResult?: (result: any) => void;
  onDone?: (status: string) => void;
  onError?: (error: string) => void;
}

export const runWorkflowStream = async (
  prompt: string,
  files: File[],
  conversationId: string | null,
  token: string | null,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> => {
  const API_BASE_URL = 'https://1f78112e7eab.ngrok-free.app';
  const formData = new FormData();
  formData.append('query', prompt);
  
  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }

  files.forEach(file => {
    formData.append('files', file);
  });

  try {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/generate/stream`, {
      method: 'POST',
      body: formData,
      headers: headers,
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

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        
        // The last part might be an incomplete message, so keep it in the buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
            if (part.trim() === '') continue;

            const eventMatch = part.match(/^event: (.*)$/m);
            const dataMatch = part.match(/^data: (.*)$/m);

            if (eventMatch && dataMatch) {
                const eventType = eventMatch[1].trim();
                const eventData = JSON.parse(dataMatch[1].trim());

                switch (eventType) {
                    case 'conversation_created':
                        callbacks.onConversationCreated?.(eventData.conversation_id);
                        break;
                    case 'files_uploaded':
                        callbacks.onFilesUploaded?.(eventData.count);
                        break;
                    case 'node_start':
                        callbacks.onNodeStart?.(eventData.node);
                        break;
                    case 'node_complete':
                        callbacks.onNodeComplete?.(eventData.node);
                        break;
                    case 'code_generated':
                        callbacks.onCodeGenerated?.(eventData.code_preview);
                        break;
                    case 'execution_output':
                        callbacks.onExecutionOutput?.(eventData.output);
                        break;
                    case 'final_result':
                        callbacks.onFinalResult?.(eventData);
                        break;
                    case 'done':
                        callbacks.onDone?.(eventData.status);
                        break;
                    case 'error':
                        callbacks.onError?.(eventData.error);
                        break;
                }
            }
        }
    }

  } catch (error) {
     if (signal.aborted) {
      console.log('Stream aborted by user.');
      return; // Don't call error callback if user cancelled
    }
    console.error("Error calling backend stream API:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    callbacks.onError?.(`Failed to connect to the streaming API. Please try again. Error: ${errorMessage}`);
  }
};