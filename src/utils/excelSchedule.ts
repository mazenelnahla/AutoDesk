import { scheduleRecordKey, indexScheduleRecords } from './scheduleRecords.ts';
import * as XLSX from 'xlsx';
import type { ElementScheduleData, ScheduleStatus, ViewerProperty } from '../types/aps';

const STORAGE_PREFIX = 'autodesk_schedule_data_';

/**
 * Searches a list of ViewerProperty items for any property that represents Saipem_IDENT
 * Supports variations: Saipem_IDENT, SAIPEM_IDENT, Saipem Ident, SaipemId, IDENT, Item Code, etc.
 */
export function extractSaipemIdentFromProps(properties: ViewerProperty[]): string | null {
  if (!properties || properties.length === 0) return null;

  const targetNames = [
    'saipem_ident',
    'saipem ident',
    'saipemident',
    'saipem_id',
    'saipem id',
    'ident',
    'item code',
    'tag number',
    'part number',
    'mark',
    'identity'
  ];

  // 1. Strict exact check (case-insensitive) for saipem_ident first
  for (const p of properties) {
    const name = (p.displayName || p.attributeName || '').toLowerCase().trim();
    if (name === 'saipem_ident' || name === 'saipem ident' || name === 'saipemident') {
      const val = String(p.displayValue ?? '').trim();
      if (val && val !== '—') return val;
    }
  }

  // 2. Secondary check for aliases
  for (const p of properties) {
    const name = (p.displayName || p.attributeName || '').toLowerCase().trim();
    if (targetNames.includes(name)) {
      const val = String(p.displayValue ?? '').trim();
      if (val && val !== '—') return val;
    }
  }

  return null;
}

/**
 * Normalizes status strings from Excel to standard ScheduleStatus
 */
export function normalizeStatus(val: any, completionPct: number): ScheduleStatus {
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim().replace(/[-_ ]/g, '');
    if (s.includes('complete') || s === 'done' || s === 'finished' || s === '100%') return 'completed';
    if (s.includes('progress') || s === 'ongoing' || s === 'started') return 'in_progress';
    if (s.includes('delay') || s.includes('late') || s.includes('behind') || s.includes('hold')) return 'delayed';
    if (s.includes('not') || s === 'pending' || s === 'todo' || s === '0%') return 'not_started';
  }

  if (completionPct >= 100) return 'completed';
  if (completionPct > 0) return 'in_progress';
  return 'not_started';
}

/**
 * Formats dates safely to YYYY-MM-DD string
 */
export function formatDateToIso(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date number
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return trimmed;
  }
  return undefined;
}

/**
 * Parses an Excel or CSV file buffer and returns a list of ElementScheduleData
 */
export async function parseExcelSchedule(
  file: File,
  contextProject?: { id: string; name: string }
): Promise<ElementScheduleData[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  let workbook: XLSX.WorkBook;

  if (isCsv) {
    const text = await file.text();
    // Detect CSV delimiter: count semicolons, commas, tabs in first 5 lines
    const firstLines = text.split('\n').slice(0, 5).join('\n');
    const semicolonCount = (firstLines.match(/;/g) || []).length;
    const tabCount = (firstLines.match(/\t/g) || []).length;
    const commaCount = (firstLines.match(/,/g) || []).length;

    let delimiter = ',';
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    }

    workbook = XLSX.read(text, { type: 'string', FS: delimiter, cellDates: true });
  } else {
    const data = await file.arrayBuffer();
    workbook = XLSX.read(data, { type: 'array', cellDates: true });
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file does not contain any sheets or readable data.');
  }

  // Find the most suitable sheet (prioritize sheets named schedule, saipem, data, tracking)
  let targetSheetName = workbook.SheetNames[0];
  const preferredSheet = workbook.SheetNames.find(name => {
    const n = name.toLowerCase();
    return n.includes('schedule') || n.includes('saipem') || n.includes('data') || n.includes('tracking') || n.includes('bim');
  });
  if (preferredSheet) {
    targetSheetName = preferredSheet;
  }

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be read.`);
  }

  // Read as 2D array of rows first to find the actual header row
  const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!allRows || allRows.length === 0) {
    throw new Error('The uploaded sheet is empty.');
  }

  // Scan first 15 rows to find the most probable header row
  const probeRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    range: 0,
    defval: '',
  }) as any[][];

  let headerRowIndex = 0;
  let bestHeaderScore = -1;

  for (let r = 0; r < Math.min(15, probeRows.length); r++) {
    const row = probeRows[r] || [];
    let score = 0;
    for (const cell of row) {
      const s = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (s.includes('ident') || s.includes('saipem') || s.includes('tag') || s.includes('itemcode')) score += 5;
      if (s.includes('dbid') || s.includes('elementid') || s.includes('objectid')) score += 3;
      if (s.includes('project') || s.includes('facility') || s.includes('job')) score += 3;
      if (s.includes('name') || s.includes('description') || s.includes('component')) score += 2;
      if (s.includes('start') || s.includes('end') || s.includes('date')) score += 2;
      if (s.includes('status') || s.includes('complete') || s.includes('progress') || s.includes('%')) score += 2;
    }
    if (score > bestHeaderScore && score > 0) {
      bestHeaderScore = score;
      headerRowIndex = r;
    }
  }

  // Parse raw rows using the detected header row
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
    range: headerRowIndex,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('No data rows found below the header row in the uploaded sheet.');
  }

  const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

  const results: ElementScheduleData[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const keys = Object.keys(row);

    // If row is entirely blank, skip it
    const hasData = keys.some(k => String(row[k]).trim() !== '');
    if (!hasData) continue;

    // Find Project column
    const projectKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c === 'project' ||
        c === 'projectname' ||
        c === 'projectid' ||
        c === 'projectcode' ||
        c === 'projectno' ||
        c === 'facility' ||
        c === 'job' ||
        c === 'jobname' ||
        c === 'jobnumber' ||
        c === 'jobno' ||
        c === 'site'
      );
    });

    // Find Saipem_IDENT column
    const identKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c === 'saipemident' ||
        c === 'saipemid' ||
        c === 'saipem' ||
        c === 'ident' ||
        c === 'tag' ||
        c === 'tagnumber' ||
        c === 'tagno' ||
        c === 'itemcode' ||
        c === 'partnumber' ||
        c === 'partno' ||
        c === 'spool' ||
        c === 'spoolid' ||
        c === 'spoolno' ||
        c === 'piecemark' ||
        c === 'mark' ||
        c === 'code'
      );
    });

    const dbIdKey = keys.find(k => {
      const c = cleanKey(k);
      return c === 'dbid' || c === 'id' || c === 'elementid' || c === 'objectid' || c === 'refelementid';
    });

    const nameKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c === 'elementname' ||
        c === 'name' ||
        c === 'partname' ||
        c === 'description' ||
        c === 'itemdescription' ||
        c === 'component' ||
        c === 'title'
      );
    });

    const categoryKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c === 'category' ||
        c === 'type' ||
        c === 'system' ||
        c === 'discipline' ||
        c === 'classification' ||
        c === 'family' ||
        c === 'group'
      );
    });

    const startKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c.includes('start') ||
        c === 'startdate' ||
        c === 'plannedstart' ||
        c === 'targetstart' ||
        c === 'baselinestart' ||
        c === 'datestart'
      );
    });

    const endKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c.includes('end') ||
        c.includes('finish') ||
        c === 'enddate' ||
        c === 'finishdate' ||
        c === 'plannedend' ||
        c === 'plannedfinish' ||
        c === 'targetfinish' ||
        c === 'dateend'
      );
    });

    const pctKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c.includes('complete') ||
        c.includes('progress') ||
        c.includes('percentage') ||
        c === 'pct' ||
        c === 'percent'
      );
    });

    const statusKey = keys.find(k => {
      const c = cleanKey(k);
      return c === 'status' || c === 'state' || c === 'phase' || c === 'stage' || c === 'condition';
    });

    const assigneeKey = keys.find(k => {
      const c = cleanKey(k);
      return (
        c === 'assignee' ||
        c === 'contractor' ||
        c === 'responsible' ||
        c === 'team' ||
        c === 'vendor' ||
        c === 'subcontractor' ||
        c === 'owner'
      );
    });

    const notesKey = keys.find(k => {
      const c = cleanKey(k);
      return c === 'notes' || c === 'remarks' || c === 'comments' || c === 'note' || c === 'details';
    });

    let saipemIdent = identKey ? String(row[identKey] ?? '').trim() : '';
    let dbIdVal: number | undefined = undefined;
    if (dbIdKey && row[dbIdKey] !== '') {
      const parsedNum = Number(row[dbIdKey]);
      if (!isNaN(parsedNum)) dbIdVal = parsedNum;
    }

    // If no explicit Saipem_IDENT column, check if dbId exists or fallback to row index
    if (!saipemIdent && dbIdVal !== undefined) {
      saipemIdent = `OBJ-${dbIdVal}`;
    } else if (!saipemIdent) {
      // If there is a first non-empty column value, use it, else fall back to SPM-XXXX
      const firstNonEmptyVal = keys.map(k => String(row[k] ?? '').trim()).find(v => v.length > 0);
      saipemIdent = firstNonEmptyVal ? firstNonEmptyVal : `SPM-${String(i + 1).padStart(4, '0')}`;
    }

    // Parse completion percentage (support numbers like 0.75 or 75 or "75%")
    let completionPct = 0;
    if (pctKey && row[pctKey] !== '') {
      const rawVal = String(row[pctKey]).replace('%', '').trim();
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        if (num <= 1 && num > 0 && !String(row[pctKey]).includes('%')) {
          completionPct = Math.min(100, Math.max(0, Math.round(num * 100)));
        } else {
          completionPct = Math.min(100, Math.max(0, Math.round(num)));
        }
      }
    }

    const statusVal = statusKey ? row[statusKey] : '';
    const finalStatus = normalizeStatus(statusVal, completionPct);

    const parsedProjectName = projectKey ? String(row[projectKey] ?? '').trim() : undefined;
    const finalProjectName = parsedProjectName || contextProject?.name;
    const finalProjectId = contextProject && (!parsedProjectName || parsedProjectName.toLowerCase() === contextProject.name.toLowerCase())
      ? contextProject.id
      : undefined;

    // Collect custom fields
    const standardKeys = [
      projectKey,
      identKey,
      dbIdKey,
      nameKey,
      categoryKey,
      startKey,
      endKey,
      pctKey,
      statusKey,
      assigneeKey,
      notesKey
    ].filter(Boolean) as string[];

    const customFields: Record<string, string> = {};
    for (const k of keys) {
      if (!standardKeys.includes(k) && row[k] !== '') {
        customFields[k] = String(row[k]);
      }
    }

    results.push({
      saipemIdent,
      projectId: finalProjectId,
      projectName: finalProjectName,
      dbId: dbIdVal,
      elementName: nameKey ? String(row[nameKey] ?? '').trim() : undefined,
      category: categoryKey ? String(row[categoryKey] ?? '').trim() : undefined,
      startDate: startKey ? formatDateToIso(row[startKey]) : undefined,
      endDate: endKey ? formatDateToIso(row[endKey]) : undefined,
      completionPercentage: completionPct,
      status: finalStatus,
      assignee: assigneeKey ? String(row[assigneeKey] ?? '').trim() : undefined,
      notes: notesKey ? String(row[notesKey] ?? '').trim() : undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  // Automatically merge parsed rows into the master pool
  saveMasterExcelPool(results);

  return results;
}

/**
 * Exports element schedule data to an Excel file (.xlsx) and triggers download
 */
export function exportToExcelFile(
  data: ElementScheduleData[],
  filename = 'Project_Schedule_Saipem_Data.xlsx',
  currentProjectName?: string
) {
  const exportRows = data.map((item) => ({
    'Project': item.projectName || currentProjectName || '',
    'Saipem_IDENT': item.saipemIdent,
    'dbId': item.dbId ?? '',
    'Element Name': item.elementName ?? '',
    'Category': item.category ?? '',
    'Start Date': item.startDate ?? '',
    'End Date': item.endDate ?? '',
    'Complete Percentage': `${item.completionPercentage}%`,
    'Status': item.status.replace('_', ' ').toUpperCase(),
    'Assignee / Contractor': item.assignee ?? '',
    'Notes / Remarks': item.notes ?? '',
    ...(item.customFields || {}),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 22 }, // Project
    { wch: 18 }, // Saipem_IDENT
    { wch: 10 }, // dbId
    { wch: 30 }, // Element Name
    { wch: 20 }, // Category
    { wch: 14 }, // Start Date
    { wch: 14 }, // End Date
    { wch: 20 }, // Complete Percentage
    { wch: 16 }, // Status
    { wch: 22 }, // Assignee
    { wch: 35 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Live Schedule Data');
  XLSX.writeFile(workbook, filename);
}

/**
 * Generates and downloads a sample Excel template for users to fill in
 */
export function downloadSampleExcelTemplate(filename = 'Saipem_Schedule_Template.xlsx', projectName = 'FPSO Topsides Project') {
  const sampleData: ElementScheduleData[] = [
    {
      saipemIdent: 'SPM-ST-001',
      projectName,
      dbId: 101,
      elementName: 'Structural Column - W12x45',
      category: 'Structural Columns',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
      completionPercentage: 100,
      status: 'completed',
      assignee: 'Apex Steel Fabrication',
      notes: 'Bolts torqued and inspected by QA/QC',
    },
    {
      saipemIdent: 'SPM-ST-002',
      projectName,
      dbId: 102,
      elementName: 'Main Framing Beam - W18x50',
      category: 'Structural Framing',
      startDate: '2026-03-10',
      endDate: '2026-03-25',
      completionPercentage: 65,
      status: 'in_progress',
      assignee: 'Apex Steel Fabrication',
      notes: 'Welding in progress on grid B-4',
    },
    {
      saipemIdent: 'SPM-CW-010',
      projectName,
      dbId: 204,
      elementName: 'Curtain Wall Mullion - 2.5x5',
      category: 'Curtain Wall Panels',
      startDate: '2026-04-01',
      endDate: '2026-04-20',
      completionPercentage: 20,
      status: 'in_progress',
      assignee: 'GlassTech Facades',
      notes: 'Anchor brackets installed',
    },
    {
      saipemIdent: 'SPM-MEP-301',
      projectName,
      dbId: 305,
      elementName: 'HVAC Chilled Water Supply Line 4"',
      category: 'Piping',
      startDate: '2026-04-15',
      endDate: '2026-05-01',
      completionPercentage: 0,
      status: 'not_started',
      assignee: 'Thermal Dynamics MEP',
      notes: 'Awaiting spool delivery',
    },
    {
      saipemIdent: 'SPM-FL-502',
      projectName,
      dbId: 412,
      elementName: 'Cast-in-Place Concrete Slab 200mm',
      category: 'Floors',
      startDate: '2026-02-15',
      endDate: '2026-03-05',
      completionPercentage: 40,
      status: 'delayed',
      assignee: 'Solid Foundations Ltd',
      notes: 'Delayed due to curing weather conditions',
    }
  ];

  exportToExcelFile(sampleData, filename, projectName);
}

/**
 * Storage helpers to load and save schedule datasets.
 * - Master pool holds all imported spreadsheets across sessions.
 * - Project storage isolates live schedule records per project ID.
 */
export const MASTER_EXCEL_POOL_KEY = 'autodesk_master_excel_pool';
export const PROJECT_STORAGE_PREFIX = 'autodesk_project_schedule_';
const GLOBAL_STORAGE_KEY = 'autodesk_global_schedule_data';

/**
 * Loads the master Excel pool containing all parsed spreadsheets
 */
export function loadMasterExcelPool(): ElementScheduleData[] {
  try {
    const raw = localStorage.getItem(MASTER_EXCEL_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Backward-compatibility: migrate legacy autodesk_global_schedule_data if present
    const legacyRaw = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (legacyRaw) {
      const legacyObj = JSON.parse(legacyRaw);
      const list = Object.values(legacyObj) as ElementScheduleData[];
      if (list.length > 0) {
        localStorage.setItem(MASTER_EXCEL_POOL_KEY, JSON.stringify(list));
        return list;
      }
    }
    return [];
  } catch (e) {
    console.warn('Failed to load master Excel pool:', e);
    return [];
  }
}

/**
 * Merges and saves records to the master Excel pool
 */
export function saveMasterExcelPool(newItems: ElementScheduleData[]): ElementScheduleData[] {
  try {
    const existing = loadMasterExcelPool();
    const map = new Map<string, ElementScheduleData>();

    // Keep element rows distinct within each project and shared IDENT.
    const buildKey = (item: ElementScheduleData) =>
      JSON.stringify([scheduleRecordKey(item), (item.projectId || item.projectName || '').trim().toLowerCase()]);

    existing.forEach((item) => {
      if (item.saipemIdent) {
        map.set(buildKey(item), item);
      }
    });

    newItems.forEach((item) => {
      if (item.saipemIdent) {
        const k = buildKey(item);
        const prev = map.get(k) || {};
        map.set(k, {
          ...prev,
          ...item,
          updatedAt: item.updatedAt || new Date().toISOString(),
        });
      }
    });

    const merged = Array.from(map.values());
    localStorage.setItem(MASTER_EXCEL_POOL_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Failed to save master Excel pool:', e);
    return newItems;
  }
}

/**
 * Loads schedule data specific to an active project
 */
export function loadProjectScheduleData(projectId: string): Record<string, ElementScheduleData> {
  if (!projectId) return {};
  try {
    const raw = localStorage.getItem(`${PROJECT_STORAGE_PREFIX}${projectId}`);
    return raw ? indexScheduleRecords(Object.values(JSON.parse(raw))) : {};
  } catch (e) {
    console.warn(`Failed to load schedule for project ${projectId}:`, e);
    return {};
  }
}

/**
 * Saves schedule data specific to an active project
 */
export function saveProjectScheduleData(projectId: string, data: Record<string, ElementScheduleData>) {
  if (!projectId) return;
  try {
    localStorage.setItem(`${PROJECT_STORAGE_PREFIX}${projectId}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save schedule for project ${projectId}:`, e);
  }
}

/**
 * Fetches and resolves schedule data for a specific project.
 * Automatically finds records matching unique Saipem_IDENTs for this project:
 * 1. Saved project records
 * 2. Records matching the project's ID or Name from master pool
 * 3. Records from master pool whose Saipem_IDENT matches unique Saipem_IDENTs scanned from the project's 3D model
 */
export function fetchScheduleForProject(params: {
  projectId: string;
  projectName?: string;
  modelKey?: string;
  modelIdents?: Record<string, { dbIds: number[]; name?: string; category?: string }>;
}): {
  scheduleMap: Record<string, ElementScheduleData>;
  matchedCount: number;
} {
  const { projectId, projectName, modelKey, modelIdents = {} } = params;
  if (!projectId) return { scheduleMap: {}, matchedCount: 0 };

  // 1. Load existing project-scoped data
  const projectMap: Record<string, ElementScheduleData> = loadProjectScheduleData(projectId);

  // Also check if there's any model-specific legacy data for backward compatibility
  if (modelKey) {
    try {
      const modelRaw = localStorage.getItem(`${STORAGE_PREFIX}${modelKey}`);
      if (modelRaw) {
        const modelData = JSON.parse(modelRaw);
        const legacyItems = (Object.values(modelData) as ElementScheduleData[]).filter((item) =>
          (!item.projectId || item.projectId === projectId) && (!item.modelUrn || item.modelUrn === modelKey)
        );
        for (const item of legacyItems) {
          if (!item.modelUrn) delete projectMap[scheduleRecordKey(item)];
          const scoped = { ...item, modelUrn: modelKey };
          projectMap[scheduleRecordKey(scoped)] = scoped;
        }
      }
    } catch {}
  }

  // 2. Query master Excel pool
  const masterPool = loadMasterExcelPool();
  const lowerProjectName = projectName?.toLowerCase().trim();
  const modelIdentMapKeys = Object.keys(modelIdents);
  const lowerModelIdentMap: Record<string, string> = {};
  modelIdentMapKeys.forEach((k) => {
    lowerModelIdentMap[k.toLowerCase().trim()] = k;
  });

  masterPool.forEach((item) => {
    if (!item.saipemIdent) return;
    const lowerIdent = item.saipemIdent.toLowerCase().trim();

    // Strictly exclude items that explicitly belong to a different project
    if (item.projectId && item.projectId !== projectId) return;
    if (!item.projectId && item.projectName && lowerProjectName && item.projectName.toLowerCase().trim() !== lowerProjectName) return;

    const matchesProjectTag =
      (item.projectId && item.projectId === projectId) ||
      (lowerProjectName && item.projectName && item.projectName.toLowerCase().trim() === lowerProjectName);

    const originalModelKey = lowerModelIdentMap[lowerIdent];
    const matchesModelIdent = Boolean(originalModelKey);

    // If item matches this project or matches a unique Saipem_IDENT detected in the model
    if (matchesProjectTag || matchesModelIdent) {
      const key = scheduleRecordKey(item);
      const existing = projectMap[key];
      const modelInfo = originalModelKey ? modelIdents[originalModelKey] : undefined;

      const merged: ElementScheduleData = {
        ...item,
        ...(existing || {}),
        saipemIdent: item.saipemIdent,
        projectId: projectId,
        projectName: projectName || item.projectName,
        dbId: item.dbId,
        elementName: existing?.elementName ?? item.elementName ?? modelInfo?.name,
        category: existing?.category ?? item.category ?? modelInfo?.category,
        updatedAt: existing?.updatedAt || item.updatedAt || new Date().toISOString(),
      };

      projectMap[key] = merged;
    }
  });

  // Ensure all entries strictly belong to this project and exclude any cross-project records
  const strictlyProjectMap: Record<string, ElementScheduleData> = {};
  Object.entries(projectMap).forEach(([k, item]) => {
    if (item.projectId && item.projectId !== projectId) return;
    strictlyProjectMap[k] = {
      ...item,
      projectId,
      projectName: projectName || item.projectName,
    };
  });

  // Persist updated project data
  saveProjectScheduleData(projectId, strictlyProjectMap);

  // Preserve the complete project store, but expose only records for this model.
  const visibleMap = modelKey ? indexScheduleRecords(Object.values(strictlyProjectMap).filter((item) => {
    if (item.modelUrn) return item.modelUrn === modelKey;
    const info = modelIdents[lowerModelIdentMap[item.saipemIdent.toLowerCase().trim()]];
    return !!info && (item.dbId == null || info.dbIds.includes(item.dbId));
  }).sort((a, b) => Number(!!a.modelUrn) - Number(!!b.modelUrn)).map((item) => ({ ...item, modelUrn: modelKey }))) : strictlyProjectMap;
  return { scheduleMap: visibleMap, matchedCount: Object.keys(visibleMap).length };
}

/**
 * Compatibility wrapper to load schedule data
 */
export function loadSavedScheduleData(
  modelKey?: string,
  projectId?: string,
  projectName?: string,
  modelIdents?: Record<string, { dbIds: number[]; name?: string; category?: string }>
): Record<string, ElementScheduleData> {
  if (projectId) {
    const { scheduleMap } = fetchScheduleForProject({
      projectId,
      projectName,
      modelKey,
      modelIdents,
    });
    return scheduleMap;
  }

  try {
    const globalRaw = localStorage.getItem(GLOBAL_STORAGE_KEY);
    const globalData: Record<string, ElementScheduleData> = globalRaw ? JSON.parse(globalRaw) : {};

    if (modelKey) {
      const modelRaw = localStorage.getItem(`${STORAGE_PREFIX}${modelKey}`);
      const modelData: Record<string, ElementScheduleData> = modelRaw ? JSON.parse(modelRaw) : {};
      return indexScheduleRecords(Object.values({ ...globalData, ...modelData }));
    }

    return indexScheduleRecords(Object.values(globalData));
  } catch (e) {
    console.warn('Failed to load schedule data from storage:', e);
    return {};
  }
}

/**
 * Saves schedule data to project-scoped storage and master pool
 */
export function saveScheduleData(
  modelKey: string | undefined,
  data: Record<string, ElementScheduleData>,
  projectId?: string
) {
  try {
    if (projectId) {
      saveProjectScheduleData(projectId, { ...loadProjectScheduleData(projectId), ...indexScheduleRecords(Object.values(data)) });
    }
    // Also save to master Excel pool
    saveMasterExcelPool(Object.values(data));

    // Also persist under current model key if specified
    if (modelKey) {
      localStorage.setItem(`${STORAGE_PREFIX}${modelKey}`, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('Failed to save schedule data to storage:', e);
  }
}


