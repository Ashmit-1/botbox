import { create } from 'zustand';
import { createSettings } from './schemas';

/**
 * Settings Store
 * 
 * Manages:
 * - User preferences
 * - Application settings
 * - Default values for new conversations
 * 
 * Settings Schema:
 * {
 *   username,           // User's display name
 *   temperature,        // Default temperature (0.0 - 2.0)
 *   contextWindow,      // Default context window size
 *   systemPrompt,       // Default system prompt
 *   defaultModelId      // Default model ID
 * }
 */

const SETTINGS_STORAGE_KEY = 'settings';

// Default settings values
export const DEFAULT_SETTINGS = {
  username: 'User',
  temperature: 0.7,
  contextWindow: 8000,
  systemPrompt: 'You are a helpful assistant.',
  defaultModelId: null,
};

// Temperature bounds
export const TEMPERATURE_MIN = 0.0;
export const TEMPERATURE_MAX = 2.0;

// Context window bounds
export const CONTEXT_WINDOW_MIN = 2000;

const settingsStore = create((set, get) => ({
  // ============================================
  // STATE
  // ============================================

  /** @type {Object} - Current settings */
  settings: { ...DEFAULT_SETTINGS },

  /** @type {boolean} - Whether settings have been loaded */
  settingsLoaded: false,

  /** @type {boolean} - Whether settings are being saved */
  saving: false,

  /** @type {Error|null} - Current error */
  error: null,

  // ============================================
  // SELECTORS
  // ============================================

  /**
   * Get all settings
   * @returns {Object}
   */
  getSettings: () => get().settings,

  /**
   * Get a specific setting by key
   * @param {string} key
   * @returns {*}
   */
  getSetting: (key) => get().settings[key],

  /**
   * Get username
   * @returns {string}
   */
  getUsername: () => get().settings.username,

  /**
   * Get default temperature
   * @returns {number}
   */
  getTemperature: () => get().settings.temperature,

  /**
   * Get default context window
   * @returns {number}
   */
  getContextWindow: () => get().settings.contextWindow,

  /**
   * Get default system prompt
   * @returns {string}
   */
  getSystemPrompt: () => get().settings.systemPrompt,

  /**
   * Get default model ID
   * @returns {string|null}
   */
  getDefaultModelId: () => get().settings.defaultModelId,

  /**
   * Check if settings have been loaded
   * @returns {boolean}
   */
  areSettingsLoaded: () => get().settingsLoaded,

  /**
   * Check if settings are being saved
   * @returns {boolean}
   */
  isSaving: () => get().saving,

  // ============================================
  // ACTIONS
  // ============================================

  actions: {
    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the store with default settings
     */
    initialize: () => {
      set({
        settings: { ...DEFAULT_SETTINGS },
        settingsLoaded: false,
        saving: false,
        error: null,
      });
    },

    /**
     * Load settings from storage
     * @param {Object} settings - Settings from localForage
     */
    loadSettings: (settings) => {
      // Merge with defaults to ensure all keys exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
      set({
        settings: mergedSettings,
        settingsLoaded: true,
        saving: false,
      });
    },

    /**
     * Set error
     * @param {Error|null} error
     */
    setError: (error) => {
      set({ error });
    },

    /**
     * Clear error
     */
    clearError: () => {
      set({ error: null });
    },

    // ============================================
    // SETTINGS UPDATES
    // ============================================

    /**
     * Update a single setting
     * @param {string} key - Setting key
     * @param {*} value - New value
     */
    updateSetting: (key, value) => {
      set((state) => ({
        settings: { ...state.settings, [key]: value },
        saving: false,
      }));
    },

    /**
     * Update multiple settings at once
     * @param {Object} updates - Settings to update
     */
    updateSettings: (updates) => {
      set((state) => ({
        settings: { ...state.settings, ...updates },
        saving: false,
      }));
    },

    /**
     * Set all settings (replace entirely)
     * @param {Object} newSettings
     */
    setSettings: (newSettings) => {
      set({ settings: { ...DEFAULT_SETTINGS, ...newSettings } });
    },

    // ============================================
    // SPECIFIC SETTING UPDATES
    // ============================================

    /**
     * Update username
     * @param {string} username
     */
    setUsername: (username) => {
      get().actions.updateSetting('username', username);
    },

    /**
     * Update default temperature
     * @param {number} temperature - Value between 0.0 and 2.0
     */
    setTemperature: (temperature) => {
      const clamped = Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, temperature));
      get().actions.updateSetting('temperature', clamped);
    },

    /**
     * Update default context window
     * @param {number} contextWindow - Value >= 2000
     */
    setContextWindow: (contextWindow) => {
      const clamped = Math.max(CONTEXT_WINDOW_MIN, contextWindow);
      get().actions.updateSetting('contextWindow', clamped);
    },

    /**
     * Update system prompt
     * @param {string} systemPrompt
     */
    setSystemPrompt: (systemPrompt) => {
      get().actions.updateSetting('systemPrompt', systemPrompt);
    },

    /**
     * Set default model ID
     * @param {string|null} defaultModelId
     */
    setDefaultModelId: (defaultModelId) => {
      get().actions.updateSetting('defaultModelId', defaultModelId);
    },

    /**
     * Reset all settings to defaults
     */
    resetToDefaults: () => {
      set({ settings: { ...DEFAULT_SETTINGS } });
    },

    // ============================================
    // SAVING STATE
    // ============================================

    /**
     * Set saving state
     * @param {boolean} saving
     */
    setSaving: (saving) => {
      set({ saving });
    },

    /**
     * Mark settings as loaded
     */
    markAsLoaded: () => {
      set({ settingsLoaded: true });
    },

    // ============================================
    // UTILITY ACTIONS
    // ============================================

    /**
     * Get settings for new conversation creation
     * @returns {Object}
     */
    getNewConversationDefaults: () => {
      const { settings } = get();
      return {
        title: 'Untitled Conversation',
        contextWindow: settings.contextWindow,
      };
    },

    /**
     * Get defaults for new message creation
     * @returns {Object}
     */
    getNewMessageDefaults: () => {
      const { settings } = get();
      return {
        temperature: settings.temperature,
      };
    },

    /**
     * Check if temperature is valid
     * @param {number} temperature
     * @returns {boolean}
     */
    isValidTemperature: (temperature) => {
      return temperature >= TEMPERATURE_MIN && temperature <= TEMPERATURE_MAX;
    },

    /**
     * Check if context window is valid
     * @param {number} contextWindow
     * @returns {boolean}
     */
    isValidContextWindow: (contextWindow) => {
      return contextWindow >= CONTEXT_WINDOW_MIN;
    },

    // ============================================
    // PERSISTENCE ACTIONS
    // ============================================

    /**
     * Save current settings to localForage
     * Called automatically on each setting change for immediate persistence
     * @returns {Promise<boolean>}
     */
    saveSettingsToStorage: async () => {
      const { settings } = get();
      
      try {
        const { saveSettings } = await import('../services/persistence');
        return await saveSettings(settings);
      } catch (error) {
        console.error('Failed to save settings:', error);
        return false;
      }
    },

    /**
     * Set username with immediate persistence
     * @param {string} username
     */
    setUsernameWithPersistence: async (username) => {
      get().actions.setUsername(username);
      await get().actions.saveSettingsToStorage();
    },

    /**
     * Set temperature with immediate persistence
     * @param {number} temperature
     */
    setTemperatureWithPersistence: async (temperature) => {
      get().actions.setTemperature(temperature);
      await get().actions.saveSettingsToStorage();
    },

    /**
     * Set context window with immediate persistence
     * @param {number} contextWindow
     */
    setContextWindowWithPersistence: async (contextWindow) => {
      get().actions.setContextWindow(contextWindow);
      await get().actions.saveSettingsToStorage();
    },

    /**
     * Set system prompt with immediate persistence
     * @param {string} systemPrompt
     */
    setSystemPromptWithPersistence: async (systemPrompt) => {
      get().actions.setSystemPrompt(systemPrompt);
      await get().actions.saveSettingsToStorage();
    },

    /**
     * Set default model ID with immediate persistence
     * @param {string|null} defaultModelId
     */
    setDefaultModelIdWithPersistence: async (defaultModelId) => {
      get().actions.setDefaultModelId(defaultModelId);
      await get().actions.saveSettingsToStorage();
    },

    // ============================================
    // EXPORT / SERIALIZATION
    // ============================================

    /**
     * Get all settings as plain object for persistence
     * @returns {Object}
     */
    getAllForPersistence: () => {
      const { settings } = get();
      return { ...settings };
    },

    /**
     * Get settings diff from defaults
     * @returns {Object} - Only settings that differ from defaults
     */
    getDiffFromDefaults: () => {
      const { settings } = get();
      const diff = {};
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (settings[key] !== DEFAULT_SETTINGS[key]) {
          diff[key] = settings[key];
        }
      }
      return diff;
    },
  },
}));

export { settingsStore };
export const useSettingsStore = settingsStore;
