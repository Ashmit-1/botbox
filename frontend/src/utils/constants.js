/**
 * Application Constants
 */

// Allowed colors per design system
export const COLORS = {
  background: 'bg-black',
  text: 'text-white',
  textSecondary: 'text-gray-400',
  border: 'border-white',
  borderSecondary: 'border-gray-700',
  surface: 'bg-black',
  surfaceSecondary: 'bg-gray-900',
};

// Provider types
export const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  OPENAI_COMPATIBLE: 'openai_compatible',
};

// Message roles
export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
};

// Storage keys for localForage
export const STORAGE_KEYS = {
  SAVED_CONVERSATIONS: 'saved_conversations',
  MODELS: 'models',
  SETTINGS: 'settings',
};

// Default values
export const DEFAULTS = {
  TEMPERATURE: 0.7,
  CONTEXT_WINDOW: 8000,
  MIN_CONTEXT_WINDOW: 2000,
  TEMPERATURE_MIN: 0.0,
  TEMPERATURE_MAX: 2.0,
};

// Error codes from backend
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// SSE Event types
export const SSE_EVENTS = {
  TOKEN: 'token',
  METADATA: 'metadata',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  DONE: 'done',
};
