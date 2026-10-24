import { STATUS_COLORS, effectiveStatus } from '../utils/statusColors';
import { findScheduleRecord } from '../utils/scheduleRecords';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Grid,
  Calendar,
  Box,
  Tag,
  Search,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
  User,
  Sliders,
  Hash,
  ExternalLink,
  Building2,
  Database,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Maximize2,
  ChevronRight
} from 'lucide-react';
import type {
  APSItem,
  APSProject,
  ViewerSelectedObject,
  ElementScheduleData,
  ScheduleStatus,
  ScannedModelIdentMap,
} from '../types/aps';
import { formatPropUnit, formatPropValue } from '../utils/unitMap';
import { extractSaipemIdentFromProps } from '../utils/excelSchedule';

interface InspectorPanelProps {
  selectedItem: APSItem | null;
  selectedProject: APSProject | null;
  selectedObject: ViewerSelectedObject | null;
  scheduleDataMap: Record<string, ElementScheduleData>;
  modelIdentsMap?: ScannedModelIdentMap;
  onUpdateScheduleData?: ((entry: ElementScheduleData) => void) | ((ident: string, data: Partial<ElementScheduleData>) => void);
  onOpenExcelModal?: () => void;
  onSelectSaipemIdent?: (ident: string) => void;
  onIsolatePart?: (dbId?: number, ident?: string, dbIds?: number[]) => void;
  onClearIsolation?: () => void;
  isIsolated?: boolean;
  isolatedIdent?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedItem,
  selectedProject,
  selectedObject,
  scheduleDataMap,
  modelIdentsMap = {},
  onOpenExcelModal,
  onSelectSaipemIdent,
  onIsolatePart,
  onClearIsolation,
  isIsolated = false,
  isolatedIdent = null,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'tracking' | 'elements' | 'properties'>('tracking');
  const [propSearch, setPropSearch] = useState('');
  const [identListSearch, setIdentListSearch] = useState('');
  const [showAllRawProps, setShowAllRawProps] = useState(false);
  const [userSelectedIdent, setUserSelectedIdent] = useState<string | null>(null);
  const [showProjectInventory, setShowProjectInventory] = useState(false);

  // Filter schedule data strictly to the selected project
  const projectScheduleMap = useMemo(() => {
    if (!selectedProject) return {};
    const result: Record<string, ElementScheduleData> = {};
    const projName = selectedProject.name?.toLowerCase().trim();

    Object.entries(scheduleDataMap).forEach(([ident, item]) => {
      // Must be related to the project
      const isProjectMatch =
        item.projectId === selectedProject.id ||
        (!item.projectId && item.projectName && item.projectName.toLowerCase().trim() === projName) ||
        (!item.projectId && !item.projectName);

      if (isProjectMatch) {
        result[ident] = item;
      }
    });
    return result;
  }, [scheduleDataMap, selectedProject]);

  // Detected Saipem_IDENT from selected 3D object
  const detectedIdentFromObject = useMemo(() => {
    if (!selectedObject) return null;

    // 1. Check object BIM properties directly
    if (selectedObject.properties && selectedObject.properties.length > 0) {
      const fromProps = extractSaipemIdentFromProps(selectedObject.properties);
      if (fromProps) return fromProps;
    }

    // 2. Check scanned model IDENT mapping
    if (selectedObject.dbId && modelIdentsMap) {
      for (const [ident, info] of Object.entries(modelIdentsMap)) {
        if (info.dbIds.includes(selectedObject.dbId)) {
          return ident;
        }
      }
    }

    // 3. Check project schedule data map
    if (selectedObject.dbId) {
      const found = Object.values(projectScheduleMap).find((s) => s.dbId === selectedObject.dbId);
      if (found) return found.saipemIdent;
    }

    return null;
  }, [selectedObject, modelIdentsMap, projectScheduleMap]);

  // Sync user selection when a new 3D piece is selected
  useEffect(() => {
    setShowProjectInventory(false);
    if (detectedIdentFromObject) {
      setUserSelectedIdent(detectedIdentFromObject);
    } else if (selectedObject) {
      // Selected object has no IDENT detected
      setUserSelectedIdent(null);
    }
  }, [detectedIdentFromObject, selectedObject, selectedProject?.id, selectedItem?.id]);

  // Currently active Saipem_IDENT (strictly related to this project)
  const activeIdent = showProjectInventory ? null : (userSelectedIdent || detectedIdentFromObject);

  // All unique Saipem_IDENTs strictly related to this project
  const allProjectIdents = useMemo(() => {
    const identSet = new Set<string>();
    Object.values(projectScheduleMap).forEach((item) => identSet.add(item.saipemIdent));
    if (modelIdentsMap) {
      Object.keys(modelIdentsMap).forEach((id) => identSet.add(id));
    }
    return Array.from(identSet).sort();
  }, [projectScheduleMap, modelIdentsMap]);

  // All 3D model dbIds that share the SAME active Saipem_IDENT in this project
  const sameIdentDbIds = useMemo(() => {
    if (!activeIdent) return [];
    if (modelIdentsMap[activeIdent]?.dbIds && modelIdentsMap[activeIdent].dbIds.length > 0) {
      return modelIdentsMap[activeIdent].dbIds;
    }
    if (selectedObject?.dbId && detectedIdentFromObject === activeIdent) {
      return [selectedObject.dbId];
    }
    return Object.values(projectScheduleMap).filter((item) => item.saipemIdent === activeIdent && item.dbId != null).map((item) => item.dbId!);
  }, [activeIdent, modelIdentsMap, selectedObject, detectedIdentFromObject, projectScheduleMap]);

  // Schedule record for the active Saipem_IDENT (strictly tagged with project)
  const currentSchedule: ElementScheduleData = useMemo(() => {
    const matched = activeIdent ? findScheduleRecord(projectScheduleMap, activeIdent, selectedObject?.dbId) : undefined;
    if (matched) return matched;
    const modelInfo = activeIdent && modelIdentsMap ? modelIdentsMap[activeIdent] : undefined;
    return {
      saipemIdent: activeIdent || '',
      projectId: selectedProject?.id,
      projectName: selectedProject?.name,
      dbId: selectedObject?.dbId ?? modelInfo?.dbIds?.[0],
      elementName: selectedObject?.name ?? modelInfo?.name,
      category: selectedObject?.properties.find((p) => p.displayName === 'Category')?.displayValue || modelInfo?.category,
      completionPercentage: 0,
      status: 'not_started',
      updatedAt: new Date().toISOString(),
    };
  }, [activeIdent, projectScheduleMap, modelIdentsMap, selectedProject, selectedObject]);

  // Available schedule records strictly scoped to this project
  const projectScheduleList = useMemo(() => {
    return Object.values(projectScheduleMap);
  }, [projectScheduleMap]);

  const hasScheduleData = Boolean(activeIdent && findScheduleRecord(projectScheduleMap, activeIdent, selectedObject?.dbId));

  // Color and badge helper for verified status
  const getStatusTheme = (status: ScheduleStatus) => {
    switch (status) {
      case 'completed':
        return {
          bar: 'status-fill-completed',
          text: 'status-text-completed',
          border: 'status-border-completed',
          bg: 'status-bg-completed',
          icon: <CheckCircle2 size={13} className="status-text-completed shrink-0" />,
        };
      case 'in_progress':
        return {
          bar: 'status-fill-in_progress',
          text: 'status-text-in_progress',
          border: 'status-border-in_progress',
          bg: 'status-bg-in_progress',
          icon: <Clock size={13} className="status-text-in_progress shrink-0" />,
        };
      case 'delayed':
        return {
          bar: 'status-fill-delayed',
          text: 'status-text-delayed',
          border: 'status-border-delayed',
          bg: 'status-bg-delayed',
          icon: <AlertTriangle size={13} className="status-text-delayed shrink-0" />,
        };
      default:
        return {
          bar: 'bg-slate-600',
          text: 'text-slate-400',
          border: 'border-slate-700/60',
          bg: 'bg-slate-800/40',
          icon: <XCircle size={13} className="text-slate-400 shrink-0" />,
        };
    }
  };

  // Filter 3D BIM properties: only display what is related to this Saipem_IDENT and project
  const rawProps = selectedObject?.properties || [];
  const relevantProps = useMemo(() => {
    if (showAllRawProps) return rawProps;

    return rawProps.filter((p) => {
      if (p.hidden) return false;
      const name = (p.displayName || p.attributeName || '').toLowerCase();
      const cat = (p.displayCategory || '').toLowerCase();

      // Saipem_IDENT / Identity / Tag / Mark
      const identKeywords = [
        'saipem', 'ident', 'tag', 'mark', 'code', 'identity', 'part number',
        'item', 'project', 'client', 'contract', 'wbs'
      ];
      if (identKeywords.some((kw) => name.includes(kw) || cat.includes(kw))) {
        return true;
      }

      // Classification & Type
      if (name === 'category' || name === 'family name' || name === 'type name' || name === 'type' || name === 'family') {
        return true;
      }

      // Construction & Phasing
      if (name.includes('phase') || name.includes('status') || name.includes('stage')) {
        return true;
      }

      return false;
    });
  }, [rawProps, showAllRawProps]);

  // Group filtered BIM properties by category
  const filteredProps = useMemo(() => {
    if (!propSearch.trim()) return relevantProps;
    const q = propSearch.toLowerCase();
    return relevantProps.filter((p) => {
      const formattedVal = formatPropValue(p).toLowerCase();
      return (
        (p.displayName && p.displayName.toLowerCase().includes(q)) ||
        formattedVal.includes(q) ||
        (p.displayCategory && p.displayCategory.toLowerCase().includes(q))
      );
    });
  }, [relevantProps, propSearch]);

  const categoriesMap: { [cat: string]: typeof filteredProps } = {};
  filteredProps.forEach((p) => {
    const cat = p.displayCategory || 'Identity & Project Parameters';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(p);
  });

  // Filtered project IDENTs for search in list view
  const filteredProjectIdents = useMemo(() => {
    if (!identListSearch.trim()) return allProjectIdents;
    const q = identListSearch.toLowerCase();
    return allProjectIdents.filter((id) => {
      const rec = findScheduleRecord(projectScheduleMap, id);
      return (
        id.toLowerCase().includes(q) ||
        (rec?.elementName && rec.elementName.toLowerCase().includes(q)) ||
        (rec?.category && rec.category.toLowerCase().includes(q))
      );
    });
  }, [allProjectIdents, identListSearch, projectScheduleMap]);

  // Handler to isolate all elements sharing the active Saipem_IDENT in 3D
  const handleIsolateActiveIdent = () => {
    if (!activeIdent) return;
    if (isIsolated && isolatedIdent === activeIdent) {
      if (onClearIsolation) {
        onClearIsolation();
      }
      return;
    }
    if (onIsolatePart) {
      onIsolatePart(selectedObject?.dbId, activeIdent, sameIdentDbIds);
    }
    if (onSelectSaipemIdent) {
      onSelectSaipemIdent(activeIdent);
    }
  };

  // Handler to select/focus a specific 3D dbId with the same Saipem_IDENT
  const handleSelectDbId = (dbId: number) => {
    if (onIsolatePart) {
      onIsolatePart(dbId, activeIdent || undefined, [dbId]);
    }
  };

  // If no model or no project is loaded
  if (!selectedItem) {
    return (
      <aside className={`inspector-panel empty ${isCollapsed ? 'inspector-collapsed' : ''}`}>
        {onToggleCollapse && (
          <button
            type="button"
            className="absolute top-3 right-3 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            onClick={onToggleCollapse}
            title="Collapse Inspector Panel"
          >
            <ChevronRight size={14} />
          </button>
        )}
        <div className="inspector-placeholder">
          <FileText size={32} className="text-slate-600 mb-2" />
          <p className="font-semibold text-slate-300">No model loaded</p>
          <p className="text-xs text-slate-500 mt-1">
            Choose a 3D model version from your project tree to inspect its Saipem_IDENT parts.
          </p>
        </div>
      </aside>
    );
  }

  if (!selectedProject) {
    return (
      <aside className={`inspector-panel empty ${isCollapsed ? 'inspector-collapsed' : ''}`}>
        {onToggleCollapse && (
          <button
            type="button"
            className="absolute top-3 right-3 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            onClick={onToggleCollapse}
            title="Collapse Inspector Panel"
          >
            <ChevronRight size={14} />
          </button>
        )}
        <div className="inspector-placeholder">
          <Building2 size={32} className="text-slate-600 mb-2" />
          <p className="font-semibold text-slate-300">No project selected</p>
          <p className="text-xs text-slate-500 mt-1">
            Select an Autodesk project to view and manage its Saipem_IDENT parts.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`inspector-panel ${isCollapsed ? 'inspector-collapsed' : ''}`}>
      {/* Top Header: Project Context & Active Saipem_IDENT */}
      <div className="inspector-header">
        {/* Project Context Badge */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 size={13} className="text-cyan-400 shrink-0" />
            <span className="text-[11px] font-semibold text-cyan-300 truncate" title={selectedProject.name}>
              {selectedProject.name}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
              Project Scope
            </span>
            {onToggleCollapse && (
              <button
                type="button"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={onToggleCollapse}
                title="Collapse Inspector Panel"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* When active Saipem_IDENT is determined: Highlight Same IDENT */}
        {activeIdent ? (
          <div className="space-y-2">
            <div className="inspector-identity-row">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Hash size={15} className="text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                      Saipem_IDENT
                    </span>
                  </div>
                  <h4 className="font-mono font-bold text-sm text-cyan-300 truncate" title={activeIdent}>
                    {activeIdent}
                  </h4>
                </div>
              </div>

              {/* Isolate in 3D Button / Show All Toggle */}
              <button
                type="button"
                className={`text-xs py-1.5 px-2.5 flex items-center gap-1.5 shrink-0 shadow-sm rounded-lg font-medium transition-all ${isIsolated && isolatedIdent === activeIdent
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer'
                  : 'btn-primary'
                  }`}
                onClick={handleIsolateActiveIdent}
                title={
                  isIsolated && isolatedIdent === activeIdent
                    ? 'Show all model parts (exit isolation)'
                    : `Isolate all ${sameIdentDbIds.length} parts sharing ${activeIdent} in 3D`
                }
              >
                {isIsolated && isolatedIdent === activeIdent ? (
                  <>
                    <EyeOff size={12} />
                    <span>Show All</span>
                  </>
                ) : (
                  <>
                    <Eye size={12} />
                    <span>Isolate in 3D</span>
                  </>
                )}
              </button>
            </div>

            {/* Model parts sharing this IDENT count indicator */}
            <div className="inspector-parts-summary">
              <div className="flex items-center gap-2 text-slate-300">
                <Box size={13} className="text-cyan-400" />
                <span>
                  <strong className="text-cyan-300 font-mono font-bold">{sameIdentDbIds.length}</strong>{' '}
                  {sameIdentDbIds.length === 1 ? 'part' : 'parts'} in project share this IDENT
                </span>
              </div>
              {selectedObject && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Selected: dbId {selectedObject.dbId}
                </span>
              )}
            </div>
          </div>
        ) : selectedObject && !showProjectInventory ? (
          /* Selected 3D object has NO Saipem_IDENT */
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <AlertCircle size={14} className="shrink-0" />
              <span className="truncate">No Saipem_IDENT assigned</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Selected: <strong className="text-white">{selectedObject.name}</strong> (dbId: {selectedObject.dbId})
            </p>
            <p className="text-[10px] text-slate-400">
              Select or assign an existing Saipem_IDENT from project <span className="text-cyan-300">{selectedProject.name}</span>.
            </p>

            {/* Open Schedule Data Dialog to Assign/Select */}
            <div className="pt-1">
              <button
                type="button"
                className="btn-primary text-xs w-full py-2 px-3 flex items-center justify-between shadow-sm"
                onClick={onOpenExcelModal}
                title="Open Schedule Data Dialog to select and bind an Excel record to this piece"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={13} className="text-emerald-400 shrink-0" />
                  <span className="font-semibold">Select in Schedule Data Dialog</span>
                </div>
                <ExternalLink size={13} className="shrink-0 text-white/80" />
              </button>
            </div>
          </div>
        ) : (
          /* No object selected: Project Saipem_IDENT Overview */
          <div className="flex items-center justify-between">
            <div>
              <span className="rvt-badge">Project Registry</span>
              <h3 className="inspector-filename mt-1">{selectedItem.displayName}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {allProjectIdents.length} Saipem_IDENT parts in project
              </p>
            </div>
            <button
              type="button"
              className="btn-excel-open"
              onClick={onOpenExcelModal}
              title="Manage live project Excel data"
            >
              <Sparkles size={12} />
              <span>Excel Hub</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs: Only when active Saipem_IDENT is determined */}
      {activeIdent ? (
        <div className="inspector-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracking')}
            title="View and edit live project schedule for this Saipem_IDENT"
          >
            <FileSpreadsheet size={13} className="text-emerald-400" />
            <span>Schedule</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'elements' ? 'active' : ''}`}
            onClick={() => setActiveTab('elements')}
            title="View all 3D pieces sharing the same Saipem_IDENT in this project"
          >
            <Box size={13} className="text-cyan-400" />
            <span>Parts ({sameIdentDbIds.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
            title="View properties related to this Saipem_IDENT and project"
          >
            <Grid size={13} />
            <span>Properties</span>
          </button>
        </div>
      ) : null}

      {/* Main Inspector Body */}
      <div className="inspector-content">
        {activeIdent ? (
          <>
            {/* ================= TAB 1: LIVE TRACKING & SCHEDULE (SAME Saipem_IDENT) ================= */}
            {activeTab === 'tracking' && (
              <div className="tab-pane space-y-3.5">
                {/* Related Project Schedule Selection Card */}
                <div className="modern-category-card">
                  <div className="modern-category-header">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Database size={13} className="text-cyan-400" />
                      <span className="modern-category-title truncate">Schedule record</span>
                    </div>
                    {hasScheduleData ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Linked Data
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-semibold border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle size={10} /> Unlinked
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Selected Record:</span>
                      <span className="font-mono font-bold text-cyan-300 truncate max-w-[180px]">
                        {activeIdent || 'None selected'}
                      </span>
                    </div>

                    {/* Button to open the Schedule Data Dialog */}
                    <button
                      type="button"
                      className="btn-secondary text-xs w-full py-2.5 px-3 flex items-center justify-between shadow-sm hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all font-medium rounded-lg"
                      onClick={onOpenExcelModal}
                      title="Open Schedule Data Dialog to select, inspect, or assign records"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet size={14} className="text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {hasScheduleData
                            ? `Change schedule record`
                            : `Browse records (${projectScheduleList.length})`}
                        </span>
                      </div>
                      <ExternalLink size={13} className="text-cyan-400 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Project & IDENT Verification Card */}
                <div className="modern-category-card project-verification-card">
                  <div className="modern-category-header">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 size={13} className="text-cyan-400" />
                      <span className="modern-category-title">Project verification</span>
                    </div>
                    <span className="project-matched-badge">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Project Matched
                    </span>
                  </div>
                  <div className="project-verification-details">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400 text-[11px]">Active Project:</span>
                      <strong className="text-cyan-300 font-semibold truncate max-w-[180px]" title={selectedProject.name}>
                        {selectedProject.name}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400 text-[11px]">Saipem_IDENT:</span>
                      <span className="font-mono font-bold text-cyan-300">{activeIdent}</span>
                    </div>
                    {currentSchedule.elementName && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 text-[11px]">Element:</span>
                        <span className="text-slate-200 truncate max-w-[180px]" title={currentSchedule.elementName}>
                          {currentSchedule.elementName}
                        </span>
                      </div>
                    )}
                    {currentSchedule.category && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400 text-[11px]">Category:</span>
                        <span className="text-slate-300 font-medium">{currentSchedule.category}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Construction Progress & Status (Strictly Read-Only Verified Data) */}
                {(() => {
                  const statusTheme = getStatusTheme(effectiveStatus(currentSchedule));
                  return (
                    <div className="modern-category-card">
                      <div className="modern-category-header">
                        <div className="flex items-center gap-1.5">
                          <Sliders size={13} className="text-cyan-400" />
                          <span className="modern-category-title">Construction progress</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          Read only
                        </span>
                      </div>

                      <div className="p-3 space-y-3">
                        {/* Visual Progress Bar & Percentage */}
                        <div>
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-[11px] text-slate-400">Completion Progress</span>
                            <span className={`font-mono text-base font-black ${statusTheme.text}`}>
                              {currentSchedule.completionPercentage}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800/90 rounded-full h-2.5 p-0.5 border border-slate-700/80 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${statusTheme.bar}`}
                              style={{ width: `${Math.min(100, Math.max(0, currentSchedule.completionPercentage))}%` }}
                            />
                          </div>
                        </div>

                        {/* Verified Status Pill */}
                        <div className={`flex items-center justify-between p-2.5 rounded-lg border ${statusTheme.bg} ${statusTheme.border}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {statusTheme.icon}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Status</span>
                              <span className={`text-xs font-bold capitalize truncate ${statusTheme.text}`}>
                                {effectiveStatus(currentSchedule).replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-900/60 px-2 py-1 rounded">
                            {currentSchedule.completionPercentage}% Complete
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Timeline & Contractor Assignment (Strictly Read-Only Verified Data) */}
                <div className="modern-category-card">
                  <div className="modern-category-header">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-cyan-400" />
                      <span className="modern-category-title">Timeline & assignment</span>
                    </div>
                  </div>

                  <div className="p-3 space-y-2.5">
                    {/* Start and End Dates */}
                    <div className="inspector-date-grid">
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Start Date</span>
                        <span className="text-xs font-mono font-semibold text-slate-200">
                          {currentSchedule.startDate || '—'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">End Date</span>
                        <span className="text-xs font-mono font-semibold text-slate-200">
                          {currentSchedule.endDate || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Assignee / Contractor */}
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-1">Assignee / Contractor</span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-200 font-medium">
                        <User size={12} className="text-cyan-400 shrink-0" />
                        <span className="truncate">{currentSchedule.assignee || 'Unassigned in project schedule'}</span>
                      </div>
                    </div>

                    {/* Remarks & Notes */}
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-1">Remarks & Notes</span>
                      <p className="text-xs text-slate-300 italic leading-relaxed">
                        {currentSchedule.notes || 'No remarks recorded in schedule.'}
                      </p>
                    </div>

                    {/* Custom fields imported from Excel */}
                    {currentSchedule.customFields && Object.keys(currentSchedule.customFields).length > 0 && (
                      <div className="pt-2 border-t border-slate-700/60">
                        <label className="text-[10px] text-slate-400 block mb-1.5 font-semibold">
                          Custom Excel Properties
                        </label>
                        <div className="space-y-1">
                          {Object.entries(currentSchedule.customFields).map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center text-[11px] bg-slate-900/60 px-2 py-1 rounded">
                              <span className="text-slate-400 font-mono text-[10px]">{k}</span>
                              <span className="text-slate-200 font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Back to Project Inventory Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setUserSelectedIdent(null);
                      setIdentListSearch('');
                      setShowProjectInventory(true);
                    }}
                  >
                    <span>View All Project Saipem_IDENTs</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* ================= TAB 2: SAME Saipem_IDENT 3D ELEMENTS ================= */}
            {activeTab === 'elements' && (
              <div className="tab-pane space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">
                      Same Saipem_IDENT Elements
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      All 3D components in project matching <strong className="text-cyan-300 font-mono">{activeIdent}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-sm rounded-md font-medium transition-all shrink-0 ${isIsolated && isolatedIdent === activeIdent
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer'
                      : 'btn-primary'
                      }`}
                    onClick={handleIsolateActiveIdent}
                    title={
                      isIsolated && isolatedIdent === activeIdent
                        ? 'Show all model parts (exit isolation)'
                        : `Isolate all ${sameIdentDbIds.length} parts in 3D`
                    }
                  >
                    {isIsolated && isolatedIdent === activeIdent ? (
                      <>
                        <EyeOff size={11} />
                        <span>Show All</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={11} />
                        <span>Isolate All ({sameIdentDbIds.length})</span>
                      </>
                    )}
                  </button>
                </div>

                {sameIdentDbIds.length === 0 ? (
                  <div className="p-4 text-center rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400">
                    No 3D elements scanned with this Saipem_IDENT yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sameIdentDbIds.map((dbId, idx) => {
                      const isCurrentlySelected = selectedObject?.dbId === dbId;
                      return (
                        <div
                          key={dbId}
                          onClick={() => handleSelectDbId(dbId)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${isCurrentlySelected
                            ? 'bg-cyan-500/15 border-cyan-500/50 shadow-sm'
                            : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/70'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${isCurrentlySelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-700 text-cyan-400'
                              }`}>
                              <Box size={12} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {isCurrentlySelected && selectedObject?.name ? selectedObject.name : `Piece #${idx + 1}`}
                                </span>
                                {isCurrentlySelected && (
                                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded font-semibold">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">dbId: {dbId}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="text-cyan-400 hover:text-cyan-300 p-1"
                            title={`Focus piece #${dbId} in 3D`}
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 3: BIM IDENTITY & PROPERTIES ================= */}
            {activeTab === 'properties' && (
              <div className="tab-pane space-y-3">
                {/* Search Bar */}
                <div className="prop-search-container">
                  <Search size={14} className="prop-search-icon" />
                  <input
                    type="text"
                    placeholder={`Search ${filteredProps.length} identity parameters...`}
                    className="prop-search-field"
                    value={propSearch}
                    onChange={(e) => setPropSearch(e.target.value)}
                  />
                  {propSearch && (
                    <button
                      type="button"
                      onClick={() => setPropSearch('')}
                      className="prop-search-clear"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>
                    Showing <strong className="text-cyan-300">{filteredProps.length}</strong> related parameters
                  </span>
                  <button
                    type="button"
                    className="text-[10px] text-cyan-400 hover:underline"
                    onClick={() => setShowAllRawProps(!showAllRawProps)}
                  >
                    {showAllRawProps ? 'Show Relevant Only' : `Show All Raw (${rawProps.length})`}
                  </button>
                </div>

                {/* Categorized Properties */}
                {Object.keys(categoriesMap).length === 0 ? (
                  <div className="prop-empty-search">
                    <Search size={22} className="text-slate-500 mb-1.5 opacity-50" />
                    <p className="text-xs font-semibold text-slate-300">No matching parameters</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select another piece or search for dimensions/material.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(categoriesMap).map(([category, propsList]) => (
                      <div key={category} className="modern-category-card">
                        <div className="modern-category-header">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="category-icon-box">
                              <Tag size={12} className="text-cyan-400" />
                            </div>
                            <span className="modern-category-title truncate" title={category}>
                              {category}
                            </span>
                          </div>
                          <span className="modern-category-counter">{propsList.length}</span>
                        </div>
                        <div className="modern-props-table">
                          {propsList.map((p, idx) => {
                            const formattedVal = formatPropValue(p);
                            const formattedUnit = formatPropUnit(p.units);
                            const copyText = formattedUnit ? `${formattedVal} ${formattedUnit}` : formattedVal;

                            return (
                              <div key={idx} className="modern-prop-row">
                                <div className="modern-prop-key">
                                  <span title={p.displayName}>{p.displayName}</span>
                                </div>
                                <div
                                  className="modern-prop-value-wrapper"
                                  title="Click to copy value"
                                  onClick={() => {
                                    if (copyText && copyText !== '—') {
                                      navigator.clipboard.writeText(copyText);
                                    }
                                  }}
                                >
                                  <span className="modern-prop-value" title={copyText}>
                                    {formattedVal}
                                  </span>
                                  {formattedUnit && (
                                    <span className="modern-prop-unit" title={p.units}>
                                      {formattedUnit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ================= NO ACTIVE IDENT: PROJECT Saipem_IDENT REGISTRY ================= */
          <div className="space-y-3">
            {/* Search within Project Saipem_IDENTs */}
            <div className="prop-search-container">
              <Search size={14} className="prop-search-icon" />
              <input
                type="text"
                placeholder={`Search ${allProjectIdents.length} project Saipem_IDENTs...`}
                className="prop-search-field"
                value={identListSearch}
                onChange={(e) => setIdentListSearch(e.target.value)}
              />
              {identListSearch && (
                <button
                  type="button"
                  onClick={() => setIdentListSearch('')}
                  className="prop-search-clear"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                Project Parts: <strong className="text-slate-200">{filteredProjectIdents.length}</strong>
              </span>
              <span className="text-[10px] text-cyan-400 font-medium">Click to inspect same IDENT</span>
            </div>

            {filteredProjectIdents.length === 0 ? (
              <div className="p-4 text-center rounded-lg bg-slate-800/40 border border-slate-700/60 space-y-2">
                <FileSpreadsheet size={24} className="text-slate-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No project Saipem_IDENTs found</p>
                <p className="text-[11px] text-slate-500">
                  Upload an Excel schedule or click on a 3D element in the model to begin tracking.
                </p>
                <button
                  type="button"
                  className="btn-excel-open mx-auto mt-2"
                  onClick={onOpenExcelModal}
                >
                  <Sparkles size={12} />
                  <span>Import Project Excel</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjectIdents.map((id) => {
                  const schedule = findScheduleRecord(projectScheduleMap, id);
                  const modelPartsCount = modelIdentsMap[id]?.dbIds?.length || new Set(
                    Object.values(projectScheduleMap).filter((item) => item.saipemIdent === id && item.dbId != null).map((item) => item.dbId)
                  ).size;
                  const completion = schedule?.completionPercentage ?? 0;
                  const status = schedule ? effectiveStatus(schedule) : 'not_started';

                  return (
                    <div
                      key={id}
                      onClick={() => {
                        setShowProjectInventory(false);
                        setUserSelectedIdent(id);
                        if (onSelectSaipemIdent) {
                          onSelectSaipemIdent(id);
                        }
                        if (onIsolatePart) {
                          const targetDbIds = modelIdentsMap[id]?.dbIds;
                          onIsolatePart(undefined, id, targetDbIds);
                        }
                      }}
                      className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/40 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Hash size={13} className="text-cyan-400 shrink-0" />
                          <span className="font-mono font-bold text-xs text-cyan-300 truncate">
                            {id}
                          </span>
                        </div>
                        <span style={{ color: STATUS_COLORS[status], borderColor: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}26` }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : status === 'in_progress'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : status === 'delayed'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-slate-700/60 text-slate-300'
                          }`}>
                          {status.replace('_', ' ')}
                        </span>
                      </div>

                      {schedule?.elementName && (
                        <p className="text-[11px] text-slate-300 truncate font-medium">
                          {schedule.elementName}
                        </p>
                      )}

                      {/* Progress Bar & Model Parts Count */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>{modelPartsCount} {modelPartsCount === 1 ? 'part' : 'parts'} in 3D model</span>
                          <span className="font-mono font-bold" style={{ color: STATUS_COLORS[status] }}>{completion}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full transition-all"
                            style={{ width: `${completion}%`, background: STATUS_COLORS[status] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Manage in Excel Hub */}
      <div className="inspector-footer">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={onOpenExcelModal}
          title="Open Excel Data Hub to import/export project spreadsheets"
        >
          <FileSpreadsheet size={13} className="text-emerald-400" />
          <span>Project Excel Data Hub</span>
        </button>
      </div>
    </aside>
  );
};

export default InspectorPanel;
