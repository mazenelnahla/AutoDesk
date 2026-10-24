import { matchesModelCategory } from '../utils/modelCategory';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  Square,
  RefreshCw,
  Settings,
  Trash2,
  Sparkles,
  Eye,
  EyeOff,
  Maximize2,
  Layers,
  ExternalLink,
  ArrowDown,
  Copy,
  Check,
  User,
  ChevronLeft
} from 'lucide-react';
import type {
  APSItem,
  APSProject,
  ElementScheduleData,
  ProjectSection,
  ScannedModelIdentMap,
  ViewerSelectedObject
} from '../types/aps';
import {
  checkLMStudioHealth,
  sendChatMessageToLMStudio,
  getSavedLMStudioUrl,
  saveLMStudioUrl,
  getSavedLMStudioModel,
  saveLMStudioModel,
  type ChatMessage,
  type LMStudioStatus,
  type ViewerAiAction,
  type ModelBimContext
} from '../services/llmStudio';

interface ChatbotSectionProps {
  selectedItem: APSItem | null;
  selectedProject: APSProject | null;
  selectedObject: ViewerSelectedObject | null;
  scheduleDataMap: Record<string, ElementScheduleData>;
  modelIdentsMap: ScannedModelIdentMap;
  modelSections: ProjectSection[];
  isIsolated: boolean;
  isolatedDbIds: number[] | null;
  onIsolatePart: (dbId?: number, ident?: string, dbIds?: number[]) => void;
  onClearIsolation: () => void;
  onToggleCollapse?: () => void;
}

/**
 * Clean & Compact Markdown Renderer.
 * Preserves clean readability without scattered buttons inside text.
 */
const CleanMarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const renderInline = (text: string): React.ReactNode[] => {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={i} className="chat-inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }

      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="text-slate-100 font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={i} className="text-slate-300 italic">
            {part.slice(1, -1)}
          </em>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let codeCounter = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    if (line.trim().startsWith('```')) {
      if (inCode) {
        const blockCode = codeBuffer.join('\n');
        const cIdx = codeCounter++;
        elements.push(
          <div key={`cb-${idx}`} className="chat-code-block my-1.5">
            <div className="chat-code-header">
              <span className="uppercase text-[9px] font-mono text-slate-400">{codeLang || 'code'}</span>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition-colors"
                onClick={() => handleCopyCode(blockCode, cIdx)}
              >
                {copiedCodeIdx === cIdx ? (
                  <span className="text-emerald-400">Copied</span>
                ) : (
                  <>
                    <Copy size={10} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="chat-code-pre">
              <code>{blockCode}</code>
            </pre>
          </div>
        );
        inCode = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-1" />);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${idx}`} className="chat-md-h3">
          {renderInline(line.slice(4))}
        </div>
      );
      continue;
    }

    if (line.startsWith('## ') || line.startsWith('# ')) {
      const text = line.startsWith('## ') ? line.slice(3) : line.slice(2);
      elements.push(
        <div key={`h2-${idx}`} className="chat-md-h2">
          {renderInline(text)}
        </div>
      );
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      elements.push(
        <div key={`li-${idx}`} className="chat-md-list-item">
          <span className="chat-md-bullet" />
          <div className="flex-1 min-w-0">{renderInline(unorderedMatch[1])}</div>
        </div>
      );
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      elements.push(
        <div key={`oli-${idx}`} className="chat-md-list-item">
          <span className="chat-md-number">{orderedMatch[1]}.</span>
          <div className="flex-1 min-w-0">{renderInline(orderedMatch[2])}</div>
        </div>
      );
      continue;
    }

    elements.push(
      <div key={`p-${idx}`} className="leading-relaxed">
        {renderInline(line)}
      </div>
    );
  }

  return <div className="chat-markdown-body space-y-0.5">{elements}</div>;
};

export const ChatbotSection: React.FC<ChatbotSectionProps> = ({
  selectedItem,
  selectedProject,
  selectedObject,
  scheduleDataMap,
  modelIdentsMap,
  modelSections,
  isIsolated,
  isolatedDbIds,
  onIsolatePart,
  onClearIsolation,
  onToggleCollapse,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `### Autodesk BIM Bot
Connected to local **LM Studio** AI. You can ask me to analyze the model, review schedule progress, or filter and isolate elements.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);

  // LM Studio Connection States
  const [serverUrl, setServerUrl] = useState<string>(getSavedLMStudioUrl());
  const [selectedModel, setSelectedModel] = useState<string>(getSavedLMStudioModel());
  const [connectionStatus, setConnectionStatus] = useState<LMStudioStatus>({
    online: false,
    url: getSavedLMStudioUrl(),
    modelCount: 0,
    models: [],
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Scroll State
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    setIsAtBottom(true);
  }, []);

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceToBottom < 60);
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom(true);
    }
  }, [messages.length, isGenerating]);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Auto-resize input textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const sh = inputRef.current.scrollHeight;
      inputRef.current.style.height = `${Math.min(Math.max(sh, 24), 90)}px`;
    }
  }, [inputPrompt]);

  const refreshHealth = useCallback(
    async (targetUrl?: string) => {
      setIsCheckingHealth(true);
      try {
        const urlToTest = targetUrl || serverUrl;
        const status = await checkLMStudioHealth(urlToTest);
        setConnectionStatus(status);
        if (status.online && status.models.length > 0 && !selectedModel) {
          setSelectedModel(status.models[0].id);
          saveLMStudioModel(status.models[0].id);
        }
      } catch {
        setConnectionStatus({
          online: false,
          url: targetUrl || serverUrl,
          modelCount: 0,
          models: [],
        });
      } finally {
        setIsCheckingHealth(false);
      }
    },
    [serverUrl, selectedModel]
  );

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const executeViewerAction = useCallback(
    async (action: ViewerAiAction, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      if (!action) return;

      if (action.type === 'clear_isolation') {
        onClearIsolation();
        if (window.Autodesk?.Viewing && (window as any).apsViewer) {
          try {
            (window as any).apsViewer.fitToView();
          } catch (e) {
            console.warn(e);
          }
        }
        return;
      }

      if (action.type === 'fit_view') {
        if (window.Autodesk?.Viewing && (window as any).apsViewer) {
          try {
            if (action.dbIds && action.dbIds.length > 0) {
              (window as any).apsViewer.fitToView(action.dbIds);
            } else {
              (window as any).apsViewer.fitToView();
            }
          } catch (e) {
            console.warn(e);
          }
        }
        return;
      }

      if (action.type === 'select' || (action.type === 'isolate' && (action.target === 'category' || action.target === 'element'))) {
        const viewer = (window as any).apsViewer;
        if (!viewer?.model) throw new Error('Load a 3D model before selecting elements.');
        let ids = action.dbIds || [];
        if (action.target === 'category' || action.target === 'element') {
          const category = String(action.value || '').trim();
          if (!category) throw new Error('Specify a category to select.');
          // Validate each element: a section named IfcBeam can contain HANDRAIL elements.
          ids = [];
          if (!ids.length) {
            // Search only element identity fields. An unrestricted viewer search also
            // matches materials and unrelated properties (e.g. pipe handrails).
            ids = await new Promise<number[]>((resolve, reject) => {
              viewer.model.getBulkProperties([], {}, (elements: Array<{ dbId: number; name?: string; properties?: any[] }>) => {
                const tree = viewer.model.getInstanceTree();
                const matchesIntent = (element: typeof elements[number], complete = false) => {
                  // Isolating a container reveals all descendants, including other
                  // element kinds. Match individual components instead.
                  if (tree && tree.getChildCount(element.dbId) > 0) return false;
                  if (action.target !== 'element') return matchesModelCategory(element, category, complete);
                  return (element.properties || []).some((property) =>
                    /^element\s*:?$/i.test(String(property.displayName || property.attributeName || '').trim()) &&
                    matchesModelCategory({ name: String(property.displayValue || '') }, category, complete)
                  );
                };
                const exact = elements.filter((element) => matchesIntent(element));
                const matches = exact.length ? exact : elements.filter((element) => matchesIntent(element, true));
                resolve(matches.map((element) => element.dbId));
              }, () => reject(new Error('Could not read model categories. Please wait for the model to finish loading.')));
            });
          }
        }
        signal?.throwIfAborted();
        ids = [...new Set(ids)];
        if (!ids.length) throw new Error(`No elements matched "${action.value || action.label}" in the loaded model.`);
        if (action.type === 'select') viewer.select(ids);
        else onIsolatePart(undefined, undefined, ids);
        viewer.fitToView(ids);
        return ids.length;
      }

      if (action.type === 'isolate') {
        if (action.target === 'status') {
          const targetStatus = String(action.value || 'delayed').toLowerCase().trim();
          const matchedItems = Object.values(scheduleDataMap).filter(
            (s) =>
              s.status.toLowerCase() === targetStatus ||
              (targetStatus === 'completed' && s.completionPercentage >= 100)
          );

          let targetDbIds: number[] = [];
          matchedItems.forEach((item) => {
            if (item.dbId) targetDbIds.push(item.dbId);
            if (item.dbId == null && item.saipemIdent && modelIdentsMap[item.saipemIdent]?.dbIds) {
              targetDbIds.push(...modelIdentsMap[item.saipemIdent].dbIds);
            }
          });

          targetDbIds = Array.from(new Set(targetDbIds));
          if (targetDbIds.length > 0) {
            onIsolatePart(undefined, undefined, targetDbIds);
          }
          return;
        }

        if (action.target === 'ident') {
          const identCode = String(action.value || '').trim();
          onIsolatePart(undefined, identCode);
          return;
        }

        if (action.dbIds && action.dbIds.length > 0) {
          onIsolatePart(undefined, undefined, action.dbIds);
          return;
        }
      }
    },
    [modelSections, scheduleDataMap, modelIdentsMap, onIsolatePart, onClearIsolation]
  );

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;

    setInputPrompt('');
    if (inputRef.current) {
      inputRef.current.style.height = '24px';
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);
    setTimeout(() => scrollToBottom(true), 30);

    const bimContext: ModelBimContext = {
      projectName: selectedProject?.name,
      modelName: selectedItem?.displayName,
      selectedObject,
      sections: modelSections,
      scheduleDataMap,
      modelIdentsMap,
      isIsolated,
      isolatedCount: isolatedDbIds ? isolatedDbIds.length : 0,
    };

    const historyPayload = messages
      .filter((m) => m.sender !== 'system')
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    historyPayload.push({
      role: 'user',
      content: prompt,
    });

    try {
      const result = await sendChatMessageToLMStudio({
        messages: historyPayload,
        context: bimContext,
        url: serverUrl,
        model: selectedModel,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();

      const appliedCount = result.action ? await executeViewerAction(result.action, controller.signal) : undefined;
      controller.signal.throwIfAborted();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: typeof appliedCount === 'number'
          ? `${result.action?.type === 'select' ? 'Selected' : 'Isolated'} **${appliedCount} elements** matching **${result.action?.value || result.action?.label}**.`
          : result.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: result.action,
      };

      setMessages((prev) => [...prev, assistantMessage]);


    } catch (err: any) {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Unable to complete request**: ${err.message || 'Unable to connect to LM Studio.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
      setTimeout(() => scrollToBottom(true), 50);
    }
  };

  const handleStop = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setIsGenerating(false);
    setMessages((previous) => [...previous, {
      id: `stopped-${Date.now()}`, sender: 'assistant', text: 'Response stopped.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveSettings = () => {
    saveLMStudioUrl(serverUrl);
    saveLMStudioModel(selectedModel);
    setShowSettingsDrawer(false);
    refreshHealth(serverUrl);
  };

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyErrorId(null);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((current) => current === msgId ? null : current), 2000);
    } catch {
      setCopyErrorId(msgId);
    }
  };

  return (
    <div className="chatbot-panel-wrapper flex flex-col h-full relative select-text">
      {/* 1. Header: Compact Status & Controls */}
      <div className="chatbot-header px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
            <Bot size={12} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-slate-200">BIM AI</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus.online ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
              title={connectionStatus.online ? 'LM Studio Online' : 'LM Studio Offline'}
            />
            <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
              {selectedModel ? selectedModel : serverUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-cyan-400 rounded transition-colors"
            onClick={() => refreshHealth()}
            title="Refresh Connection"
            disabled={isCheckingHealth}
          >
            <RefreshCw size={12} className={isCheckingHealth ? 'animate-spin text-cyan-400' : ''} />
          </button>
          <button
            type="button"
            className={`p-1 rounded transition-colors ${
              showSettingsDrawer ? 'text-cyan-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            title="Settings"
          >
            <Settings size={12} />
          </button>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
            onClick={() => {
              if (confirm('Clear chat history?')) {
                setMessages([
                  {
                    id: 'welcome-reset',
                    sender: 'assistant',
                    text: 'Chat cleared. How can I help with the 3D model?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }
            }}
            title="Clear Chat"
          >
            <Trash2 size={12} />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              onClick={onToggleCollapse}
              title="Collapse Left Sidebar"
            >
              <ChevronLeft size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Settings Drawer */}
      {showSettingsDrawer && (
        <div className="p-2.5 bg-slate-950 border-b border-slate-800 text-xs space-y-2 shrink-0">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Server URL</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Model ID</label>
            {connectionStatus.models.length > 0 ? (
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="">Default (First loaded)</option>
                {connectionStatus.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://lmstudio.ai"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>LM Studio</span>
              <ExternalLink size={9} />
            </a>
            <button
              type="button"
              className="px-2.5 py-1 text-[11px] font-medium rounded bg-cyan-600 hover:bg-cyan-500 text-white"
              onClick={handleSaveSettings}
            >
              Save & Connect
            </button>
          </div>
        </div>
      )}

      {/* 2. Active Model Context Strip */}
      <div className="viewer-context-strip px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers size={11} className="text-cyan-400 shrink-0" />
          <span className="truncate text-slate-300" title={selectedItem?.displayName || 'No Model Loaded'}>
            {selectedItem?.displayName || 'No Model Loaded'}
          </span>
        </div>

        {isIsolated ? (
          <button
            type="button"
            onClick={onClearIsolation}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-medium border border-amber-500/30 shrink-0 cursor-pointer"
            title="Reset isolation"
          >
            <EyeOff size={10} />
            <span>Reset View</span>
          </button>
        ) : (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 shrink-0">
            <Eye size={10} />
            <span>Full View</span>
          </span>
        )}
      </div>

      {/* 3. Messages Stream */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container flex-1 overflow-y-auto p-2.5 space-y-2.5"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble-row flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Clear Sender & Receiver Header */}
            {msg.sender === 'assistant' ? (
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/35 shrink-0">
                  <Bot size={10} />
                </div>
                <span className="font-semibold text-cyan-300">Autodesk BIM Bot</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-mono">
                  AI
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-[9.5px] text-slate-500">{msg.timestamp}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] flex-row-reverse">
                <div className="w-4 h-4 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center border border-slate-600 shrink-0">
                  <User size={10} />
                </div>
                <span className="font-semibold text-slate-200">You</span>
                <span className="text-slate-600">·</span>
                <span className="text-[9.5px] text-slate-500">{msg.timestamp}</span>
              </div>
            )}

            <div
              className={`chat-bubble group relative text-[11px] leading-relaxed max-w-[90%] px-3.5 py-2.5 ${
                msg.sender === 'user'
                  ? 'chat-bubble-user'
                  : msg.isError
                  ? 'chat-bubble-error'
                  : 'chat-bubble-assistant'
              }`}
            >
              {msg.sender === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              ) : (
                <CleanMarkdownContent content={msg.text} />
              )}

              {/* Action Card */}
              {msg.action && (
                <div className="viewer-action-card flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-medium text-[11px]">
                    <Sparkles size={11} className="text-cyan-400 shrink-0" />
                    <span>Action: {msg.action.label}</span>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-[10px] font-medium border border-cyan-500/30 transition-colors flex items-center gap-1"
                      onClick={() => { void executeViewerAction(msg.action!).catch((error: Error) => {
                        setMessages((previous) => [...previous, { id: `action-error-${Date.now()}`, sender: 'assistant', text: error.message, timestamp: new Date().toLocaleTimeString(), isError: true }]);
                      }); }}
                    >
                      <Layers size={10} />
                      <span>Apply</span>
                    </button>

                    {isIsolated && (
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors flex items-center gap-1"
                        onClick={onClearIsolation}
                      >
                        <EyeOff size={10} />
                        <span>Show All</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors flex items-center gap-1"
                      onClick={() => {
                        if ((window as any).apsViewer) {
                          try {
                            (window as any).apsViewer.fitToView();
                          } catch (e) {
                            console.warn(e);
                          }
                        }
                      }}
                    >
                      <Maximize2 size={10} />
                      <span>Fit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="chat-message-toolbar">
              <button
                type="button"
                className={`chat-message-copy${copiedMsgId === msg.id ? ' is-copied' : ''}`}
                onClick={() => { void handleCopyMessage(msg.id, msg.text); }}
                title={copyErrorId === msg.id ? 'Copy failed. Try again.' : copiedMsgId === msg.id ? 'Copied to clipboard' : 'Copy message'}
                aria-label={copiedMsgId === msg.id ? 'Message copied' : 'Copy message'}
              >
                {copiedMsgId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                <span aria-live="polite">{copyErrorId === msg.id ? 'Retry copy' : copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="chat-bubble-row flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
              <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/35 shrink-0">
                <Bot size={10} />
              </div>
              <span className="font-semibold text-cyan-300">Autodesk BIM Bot</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-mono">
                AI
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-[9.5px] text-cyan-400 animate-pulse">Thinking...</span>
            </div>
            <div className="chat-bubble chat-bubble-assistant flex items-center gap-2 text-[11px] text-slate-300">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[10.5px] text-slate-400">Processing query...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-bottom indicator (Compact) */}
      {!isAtBottom && (
        <button
          type="button"
          className="floating-scroll-bottom-btn"
          onClick={() => scrollToBottom(true)}
          title="Scroll to latest"
        >
          <ArrowDown size={11} />
          <span>Latest</span>
        </button>
      )}

      {/* Prompt composer */}
      <div className="chatbot-input-container shrink-0">
        <div className={`chat-input-capsule${isGenerating ? ' is-generating' : ''}`}>
          <textarea
            ref={inputRef}
            className="chat-textarea"
            aria-label="Message BIM AI"
            placeholder="Ask about your model…"
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          <button
            type="button"
            className={`chat-send-btn ${isGenerating ? 'chat-stop-btn' : inputPrompt.trim() ? 'active' : ''}`}
            onClick={() => isGenerating ? handleStop() : handleSendMessage()}
            disabled={!isGenerating && !inputPrompt.trim()}
            title={isGenerating ? 'Stop response' : 'Send prompt (Enter)'}
            aria-label={isGenerating ? 'Stop response' : 'Send message'}
          >
            {isGenerating ? <Square size={12} fill="currentColor" /> : <Send size={13} />}
          </button>
        </div>
        <div className="chat-composer-footer flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5 font-medium">
          <div className="flex items-center gap-1 text-slate-500">
            <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700/80 text-[9px] font-mono text-slate-400">↵</kbd>
            <span>send</span>
            <span className="text-slate-600">·</span>
            <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700/80 text-[9px] font-mono text-slate-400">Shift+↵</kbd>
            <span>newline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus.online ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            <span className="text-slate-500 text-[9.5px]">
              {connectionStatus.online ? 'LM Studio' : 'Local AI'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
