/**
 * Runtime Configuration Utilities
 * 
 * Resolves final request configuration by merging model settings with global overrides.
 * Global settings ALWAYS override model-specific settings.
 * 
 * Key Rule: System prompt is NEVER trimmed and always comes first in request payload.
 */

import { PROVIDERS } from '../store/modelStore';

// ============================================
// CONSTANTS
// ============================================

// Temperature bounds
export const TEMPERATURE_MIN = 0.0;
export const TEMPERATURE_MAX = 2.0;

// Context window bounds
export const CONTEXT_WINDOW_MIN = 2000;

// ============================================
// VALIDATION
// ============================================

/**
 * Validate temperature value
 * @param {number} temperature 
 * @returns {boolean}
 */
export function isValidTemperature(temperature) {
  return temperature >= TEMPERATURE_MIN && temperature <= TEMPERATURE_MAX;
}

/**
 * Validate context window value
 * @param {number} contextWindow 
 * @returns {boolean}
 */
export function isValidContextWindow(contextWindow) {
  return contextWindow >= CONTEXT_WINDOW_MIN;
}

/**
 * Validate system prompt
 * @param {string} systemPrompt 
 * @returns {boolean}
 */
export function isValidSystemPrompt(systemPrompt) {
  return typeof systemPrompt === 'string' && systemPrompt.trim().length > 0;
}

/**
 * Validate username
 * @param {string} username 
 * @returns {boolean}
 */
export function isValidUsername(username) {
  return typeof username === 'string' && username.trim().length > 0;
}

// ============================================
// OVERRIDE LOGIC
// ============================================

/**
 * Apply global setting overrides to model config
 * 
 * Global settings ALWAYS override model-specific settings.
 * 
 * @param {Object} modelConfig - Model configuration
 * @param {Object} settings - Global settings
 * @returns {Object} - Effective configuration
 */
function applyGlobalOverrides(modelConfig, settings) {
  // Start with model config
  const effective = { ...modelConfig };
  
  // Global temperature overrides model temperature
  if (settings.temperature !== undefined) {
    effective.temperature = settings.temperature;
  }
  
  // Note: contextWindow is NOT part of model config
  // It's only used for request payload building on the frontend
  
  return effective;
}

// ============================================
// EFFECTIVE CONFIG BUILDER
// ============================================

/**
 * Build effective model configuration for API requests
 * 
 * Merges model settings with global overrides.
 * Global temperature overrides model temperature.
 * 
 * @param {Object|null} selectedModel - Selected model (null if none)
 * @param {Object} settings - Global settings
 * @returns {Object} - Effective model config for request
 */
export function buildEffectiveModelConfig(selectedModel, settings) {
  // If no model selected, return null
  if (!selectedModel) {
    return null;
  }

  // Build base config from model
  const modelConfig = {
    provider: selectedModel.provider,
    model_name: selectedModel.model_name,
    api_key: selectedModel.api_key,
    temperature: selectedModel.temperature,
    base_url: selectedModel.base_url,
  };

  // Apply global overrides
  return applyGlobalOverrides(modelConfig, settings);
}

/**
 * Build complete request payload configuration
 * 
 * Returns the model config portion for chat requests.
 * System prompt is handled separately in message array construction.
 * 
 * @param {Object|null} selectedModel - Selected model
 * @param {Object} settings - Global settings
 * @returns {Object} - Model config for request payload
 */
export function buildRequestModelConfig(selectedModel, settings) {
  const effective = buildEffectiveModelConfig(selectedModel, settings);
  
  if (!effective) {
    return null;
  }

  // Ensure all required fields are present
  return {
    provider: effective.provider,
    model_name: effective.model_name,
    api_key: effective.api_key,
    temperature: effective.temperature,
    base_url: effective.base_url,
  };
}

// ============================================
// REQUEST PAYLOAD BUILDER
// ============================================

/**
 * Build messages array for chat request
 * 
 * CRITICAL: System prompt is NEVER trimmed.
 * System prompt always comes first.
 * Then conversation messages (after trim boundary).
 * Then current user message.
 * 
 * @param {string} systemPrompt - Global system prompt
 * @param {Object[]} conversationMessages - Full conversation messages
 * @param {number} trimBoundary - Accumulated trim boundary
 * @param {string} currentUserMessage - New user message
 * @returns {Object[]} - Messages array for request payload
 */
export function buildRequestMessages(
  systemPrompt,
  conversationMessages,
  trimBoundary,
  currentUserMessage
) {
  const messages = [];

  // System prompt ALWAYS comes first if it exists
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({
      role: 'system',
      content: systemPrompt.trim(),
    });
  }

  // Add conversation messages that are still in context
  // (skip the ones that have been trimmed)
  const messagesInContext = conversationMessages.slice(trimBoundary);
  
  // Filter out any empty messages
  const validMessages = messagesInContext.filter(
    m => m.content && m.content.trim()
  );
  
  messages.push(...validMessages);

  // Add the new user message (last)
  messages.push({
    role: 'user',
    content: currentUserMessage,
  });

  return messages;
}

/**
 * Build complete chat request payload
 * 
 * Combines model config and messages for backend request.
 * 
 * @param {Object} modelConfig - Effective model config
 * @param {string} systemPrompt - Global system prompt
 * @param {Object[]} conversationMessages - Full conversation messages
 * @param {number} trimBoundary - Accumulated trim boundary
 * @param {string} currentUserMessage - New user message
 * @param {number} contextWindow - Context window size
 * @returns {Object} - Complete request payload
 */
export function buildChatRequestPayload(
  modelConfig,
  systemPrompt,
  conversationMessages,
  trimBoundary,
  currentUserMessage,
  contextWindow = 8000
) {
  if (!modelConfig) {
    throw new Error('No model config provided');
  }

  const messages = buildRequestMessages(
    systemPrompt,
    conversationMessages,
    trimBoundary,
    currentUserMessage
  );

  return {
    model_config: modelConfig,
    messages,
    context_window: contextWindow,
  };
}

// ============================================
// SETTINGS VALIDATION UTILITIES
// ============================================

/**
 * Validate all settings values
 * @param {Object} settings 
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export function validateSettings(settings) {
  const errors = {};

  if (!isValidTemperature(settings.temperature)) {
    errors.temperature = `Temperature must be between ${TEMPERATURE_MIN} and ${TEMPERATURE_MAX}`;
  }

  if (!isValidContextWindow(settings.contextWindow)) {
    errors.contextWindow = `Context window must be at least ${CONTEXT_WINDOW_MIN}`;
  }

  // Username is optional (empty = "Welcome" without name)
  // System prompt is optional (empty = no system message)

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Clamp temperature to valid range
 * @param {number} temperature 
 * @returns {number}
 */
export function clampTemperature(temperature) {
  return Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, temperature));
}

/**
 * Clamp context window to valid range
 * @param {number} contextWindow 
 * @returns {number}
 */
export function clampContextWindow(contextWindow) {
  return Math.max(CONTEXT_WINDOW_MIN, contextWindow);
}

// ============================================
// SETTINGS UTILITIES
// ============================================

/**
 * Get display name for welcome screen
 * @param {string} username 
 * @returns {string}
 */
export function getWelcomeDisplayName(username) {
  return username && username.trim() ? username.trim() : 'User';
}

/**
 * Get effective temperature (settings override)
 * @param {number} modelTemperature 
 * @param {number} settingsTemperature 
 * @returns {number}
 */
export function getEffectiveTemperature(modelTemperature, settingsTemperature) {
  // Global settings override model settings
  return settingsTemperature !== undefined ? settingsTemperature : modelTemperature;
}

/**
 * Get effective system prompt
 * @param {string} settingsSystemPrompt 
 * @returns {string}
 */
export function getEffectiveSystemPrompt(settingsSystemPrompt) {
  return settingsSystemPrompt || '';
}

// ============================================
// EXPORTS
// ============================================

export default {
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
  CONTEXT_WINDOW_MIN,
  isValidTemperature,
  isValidContextWindow,
  isValidSystemPrompt,
  isValidUsername,
  buildEffectiveModelConfig,
  buildRequestModelConfig,
  buildRequestMessages,
  buildChatRequestPayload,
  validateSettings,
  clampTemperature,
  clampContextWindow,
  getWelcomeDisplayName,
  getEffectiveTemperature,
  getEffectiveSystemPrompt,
};
