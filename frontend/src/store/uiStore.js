import { create } from 'zustand';

/**
 * UI Store
 * 
 * Manages:
 * - UI state (modal visibility, drawer state, etc.)
 * - Current view/route state
 * - Loading and error states for UI components
 * - Focus and selection state
 */

const uiStore = create((set, get) => ({
  // ============================================
  // STATE
  // ============================================

  // Modal states
  modals: {
    modelEditor: false,
    conversationSettings: false,
    settings: false,
    confirmDelete: false,
    confirmClear: false,
  },

  // Drawer states
  drawers: {
    conversationList: false,
    modelList: false,
  },

  // Sidebar state
  sidebarCollapsed: false,

  // Current focused element IDs
  focus: {
    conversationId: null,
    messageId: null,
    modelId: null,
  },

  // Selection state (for batch operations)
  selection: {
    conversationIds: new Set(),
    modelIds: new Set(),
  },

  // Current active view/tab
  activeView: {
    chat: {
      inputFocused: false,
      messagesScrollPosition: 0,
      isScrolledToBottom: true,
    },
    models: {
      filter: 'all',
      searchQuery: '',
    },
    settings: {
      activeTab: 'general',
    },
  },

  // Toast/notifications
  notifications: [],

  // Global loading overlay
  globalLoading: false,
  globalLoadingMessage: '',

  // Keyboard shortcuts helper state
  keyboard: {
    cmdPressed: false,
    ctrlPressed: false,
    shiftPressed: false,
    lastKey: null,
  },

  // ============================================
  // SELECTORS
  // ============================================

  // Modal getters
  isModelEditorOpen: () => get().modals.modelEditor,
  isConversationSettingsOpen: () => get().modals.conversationSettings,
  isSettingsOpen: () => get().modals.settings,
  isConfirmDeleteOpen: () => get().modals.confirmDelete,
  isConfirmClearOpen: () => get().modals.confirmClear,

  // Sidebar state
  isSidebarCollapsed: () => get().sidebarCollapsed,

  // Drawer getters
  isConversationListOpen: () => get().drawers.conversationList,
  isModelListOpen: () => get().drawers.modelList,

  // Focus getters
  getFocusedConversationId: () => get().focus.conversationId,
  getFocusedMessageId: () => get().focus.messageId,
  getFocusedModelId: () => get().focus.modelId,

  // Selection getters
  getSelectedConversationIds: () => Array.from(get().selection.conversationIds),
  getSelectedModelIds: () => Array.from(get().selection.modelIds),
  hasSelectedConversations: () => get().selection.conversationIds.size > 0,
  hasSelectedModels: () => get().selection.modelIds.size > 0,

  // Active view getters
  getActiveChatView: () => get().activeView.chat,
  getActiveModelsView: () => get().activeView.models,
  getActiveSettingsView: () => get().activeView.settings,

  // Notifications
  getNotifications: () => get().notifications,
  hasNotifications: () => get().notifications.length > 0,

  // Global loading
  isGlobalLoading: () => get().globalLoading,
  getGlobalLoadingMessage: () => get().globalLoadingMessage,

  // Keyboard state
  isCmdPressed: () => get().keyboard.cmdPressed,
  isCtrlPressed: () => get().keyboard.ctrlPressed,
  isShiftPressed: () => get().keyboard.shiftPressed,

  // ============================================
  // ACTIONS
  // ============================================

  actions: {
    // ============================================
    // SIDEBAR ACTIONS
    // ============================================

    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
    },

    setSidebarCollapsed: (collapsed) => {
      set({ sidebarCollapsed: collapsed });
    },

    // ============================================
    // MODAL ACTIONS
    // ============================================

    openModal: (modalName) => {
      set((state) => ({
        modals: { ...state.modals, [modalName]: true },
      }));
    },

    closeModal: (modalName) => {
      set((state) => ({
        modals: { ...state.modals, [modalName]: false },
      }));
    },

    toggleModal: (modalName) => {
      set((state) => ({
        modals: { ...state.modals, [modalName]: !state.modals[modalName] },
      }));
    },

    // Specific modal actions
    openModelEditor: () => get().actions.openModal('modelEditor'),
    closeModelEditor: () => get().actions.closeModal('modelEditor'),
    toggleModelEditor: () => get().actions.toggleModal('modelEditor'),

    openConversationSettings: () => get().actions.openModal('conversationSettings'),
    closeConversationSettings: () => get().actions.closeModal('conversationSettings'),

    openSettings: () => get().actions.openModal('settings'),
    closeSettings: () => get().actions.closeModal('settings'),

    openConfirmDelete: () => get().actions.openModal('confirmDelete'),
    closeConfirmDelete: () => get().actions.closeModal('confirmDelete'),

    openConfirmClear: () => get().actions.openModal('confirmClear'),
    closeConfirmClear: () => get().actions.closeModal('confirmClear'),

    // Close all modals
    closeAllModals: () => {
      set({ modals: {
        modelEditor: false,
        conversationSettings: false,
        settings: false,
        confirmDelete: false,
        confirmClear: false,
      } });
    },

    // ============================================
    // DRAWER ACTIONS
    // ============================================

    openDrawer: (drawerName) => {
      set((state) => ({
        drawers: { ...state.drawers, [drawerName]: true },
      }));
    },

    closeDrawer: (drawerName) => {
      set((state) => ({
        drawers: { ...state.drawers, [drawerName]: false },
      }));
    },

    toggleDrawer: (drawerName) => {
      set((state) => ({
        drawers: { ...state.drawers, [drawerName]: !state.drawers[drawerName] },
      }));
    },

    // Specific drawer actions
    openConversationList: () => get().actions.openDrawer('conversationList'),
    closeConversationList: () => get().actions.closeDrawer('conversationList'),
    toggleConversationList: () => get().actions.toggleDrawer('conversationList'),

    openModelList: () => get().actions.openDrawer('modelList'),
    closeModelList: () => get().actions.closeDrawer('modelList'),
    toggleModelList: () => get().actions.toggleDrawer('modelList'),

    // Close all drawers
    closeAllDrawers: () => {
      set({ drawers: {
        conversationList: false,
        modelList: false,
      } });
    },

    // ============================================
    // FOCUS ACTIONS
    // ============================================

    focusConversation: (conversationId) => {
      set({ focus: { ...get().focus, conversationId } });
    },

    blurConversation: () => {
      set({ focus: { ...get().focus, conversationId: null } });
    },

    focusMessage: (messageId) => {
      set({ focus: { ...get().focus, messageId } });
    },

    blurMessage: () => {
      set({ focus: { ...get().focus, messageId: null } });
    },

    focusModel: (modelId) => {
      set({ focus: { ...get().focus, modelId } });
    },

    blurModel: () => {
      set({ focus: { ...get().focus, modelId: null } });
    },

    clearAllFocus: () => {
      set({ focus: {
        conversationId: null,
        messageId: null,
        modelId: null,
      } });
    },

    // ============================================
    // SELECTION ACTIONS
    // ============================================

    selectConversation: (conversationId, multiSelect = false) => {
      if (!multiSelect) {
        set({ selection: {
          ...get().selection,
          conversationIds: new Set([conversationId]),
        } });
      } else {
        set((state) => {
          const newSet = new Set(state.selection.conversationIds);
          if (newSet.has(conversationId)) {
            newSet.delete(conversationId);
          } else {
            newSet.add(conversationId);
          }
          return {
            selection: {
              ...state.selection,
              conversationIds: newSet,
            },
          };
        });
      }
    },

    deselectConversation: (conversationId) => {
      set((state) => {
        const newSet = new Set(state.selection.conversationIds);
        newSet.delete(conversationId);
        return {
          selection: {
            ...state.selection,
            conversationIds: newSet,
          },
        };
      });
    },

    clearConversationSelection: () => {
      set((state) => ({
        selection: {
          ...state.selection,
          conversationIds: new Set(),
        },
      }));
    },

    selectModel: (modelId, multiSelect = false) => {
      if (!multiSelect) {
        set({ selection: {
          ...get().selection,
          modelIds: new Set([modelId]),
        } });
      } else {
        set((state) => {
          const newSet = new Set(state.selection.modelIds);
          if (newSet.has(modelId)) {
            newSet.delete(modelId);
          } else {
            newSet.add(modelId);
          }
          return {
            selection: {
              ...state.selection,
              modelIds: newSet,
            },
          };
        });
      }
    },

    deselectModel: (modelId) => {
      set((state) => {
        const newSet = new Set(state.selection.modelIds);
        newSet.delete(modelId);
        return {
          selection: {
            ...state.selection,
            modelIds: newSet,
          },
        };
      });
    },

    clearModelSelection: () => {
      set((state) => ({
        selection: {
          ...state.selection,
          modelIds: new Set(),
        },
      }));
    },

    clearAllSelection: () => {
      set({ selection: {
        conversationIds: new Set(),
        modelIds: new Set(),
      } });
    },

    // ============================================
    // ACTIVE VIEW ACTIONS
    // ============================================

    setChatInputFocused: (focused) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          chat: { ...state.activeView.chat, inputFocused: focused },
        },
      }));
    },

    setChatScrollPosition: (position) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          chat: { ...state.activeView.chat, messagesScrollPosition: position },
        },
      }));
    },

    setChatScrolledToBottom: (isAtBottom) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          chat: { ...state.activeView.chat, isScrolledToBottom: isAtBottom },
        },
      }));
    },

    setModelsFilter: (filter) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          models: { ...state.activeView.models, filter },
        },
      }));
    },

    setModelsSearchQuery: (query) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          models: { ...state.activeView.models, searchQuery: query },
        },
      }));
    },

    setSettingsActiveTab: (tab) => {
      set((state) => ({
        activeView: {
          ...state.activeView,
          settings: { ...state.activeView.settings, activeTab: tab },
        },
      }));
    },

    // ============================================
    // NOTIFICATION ACTIONS
    // ============================================

    addNotification: (notification) => {
      const id = crypto.randomUUID();
      set((state) => ({
        notifications: [
          { id, type: 'info', message: '', ...notification },
          ...state.notifications,
        ],
      }));
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        get().actions.removeNotification(id);
      }, 5000);
      
      return id;
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id),
      }));
    },

    clearNotifications: () => {
      set({ notifications: [] });
    },

    showSuccess: (message) => {
      return get().actions.addNotification({ type: 'success', message });
    },

    showError: (message) => {
      return get().actions.addNotification({ type: 'error', message });
    },

    showWarning: (message) => {
      return get().actions.addNotification({ type: 'warning', message });
    },

    showInfo: (message) => {
      return get().actions.addNotification({ type: 'info', message });
    },

    // ============================================
    // GLOBAL LOADING ACTIONS
    // ============================================

    showGlobalLoading: (message = 'Loading...') => {
      set({ globalLoading: true, globalLoadingMessage: message });
    },

    hideGlobalLoading: () => {
      set({ globalLoading: false, globalLoadingMessage: '' });
    },

    // ============================================
    // KEYBOARD ACTIONS
    // ============================================

    updateKeyboardState: (state) => {
      set((prev) => ({
        keyboard: { ...prev.keyboard, ...state },
      }));
    },

    setCmdPressed: (pressed) => {
      get().actions.updateKeyboardState({ cmdPressed: pressed });
    },

    setCtrlPressed: (pressed) => {
      get().actions.updateKeyboardState({ ctrlPressed: pressed });
    },

    setShiftPressed: (pressed) => {
      get().actions.updateKeyboardState({ shiftPressed: pressed });
    },

    setLastKey: (key) => {
      get().actions.updateKeyboardState({ lastKey: key });
    },

    clearKeyboardState: () => {
      set({ keyboard: {
        cmdPressed: false,
        ctrlPressed: false,
        shiftPressed: false,
        lastKey: null,
      } });
    },

    // ============================================
    // RESET ACTIONS
    // ============================================

    /**
     * Reset all UI state to defaults
     */
    reset: () => {
      set({
        modals: {
          modelEditor: false,
          conversationSettings: false,
          settings: false,
          confirmDelete: false,
          confirmClear: false,
        },
        drawers: {
          conversationList: false,
          modelList: false,
        },
        sidebarCollapsed: false,
        focus: {
          conversationId: null,
          messageId: null,
          modelId: null,
        },
        selection: {
          conversationIds: new Set(),
          modelIds: new Set(),
        },
        activeView: {
          chat: {
            inputFocused: false,
            messagesScrollPosition: 0,
            isScrolledToBottom: true,
          },
          models: {
            filter: 'all',
            searchQuery: '',
          },
          settings: {
            activeTab: 'general',
          },
        },
        notifications: [],
        globalLoading: false,
        globalLoadingMessage: '',
        keyboard: {
          cmdPressed: false,
          ctrlPressed: false,
          shiftPressed: false,
          lastKey: null,
        },
      });
    },
  },
}));

export { uiStore };
export const useUIStore = uiStore;
