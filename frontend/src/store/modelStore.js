import { create } from 'zustand';
import { createModel } from './schemas';

/**
 * Model Store
 * 
 * Manages:
 * - All model configurations
 * - Current selected model
 * - CRUD operations for models
 * - Model validation state
 * 
 * Model Schema:
 * {
 *   id,
 *   name,
 *   provider,        // 'openai' | 'gemini' | 'openai_compatible'
 *   model_name,      // Model identifier from provider
 *   api_key,         // API key (to be encrypted before persistence)
 *   temperature,     // Sampling temperature (0.0 - 2.0)
 *   base_url         // Base URL (required for openai_compatible)
 * }
 * 
 * NOTE: API keys are stored in memory and must be encrypted before
 * persisting to localForage. Encryption implementation is future work.
 */

const MODEL_STORAGE_KEY = 'models';

// Provider constants
export const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  OPENAI_COMPATIBLE: 'openai_compatible',
};

// Providers that require base_url
export const REQUIRES_BASE_URL = [PROVIDERS.OPENAI_COMPATIBLE];

// Default models per provider
export const DEFAULT_MODELS = {
  [PROVIDERS.OPENAI]: 'gpt-4o',
  [PROVIDERS.GEMINI]: 'gemini-1.5-pro',
  [PROVIDERS.OPENAI_COMPATIBLE]: '',
};

const modelStore = create((set, get) => ({
  // ============================================
  // STATE
  // ============================================

  /** @type {Object[]} - All saved model configurations */
  models: [],

  /** @type {boolean} - Whether models have been loaded from storage */
  modelsLoaded: false,

  /** @type {string|null} - ID of currently selected model */
  currentModelId: null,

  /** @type {Object|null} - Model validation state */
  validation: {
    isValidating: false,
    error: null,
    lastValidatedModelId: null,
    lastValidationResult: null,
  },

  /** @type {boolean} - Whether a model operation is in progress */
  loading: false,

  /** @type {Error|null} - Current error */
  error: null,

  // ============================================
  // SELECTORS
  // ============================================

  /**
   * Get all models
   * @returns {Object[]}
   */
  getModels: () => get().models,

  /**
   * Get current model
   * @returns {Object|null}
   */
  getCurrentModel: () => {
    const { models, currentModelId } = get();
    return models.find(m => m.id === currentModelId) || null;
  },

  /**
   * Get model by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getModelById: (id) => {
    const { models } = get();
    return models.find(m => m.id === id) || null;
  },

  /**
   * Get models by provider
   * @param {string} provider
   * @returns {Object[]}
   */
  getModelsByProvider: (provider) => {
    const { models } = get();
    return models.filter(m => m.provider === provider);
  },

  /**
   * Get OpenAI models
   * @returns {Object[]}
   */
  getOpenAIModels: () => get().getModelsByProvider(PROVIDERS.OPENAI),

  /**
   * Get Gemini models
   * @returns {Object[]}
   */
  getGeminiModels: () => get().getModelsByProvider(PROVIDERS.GEMINI),

  /**
   * Get OpenAI compatible models
   * @returns {Object[]}
   */
  getOpenAICompatibleModels: () => get().getModelsByProvider(PROVIDERS.OPENAI_COMPATIBLE),

  /**
   * Check if any models exist
   * @returns {boolean}
   */
  hasModels: () => get().models.length > 0,

  /**
   * Check if a model with base_url requirement is selected
   * @returns {boolean}
   */
  currentModelRequiresBaseUrl: () => {
    const current = get().getCurrentModel();
    if (!current) return false;
    return REQUIRES_BASE_URL.includes(current.provider);
  },

  /**
   * Get validation state
   * @returns {Object}
   */
  getValidation: () => get().validation,

  /**
   * Check if model is validating
   * @returns {boolean}
   */
  isValidating: () => get().validation.isValidating,

  /**
   * Get last validation result for current model
   * @returns {Object|null}
   */
  getLastValidationResult: () => {
    const { validation, currentModelId } = get();
    if (validation.lastValidatedModelId !== currentModelId) {
      return null;
    }
    return validation.lastValidationResult;
  },

  /**
   * Check if current model is valid (last validation passed)
   * @returns {boolean}
   */
  isCurrentModelValid: () => {
    const result = get().getLastValidationResult();
    return result?.valid === true;
  },

  // ============================================
  // ACTIONS
  // ============================================

  actions: {
    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the store with default state
     */
    initialize: () => {
      set({
        models: [],
        modelsLoaded: false,
        currentModelId: null,
        validation: {
          isValidating: false,
          error: null,
          lastValidatedModelId: null,
          lastValidationResult: null,
        },
        loading: false,
        error: null,
      });
    },

    /**
     * Load models from storage
     * @param {Object[]} models - Models from localForage
     */
    loadModels: (models) => {
      set({
        models,
        modelsLoaded: true,
        loading: false,
      });
    },

    /**
     * Set loading state
     * @param {boolean} loading
     */
    setLoading: (loading) => {
      set({ loading });
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
    // MODEL CRUD
    // ============================================

    /**
     * Create a new model
     * @param {Object} params - Model parameters
     * @param {string} params.name - Display name
     * @param {string} params.provider - Provider type
     * @param {string} params.model_name - Model identifier
     * @param {string} params.api_key - API key
     * @param {number} [params.temperature] - Temperature (default: 0.7)
     * @param {string} [params.base_url] - Base URL
     * @returns {Object} - The created model
     */
    createModel: (params) => {
      const model = createModel({
        name: params.name,
        provider: params.provider,
        model_name: params.model_name,
        api_key: params.api_key,
        temperature: params.temperature,
        base_url: params.base_url,
      });

      set((state) => ({
        models: [model, ...state.models],
        currentModelId: model.id,
        saved: false,
      }));

      return model;
    },

    /**
     * Add a model (from storage or external source)
     * @param {Object} model - Model to add
     * @returns {Object} - The added model
     */
    addModel: (model) => {
      set((state) => ({
        models: [model, ...state.models],
      }));
      return model;
    },

    /**
     * Update a model
     * @param {string} id - Model ID to update
     * @param {Object} updates - Updates to apply
     * @returns {Object|null} - The updated model or null
     */
    updateModel: (id, updates) => {
      const { models, currentModelId } = get();
      
      const updatedModels = models.map(model => {
        if (model.id !== id) return model;
        return { ...model, ...updates };
      });

      set({ models: updatedModels });

      const updatedModel = updatedModels.find(m => m.id === id);
      
      // If current model was updated, keep selection
      if (currentModelId === id && updatedModel) {
        set({ currentModelId: updatedModel.id });
      }

      return updatedModel || null;
    },

    /**
     * Update current model
     * @param {Object} updates - Updates to apply
     * @returns {Object|null}
     */
    updateCurrentModel: (updates) => {
      const { currentModelId } = get();
      if (!currentModelId) return null;
      return get().actions.updateModel(currentModelId, updates);
    },

    /**
     * Delete a model
     * @param {string} id - Model ID to delete
     */
    deleteModel: (id) => {
      const { currentModelId } = get();
      
      set((state) => {
        const newModels = state.models.filter(m => m.id !== id);
        const newCurrentModelId = currentModelId === id ? null : currentModelId;
        return {
          models: newModels,
          currentModelId: newCurrentModelId,
        };
      });
    },

    /**
     * Replace all models (for bulk operations)
     * @param {Object[]} newModels - New models array
     */
    replaceModels: (newModels) => {
      set({ models: newModels });
    },

    // ============================================
    // MODEL SELECTION
    // ============================================

    /**
     * Set the current model
     * @param {string} id - Model ID to select
     */
    setCurrentModel: (id) => {
      const { models } = get();
      
      if (!models.some(m => m.id === id)) {
        get().actions.setError(new Error(`Model ${id} not found`));
        return;
      }

      set({ currentModelId: id });
    },

    /**
     * Set current model by index
     * @param {number} index
     */
    setCurrentModelByIndex: (index) => {
      const { models } = get();
      if (index < 0 || index >= models.length) {
        get().actions.setError(new Error('Invalid model index'));
        return;
      }
      set({ currentModelId: models[index].id });
    },

    /**
     * Clear current model selection
     */
    clearCurrentModel: () => {
      set({ currentModelId: null });
    },

    /**
     * Select next model in list
     */
    selectNextModel: () => {
      const { models, currentModelId } = get();
      if (models.length === 0) return;
      
      const currentIndex = models.findIndex(m => m.id === currentModelId);
      const nextIndex = (currentIndex + 1) % models.length;
      get().actions.setCurrentModelByIndex(nextIndex);
    },

    /**
     * Select previous model in list
     */
    selectPreviousModel: () => {
      const { models, currentModelId } = get();
      if (models.length === 0) return;
      
      const currentIndex = models.findIndex(m => m.id === currentModelId);
      const prevIndex = (currentIndex - 1 + models.length) % models.length;
      get().actions.setCurrentModelByIndex(prevIndex);
    },

    // ============================================
    // VALIDATION
    // ============================================

    /**
     * Set validation state
     * @param {Object} state - Validation state updates
     */
    setValidation: (state) => {
      set((prev) => ({
        validation: { ...prev.validation, ...state },
      }));
    },

    /**
     * Start model validation
     * @param {string} modelId - Model ID to validate
     */
    startValidation: (modelId) => {
      get().actions.setValidation({
        isValidating: true,
        error: null,
        lastValidatedModelId: modelId,
        lastValidationResult: null,
      });
    },

    /**
     * Complete model validation
     * @param {Object} result - Validation result from backend
     */
    completeValidation: (result) => {
      get().actions.setValidation({
        isValidating: false,
        lastValidationResult: result,
      });
    },

    /**
     * Fail model validation
     * @param {Error} error - Validation error
     */
    failValidation: (error) => {
      get().actions.setValidation({
        isValidating: false,
        error,
        lastValidationResult: { valid: false, error: error.message },
      });
    },

    /**
     * Validate current model with backend
     * @returns {Promise<Object|null>} - Validation result or null
     */
    validateCurrentModel: async () => {
      const { currentModelId, models } = get();
      const currentModel = models.find(m => m.id === currentModelId);
      
      if (!currentModel) {
        get().actions.setError(new Error('No current model selected'));
        return null;
      }

      get().actions.startValidation(currentModelId);

      // Import here to avoid circular dependency
      const { validateModel } = await import('../services/api');

      try {
        const result = await validateModel({
          provider: currentModel.provider,
          model_name: currentModel.model_name,
          api_key: currentModel.api_key,
          temperature: currentModel.temperature,
          base_url: currentModel.base_url,
        });

        get().actions.completeValidation(result);
        return result;
      } catch (error) {
        get().actions.failValidation(error);
        return null;
      }
    },

    // ============================================
    // UTILITY ACTIONS
    // ============================================

    /**
     * Get model config for API request
     * @param {string} [modelId] - Optional model ID (defaults to current)
     * @returns {Object|null}
     */
    getModelConfigForRequest: (modelId) => {
      const { currentModelId, models } = get();
      const targetModelId = modelId || currentModelId;
      const model = models.find(m => m.id === targetModelId);
      
      if (!model) return null;

      return {
        provider: model.provider,
        model_name: model.model_name,
        api_key: model.api_key,
        temperature: model.temperature,
        base_url: model.base_url,
      };
    },

    /**
     * Check if model requires base_url
     * @param {string} modelId
     * @returns {boolean}
     */
    modelRequiresBaseUrl: (modelId) => {
      const model = get().getModelById(modelId);
      if (!model) return false;
      return REQUIRES_BASE_URL.includes(model.provider);
    },

    // ============================================
    // EXPORT / SERIALIZATION
    // ============================================

    /**
     * Get all models as plain objects for persistence
     * NOTE: API keys are NOT encrypted here - encryption should happen
     * before calling this for actual persistence
     * @returns {Object[]}
     */
    getAllForPersistence: () => {
      const { models } = get();
      return models.map(m => ({ ...m }));
    },

    /**
     * Get current model for persistence
     * @returns {Object|null}
     */
    getCurrentForPersistence: () => {
      const current = get().getCurrentModel();
      return current ? { ...current } : null;
    },

  },
}));

export { modelStore };
export const useModelStore = modelStore;
