import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
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

const DEFAULT_QUICK_ACTIONS = [
  { label: 'Isolate Delayed', prompt: 'Isolate all elements that are delayed behind schedule' },
  { label: 'Show Walls', prompt: 'Filter and show only Walls in the 3D viewer' },
  { label: 'Doors & Windows', prompt: 'Show all doors and windows' },
  { label: 'Schedule Progress', prompt: 'Color code the model by construction schedule progress' },
  { label: 'Show Full Model', prompt: 'Show all model elements and reset isolation' },
  { label: 'Model Summary', prompt: 'Summarize model categories, elements and schedule status' },
];

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
Connected to local **LM Studio** AI. You can ask me to analyze the model, review schedule progress, or filter and isolate elements.

Try clicking a quick prompt below or type:
- *Isolate all walls*
- *Show delayed elements*
- *Reset viewer to show everything*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

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
    (action: ViewerAiAction) => {
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

      if (action.type === 'select' && action.dbIds) {
        if (window.Autodesk?.Viewing && (window as any).apsViewer) {
          try {
            (window as any).apsViewer.select(action.dbIds);
            (window as any).apsViewer.fitToView(action.dbIds);
          } catch (e) {
            console.warn(e);
          }
        }
        return;
      }

      if (action.type === 'isolate') {
        if (action.target === 'category') {
          const catName = String(action.value || '').toLowerCase().trim();
          let matchedDbIds: number[] = [];

          for (const sec of modelSections) {
            const secLower = sec.name.toLowerCase();
            if (secLower === catName || secLower.includes(catName) || catName.includes(secLower)) {
              if (sec.dbIds && sec.dbIds.length > 0) {
                matchedDbIds.push(...sec.dbIds);
              }
            }
          }

          matchedDbIds = Array.from(new Set(matchedDbIds));

          if (matchedDbIds.length > 0) {
            onIsolatePart(undefined, undefined, matchedDbIds);
          } else if (action.dbIds && action.dbIds.length > 0) {
            onIsolatePart(undefined, undefined, action.dbIds);
          }
          return;
        }

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
            if (item.saipemIdent && modelIdentsMap[item.saipemIdent]?.dbIds) {
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
    if (!prompt || isGenerating) return;

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
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: result.action,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (result.action) {
        executeViewerAction(result.action);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Connection Error**: ${err.message || 'Unable to connect to LM Studio.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => scrollToBottom(true), 50);
    }
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

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
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
              {msg.sender === 'assistant' && (
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-200 transition-opacity"
                  onClick={() => handleCopyMessage(msg.id, msg.text)}
                  title="Copy"
                >
                  {copiedMsgId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              )}

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
                      onClick={() => executeViewerAction(msg.action!)}
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

      {/* 4. Quick Action Chips (Uniform monochrome) */}
      <div className="px-2.5 py-1.5 bg-slate-900/50 border-t border-slate-800 shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {DEFAULT_QUICK_ACTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-chip shrink-0"
              onClick={() => handleSendMessage(item.prompt)}
              disabled={isGenerating}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Modern Prettier Input Bar */}
      <div className="chatbot-input-container shrink-0">
        <div className="chat-input-capsule">
          <textarea
            ref={inputRef}
            className="chat-textarea"
            placeholder="Ask AI to filter or control 3D viewer..."
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          <button
            type="button"
            className={`chat-send-btn ${inputPrompt.trim() && !isGenerating ? 'active' : ''}`}
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isGenerating}
            title="Send prompt (Enter)"
          >
            <Send size={13} />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5 font-medium">
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
