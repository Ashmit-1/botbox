import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useModelStore, useUIStore } from '../store';
import { clampTemperature, clampContextWindow, isValidContextWindow } from '../lib/runtimeConfig';

/**
 * Settings Page
 * 
 * Runtime configuration for all future chat requests.
 * Settings persist immediately on change (no Save button).
 * Global settings override model-specific settings.
 */
function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore(state => state.getSettings());
  const models = useModelStore(state => state.getModels());
  
  const setUsername = useSettingsStore(state => state.actions.setUsername);
  const setTemperature = useSettingsStore(state => state.actions.setTemperature);
  const setContextWindow = useSettingsStore(state => state.actions.setContextWindow);
  const setSystemPrompt = useSettingsStore(state => state.actions.setSystemPrompt);
  const setDefaultModelId = useSettingsStore(state => state.actions.setDefaultModelId);
  const saveSettingsToStorage = useSettingsStore(state => state.actions.saveSettingsToStorage);

  const closeSettings = useUIStore(state => state.actions.closeSettings);
  const showError = useUIStore(state => state.actions.showError);
  const showSuccess = useUIStore(state => state.actions.showSuccess);

  // Local form state for validation before applying
  const [formData, setFormData] = useState({
    username: settings.username,
    temperature: settings.temperature,
    contextWindow: settings.contextWindow,
    systemPrompt: settings.systemPrompt,
    defaultModelId: settings.defaultModelId || '',
  });

  // Sync form with settings when settings change externally
  useEffect(() => {
    setFormData({
      username: settings.username,
      temperature: settings.temperature,
      contextWindow: settings.contextWindow,
      systemPrompt: settings.systemPrompt,
      defaultModelId: settings.defaultModelId || '',
    });
  }, [settings]);

  // Debounced save for text inputs
  const debouncedSave = useCallback(
    (action, value, validationFn = null) => {
      // Validate if validation function provided
      if (validationFn && !validationFn(value)) {
        showError('Invalid value');
        return;
      }
      
      // Apply and save
      action(value);
      saveSettingsToStorage();
    },
    [saveSettingsToStorage, showError]
  );

  // Handle username change with immediate persistence
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, username: value }));
    debouncedSave(setUsername, value);
  };

  // Handle temperature change (slider) with immediate persistence
  const handleTemperatureChange = (e) => {
    const value = parseFloat(e.target.value);
    const safeValue = isNaN(value) ? 0.7 : value;
    setFormData(prev => ({ ...prev, temperature: safeValue }));
    debouncedSave(setTemperature, safeValue);
  };

  // Handle temperature input (numeric) with immediate persistence
  const handleTemperatureInputChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setFormData(prev => ({ ...prev, temperature: value }));
      debouncedSave(setTemperature, value);
    }
  };

  // Handle context window change with immediate persistence
  const handleContextWindowChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setFormData(prev => ({ ...prev, contextWindow: value }));
    
    // Validate and clamp
    const clamped = clampContextWindow(value);
    if (clamped !== value) {
      setFormData(prev => ({ ...prev, contextWindow: clamped }));
    }
    debouncedSave(setContextWindow, clamped, isValidContextWindow);
  };

  // Handle system prompt change with immediate persistence
  const handleSystemPromptChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, systemPrompt: value }));
    debouncedSave(setSystemPrompt, value);
  };

  // Handle default model change with immediate persistence
  const handleDefaultModelChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, defaultModelId: value }));
    debouncedSave(setDefaultModelId, value === '' ? null : value);
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    useSettingsStore.getState().actions.resetToDefaults();
    saveSettingsToStorage();
    showSuccess('Settings reset to defaults');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Settings</h1>
        <button
          onClick={() => navigate('/chat')}
          className="p-2 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-white transition-colors"
        >
          ×
        </button>
      </div>

      <div className="flex-1 px-4 md:px-6 pb-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Username Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                Your Name
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={handleUsernameChange}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
              />
              <p className="text-xs text-gray-500">
                Used for welcome screen: "Welcome, {name}"
              </p>
            </div>
          </section>

          {/* Temperature Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-gray-500 tracking-wider">
              Temperature
            </h2>
            
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                Global Temperature Override
              </label>
              
              {/* Slider */}
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={handleTemperatureChange}
                  className="flex-1"
                />
                <span className="w-16 text-right text-sm text-gray-400">
                  {(typeof formData.temperature === 'number' && !isNaN(formData.temperature) 
                    ? formData.temperature.toFixed(1) 
                    : '0.7')}
                </span>
              </div>
              
              {/* Numeric Input */}
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={handleTemperatureInputChange}
                  className="w-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                />
                <span className="text-sm text-gray-500">Range: 0.0 - 2.0</span>
              </div>
              
              <p className="text-xs text-gray-500">
                Lower = more deterministic. Higher = more creative.
                <br />
                <strong>This overrides all model-specific temperature settings.</strong>
              </p>
            </div>
          </section>

          {/* Context Window Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-gray-500 tracking-wider">
              Context Window
            </h2>
            
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                Global Context Window Size
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={formData.contextWindow}
                  onChange={handleContextWindowChange}
                  min={2000}
                  className="w-48 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white"
                />
              </div>
              <p className="text-xs text-gray-500">
                Tokens the model can consider from previous messages.
                <br />
                Minimum: 2000. Recommended: 8000.
              </p>
            </div>
          </section>

          {/* System Prompt Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-gray-500 tracking-wider">
              System Prompt
            </h2>
            
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                Global System Message
              </label>
              <textarea
                value={formData.systemPrompt}
                onChange={handleSystemPromptChange}
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white font-mono text-sm resize-none"
                placeholder="You are a helpful assistant."
              />
              <p className="text-xs text-gray-500">
                Instructions that guide the AI's behavior.
                <br />
                <strong>CRITICAL: This is NEVER trimmed and always comes first in requests.</strong>
                <br />
                Applies to all conversations. Not per-model.
              </p>
            </div>
          </section>

          {/* Default Model Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-gray-500 tracking-wider">
              Default Model
            </h2>
            
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-500 tracking-wider">
                Default Model Selection
              </label>
              
              {models.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">
                    No models available.
                  </p>
                  <p className="text-gray-500 text-sm">
                    Go to Model Hub to add one.
                  </p>
                </div>
              ) : (
                <select
                  value={formData.defaultModelId}
                  onChange={handleDefaultModelChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-white text-white transition-colors"
                >
                  <option value="">None - Select model per conversation</option>
                  {models.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider}:{model.model_name})
                    </option>
                  ))}
                </select>
              )}
              
              <p className="text-xs text-gray-500">
                This model will be selected by default for new conversations.
                <br />
                Can be changed per conversation.
              </p>
            </div>
          </section>

          {/* Reset Section */}
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <button
              onClick={handleResetToDefaults}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors uppercase text-sm tracking-wider"
            >
              Reset All Settings to Defaults
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
