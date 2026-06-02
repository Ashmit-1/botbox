import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelStore, useUIStore, useSettingsStore } from '../store';
import { PROVIDERS, REQUIRES_BASE_URL } from '../store/modelStore';
import { createModel } from '../store/schemas';
import { saveModels } from '../services/persistence';
import { validateModel } from '../services/api';
import { loadAllState } from '../services/persistence';

const PROVIDER_DISPLAY = {
  [PROVIDERS.OPENAI]: 'OpenAI',
  [PROVIDERS.GEMINI]: 'Gemini',
  [PROVIDERS.OPENAI_COMPATIBLE]: 'OpenAI Compatible',
};

const DEFAULT_MODEL_NAMES = {
  [PROVIDERS.OPENAI]: 'gpt-4o',
  [PROVIDERS.GEMINI]: 'gemini-1.5-pro',
  [PROVIDERS.OPENAI_COMPATIBLE]: '',
};

function ModelHubPage() {
  const navigate = useNavigate();
  const models = useModelStore(state => state.models);
  const currentModel = useModelStore(state => {
    const { models, currentModelId } = state;
    return models.find(m => m.id === currentModelId) || null;
  });
  const defaultModelId = useSettingsStore(state => state.getDefaultModelId());
  const createStoreModel = useModelStore(state => state.actions.createModel);
  const updateStoreModel = useModelStore(state => state.actions.updateModel);
  const deleteStoreModel = useModelStore(state => state.actions.deleteModel);
  const setCurrentModel = useModelStore(state => state.actions.setCurrentModel);
  const setDefaultModelId = useSettingsStore(state => state.actions.setDefaultModelId);
  const saveSettings = useSettingsStore(state => state.actions.updateSettings);
  const showSuccess = useUIStore(state => state.actions.showSuccess);
  const showError = useUIStore(state => state.actions.showError);
  const showWarning = useUIStore(state => state.actions.showWarning);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    provider: PROVIDERS.OPENAI,
    model_name: DEFAULT_MODEL_NAMES[PROVIDERS.OPENAI],
    api_key: '',
    temperature: 0.7,
    base_url: '',
  });

  const [validationStates, setValidationStates] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const { models } = await loadAllState();
        if (models && models.length > 0) {
          useModelStore.getState().replaceModels(models);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!isAddModalOpen) {
      setFormData({
        id: null,
        name: '',
        provider: PROVIDERS.OPENAI,
        model_name: DEFAULT_MODEL_NAMES[PROVIDERS.OPENAI],
        api_key: '',
        temperature: 0.7,
        base_url: '',
      });
      setValidationResult(null);
      setShowApiKey(false);
    }
  }, [isAddModalOpen]);

  const handleProviderChange = (e) => {
    const provider = e.target.value;
    setFormData(prev => ({
      ...prev,
      provider,
      model_name: DEFAULT_MODEL_NAMES[provider] || prev.model_name,
    }));
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;

    if (type === 'range' || type === 'number' || name === 'temperature') {
      const numValue = parseFloat(value);
      setFormData(prev => ({
        ...prev,
        [name]: isNaN(numValue) ? (name === 'temperature' ? 0.7 : 0) : numValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleShowApiKeyToggle = () => {
    setShowApiKey(!showApiKey);
  };

  const handleAddModel = async () => {
    if (!formData.name.trim()) {
      showError('Model name is required');
      return;
    }

    if (!formData.model_name.trim()) {
      showError('Model name is required');
      return;
    }

    if (!formData.api_key.trim()) {
      showError('API key is required');
      return;
    }

    if (REQUIRES_BASE_URL.includes(formData.provider) && !formData.base_url?.trim()) {
      showError('Base URL is required for OpenAI compatible providers');
      return;
    }

    const newModel = createModel({
      name: formData.name.trim(),
      provider: formData.provider,
      model_name: formData.model_name.trim(),
      api_key: formData.api_key.trim(),
      temperature: formData.temperature,
      base_url: REQUIRES_BASE_URL.includes(formData.provider) ? formData.base_url.trim() : null,
    });

    createStoreModel(newModel);

    await saveModels(useModelStore.getState().getModels());

    showSuccess('Model added successfully');
    setIsAddModalOpen(false);
  };

  const handleEditModel = (model) => {
    setFormData({
      id: model.id,
      name: model.name,
      provider: model.provider,
      model_name: model.model_name,
      api_key: model.api_key,
      temperature: parseFloat(model.temperature) || 0.7,
      base_url: model.base_url || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!formData.id) return;

    if (!formData.name.trim()) {
      showError('Model name is required');
      return;
    }

    if (!formData.model_name.trim()) {
      showError('Model name is required');
      return;
    }

    if (!formData.api_key.trim()) {
      showError('API key is required');
      return;
    }

    if (REQUIRES_BASE_URL.includes(formData.provider) && !formData.base_url?.trim()) {
      showError('Base URL is required for OpenAI compatible providers');
      return;
    }

    const updatedModel = updateStoreModel(formData.id, {
      name: formData.name.trim(),
      provider: formData.provider,
      model_name: formData.model_name.trim(),
      api_key: formData.api_key.trim(),
      temperature: formData.temperature,
      base_url: REQUIRES_BASE_URL.includes(formData.provider) ? formData.base_url.trim() : null,
    });

    if (updatedModel) {
      await saveModels(useModelStore.getState().getModels());
      showSuccess('Model updated successfully');
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteConfirm = (model) => {
    setModelToDelete(model);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!modelToDelete) return;

    deleteStoreModel(modelToDelete.id);

    if (currentModel?.id === modelToDelete.id) {
      setCurrentModel(null);
    }

    if (defaultModelId === modelToDelete.id) {
      setDefaultModelId(null);
      await saveSettings(useSettingsStore.getState().getSettings());
    }

    await saveModels(useModelStore.getState().getModels());
    showSuccess('Model deleted successfully');

    setIsDeleteModalOpen(false);
    setModelToDelete(null);
  };

  const handleSetAsDefault = async (model) => {
    setDefaultModelId(model.id);
    setCurrentModel(model.id);
    await saveSettings(useSettingsStore.getState().getSettings());
    showSuccess(`${model.name} set as default model`);
  };

  const handleValidate = async (model) => {
    if (!model.api_key) {
      showWarning('No API key to validate');
      return;
    }

    setIsValidating(true);
    setValidationStates(prev => ({ ...prev, [model.id]: 'validating' }));

    try {
      const result = await validateModel({
        provider: model.provider,
        model_name: model.model_name,
        api_key: model.api_key,
        temperature: model.temperature,
        base_url: model.base_url,
      });

      setValidationStates(prev => ({
        ...prev,
        [model.id]: result.valid ? 'valid' : 'invalid'
      }));
      setValidationResult(result);

      if (result.valid) {
        showSuccess('Model validated successfully');
      } else {
        showError(result.error || 'Validation failed');
      }
    } catch (error) {
      setValidationStates(prev => ({ ...prev, [model.id]: 'error' }));
      showError(error.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationStatus = (modelId) => {
    return validationStates[modelId];
  };

  const isProviderOpenAICompatible = (provider) => {
    return REQUIRES_BASE_URL.includes(provider);
  };

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold uppercase tracking-wider">Model Hub</h1>
          <button
            onClick={() => navigate('/chat')}
            className="p-2 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-6 pb-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Add Model Button */}
            <div className="mb-6">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-white font-medium transition-colors uppercase tracking-wider"
              >
                + Add Model
              </button>
            </div>

            {/* Configured Models */}
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-wider">
                Configured Models
              </h2>
              {models.length === 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
                  <p className="text-gray-400 mb-4">No models configured</p>
                  <p className="text-gray-500 text-sm">Add your first model to begin chatting</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-white font-medium transition-colors"
                  >
                    Add Model
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {models.map(model => (
                    <div
                      key={model.id}
                      className={`bg-gray-900 border border-gray-700 rounded-xl p-4 ${
                        currentModel?.id === model.id ? 'ring-1 ring-white' : ''
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:justify-between gap-4">
                        {/* Model Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="font-bold text-lg">{model.name}</div>
                            {defaultModelId === model.id && (
                              <span className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded uppercase tracking-wider">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">
                            {PROVIDER_DISPLAY[model.provider] || model.provider}
                            {model.model_name && ` - ${model.model_name}`}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(typeof model.temperature === 'number' && !isNaN(model.temperature))
                              ? model.temperature.toFixed(1)
                              : '0.7'}
                            {model.base_url && ` | Base URL: ${model.base_url}`}
                          </div>

                          {/* Validation Status */}
                          {getValidationStatus(model.id) && (
                            <div className="text-xs mt-2">
                              {getValidationStatus(model.id) === 'valid' && (
                                <span className="text-green-400">✓ Valid</span>
                              )}
                              {getValidationStatus(model.id) === 'invalid' && (
                                <span className="text-red-400">✗ Invalid</span>
                              )}
                              {getValidationStatus(model.id) === 'validating' && (
                                <span className="text-yellow-400">Validating...</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 md:flex-col md:gap-2 shrink-0">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSetAsDefault(model)}
                              disabled={defaultModelId === model.id}
                              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors disabled:opacity-40"
                            >
                              {defaultModelId === model.id ? 'Default' : 'Set Default '}
                            </button>

                            <button
                              onClick={() => handleValidate(model)}
                              disabled={isValidating}
                              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors disabled:opacity-40"
                            >
                              Validate
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditModel(model)}
                              className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDeleteConfirm(model)}
                              className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-700/50 rounded-lg hover:bg-red-800/40 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Model Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-wider">
              {formData.id ? 'Edit Model' : 'Add Model'}
            </h2>

            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              formData.id ? handleSaveEdit() : handleAddModel();
            }}>
              {/* Model Name */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                  Display Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="My GPT-4 Model"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                />
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                  Provider
                </label>
                <select
                  name="provider"
                  value={formData.provider}
                  onChange={handleProviderChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                >
                  {Object.entries(PROVIDER_DISPLAY).map(([key, display]) => (
                    <option key={key} value={key}>
                      {display}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Name (from provider) */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                  Model Identifier
                </label>
                <input
                  type="text"
                  name="model_name"
                  value={formData.model_name}
                  onChange={handleFormChange}
                  placeholder="gpt-4o"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    name="api_key"
                    value={formData.api_key}
                    onChange={handleFormChange}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                  Temperature
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    name="temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={handleFormChange}
                    className="flex-1"
                  />
                  <span className="w-16 text-right text-sm text-gray-400">
                    {(typeof formData.temperature === 'number' && !isNaN(formData.temperature)
                      ? formData.temperature.toFixed(1)
                      : '0.7')}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Lower = more deterministic, Higher = more creative
                </p>
              </div>

              {/* Base URL (only for OpenAI compatible) */}
              {isProviderOpenAICompatible(formData.provider) && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                    Base URL
                  </label>
                  <input
                    type="url"
                    name="base_url"
                    value={formData.base_url}
                    onChange={handleFormChange}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                  />
                  <p className="text-xs text-gray-500">
                    Required for OpenAI compatible endpoints
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors uppercase text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-white transition-colors uppercase text-sm font-medium"
                >
                  {formData.id ? 'Save Changes' : 'Add Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && modelToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-wider">Delete Model</h2>
            <p className="mb-6 text-gray-400">
              Delete {modelToDelete.name}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setModelToDelete(null);
                }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors uppercase text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors uppercase text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ModelHubPage;
