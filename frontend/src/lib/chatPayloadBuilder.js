/**
 * Chat Payload Builder
 * 
 * Builds backend-ready payloads for chat requests.
 * Does NOT implement streaming, backend calls, or SSE parsing.
 * 
 * Purpose: Future streaming layer can call buildChatPayload() and immediately
 * obtain a valid backend payload.
 */

import { buildEffectiveModelConfig, buildRequestMessages } from './runtimeConfig';

// ============================================
// PAYLOAD BUILDER
// ============================================

/**
 * Build complete chat request payload
 * 
 * Follows backend contract exactly:
 * - model_config with provider, model_name, api_key, temperature, base_url
 * - messages array with system first (if present), then context, then user message
 * - context_window from settings
 * 
 * @param {Object} conversation - Current conversation
 * @param {string} currentUserMessage - The new user message
 * @param {Object} settings - Global settings
 * @param {Object|null} selectedModel - Currently selected model
 * @returns {Object} - Backend-ready payload
 */
export function buildChatPayload(
  conversation,
  currentUserMessage,
  settings,
  selectedModel
) {
  if (!conversation || !currentUserMessage) {
    throw new Error('Conversation and user message are required');
  }

  // Get effective model config (with global overrides)
  const modelConfig = buildEffectiveModelConfig(selectedModel, settings);
  
  if (!modelConfig) {
    throw new Error('No model config available');
  }

  // Build messages array with proper ordering
  const messages = buildRequestMessages(
    settings.systemPrompt,
    conversation.messages,
    conversation.accumulatedTrimBoundary,
    currentUserMessage
  );

  // Build payload
  return {
    model_config: modelConfig,
    messages,
    context_window: settings.contextWindow || 8000,
  };
}

/**
 * Build chat payload for regeneration
 * 
 * Removes the last assistant message and builds payload using previous user message.
 * 
 * @param {Object} conversation - Current conversation
 * @param {Object} settings - Global settings
 * @param {Object|null} selectedModel - Currently selected model
 * @returns {Object} - Backend-ready payload for regeneration
 */
export function buildRegeneratePayload(
  conversation,
  settings,
  selectedModel
) {
  if (!conversation) {
    throw new Error('Conversation is required');
  }

  // Get the messages without the last assistant message
  const messagesForRegeneration = getMessagesForRegeneration(conversation);
  
  // The last message should be the user message we're regenerating a response for
  // If there's no user message, we can't regenerate
  if (messagesForRegeneration.length === 0) {
    throw new Error('No messages available for regeneration');
  }

  // The last message is the user message we're responding to
  const lastUserMessage = messagesForRegeneration[messagesForRegeneration.length - 1];
  
  // Build payload using the user message as the current input
  return buildChatPayload(
    {
      ...conversation,
      messages: messagesForRegeneration,
    },
    lastUserMessage.content,
    settings,
    selectedModel
  );
}

// ============================================
// MESSAGE ARRAY UTILITIES
// ============================================

/**
 * Get messages for regeneration (removes last assistant message)
 * 
 * @param {Object} conversation 
 * @returns {Object[]} - Messages without last assistant
 */
export function getMessagesForRegeneration(conversation) {
  const { messages } = conversation;
  
  if (messages.length === 0) {
    return [];
  }

  // Find the last assistant message that is completed (not streaming)
  const lastAssistantIndex = findLastCompletedAssistantIndex(messages);
  
  if (lastAssistantIndex === -1) {
    // No assistant message to remove
    return [...messages];
  }

  // Remove the last assistant message
  return messages.filter((_, index) => index !== lastAssistantIndex);
}

/**
 * Find index of last completed assistant message
 * @param {Object[]} messages 
 * @returns {number} - Index or -1
 */
function findLastCompletedAssistantIndex(messages) {
  // Status values
  const COMPLETED = 'completed';
  const STOPED = 'stopped';
  const ERROR = 'error';
  
  // Find all completed assistant messages (completed, stopped, or error)
  const completedIndices = [];
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'assistant' && 
        (message.status === COMPLETED || 
         message.status === STOPED || 
         message.status === ERROR)) {
      completedIndices.push(i);
    }
  }
  
  // Return the last one, or -1 if none
  return completedIndices.length > 0 ? completedIndices[0] : -1;
}

/**
 * Get messages that are currently in context (after trim boundary)
 * 
 * CRITICAL: Never removes messages from storage. Only filters for request payload.
 * 
 * @param {Object} conversation 
 * @returns {Object[]} - Messages in context
 */
export function getMessagesInContext(conversation) {
  if (!conversation) {
    return [];
  }
  
  const { messages, accumulatedTrimBoundary } = conversation;
  return messages.slice(accumulatedTrimBoundary);
}

/**
 * Get all user messages from conversation
 * @param {Object[]} messages 
 * @returns {Object[]}
 */
export function getUserMessages(messages) {
  return messages.filter(m => m.role === 'user');
}

/**
 * Get the last user message
 * @param {Object[]} messages 
 * @returns {Object|null}
 */
export function getLastUserMessage(messages) {
  const userMessages = getUserMessages(messages);
  return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
}

/**
 * Check if conversation has any messages
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function hasMessages(conversation) {
  return conversation && conversation.messages && conversation.messages.length > 0;
}

/**
 * Check if conversation has unsaved changes
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function isConversationDirty(conversation) {
  if (!conversation) return false;
  
  // Dirty if:
  // - Not saved
  // - Has messages
  return !conversation.saved && conversation.messages.length > 0;
}

// ============================================
// TITLE MANAGEMENT
// ============================================

/**
 * Generate title from first user message
 * 
 * Rules:
 * - First USER message becomes the title
 * - Only auto-generate if title is still default
 * - Never overwrite existing title automatically
 * 
 * @param {Object} conversation 
 * @returns {string} - Generated title
 */
export function generateTitleFromFirstMessage(conversation) {
  if (!conversation || !conversation.messages) {
    return 'Untitled Conversation';
  }

  // Find first user message
  for (const message of conversation.messages) {
    if (message.role === 'user' && message.content && message.content.trim()) {
      return message.content.trim();
    }
  }

  return 'Untitled Conversation';
}

/**
 * Should auto-generate title?
 * Only if title is still default and first user message exists
 * 
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function shouldAutoGenerateTitle(conversation) {
  if (!conversation) return false;
  
  const hasDefaultTitle = conversation.title === 'Untitled Conversation';
  const hasUserMessages = getUserMessages(conversation.messages).length > 0;
  
  return hasDefaultTitle && hasUserMessages;
}

// ============================================
// MESSAGE FACTORIES
// ============================================

import { createMessage, MESSAGE_STATUS } from '../store/schemas';

/**
 * Create a user message
 * @param {Object} params 
 * @param {string} params.content 
 * @param {string} [params.modelId] 
 * @param {string} [params.modelName] 
 * @returns {Object}
 */
export function createUserMessage(params) {
  return createMessage({
    role: 'user',
    content: params.content,
    modelId: params.modelId,
    modelName: params.modelName,
  });
}

/**
 * Create an assistant message (for streaming start)
 * @param {Object} params 
 * @param {string} [params.content=''] 
 * @param {string} [params.modelId] 
 * @param {string} [params.modelName] 
 * @returns {Object}
 */
export function createAssistantMessage(params = {}) {
  return createMessage({
    role: 'assistant',
    content: params.content || '',
    modelId: params.modelId,
    modelName: params.modelName,
    status: MESSAGE_STATUS.STREAMING,
  });
}

/**
 * Create an error message (assistant role with error status)
 * @param {Object} params 
 * @param {string} params.error - Error message
 * @param {string} [params.modelId] 
 * @param {string} [params.modelName] 
 * @returns {Object}
 */
export function createErrorMessage(params) {
  return createMessage({
    role: 'assistant',
    content: params.error || 'An error occurred',
    modelId: params.modelId,
    modelName: params.modelName,
    status: MESSAGE_STATUS.ERROR,
    metadata: { error: params.error },
  });
}

/**
 * Create a stopped message (user cancelled streaming)
 * @param {Object} params 
 * @param {string} params.partialContent - Partial content before stop
 * @param {string} [params.modelId] 
 * @param {string} [params.modelName] 
 * @returns {Object}
 */
export function createStoppedMessage(params) {
  return createMessage({
    role: 'assistant',
    content: params.partialContent || '',
    modelId: params.modelId,
    modelName: params.modelName,
    status: MESSAGE_STATUS.STOPPED,
  });
}

/**
 * Create a system message
 * @param {string} content 
 * @returns {Object}
 */
export function createSystemMessage(content) {
  return createMessage({
    role: 'system',
    content: content.trim(),
  });
}

// ============================================
// TRIM BOUNDARY UTILITIES
// ============================================

/**
 * Update trim boundary from backend metadata
 * 
 * CRITICAL: Never removes messages. Only accumulates the boundary.
 * 
 * @param {number} currentTrimBoundary - Current accumulated trim boundary
 * @param {number} newTrimBoundary - Trim boundary from backend response
 * @returns {number} - New accumulated trim boundary
 */
export function updateTrimBoundary(currentTrimBoundary, newTrimBoundary) {
  return currentTrimBoundary + newTrimBoundary;
}

/**
 * Get trim offset for request payload (messages to skip)
 * @param {Object} conversation 
 * @returns {number}
 */
export function getTrimOffset(conversation) {
  return conversation?.accumulatedTrimBoundary || 0;
}

// ============================================
// CONTEXT ACCOUNTING UTILITIES
// ============================================

/**
 * Calculate current context tokens from messages in context
 * 
 * Uses metadata from messages if available, otherwise estimates.
 * 
 * @param {Object} conversation 
 * @returns {number} - Estimated token count
 */
export function calculateCurrentContextTokens(conversation) {
  if (!conversation) return 0;

  // Prefer actual token count from backend responses — sum up ALL assistant responses
  let total = 0;
  let hasBackendData = false;
  for (const message of conversation.messages) {
    if (message.role === 'assistant' && message.metadata && typeof message.metadata.totalTokens === 'number') {
      total += message.metadata.totalTokens;
      hasBackendData = true;
    }
  }
  if (hasBackendData) {
    return total;
  }

  // Fallback: estimate from word count for messages without metadata
  const { messages, accumulatedTrimBoundary } = conversation;
  const messagesInContext = messages.slice(accumulatedTrimBoundary);
  let tokenCount = 0;
  for (const message of messagesInContext) {
    if (message.content && message.content.trim()) {
      const wordCount = message.content.trim().split(/\s+/).length;
      tokenCount += wordCount * 4;
    }
  }
  return tokenCount;
}

/**
 * Calculate context usage percentage
 * @param {Object} conversation 
 * @param {Object} settings 
 * @returns {number} - Percentage (0-1)
 */
export function calculateContextUsagePercent(conversation, settings) {
  if (!conversation || !settings) return 0;
  
  const contextWindow = settings.contextWindow || 8000;
  if (contextWindow <= 0) return 0;
  
  const currentTokens = calculateCurrentContextTokens(conversation);
  return Math.min(1, currentTokens / contextWindow);
}

/**
 * Calculate conversation context tokens (for display)
 * @param {Object} conversation 
 * @returns {Object} - { currentTokens, contextWindow, usagePercent }
 */
export function calculateConversationContextTokens(conversation, settings) {
  const contextWindow = settings?.contextWindow || 8000;
  const currentTokens = calculateCurrentContextTokens(conversation);
  const usagePercent = calculateContextUsagePercent(conversation, settings);
  
  return {
    currentTokens,
    contextWindow,
    usagePercent,
  };
}

/**
 * Get context usage display string (e.g., "5231 / 8000")
 * @param {Object} conversation 
 * @param {Object} settings 
 * @returns {string}
 */
export function getContextUsageDisplay(conversation, settings) {
  const contextWindow = settings?.contextWindow || 8000;
  const currentTokens = calculateCurrentContextTokens(conversation);
  
  return `${Math.round(currentTokens)} / ${contextWindow}`;
}

// ============================================
// REGENERATE UTILITIES
// ============================================

/**
 * Prepare conversation for regeneration
 * Removes the last assistant message and returns it for potential restoration
 * 
 * @param {Object} conversation 
 * @returns {Object|null} - The removed message or null
 */
export function prepareForRegeneration(conversation) {
  if (!conversation) return null;

  const { messages } = conversation;
  const lastAssistantIndex = findLastCompletedAssistantIndex(messages);
  
  if (lastAssistantIndex === -1) {
    return null;
  }

  const removedMessage = { ...messages[lastAssistantIndex] };
  
  // Return the removed message
  return removedMessage;
}

/**
 * Check if conversation can be regenerated
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function canRegenerate(conversation) {
  if (!conversation) return false;
  return findLastCompletedAssistantIndex(conversation.messages) !== -1;
}

// ============================================
// CONVERSATION LIFECYCLE UTILITIES
// ============================================

/**
 * Create a new empty conversation
 * @returns {Object}
 */
export function createEmptyConversation() {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    saved: false,
    accumulatedTrimBoundary: 0,
    contextWindow: 8000,
    messages: [],
  };
}

/**
 * Mark conversation as clean (after successful save)
 * @param {Object} conversation 
 * @returns {Object}
 */
export function markConversationAsClean(conversation) {
  return {
    ...conversation,
    saved: true,
    updatedAt: Date.now(),
  };
}

/**
 * Mark conversation as dirty
 * @param {Object} conversation 
 * @returns {Object}
 */
export function markConversationAsDirty(conversation) {
  return {
    ...conversation,
    saved: false,
    updatedAt: Date.now(),
  };
}

/**
 * Rename conversation
 * @param {Object} conversation 
 * @param {string} newTitle 
 * @returns {Object}
 */
export function renameConversation(conversation, newTitle) {
  return {
    ...conversation,
    title: newTitle,
    updatedAt: Date.now(),
    saved: false, // Mark as dirty
  };
}

// ============================================
// MESSAGE STATUS UTILITIES
// ============================================

/**
 * Check if message is streaming
 * @param {Object} message 
 * @returns {boolean}
 */
export function isMessageStreaming(message) {
  return message?.status === MESSAGE_STATUS.STREAMING;
}

/**
 * Check if message is completed
 * @param {Object} message 
 * @returns {boolean}
 */
export function isMessageCompleted(message) {
  return message?.status === MESSAGE_STATUS.COMPLETED;
}

/**
 * Check if message is stopped
 * @param {Object} message 
 * @returns {boolean}
 */
export function isMessageStopped(message) {
  return message?.status === MESSAGE_STATUS.STOPPED;
}

/**
 * Check if message is error
 * @param {Object} message 
 * @returns {boolean}
 */
export function isMessageError(message) {
  return message?.status === MESSAGE_STATUS.ERROR;
}

/**
 * Check if conversation is streaming
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function isConversationStreaming(conversation) {
  if (!conversation) return false;
  return conversation.messages.some(isMessageStreaming);
}

/**
 * Check if conversation has any streaming messages
 * @param {Object} conversation 
 * @returns {boolean}
 */
export function hasStreamingMessage(conversation) {
  return isConversationStreaming(conversation);
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Payload builders
  buildChatPayload,
  buildRegeneratePayload,
  
  // Message array utilities
  getMessagesForRegeneration,
  getMessagesInContext,
  getUserMessages,
  getLastUserMessage,
  hasMessages,
  isConversationDirty,
  
  // Title management
  generateTitleFromFirstMessage,
  shouldAutoGenerateTitle,
  
  // Message factories
  createUserMessage,
  createAssistantMessage,
  createErrorMessage,
  createStoppedMessage,
  createSystemMessage,
  
  // Trim boundary
  updateTrimBoundary,
  getTrimOffset,
  
  // Context accounting
  calculateCurrentContextTokens,
  calculateContextUsagePercent,
  calculateConversationContextTokens,
  getContextUsageDisplay,
  
  // Regenerate
  prepareForRegeneration,
  canRegenerate,
  
  // Lifecycle
  createEmptyConversation,
  markConversationAsClean,
  markConversationAsDirty,
  renameConversation,
  
  // Status
  isMessageStreaming,
  isMessageCompleted,
  isMessageStopped,
  isMessageError,
  isConversationStreaming,
  hasStreamingMessage,
};
