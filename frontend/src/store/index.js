/**
 * Central Store Exports
 * 
 * All Zustand stores are exported from here for centralized access.
 * Each store manages a specific domain of application state.
 */

// Conversation Store - Manages conversations and messages
export { useConversationStore, conversationStore } from './conversationStore';

// Model Store - Manages model configurations
export { useModelStore, modelStore, PROVIDERS, REQUIRES_BASE_URL, DEFAULT_MODELS } from './modelStore';

// Settings Store - Manages user preferences
export { useSettingsStore, settingsStore, DEFAULT_SETTINGS, TEMPERATURE_MIN, TEMPERATURE_MAX, CONTEXT_WINDOW_MIN } from './settingsStore';

// UI Store - Manages UI state (modals, focus, etc.)
export { useUIStore, uiStore } from './uiStore';

// Schema utilities and constants
export {
  MESSAGE_STATUS,
  createMetadata,
  createContextSnapshot,
  createMessage,
  createConversation,
  createModel,
  createSettings,
  calculateContextUsage,
  getMessagesInContext,
  getSystemMessage,
  getUserMessages,
  getAssistantMessages,
  getLastUserMessage,
  getLastAssistantMessage,
  hasStreamingMessage,
  isConversationStreaming,
  isMessageValid,
  validateConversationForSend,
} from './schemas';
