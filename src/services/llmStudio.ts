import axios from 'axios';
import type { ElementScheduleData, ProjectSection, ScannedModelIdentMap, ViewerSelectedObject } from '../types/aps';

export interface LMStudioModel {
  id: string;
  name: string;
  owned_by?: string;
}

export interface LMStudioStatus {
  online: boolean;
  url: string;
  modelCount: number;
  models: LMStudioModel[];
  error?: string;
}

export interface ViewerAiAction {
  type: 'isolate' | 'clear_isolation' | 'select' | 'fit_view' | 'theme_status';
  target: 'category' | 'ident' | 'status' | 'dbIds' | 'all';
  value?: any; // e.g. category name, ident code, status string, array of dbIds
  label: string;
  elementCount?: number;
  dbIds?: number[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  action?: ViewerAiAction;
  isError?: boolean;
}

const STORAGE_KEY_URL = 'aps_lmstudio_url';
const STORAGE_KEY_MODEL = 'aps_lmstudio_model';
const DEFAULT_URL = 'http://127.0.0.1:1234';

export function getSavedLMStudioUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function saveLMStudioUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_URL, url);
  } catch (e) {
    console.error('Failed to save LM Studio URL:', e);
  }
}

export function getSavedLMStudioModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_MODEL) || '';
  } catch {
    return '';
  }
}

export function saveLMStudioModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  } catch (e) {
    console.error('Failed to save LM Studio Model:', e);
  }
}

/**
 * Check connectivity to LM Studio via backend proxy or direct fetch
 */
export async function checkLMStudioHealth(targetUrl?: string): Promise<LMStudioStatus> {
  const url = (targetUrl || getSavedLMStudioUrl()).trim();

  // 1. Try via backend Express proxy first
  try {
    const res = await axios.get('/api/llm/health', {
      params: { url },
      timeout: 4000,
    });
    if (res.data) {
      return res.data;
    }
  } catch {
    // If backend proxy route failed, try direct fetch
  }

  // 2. Direct browser fetch to LM Studio endpoint
  try {
    const directUrl = url.replace(/\/+$/, '');
    const res = await axios.get(`${directUrl}/v1/models`, {
      timeout: 3000,
    });
    const models = (res.data?.data || []).map((m: any) => ({
      id: m.id || m.name,
      name: m.id || m.name,
      owned_by: m.owned_by || 'lmstudio',
    }));
    return {
      online: true,
      url,
      modelCount: models.length,
      models,
    };
  } catch (directErr: any) {
    return {
      online: false,
      url,
      modelCount: 0,
      models: [],
      error: directErr.message || 'Cannot reach LM Studio. Make sure local server is running.',
    };
  }
}

export interface ModelBimContext {
  projectName?: string;
  modelName?: string;
  selectedObject?: ViewerSelectedObject | null;
  sections?: ProjectSection[];
  scheduleDataMap?: Record<string, ElementScheduleData>;
  modelIdentsMap?: ScannedModelIdentMap;
  isIsolated?: boolean;
  isolatedCount?: number;
}

/**
 * Compile system instructions with dynamic BIM model metadata
 */
export function buildBimSystemPrompt(context: ModelBimContext): string {
  const {
    projectName,
    modelName,
    selectedObject,
    sections = [],
    scheduleDataMap = {},
    modelIdentsMap = {},
    isIsolated,
    isolatedCount = 0,
  } = context;

  const categoriesSummary = sections
    .slice(0, 30)
    .map((s) => `- ${s.name} (${s.elementCount} elements)`)
    .join('\n');

  const scheduleList = Object.values(scheduleDataMap);
  const delayedItems = scheduleList.filter((s) => s.status === 'delayed');
  const completedItems = scheduleList.filter((s) => s.status === 'completed');
  const inProgressItems = scheduleList.filter((s) => s.status === 'in_progress');
  const notStartedItems = scheduleList.filter((s) => s.status === 'not_started');

  const sampleIdents = Object.keys(modelIdentsMap).slice(0, 15).join(', ');

  let selectedObjText = 'None';
  if (selectedObject) {
    const identProp = selectedObject.properties?.find((p) =>
      p.displayName?.toLowerCase().includes('ident') || p.displayName?.toLowerCase().includes('mark')
    );
    const catProp = selectedObject.properties?.find((p) =>
      p.displayName?.toLowerCase() === 'category'
    );
    selectedObjText = `dbId #${selectedObject.dbId}, Name: "${selectedObject.name}"${
      catProp ? `, Category: "${catProp.displayValue}"` : ''
    }${identProp ? `, Saipem_IDENT: "${identProp.displayValue}"` : ''}`;
  }

  return `You are an AI BIM & Construction Copilot connected to the Autodesk 3D Viewer.
Your mission is to help engineers, project managers, and BIM coordinators inspect models, analyze construction progress, and directly control and filter the 3D viewer.

=== CURRENT 3D MODEL CONTEXT ===
- Project: ${projectName || 'Active BIM Project'}
- Active Model: ${modelName || 'No model loaded'}
- View State: ${isIsolated ? `Isolated (${isolatedCount} elements visible)` : 'Full Model (All elements visible)'}
- Currently Selected 3D Object: ${selectedObjText}

=== MODEL CATEGORIES & SECTIONS (${sections.length} total) ===
${categoriesSummary || '- Categories scanning or not yet available'}

=== CONSTRUCTION SCHEDULE & SAIPEM_IDENT ===
- Total Scheduled Items: ${scheduleList.length}
- Delayed Items: ${delayedItems.length}
- In Progress: ${inProgressItems.length}
- Completed: ${completedItems.length}
- Not Started: ${notStartedItems.length}
- Scanned Saipem_IDENTs in 3D: ${Object.keys(modelIdentsMap).length} (Samples: ${sampleIdents || 'none'})

=== 3D VIEWER ACTIONS ===
Whenever the user asks you to filter, isolate, color, zoom, or reset the 3D viewer, you MUST append an action block at the END of your response in this exact format:

:::action
{
  "type": "isolate" | "clear_isolation" | "select" | "fit_view" | "theme_status",
  "target": "category" | "ident" | "status" | "dbIds" | "all",
  "value": "<category_name_or_ident_or_status>",
  "label": "<short descriptive label>"
}
:::

Supported Actions:
1. Isolate by Category:
   :::action
   {"type": "isolate", "target": "category", "value": "Walls", "label": "Isolate Walls"}
   :::
2. Isolate by Schedule Status (delayed, completed, in_progress, not_started):
   :::action
   {"type": "isolate", "target": "status", "value": "delayed", "label": "Isolate Delayed Elements"}
   :::
3. Isolate by Saipem_IDENT:
   :::action
   {"type": "isolate", "target": "ident", "value": "SP-10492", "label": "Isolate Saipem_IDENT SP-10492"}
   :::
4. Show All / Clear Filter:
   :::action
   {"type": "clear_isolation", "target": "all", "label": "Show Full 3D Model"}
   :::
5. Color-code by Construction Progress:
   :::action
   {"type": "theme_status", "target": "all", "label": "Apply Progress Color Theming"}
   :::
6. Focus / Fit to View:
   :::action
   {"type": "fit_view", "target": "all", "label": "Fit Model to View"}
   :::

Always explain what you are doing in concise, professional markdown, and provide helpful insights about the BIM elements.`;
}

/**
 * Parses any :::action ... ::: block from an LLM response text
 */
export function extractViewerAction(responseText: string): { cleanText: string; action?: ViewerAiAction } {
  const actionRegex = /:::action\s*([\s\S]*?)\s*:::/i;
  const match = responseText.match(actionRegex);

  if (!match) {
    // Also check for ```json { "type": "isolate" ... } ```
    const jsonCodeRegex = /```(?:json)?\s*(\{\s*"type"\s*:\s*"(?:isolate|clear_isolation|select|fit_view|theme_status)"[\s\S]*?\})\s*```/i;
    const jsonMatch = responseText.match(jsonCodeRegex);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const cleanText = responseText.replace(jsonMatch[0], '').trim();
        return { cleanText, action: parsed };
      } catch {
        // Continue
      }
    }
    return { cleanText: responseText };
  }

  try {
    const rawJson = match[1].trim();
    const action = JSON.parse(rawJson) as ViewerAiAction;
    const cleanText = responseText.replace(match[0], '').trim();
    return { cleanText, action };
  } catch (err) {
    console.warn('Failed to parse :::action block:', err);
    return { cleanText: responseText };
  }
}

/**
 * Intelligent local heuristic processor for when LM Studio is offline or for instant quick actions
 */
export function processLocalHeuristicCommand(
  prompt: string,
  context: ModelBimContext
): { response: string; action?: ViewerAiAction } {
  const p = prompt.toLowerCase().trim();
  const { sections = [], scheduleDataMap = {}, modelIdentsMap = {}, selectedObject } = context;

  // 1. Show all / Reset / Clear filter
  if (p.includes('show all') || p.includes('reset') || p.includes('clear filter') || p.includes('clear isolation') || p.includes('unhide all')) {
    return {
      response: "Restoring the 3D view. All model elements are now visible.",
      action: {
        type: 'clear_isolation',
        target: 'all',
        label: 'Show Full 3D Model',
      },
    };
  }

  // 2. Schedule status filtering: Delayed
  if (p.includes('delay') || p.includes('late') || p.includes('behind schedule')) {
    const delayed = Object.values(scheduleDataMap).filter((s) => s.status === 'delayed');
    const delayedDbIds: number[] = [];
    delayed.forEach((item) => {
      if (item.dbId) delayedDbIds.push(item.dbId);
      if (item.saipemIdent && modelIdentsMap[item.saipemIdent]?.dbIds) {
        delayedDbIds.push(...modelIdentsMap[item.saipemIdent].dbIds);
      }
    });

    return {
      response: `Found **${delayed.length} delayed items** (${delayedDbIds.length} 3D elements). Filtering viewer to show only delayed construction components.`,
      action: {
        type: 'isolate',
        target: 'status',
        value: 'delayed',
        dbIds: delayedDbIds,
        elementCount: delayedDbIds.length,
        label: `Isolate Delayed Elements (${delayedDbIds.length})`,
      },
    };
  }

  // 3. Schedule status filtering: Completed
  if (p.includes('completed') || p.includes('finished') || p.includes('100%')) {
    const completed = Object.values(scheduleDataMap).filter(
      (s) => s.status === 'completed' || s.completionPercentage >= 100
    );
    const compDbIds: number[] = [];
    completed.forEach((item) => {
      if (item.dbId) compDbIds.push(item.dbId);
      if (item.saipemIdent && modelIdentsMap[item.saipemIdent]?.dbIds) {
        compDbIds.push(...modelIdentsMap[item.saipemIdent].dbIds);
      }
    });

    return {
      response: `Found **${completed.length} completed items** (${compDbIds.length} 3D elements). Isolating completed construction components.`,
      action: {
        type: 'isolate',
        target: 'status',
        value: 'completed',
        dbIds: compDbIds,
        elementCount: compDbIds.length,
        label: `Isolate Completed Elements (${compDbIds.length})`,
      },
    };
  }

  // 4. Color by progress / Theme
  if (p.includes('color') || p.includes('theme') || p.includes('heatmap') || p.includes('highlight progress')) {
    return {
      response: "Applying schedule progress color theming to the 3D model (Green: Completed, Cyan: 75%+, Blue: 25%+, Amber: Delayed, Purple: Started).",
      action: {
        type: 'theme_status',
        target: 'all',
        label: 'Apply Schedule Theming Colors',
      },
    };
  }

  // 5. Fit to view / Focus
  if (p.includes('fit') || p.includes('zoom') || p.includes('center view') || p.includes('focus')) {
    if (selectedObject?.dbId) {
      return {
        response: `Zooming and focusing camera onto selected element **#${selectedObject.dbId}** (${selectedObject.name}).`,
        action: {
          type: 'fit_view',
          target: 'dbIds',
          dbIds: [selectedObject.dbId],
          label: `Focus on #${selectedObject.dbId}`,
        },
      };
    }
    return {
      response: "Centering and fitting the entire 3D model in view.",
      action: {
        type: 'fit_view',
        target: 'all',
        label: 'Fit Model to View',
      },
    };
  }

  // 6. Category matching
  for (const sec of sections) {
    const secNameLower = sec.name.toLowerCase();
    // Check if category name matches prompt words
    const singularName = secNameLower.endsWith('s') ? secNameLower.slice(0, -1) : secNameLower;
    if (p.includes(secNameLower) || (singularName.length > 3 && p.includes(singularName))) {
      return {
        response: `Isolating **${sec.name}** category (${sec.elementCount} elements). All other categories are hidden.`,
        action: {
          type: 'isolate',
          target: 'category',
          value: sec.name,
          dbIds: sec.dbIds || [],
          elementCount: sec.elementCount,
          label: `Isolate ${sec.name} (${sec.elementCount})`,
        },
      };
    }
  }

  // 7. Saipem_IDENT match
  for (const [ident, info] of Object.entries(modelIdentsMap)) {
    if (p.includes(ident.toLowerCase())) {
      return {
        response: `Found Saipem_IDENT **${ident}** matching ${info.dbIds.length} element(s). Isolating in 3D viewer.`,
        action: {
          type: 'isolate',
          target: 'ident',
          value: ident,
          dbIds: info.dbIds,
          elementCount: info.dbIds.length,
          label: `Isolate IDENT ${ident}`,
        },
      };
    }
  }

  // 8. Model summary
  if (p.includes('summary') || p.includes('overview') || p.includes('stats') || p.includes('count')) {
    const totalSched = Object.keys(scheduleDataMap).length;
    const delayedCount = Object.values(scheduleDataMap).filter((s) => s.status === 'delayed').length;
    const completedCount = Object.values(scheduleDataMap).filter((s) => s.status === 'completed').length;
    return {
      response: `### 📊 3D Model Overview
- **Active Model**: ${context.modelName || 'Loaded in viewer'}
- **BIM Categories**: ${sections.length} categories detected (${sections.slice(0, 5).map((s) => s.name).join(', ')}...)
- **Scheduled Parts**: ${totalSched} items (${completedCount} completed, ${delayedCount} delayed)
- **Scanned Saipem_IDENTs**: ${Object.keys(modelIdentsMap).length} parts indexed

*Tip: Connect LM Studio for freeform conversation or ask me to "Isolate Walls", "Show Delayed", or "Reset View"!*`,
    };
  }

  // Default fallback response
  return {
    response: `I'm ready to control and filter your 3D viewer! You can try commands like:
- **"Isolate walls"** or **"Show doors"**
- **"Filter delayed items"**
- **"Color code progress"**
- **"Fit view"** or **"Show all elements"**

*(Note: Connect LM Studio local server on port 1234 for advanced AI generative responses!)*`,
  };
}

/**
 * Send chat message to LM Studio local server or execute fallback
 */
export async function sendChatMessageToLMStudio(params: {
  messages: Array<{ role: string; content: string }>;
  context: ModelBimContext;
  url?: string;
  model?: string;
  temperature?: number;
}): Promise<{ text: string; action?: ViewerAiAction; rawResponse?: any; offlineMode?: boolean }> {
  const { messages, context, url = getSavedLMStudioUrl(), model = getSavedLMStudioModel(), temperature = 0.2 } = params;

  const systemPrompt = buildBimSystemPrompt(context);
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Try proxy first
  try {
    const res = await axios.post('/api/llm/chat', {
      url,
      model: model || 'default',
      messages: fullMessages,
      temperature,
      max_tokens: 1000,
    }, {
      timeout: 60000,
    });

    const aiText = res.data?.choices?.[0]?.message?.content || '';
    if (aiText) {
      const { cleanText, action } = extractViewerAction(aiText);
      return { text: cleanText, action, rawResponse: res.data };
    }
  } catch (proxyErr: any) {
    console.warn('Backend proxy chat attempt failed, trying direct LM Studio endpoint...', proxyErr?.message);

    // Try direct fetch to LM Studio
    try {
      const directUrl = url.replace(/\/+$/, '');
      const directRes = await axios.post(`${directUrl}/v1/chat/completions`, {
        model: model || 'default',
        messages: fullMessages,
        temperature,
        max_tokens: 1000,
        stream: false,
      }, {
        timeout: 60000,
      });

      const aiText = directRes.data?.choices?.[0]?.message?.content || '';
      if (aiText) {
        const { cleanText, action } = extractViewerAction(aiText);
        return { text: cleanText, action, rawResponse: directRes.data };
      }
    } catch (directErr) {
      console.warn('Direct LM Studio chat also unreachable. Using BIM Heuristic Engine:', directErr);
    }
  }

  // If LM Studio is not online or failed, use heuristic engine with friendly note
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const heuristic = processLocalHeuristicCommand(lastUserMsg, context);

  return {
    text: heuristic.response,
    action: heuristic.action,
    offlineMode: true,
  };
}
