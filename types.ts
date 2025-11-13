import type { ReactNode } from 'react';

/**
 * Represents a predefined template for starting a workflow.
 */
export interface Template {
  value: string;
  label: string;
  prompt: string;
}

/**
 * Represents the user object returned from the backend API.
 */
export interface User {
  id: string;
  email: string;
  username?: string;
  subscription_tier?: string;
}

/**
 * Represents the successful response from the login endpoint.
 */
export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}


/**
 * Represents the structured data for statistical analysis.
 * This is now a flexible type to accommodate the raw JSON from `statistics.json`.
 */
export type Statistics = any;


/**
 * Represents a single node in the LangGraph execution trace, based on the new API documentation.
 * Fields are optional to accommodate the progressive building of the object during streaming.
 */
export interface NodeMetadata {
  name: string;
  status: 'success' | 'failed' | 'running';
  duration_ms: number;
  started_at?: string;
  completed_at?: string;
  execution_number?: number;
  
  error?: string;
  error_type?: string;
  
  metadata: NodeSpecificMetadata;
  progressMessages?: string[];
}

export type NodeSpecificMetadata = 
  | IntentMetadata 
  | CodegenMetadata 
  | ExecutionMetadata 
  | ReviewMetadata 
  | QAMetadata
  | {};

export interface IntentMetadata {
  model?: string;
  tokens?: number;
  intent?: string;
  complexity?: 'low' | 'medium' | 'high';
  domain?: string;
}

export interface CodegenMetadata {
  model?: string;
  tokens?: number;
  code_length?: number;
  retry_count?: number;
}

export interface ExecutionMetadata {
  success?: boolean;
  output_files_count?: number;
  uploaded_files_count?: number;
  error?: string;
}

export interface ReviewMetadata {
  model?: string;
  tokens?: number;
}

export interface QAMetadata {
  model?: string;
  tokens?: number;
  test_cases_length?: number;
  final_status?: string;
}


/**
 * Represents the structured data returned by the AI for a single workflow step.
 */
export interface AIResponsePayload {
  description: string;
  code: string;
  statistics: Statistics | string;
  outputFiles: { name: string; downloadUrl: string }[];
  toolsUsed: string[];
  executionTrace: NodeMetadata[];
}

/**
 * Represents the state of a streaming response from the AI.
 */
export interface StreamingState {
  currentNode: string;
  progress: number;
  codePreview?: string;
  executionOutput?: string;
  nodes: NodeMetadata[];
  streamingCode: string;
  streamingDescription: string;
}

/**
 * Represents a single turn in a workflow conversation.
 */
export interface Message {
  id: string;
  role: 'user' | 'model';
  prompt: string; // User's prompt text
  files: File[]; // Files attached by the user for the current turn
  inputFiles?: { name: string; downloadUrl: string }[]; // Files from history
  response?: AIResponsePayload; // Structured response for 'model' role
  streamingState?: StreamingState; // Live state during streaming
  timestamp: Date;
}

/**
 * Represents a complete workflow, structured as a conversation.
 */
export interface Workflow {
  id: string;
  title: string;
  history: Message[];
  createdAt: Date;
  conversationId?: string;
}


/**
 * Represents the final payload from the streaming API.
 */
export interface FinalResultPayload {
    success: boolean;
    description?: string;
    user_id: string;
    conversation_id: string;
    message_id: string;
    code: string;
    execution: {
        success: boolean;
        stdout: string;
        error: string | null;
    };
    input_files: { file_name: string; download_url: string }[];
    output_files: { file_name: string; download_url: string }[];
    nodes: NodeMetadata[];
}

/**
 * Callbacks for the workflow streaming service.
 */
export interface StreamCallbacks {
  onWorkflowStart?: () => void;
  onConversationCreated?: (conversationId: string) => void;
  onFilesUploaded?: (count: number) => void;
  onLlmToken?: (data: { node: string; token: string; accumulated_length: number }) => void;
  onNodeProgress?: (data: { node: string; message: string; }) => void;
  onResultStreamChunk?: (data: { chunk: string; }) => void;
  onNodeStart?: (data: { node: string; status: "started"; started_at?: string; }) => void;
  onNodeComplete?: (data: { node: string; status: string; duration_ms: number; metadata: any; }) => void;
  onFinalResult?: (result: any) => Promise<void> | void;
  onDone?: (status: string) => void;
  onError?: (error: string) => void;
}