/**
 * State Schemas
 * 
 * All schemas used across the application state.
 * These are the source of truth for data shapes.
 */

// ============================================
// STATUS VALUES
// ============================================

export const MESSAGE_STATUS = {
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  ERROR: 'error',
};

// ============================================
// METADATA SCHEMA
// ============================================

/**
 * @typedef {Object} Metadata
 * @property {number|null} inputTokens - Input tokens used
 * @property {number|null} outputTokens - Output tokens used
 * @property {number|null} totalTokens - Total tokens used
 * @property {number} trimBoundary - Messages dropped in this request
 * @property {number} messagesInContext - Messages sent to model
 */

export const createMetadata = (overrides = {}) => ({
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  trimBoundary: 0,
  messagesInContext: 0,
  ...overrides,
});

// ============================================
// CONTEXT SNAPSHOT SCHEMA
// ============================================

/**
 * @typedef {Object} ContextSnapshot
 * @property {number} totalTokensAtTurn - Total tokens at this turn
 */

export const createContextSnapshot = (overrides = {}) => ({
  totalTokensAtTurn: 0,
  ...overrides,
});

// ============================================
// MESSAGE SCHEMA
// ============================================

/**
 * @typedef {Object} Message
 * @property {string} id - Unique message identifier
 * @property {'system'|'user'|'assistant'} role - Message role
 * @property {string} content - Message content
 * @property {string|null} modelId - Model ID used for this message
 * @property {string|null} modelName - Model name used
 * @property {number} createdAt - Timestamp
 * @property {string} status - One of: streaming, completed, stopped, error
 * @property {Metadata|null} metadata - Token usage and trim info
 * @property {ContextSnapshot|null} contextSnapshot - Context info at turn
 */

export const createMessage = (params) => ({
  id: crypto.randomUUID(),
  role: params.role,
  content: params.content || '',
  thinking: params.thinking || '',
  modelId: params.modelId || null,
  modelName: params.modelName || null,
  createdAt: Date.now(),
  status: MESSAGE_STATUS.COMPLETED,
  metadata: null,
  contextSnapshot: null,
});

// ============================================
// CONVERSATION SCHEMA
// ============================================

/**
 * @typedef {Object} Conversation
 * @property {string} id - Unique conversation identifier
 * @property {string} title - Conversation title
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {boolean} saved - Whether conversation is persisted
 * @property {number} accumulatedTrimBoundary - Running total of trimmed messages
 * @property {number} contextWindow - Context window size for this conversation
 * @property {Message[]} messages - Array of messages
 */

export const createConversation = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: 'Untitled Conversation',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  saved: false,
  accumulatedTrimBoundary: 0,
  contextWindow: 8000,
  messages: [],
  ...overrides,
});

// ============================================
// MODEL SCHEMA
// ============================================

/**
 * @typedef {Object} Model
 * @property {string} id - Unique model identifier
 * @property {string} name - Display name
 * @property {'openai'|'gemini'|'openai_compatible'} provider - Provider type
 * @property {string} model_name - Model identifier from provider
 * @property {string} api_key - API key (to be encrypted before persistence)
 * @property {number} temperature - Sampling temperature (0.0 - 2.0)
 * @property {string|null} base_url - Base URL (required for openai_compatible)
 */

export const createModel = (params) => ({
  id: crypto.randomUUID(),
  name: params.name,
  provider: params.provider,
  model_name: params.model_name,
  api_key: params.api_key,
  temperature: params.temperature ?? 0.7,
  base_url: params.base_url ?? null,
});

// ============================================
// SETTINGS SCHEMA
// ============================================

/**
 * @typedef {Object} Settings
 * @property {string} username - User's display name
 * @property {number} temperature - Default temperature
 * @property {number} contextWindow - Default context window
 * @property {string} systemPrompt - Default system prompt
 * @property {string|null} defaultModelId - Default model ID
 */

export const createSettings = (overrides = {}) => ({
  username: 'User',
  temperature: 0.7,
  contextWindow: 8000,
  systemPrompt: 'You are a helpful assistant.',
  defaultModelId: null,
  ...overrides,
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate current context usage
 * @param {Conversation} conversation 
 * @returns {Object} - Context usage info
 */
export function calculateContextUsage(conversation) {
  const { messages, accumulatedTrimBoundary, contextWindow } = conversation;
  
  // Count tokens in messages that are still in context
  // (messages beyond accumulatedTrimBoundary are trimmed)
  const messagesInContext = Math.max(0, messages.length - accumulatedTrimBoundary);
  
  // For display purposes, we track the running total
  // The actual token count comes from backend metadata
  const lastMetadata = messages.length > 0 
    ? messages[messages.length - 1]?.metadata 
    : null;
  
  const totalTokens = lastMetadata?.totalTokens ?? 0;
  
  return {
    messagesInContext,
    trimmedMessages: accumulatedTrimBoundary,
    totalMessages: messages.length,
    totalTokens,
    contextWindow,
    usageRatio: contextWindow > 0 ? totalTokens / contextWindow : 0,
  };
}

/**
 * Get messages that are still in context (not trimmed)
 * @param {Conversation} conversation
 * @returns {Message[]} - Messages in context
 */
export function getMessagesInContext(conversation) {
  const { messages, accumulatedTrimBoundary } = conversation;
  return messages.slice(accumulatedTrimBoundary);
}

/**
 * Get system message if present
 * @param {Message[]} messages
 * @returns {Message|null}
 */
export function getSystemMessage(messages) {
  return messages.find(m => m.role === 'system') || null;
}

/**
 * Get all user messages
 * @param {Message[]} messages
 * @returns {Message[]}
 */
export function getUserMessages(messages) {
  return messages.filter(m => m.role === 'user');
}

/**
 * Get all assistant messages
 * @param {Message[]} messages
 * @returns {Message[]}
 */
export function getAssistantMessages(messages) {
  return messages.filter(m => m.role === 'assistant');
}

/**
 * Get last user message (for continuing conversation)
 * @param {Message[]} messages
 * @returns {Message|null}
 */
export function getLastUserMessage(messages) {
  const userMessages = getUserMessages(messages);
  return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
}

/**
 * Check if conversation has streaming message
 * @param {Message[]} messages
 * @returns {boolean}
 */
export function hasStreamingMessage(messages) {
  return messages.some(m => m.status === MESSAGE_STATUS.STREAMING);
}

/**
 * Check if conversation is currently streaming
 * @param {Conversation} conversation
 * @returns {boolean}
 */
export function isConversationStreaming(conversation) {
  return hasStreamingMessage(conversation.messages);
}

/**
 * Get last assistant message
 * @param {Message[]} messages
 * @returns {Message|null}
 */
export function getLastAssistantMessage(messages) {
  const assistantMessages = getAssistantMessages(messages);
  return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate message before sending to backend
 * @param {Message} message
 * @param {number} index
 * @param {Message[]} allMessages
 * @returns {boolean}
 */
export function isMessageValid(message, index, allMessages) {
  // Content must not be empty
  if (!message.content || message.content.trim() === '') {
    return false;
  }
  
  // Check message order rules per backend contract
  const systemMessages = allMessages.filter(m => m.role === 'system');
  
  // Max one system message
  if (message.role === 'system' && systemMessages.length > 1) {
    return false;
  }
  
  // System message must be first
  if (message.role !== 'system' && systemMessages.length > 0) {
    const firstMessage = allMessages[0];
    if (firstMessage.role !== 'system') {
      return false;
    }
  }
  
  // Last message must be from user (for new requests)
  if (index === allMessages.length - 1 && message.role !== 'user') {
    return false;
  }
  
  return true;
}

/**
 * Validate conversation for sending to backend
 * @param {Conversation} conversation
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateConversationForSend(conversation) {
  const errors = [];
  const { messages } = conversation;
  
  // At least one message required
  if (messages.length === 0) {
    errors.push('At least one message required');
    return { valid: false, errors };
  }
  
  // Check each message
  let systemCount = 0;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Content must not be empty
    if (!message.content || message.content.trim() === '') {
      errors.push(`Message ${i} has empty content`);
    }
    
    // Count system messages
    if (message.role === 'system') {
      systemCount++;
    }
    
    // Check message order
    if (message.role === 'system' && i > 0) {
      errors.push('System message must be first');
    }
  }
  
  // Max one system message
  if (systemCount > 1) {
    errors.push('Only one system message allowed');
  }
  
  // Last message must be from user
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user') {
    errors.push('Last message must be from user');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
