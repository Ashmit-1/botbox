import { useState, useRef, useCallback, memo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, RotateCcw, Save, Plus, Zap } from 'lucide-react';
import { useConversationStore, useModelStore, useSettingsStore, useUIStore } from '../store';
import {
  buildChatPayload,
  buildRegeneratePayload,
  createUserMessage,
  isConversationStreaming,
  getContextUsageDisplay,
} from '../lib/chatPayloadBuilder';
import {
  buildEffectiveModelConfig,
  getWelcomeDisplayName,
} from '../lib/runtimeConfig';
import {
  sendChatStream,
  abortCurrentStream,
  isStreaming as isGlobalStreaming,
} from '../services/chatStreamService';

/* ========================================================================
   Helpers
   ======================================================================== */
/*
 * Recursively extract plain text from a React node tree.
 * Used by PreBlock to get the raw code string for the copy button.
 */
function extractText(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props && node.props.children != null) return extractText(node.props.children);
  return '';
}

/* ========================================================================
   Code block with copy — separate component so we can use a ref to the
   rendered DOM for reliable clipboard text (independent of children shape).
   ======================================================================== */
/*
 * Pre override: the only entry point for fenced code blocks after
 * react-markdown v10 removed the `inline` prop for code components.
 * `pre` always wraps block code, so we style the block here and let the
 * inner `code` renderer stay responsible for inline styling only.
 */
function PreBlock({ node, children, ...props }) {
  const [copied, setCopied] = useState(false);

  // Extract the language from the className prop (set by react-markdown / remark-rehype).
  const match = /language-([\w-]+)/.exec(props.className || '');
  const language = match ? match[1] : null;

  // Extract the raw code text from the <code> children.
  const codeText = extractText(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may fail (permissions, insecure context). Ignore silently.
    }
  };

  return (
    <div className="relative my-4">
      <div className="overflow-x-auto border border-gray-700 rounded-lg">
        {language && (
          <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-700 bg-gray-900">
            {language}
          </div>
        )}
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: '#111827',
            borderRadius: '0 0 0.5rem 0.5rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
          }}
          wrapLines
          showLineNumbers={false}
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-white transition-colors flex items-center gap-1"
        title="Copy code"
      >
        <Copy size={14} className="text-white" />
        {copied && <span className="text-white">Copied</span>}
      </button>
    </div>
  );
}

const markdownComponents = {
  pre: PreBlock,
  code({ node, className, children, ...props }) {
    // Inline code only — block code is fully handled by PreBlock + SyntaxHighlighter.
    return (
      <code className="bg-gray-900 px-1.5 py-0.5 rounded-md text-sm font-mono text-gray-300" {...props}>
        {children}
      </code>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="border-collapse border border-gray-700 w-full">{children}</table>
      </div>
    );
  },
  th({ children, ...props }) {
    return <th className="border border-gray-700 px-4 py-2 bg-gray-800 text-left font-medium" {...props}>{children}</th>;
  },
  td({ children, ...props }) {
    return <td className="border border-gray-700 px-4 py-2" {...props}>{children}</td>;
  },
  blockquote({ children }) {
    return <blockquote className="border-l-4 border-gray-600 pl-4 my-4 text-gray-400 italic">{children}</blockquote>;
  },
  h1: ({ children }) => <h1 className="text-3xl md:text-4xl font-bold my-4">{children}</h1>,
  h2: ({ children }) => <h2 className="text-2xl md:text-3xl font-bold my-4">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xl md:text-2xl font-bold my-3">{children}</h3>,
  h4: ({ children }) => <h4 className="text-lg font-bold my-3">{children}</h4>,
  h5: ({ children }) => <h5 className="text-base font-bold my-2">{children}</h5>,
  h6: ({ children }) => <h6 className="text-sm font-bold my-2">{children}</h6>,
  p: ({ children }) => <p className="my-4 text-gray-200 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-4 list-disc list-inside text-gray-200 space-y-2">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 list-decimal list-inside text-gray-200 space-y-2">{children}</ol>,
  li: ({ children }) => <li className="text-gray-200">{children}</li>,
  a: ({ href, children, ...props }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" {...props}>{children}</a>
  ),
};

/* ========================================================================
   Memoized markdown content — only re-renders when the *content* string changes.
   ======================================================================== */
const MarkdownContent = memo(function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

/* ====================================================================
   Thinking section — collapsible reasoning display
   ======================================================================== */
const ThinkingSection = memo(function ThinkingSection({ content, isStreaming }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = isStreaming || expanded;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
      >
        <Zap size={14} />
        <span>Thinking</span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-400 leading-relaxed border-l-2 border-gray-700 pl-3">
          {content}
        </pre>
      )}
    </div>
  );
});

/* ========================================================================
   Memoized message row — prevents full-message-list re-renders.
   ======================================================================== */
const MessageItem = memo(function MessageItem({ message, isLastCompleted, onRegenerate, isBusy, childrenContent }) {
  const getStatusText = (s) => {
    switch (s) {
      case 'streaming': return 'Streaming...';
      case 'stopped': return 'Stopped';
      case 'error': return 'Error';
      default: return '';
    }
  };

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-gray-900 border border-gray-800'
          : 'bg-gray-800/50 border border-gray-700/50'
      } p-4 md:p-6 rounded-2xl max-w-4xl mx-auto group`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="font-bold uppercase text-sm tracking-wider">
          {message.role === 'system' ? 'System' :
           message.role === 'user' ? 'You' :
           message.role === 'assistant' ? 'Assistant' : message.role}
        </span>
        {message.role === 'assistant' && message.status && message.status !== 'completed' && (
          <span className="text-xs text-gray-500">{getStatusText(message.status)}</span>
        )}
      </div>

      <div className="prose prose-invert max-w-none">
        {childrenContent}
      </div>

      {message.role === 'assistant' && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">
          <div className="text-xs text-gray-500 transition-opacity duration-200 opacity-0 group-hover:opacity-100 flex-1 truncate">
            {message.metadata?.inputTokens != null && `${message.metadata.inputTokens} in`}
            {message.metadata?.inputTokens != null && message.metadata?.outputTokens != null && ' | '}
            {message.metadata?.outputTokens != null && `${message.metadata.outputTokens} out`}
          </div>
          {message.status === 'completed' && isLastCompleted && (
            <button
              onClick={() => onRegenerate?.(message.id)}
              disabled={isBusy}
              className="p-1.5 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white transition-colors disabled:opacity-40"
              title="Regenerate"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

/* ========================================================================
   Main Chat Page
   ======================================================================== */
function ChatPage() {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showContextTrimWarning] = useState(false); // derived, not stored
  const [saveSuccess, setSaveSuccess] = useState(false);

  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const saveSuccessTimeoutRef = useRef(null);

  /* ----------------------------------------------------------------------
     Streaming metadata helpers (thinking text + active message id).
     Content streams straight into the store; these refs only track
     assistant "thinking" deltas and the active message id.
     ---------------------------------------------------------------------- */
  const streamMsgIdRef = useRef(null);
  const streamThinkingRef = useRef('');

  /* ------- Store hooks ------- */
  const currentConversation = useConversationStore((state) => state.getCurrentConversation());
  const currentModel = useModelStore((state) => {
    const { models, currentModelId } = state;
    return models.find((m) => m.id === currentModelId) || null;
  });
  const settings = useSettingsStore((state) => state.getSettings());
  const username = useSettingsStore((state) => state.getUsername());

  const addMessage = useConversationStore((state) => state.actions.addMessage);
  const addAssistantMessage = useConversationStore((state) => state.actions.addAssistantMessage);
  const updateLastMessage = useConversationStore((state) => state.actions.updateLastMessage);
  const updateMessage = useConversationStore((state) => state.actions.updateMessage);
  const completeLastMessage = useConversationStore((state) => state.actions.completeLastMessage);
  const stopLastMessage = useConversationStore((state) => state.actions.stopLastMessage);
  const errorLastMessage = useConversationStore((state) => state.actions.errorLastMessage);
  const updateTrimBoundary = useConversationStore((state) => state.actions.updateTrimBoundary);
  const prepareForRegeneration = useConversationStore((state) => state.actions.prepareForRegeneration);
  const saveCurrentConversation = useConversationStore((state) => state.actions.saveCurrentConversation);
  const clearCurrentConversation = useConversationStore((state) => state.actions.clearCurrentConversation);
  const createConversation = useConversationStore((state) => state.actions.createConversation);

  const hasUnsavedChanges = useConversationStore((state) => state.hasUnsavedChanges());
  const openConfirmClear = useUIStore((state) => state.actions.openConfirmClear);

  const messages = currentConversation?.messages || [];
  const hasMessages = messages.length > 0;
  const isStreamActive = isConversationStreaming(currentConversation) || isGlobalStreaming();

  /* ----------------------------------------------------------------------
     Auto-resize textarea
     ---------------------------------------------------------------------- */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const sh = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(sh, 44), 400)}px`;
    }
  }, [inputValue]);

  /* ----------------------------------------------------------------------
     Scroll handling — smooth scroll to bottom when user is already near bottom.
     We track it with a ref so we don't cause re-renders.
     ---------------------------------------------------------------------- */
  const scheduleScroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (!scrollContainerRef.current || !messagesEndRef.current) return;
      const c = scrollContainerRef.current;
      const dist = c.scrollHeight - (c.scrollTop + c.clientHeight);
      if (dist < 300) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    });
  }, []);

  /* ----------------------------------------------------------------------
     Helpers for streaming lifecycle
     ---------------------------------------------------------------------- */
  const resetStreamState = useCallback(() => {
    streamMsgIdRef.current = null;
    streamThinkingRef.current = '';
  }, []);

  /* ----------------------------------------------------------------------
     handleSend
     ---------------------------------------------------------------------- */
  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) { setErrorMessage('Message cannot be empty'); return; }
    if (!currentModel) { setErrorMessage('Select a model before chatting'); return; }
    if (!currentModel.api_key || !currentModel.api_key.trim()) {
      setErrorMessage('Selected model has no API key. Please configure in Model Hub.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    const userContent = inputValue.trim();
    setInputValue('');

    try {
      const effective = buildEffectiveModelConfig(currentModel, settings);
      if (!effective) { setErrorMessage('No model configuration available'); setIsSending(false); return; }

      const payload = buildChatPayload(currentConversation, userContent, settings, currentModel);

      addMessage(createUserMessage({ content: userContent, modelId: currentModel.id, modelName: currentModel.name }));

      // Create assistant placeholder in store
      const assistantMsg = addAssistantMessage('', currentModel.id, currentModel.name);
      resetStreamState();
      streamMsgIdRef.current = assistantMsg?.id || null;

      // Start streaming
      await sendChatStream(payload, {
        onToken: (tokenData) => {
          if (tokenData.content) {
            if (typeof tokenData.content === 'string') {
              // Write each delta straight into the store so the memoized
              // markdown re-renders in real time (live streaming).
              updateLastMessage(tokenData.content);
            } else if (Array.isArray(tokenData.content)) {
              for (const item of tokenData.content) {
                if (item.type === 'thinking' && item.thinking) {
                  streamThinkingRef.current += item.thinking;
                }
              }
            }
            scheduleScroll();
          }
        },
        onMetadata: (metadata) => {
          const finalMeta = {
            inputTokens: metadata.input_tokens,
            outputTokens: metadata.output_tokens,
            totalTokens: metadata.total_tokens,
            trimBoundary: metadata.trim_boundary,
            messagesInContext: metadata.messages_in_context,
          };
          updateLastMessage('', finalMeta);
          if (metadata.trim_boundary) updateTrimBoundary(metadata.trim_boundary);
        },
        onError: (errorData) => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          setErrorMessage(errorData.message || 'An error occurred');
          errorLastMessage(errorData.message || 'An error occurred');
        },
        onCancelled: () => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          stopLastMessage();
        },
        onDone: () => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          completeLastMessage();
          resetStreamState();
        },
      });
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send message');
      errorLastMessage(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [inputValue, currentModel, currentConversation, settings, addMessage, addAssistantMessage, updateLastMessage, updateMessage, completeLastMessage, stopLastMessage, errorLastMessage, updateTrimBoundary, resetStreamState, scheduleScroll]);

  /* ----------------------------------------------------------------------
     handleStop
     ---------------------------------------------------------------------- */
  const handleStop = useCallback(() => {
    abortCurrentStream();
    setIsSending(false);
  }, []);

  /* ----------------------------------------------------------------------
     handleRegenerate
     ---------------------------------------------------------------------- */
  const handleRegenerate = useCallback(async (messageId) => {
    if (!currentModel) return;
    if (!currentModel.api_key || !currentModel.api_key.trim()) {
      setErrorMessage('Selected model has no API key. Please configure in Model Hub.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const effective = buildEffectiveModelConfig(currentModel, settings);
      if (!effective) { setErrorMessage('No model configuration available'); setIsSending(false); return; }

      // Build payload using current conversation (includes last assistant, which buildRegeneratePayload will filter out)
      const payload = buildRegeneratePayload(currentConversation, settings, currentModel);

      // Remove the last assistant from store before creating a new one
      const removed = prepareForRegeneration();
      if (!removed) {
        setIsSending(false);
        return;
      }

      // Create new assistant streaming placeholder
      resetStreamState();
      const assistantMsg = addAssistantMessage('', currentModel.id, currentModel.name);
      streamMsgIdRef.current = assistantMsg?.id || null;

      // Start streaming
      await sendChatStream(payload, {
        onToken: (tokenData) => {
          if (tokenData.content) {
            if (typeof tokenData.content === 'string') {
              updateLastMessage(tokenData.content);
            } else if (Array.isArray(tokenData.content)) {
              for (const item of tokenData.content) {
                if (item.type === 'thinking' && item.thinking) {
                  streamThinkingRef.current += item.thinking;
                }
              }
            }
            scheduleScroll();
          }
        },
        onMetadata: (metadata) => {
          const finalMeta = {
            inputTokens: metadata.input_tokens,
            outputTokens: metadata.output_tokens,
            totalTokens: metadata.total_tokens,
            trimBoundary: metadata.trim_boundary,
            messagesInContext: metadata.messages_in_context,
          };
          updateLastMessage('', finalMeta);
          if (metadata.trim_boundary) updateTrimBoundary(metadata.trim_boundary);
        },
        onError: (errorData) => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          setErrorMessage(errorData.message || 'An error occurred');
          errorLastMessage(errorData.message || 'An error occurred');
        },
        onCancelled: () => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          stopLastMessage();
        },
        onDone: () => {
          if (streamMsgIdRef.current && streamThinkingRef.current) {
            updateMessage(streamMsgIdRef.current, { thinking: streamThinkingRef.current });
          }
          completeLastMessage();
          resetStreamState();
        },
      });
    } catch (error) {
      setErrorMessage(error.message || 'Failed to regenerate');
      errorLastMessage(error.message || 'Failed to regenerate');
    } finally {
      setIsSending(false);
    }
  }, [currentModel, currentConversation, settings, prepareForRegeneration, addAssistantMessage, updateLastMessage, updateMessage, completeLastMessage, stopLastMessage, errorLastMessage, updateTrimBoundary, resetStreamState, scheduleScroll]);

  /* ----------------------------------------------------------------------
     Input handlers
     ---------------------------------------------------------------------- */
  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isSending && !isStreamActive) { handleSend(); }
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInputSubmit(e); }
  };
  const handleInputChange = (e) => { setInputValue(e.target.value); };

  /* Reset local scratch state when store creates a brand-new empty conversation */
  const currentConvId = currentConversation?.id;
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length === 0) {
      setInputValue('');
      setErrorMessage(null);
    }
  }, [currentConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doNewChat = () => { clearCurrentConversation(); createConversation(); setInputValue(''); setErrorMessage(null); };

  const handleNewChat = () => {
    if (hasUnsavedChanges) {
      openConfirmClear();
    } else {
      doNewChat();
    }
  };

  const handleSave = async () => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    try {
      await saveCurrentConversation();
      setSaveSuccess(true);
      if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current);
      saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setErrorMessage('Failed to save conversation');
    }
  };

  /* ----------------------------------------------------------------------
     Derived helpers
     ---------------------------------------------------------------------- */
  const isLastCompletedAssistant = (message) => {
    if (message.role !== 'assistant' || message.status !== 'completed') return false;
    const completed = messages.filter((m) => m.role === 'assistant' && m.status === 'completed');
    return completed.length > 0 && completed[completed.length - 1].id === message.id;
  };

  const contextUsage = getContextUsageDisplay(currentConversation, settings);

  /* ----------------------------------------------------------------------
     Render helpers for each message
     ---------------------------------------------------------------------- */
  const renderMessageContent = (message) => {
    const hasThinking = message.thinking && message.thinking.trim();

    // Empty assistant placeholder at the very start of streaming.
    if (message.role === 'assistant' && message.status === 'streaming' && !message.content && !hasThinking) {
      return (
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Generating..</span>
        </div>
      );
    }

    // Store holds the latest content (updated per token), so ReactMarkdown
    // re-renders live for both streaming and completed messages.
    return (
      <>
        {hasThinking && <ThinkingSection content={message.thinking} isStreaming={message.status === 'streaming'} />}
        <MarkdownContent key={message.id} content={message.content} />
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat messages area */}
      {hasMessages && (
        <div className="shrink-0 px-4 md:px-8 lg:px-16 pt-4 pb-1 flex justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isStreamActive || (!currentConversation?.messages?.length)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-white transition-colors ${
                saveSuccess
                  ? 'bg-green-900 border-green-700 text-green-300'
                  : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Save conversation"
            >
              <Save size={14} />
              <span className="hidden md:inline uppercase tracking-wider">{saveSuccess ? 'Saved' : 'Save'}</span>
            </button>
            <button
              onClick={handleNewChat}
              disabled={isStreamActive}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="New chat"
            >
              <Plus size={14} />
              <span className="hidden md:inline uppercase tracking-wider">New Chat</span>
            </button>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 px-4 md:px-8 lg:px-16 pt-2 pb-4 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center flex-1 min-h-full">
            <div className="text-center max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Welcome{username && username.trim() ? `, ${username}` : ''}
              </h1>
              <p className="text-gray-400 text-xl md:text-2xl">What can I help with today?</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {showContextTrimWarning && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-400/80 text-center">
                Context Trimmed. Older messages are no longer included in model context.
              </div>
            )}

            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isLastCompleted={isLastCompletedAssistant(message)}
                onRegenerate={handleRegenerate}
                isBusy={isSending || isStreamActive}
                childrenContent={renderMessageContent(message)}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {errorMessage && (
        <div className="px-4 md:px-8 lg:px-16 pb-4">
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-400">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="px-4 md:px-8 lg:px-16 py-4 bg-black/50 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 focus-within:ring-1 focus-within:ring-white transition-all">
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                disabled={isSending || isStreamActive}
                className="w-full bg-transparent text-white placeholder-gray-500 resize-none overflow-y-auto outline-none min-h-[44px] max-h-[400px] disabled:opacity-60 text-base"
                style={{ lineHeight: '1.6' }}
              />
            </div>
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentModel && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="font-medium">{currentModel.name}</span>
                    <span className="hidden md:inline text-gray-600">|</span>
                    <span className="hidden md:inline">{contextUsage}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasMessages && (
                  <button
                    onClick={handleNewChat}
                    disabled={isSending || isStreamActive}
                    className="hidden md:inline-block px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    New Chat
                  </button>
                )}
                {isSending || isStreamActive ? (
                  <button
                    onClick={handleStop}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-40 font-medium transition-colors"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    onClick={handleInputSubmit}
                    disabled={!inputValue.trim() || isSending || isStreamActive}
                    className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-40 font-medium transition-colors"
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center md:text-right">Shift + Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
