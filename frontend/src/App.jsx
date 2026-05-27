import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes';
import { useConversationStore, useModelStore, useSettingsStore } from './store';
import { loadAllState } from './services/persistence';
import { useUnsavedChangesWarning } from './hooks';
import { createEmptyConversation, shouldAutoGenerateTitle, generateTitleFromFirstMessage } from './lib/chatPayloadBuilder';
import { settingsStore, modelStore } from './store';

function App() {
  const [initialized, setInitialized] = useState(false);
  
  const conversationInitialize = useConversationStore((state) => state.actions.initialize);
  const conversationLoadSaved = useConversationStore((state) => state.actions.loadSavedConversations);
  const modelInitialize = useModelStore((state) => state.actions.initialize);
  const modelLoad = useModelStore((state) => state.actions.loadModels);
  const settingsInitialize = useSettingsStore((state) => state.actions.initialize);
  const settingsLoad = useSettingsStore((state) => state.actions.loadSettings);
  const currentConversation = useConversationStore((state) => state.getCurrentConversation());
  const setCurrentConversation = useConversationStore((state) => state.actions.setCurrentConversation);

  // Add beforeunload warning for unsaved changes
  useUnsavedChangesWarning();

  // Initialize stores and load persistence data on app mount
  useEffect(() => {
    async function initializeApp() {
      // Initialize stores
      conversationInitialize();
      modelInitialize();
      settingsInitialize();

      // Load data from persistence service
      try {
        const { conversations, models, settings } = await loadAllState();
        
        // Load into stores
        if (conversations.length > 0) {
          conversationLoadSaved(conversations);
        }
        if (models.length > 0) {
          modelLoad(models);
        }
        if (settings) {
          settingsLoad(settings);
        }
        
        // After loading settings and models, set current model to default model if available
        const defaultModelId = settingsStore.getState().getDefaultModelId();
        if (defaultModelId) {
          const model = modelStore.getState().getModelById(defaultModelId);
          if (model) {
            modelStore.getState().actions.setCurrentModel(defaultModelId);
          }
        }
      } catch (error) {
        console.error('Failed to load persistence data:', error);
      } finally {
        // Ensure we have a current conversation
        const current = useConversationStore.getState().getCurrentConversation();
        if (!current) {
          // Create empty conversation if none exists
          const emptyConversation = createEmptyConversation();
          useConversationStore.getState().actions.setCurrentConversation(emptyConversation);
        } else {
          // Check if we should auto-generate a title from first message
          if (shouldAutoGenerateTitle(current)) {
            const newConversation = {
              ...current,
              title: generateTitleFromFirstMessage(current),
              updatedAt: Date.now(),
            };
            useConversationStore.getState().actions.setCurrentConversation(newConversation);
          }
        }
        
        setInitialized(true);
      }
    }

    initializeApp();
  }, [conversationInitialize, modelInitialize, settingsInitialize, conversationLoadSaved, modelLoad, settingsLoad]);

  // Only render router after initialization is complete
  // This prevents flash of empty state
  if (!initialized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
