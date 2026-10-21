import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Building2,
  HardDrive,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  ArrowLeft,
  LayoutList,
  FolderTree,
  Home,
  X,
  Layers,
  MoreHorizontal,
  Bot,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type {
  APSHub,
  APSProject,
  APSItem,
  APSVersion,
  ViewerSelectedObject,
  ElementScheduleData,
  ScannedModelIdentMap,
  ProjectSection
} from '../types/aps';
import {
  fetchLiveContents,
  fetchLiveItemVersions,
  toUrlSafeBase64
} from '../services/apsData';
import { ChatbotSection } from './ChatbotSection';

interface SidebarProps {
  hubs: APSHub[];
  selectedHub: APSHub | null;
  onSelectHub: (hub: APSHub) => void;
  projects: APSProject[];
  selectedProject: APSProject | null;
  onSelectProject: (project: APSProject) => void;
  items: APSItem[];
  selectedItem: APSItem | null;
  onSelectItem: (item: APSItem) => void;
  isLoading: boolean;
  selectedObject?: ViewerSelectedObject | null;
  scheduleDataMap?: Record<string, ElementScheduleData>;
  modelIdentsMap?: ScannedModelIdentMap;
  modelSections?: ProjectSection[];
  isIsolated?: boolean;
  isolatedDbIds?: number[] | null;
  onIsolatePart?: (dbId?: number, ident?: string, dbIds?: number[]) => void;
  onClearIsolation?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface TreeItemNodeProps {
  hubId: string;
  projectId: string;
  item: APSItem;
  parentPath: string;
  selectedItem: APSItem | null;
  expandedNodes: { [id: string]: boolean };
  subNodes: { [id: string]: APSItem[] };
  loadingNodes: { [id: string]: boolean };
  filterItem: (item: APSItem) => boolean;
  onToggleFolder: (folderId: string, parentPath: string, e: React.MouseEvent) => void;
  onSelectModel: (item: APSItem, parentPath: string) => void;
  formatFileSize: (bytes?: number) => string;
}

const TreeItemNode: React.FC<TreeItemNodeProps> = ({
  hubId,
  projectId,
  item,
  parentPath,
  selectedItem,
  expandedNodes,
  subNodes,
  loadingNodes,
  filterItem,
  onToggleFolder,
  onSelectModel,
  formatFileSize,
}) => {
  const isExpanded = !!expandedNodes[item.id];
  const isLoadingSub = !!loadingNodes[item.id];
  const currentPath = item.path || `${parentPath}/${item.displayName}`;

  if (item.isFolder) {
    const folderContents = subNodes[item.id] || [];

    return (
      <li className="tree-node tree-folder-node">
        <div
          className={`folder-row ${isExpanded ? 'expanded' : ''}`}
          onClick={(e) => onToggleFolder(item.id, currentPath, e)}
        >
          <button
            type="button"
            className="tree-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFolder(item.id, currentPath, e);
            }}
            aria-label="Expand folder"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="tree-arrow" />
            ) : (
              <ChevronRight size={14} className="tree-arrow" />
            )}
          </button>
          {isExpanded ? (
            <FolderOpen size={16} className="folder-icon open shrink-0" />
          ) : (
            <Folder size={16} className="folder-icon shrink-0" />
          )}
          <span className="folder-name truncate" title={item.displayName}>
            {item.displayName}
          </span>
          {folderContents.length > 0 && isExpanded && (
            <span className="folder-count-badge">
              {folderContents.length}
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="tree-children pl-4 border-l-2 border-slate-700/60 ml-3.5 my-1 space-y-1">
            {isLoadingSub ? (
              <div className="flex items-center gap-2 py-2 px-2.5 text-xs text-slate-400 bg-slate-900/40 rounded-md">
                <Loader2 size={13} className="animate-spin text-cyan-400" />
                <span>Loading folder contents...</span>
              </div>
            ) : folderContents.length === 0 ? (
              <div className="py-2 px-3 text-xs text-slate-500 italic bg-slate-900/30 rounded-md">
                No items in folder
              </div>
            ) : (
              <ul className="file-tree-list">
                {folderContents.filter(filterItem).map((subItem) => (
                  <TreeItemNode
                    key={subItem.id}
                    hubId={hubId}
                    projectId={projectId}
                    item={subItem}
                    parentPath={currentPath}
                    selectedItem={selectedItem}
                    expandedNodes={expandedNodes}
                    subNodes={subNodes}
                    loadingNodes={loadingNodes}
                    filterItem={filterItem}
                    onToggleFolder={onToggleFolder}
                    onSelectModel={onSelectModel}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  }

  // File / Model item
  const isSelected =
    selectedItem?.id === item.id ||
    (item.versionUrn && selectedItem?.versionUrn === item.versionUrn);
  const isLoading = !!loadingNodes[item.id];

  return (
    <li className={`tree-node tree-file-node ${isSelected ? 'selected' : ''}`}>
      <div
        className={`file-row ${isSelected ? 'active-item' : ''}`}
        onClick={() => onSelectModel(item, parentPath)}
      >
        <div className={`file-icon-wrapper ${item.isRevit ? 'revit-wrapper' : 'generic-wrapper'}`}>
          <FileCode
            size={15}
            className={`shrink-0 ${item.isRevit ? 'file-icon-revit' : 'file-icon-generic'}`}
          />
        </div>
        <div className="file-details flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="file-name" title={item.displayName}>
              {item.displayName}
            </span>
            {item.isRevit && (
              <span className="file-type-pill">BIM</span>
            )}
          </div>
          <div className="file-meta">
            {item.size ? (
              <span className="file-size">{formatFileSize(item.size)}</span>
            ) : null}
            {item.lastModified && (
              <span className="file-date">
                <Clock size={10} />
                {new Date(item.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="file-action-status shrink-0 flex items-center">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-cyan-400" />
          ) : isSelected ? (
            <CheckCircle2 size={15} className="text-cyan-400" />
          ) : null}
        </div>
      </div>
    </li>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  hubs,
  selectedHub,
  onSelectHub,
  projects,
  selectedProject,
  onSelectProject,
  items,
  selectedItem,
  onSelectItem,
  isLoading,
  selectedObject,
  scheduleDataMap = {},
  modelIdentsMap = {},
  modelSections = [],
  isIsolated = false,
  isolatedDbIds = null,
  onIsolatePart = () => {},
  onClearIsolation = () => {},
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'window' | 'tree'>('window');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'ai_chat'>('explorer');
  const [isWideMode, setIsWideMode] = useState(false);

  // Window drilldown breadcrumbs history: list of { id, name, path }
  const [folderPathHistory, setFolderPathHistory] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Project Root' },
  ]);

  const [expandedNodes, setExpandedNodes] = useState<{ [id: string]: boolean }>({});
  const [subNodes, setSubNodes] = useState<{ [folderId: string]: APSItem[] }>({});
  const [itemVersions, setItemVersions] = useState<{ [itemId: string]: APSVersion[] }>({});
  const [loadingNodes, setLoadingNodes] = useState<{ [id: string]: boolean }>({});
  const [loadingFolderContents, setLoadingFolderContents] = useState<boolean>(false);
  const [isBreadcrumbDropdownOpen, setIsBreadcrumbDropdownOpen] = useState<boolean>(false);
  const breadcrumbDropdownRef = useRef<HTMLDivElement>(null);

  // Close breadcrumb dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        breadcrumbDropdownRef.current &&
        !breadcrumbDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBreadcrumbDropdownOpen(false);
      }
    };
    if (isBreadcrumbDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isBreadcrumbDropdownOpen]);

  // Reset folder navigation and cache when project or hub changes
  useEffect(() => {
    setFolderPathHistory([{ id: null, name: selectedProject ? selectedProject.name : 'Project Root' }]);
    setExpandedNodes({});
    setSubNodes({});
    setItemVersions({});
    setLoadingNodes({});
  }, [selectedProject?.id, selectedHub?.id]);

  const rootPath = selectedHub && selectedProject ? `/${selectedHub.name}/${selectedProject.name}` : '';
  const currentFolder = folderPathHistory[folderPathHistory.length - 1];

  // Load folder contents for window view drilldown
  const openFolderInWindow = async (folder: APSItem) => {
    if (!selectedHub || !selectedProject) return;
    if (selectedProject.hubId && selectedProject.hubId !== selectedHub.id) return;

    setFolderPathHistory((prev) => [...prev, { id: folder.id, name: folder.displayName }]);

    if (!subNodes[folder.id]) {
      setLoadingFolderContents(true);
      try {
        const contents = await fetchLiveContents(selectedHub.id, selectedProject.id, folder.id);
        const mapped = contents.map((c) => ({
          ...c,
          path: `${folder.path || rootPath}/${c.displayName}`,
        }));
        setSubNodes((prev) => ({ ...prev, [folder.id]: mapped }));
      } catch (err) {
        console.error('Failed to load folder contents in window view:', err);
      } finally {
        setLoadingFolderContents(false);
      }
    }
  };

  const navigateBack = () => {
    if (folderPathHistory.length > 1) {
      setFolderPathHistory((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setFolderPathHistory((prev) => prev.slice(0, index + 1));
  };

  const handleToggleFolder = async (
    folderId: string,
    parentPath: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!selectedHub || !selectedProject) return;
    if (selectedProject.hubId && selectedProject.hubId !== selectedHub.id) return;

    const willExpand = !expandedNodes[folderId];
    setExpandedNodes((prev) => ({ ...prev, [folderId]: willExpand }));

    if (willExpand && !subNodes[folderId]) {
      setLoadingNodes((prev) => ({ ...prev, [folderId]: true }));
      try {
        const contents = await fetchLiveContents(selectedHub.id, selectedProject.id, folderId);
        const mapped = contents.map((c) => ({
          ...c,
          path: `${parentPath}/${c.displayName}`,
        }));
        setSubNodes((prev) => ({ ...prev, [folderId]: mapped }));
      } catch (err) {
        console.error('Failed to load folder contents:', err);
      } finally {
        setLoadingNodes((prev) => ({ ...prev, [folderId]: false }));
      }
    }
  };

  const handleSelectModel = async (item: APSItem, parentPath: string) => {
    const fullPath = item.path || `${parentPath}/${item.displayName}`;

    // If item already has versionUrn and base64Urn, select immediately
    if (item.versionUrn && item.base64Urn) {
      onSelectItem({
        ...item,
        path: fullPath,
      });
      return;
    }

    // If cached versions exist
    const cached = itemVersions[item.id];
    if (cached && cached.length > 0) {
      const latest = cached[0];
      const safeUrn = toUrlSafeBase64(latest.id);
      onSelectItem({
        ...item,
        path: fullPath,
        versionUrn: latest.id,
        base64Urn: safeUrn,
      });
      return;
    }

    // Otherwise fetch version
    if (!selectedHub || !selectedProject) return;
    setLoadingNodes((prev) => ({ ...prev, [item.id]: true }));
    try {
      const versions = await fetchLiveItemVersions(selectedHub.id, selectedProject.id, item.id);
      setItemVersions((prev) => ({ ...prev, [item.id]: versions }));

      if (versions.length > 0) {
        const latest = versions[0];
        const safeUrn = toUrlSafeBase64(latest.id);
        onSelectItem({
          ...item,
          path: fullPath,
          versionUrn: latest.id,
          base64Urn: safeUrn,
        });
      } else {
        onSelectItem({
          ...item,
          path: fullPath,
        });
      }
    } catch (err) {
      console.error('Failed to load item versions:', err);
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const filterItem = (item: APSItem): boolean => {
    if (searchQuery.trim()) {
      return item.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Get active items to display for the window drilldown view
  const currentWindowItems = currentFolder.id === null ? items : subNodes[currentFolder.id] || [];
  const filteredWindowItems = currentWindowItems.filter(filterItem);
  const folderCount = filteredWindowItems.filter((i) => i.isFolder).length;
  const fileCount = filteredWindowItems.filter((i) => !i.isFolder).length;

  return (
    <aside className={`sidebar-container ${isWideMode ? 'sidebar-wide' : ''} ${activeSidebarTab === 'ai_chat' ? 'full-chatbot-active' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Vertical Side Navigation Buttons Rail */}
      <div className="sidebar-side-rail">
        <div className="rail-buttons-top">
          <button
            type="button"
            className={`side-rail-btn ${activeSidebarTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('explorer')}
            title="BIM Model Explorer & Files"
          >
            <FolderTree size={18} />
            <span className="side-rail-label">Files</span>
          </button>

          <button
            type="button"
            className={`side-rail-btn ${activeSidebarTab === 'ai_chat' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('ai_chat')}
            title="Full AI Chatbot (LM Studio)"
          >
            <div className="side-rail-icon-wrap">
              <Bot size={18} />
              <span className="side-rail-status-dot" />
            </div>
            <span className="side-rail-label">AI Chat</span>
          </button>
        </div>

        <div className="rail-buttons-bottom">
          {onToggleCollapse && (
            <button
              type="button"
              className="side-rail-btn side-rail-collapse-btn"
              onClick={onToggleCollapse}
              title="Collapse Left Sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <button
            type="button"
            className={`side-rail-btn side-rail-size-btn ${isWideMode ? 'active' : ''}`}
            onClick={() => setIsWideMode(!isWideMode)}
            title={isWideMode ? 'Standard sidebar width' : 'Expand sidebar width'}
          >
            {isWideMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="sidebar-main-content">
        {activeSidebarTab === 'ai_chat' ? (
          <div className="full-chatbot-pane">
            <ChatbotSection
              selectedItem={selectedItem}
              selectedProject={selectedProject}
              selectedObject={selectedObject || null}
              scheduleDataMap={scheduleDataMap}
              modelIdentsMap={modelIdentsMap}
              modelSections={modelSections}
              isIsolated={isIsolated}
              isolatedDbIds={isolatedDbIds}
              onIsolatePart={onIsolatePart}
              onClearIsolation={onClearIsolation}
              onToggleCollapse={onToggleCollapse}
            />
          </div>
        ) : (
          <div className="sidebar-explorer-pane">
            {/* Top Hubs & Projects Selector Header */}
            <div className="sidebar-section">
              <div className="selector-group">
                <div className="flex items-center justify-between">
                  <label className="selector-label">
                    <Building2 size={13} className="text-cyan-400" />
                    <span>ACC / BIM 360 Hub</span>
                  </label>
                  {onToggleCollapse && (
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={onToggleCollapse}
                      title="Collapse Left Sidebar"
                    >
                      <ChevronLeft size={14} />
                    </button>
                  )}
                </div>
                <div className="select-wrapper">
                  <select
                    className="sidebar-select"
                    value={selectedHub?.id || ''}
                    onChange={(e) => {
                      const h = hubs.find((hub) => hub.id === e.target.value);
                      if (h) onSelectHub(h);
                    }}
                    disabled={hubs.length === 0}
                  >
                    {hubs.length === 0 ? (
                      <option value="">No Hubs Connected</option>
                    ) : (
                      hubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.hubType.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>

              <div className="selector-group">
                <label className="selector-label">
                  <HardDrive size={13} className="text-indigo-400" />
                  <span>Active Project</span>
                </label>
                <div className="select-wrapper">
                  <select
                    className="sidebar-select"
                    value={selectedProject?.id || ''}
                    onChange={(e) => {
                      const p = projects.find((proj) => proj.id === e.target.value);
                      if (p) onSelectProject(p);
                    }}
                    disabled={!selectedHub || projects.length === 0}
                  >
                    {projects.length === 0 ? (
                      <option value="">No Projects Found</option>
                    ) : (
                      projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="sidebar-search-bar">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search BIM files & folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Folder Contents & File Tree Container */}
      <div className="sidebar-tree-container">
        <div className="tree-header-row flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">

            <div className="flex items-baseline gap-2 min-w-0">
              <Database size={14} className="text-cyan-400" />
              <span className="text-[13px] font-semibold text-slate-100 tracking-tight whitespace-nowrap">Explorer</span>
              <div className="header-counter-row flex items-center gap-1">
                <span className="counter-pill">{folderCount} {folderCount === 1 ? 'folder' : 'folders'}</span>
                <span className="counter-bullet">·</span>
                <span className="counter-pill">{fileCount} {fileCount === 1 ? 'model' : 'models'}</span>
              </div>
            </div>
          </div>

          {/* Single Button Toggle for Tree View vs Folder View */}
          <button
            type="button"
            className="single-view-toggle-btn shrink-0"
            onClick={() => setViewMode(viewMode === 'window' ? 'tree' : 'window')}
            title={
              viewMode === 'window'
                ? 'Switch to Indented Tree View'
                : 'Switch to Folder Window View'
            }
          >
            {viewMode === 'window' ? (
              <>
                <FolderTree size={13} className="text-cyan-400" />
                <span>Tree View</span>
              </>
            ) : (
              <>
                <LayoutList size={13} className="text-indigo-400" />
                <span>Folder View</span>
              </>
            )}
          </button>
        </div>

        {/* WINDOW DRILLDOWN MODE HEADER WITH BACK BUTTON & BREADCRUMBS */}
        {viewMode === 'window' && (
          <div className="folder-window-nav">
            <button
              type="button"
              className="back-nav-btn"
              onClick={navigateBack}
              disabled={folderPathHistory.length <= 1}
              title={
                folderPathHistory.length > 1
                  ? `Up to: ${folderPathHistory[folderPathHistory.length - 2].name}`
                  : 'At project root directory'
              }
            >
              <ArrowLeft size={13} />
            </button>

            {/* Non-Scrollable Responsive Breadcrumb Route */}
            <div
              className="breadcrumb-trail"
              title={folderPathHistory.map((c) => c.name).join(' / ')}
            >
              {folderPathHistory.length === 1 ? (
                /* Single Level: Root */
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(0)}
                  className="breadcrumb-item active"
                  title={folderPathHistory[0].name}
                >
                  <Home size={12} className="text-cyan-400 shrink-0" />
                  <span className="truncate">{folderPathHistory[0].name}</span>
                </button>
              ) : folderPathHistory.length === 2 ? (
                /* 2 Levels: Root > Current */
                <>
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(0)}
                    className="breadcrumb-item shrink-0"
                    title={folderPathHistory[0].name}
                  >
                    <Home size={11} className="shrink-0" />
                    <span className="truncate max-w-[85px]">{folderPathHistory[0].name}</span>
                  </button>

                  <ChevronRight size={11} className="breadcrumb-separator" />

                  <button
                    type="button"
                    className="breadcrumb-item active flex-1 min-w-0"
                    title={folderPathHistory[1].name}
                  >
                    <FolderOpen size={12} className="text-cyan-400 shrink-0" />
                    <span className="truncate text-cyan-300 font-semibold">{folderPathHistory[1].name}</span>
                  </button>
                </>
              ) : (
                /* 3+ Levels: Root > ... (Dropdown) > Current */
                <>
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(0)}
                    className="breadcrumb-item shrink-0"
                    title={`Root: ${folderPathHistory[0].name}`}
                  >
                    <Home size={11} className="shrink-0" />
                  </button>

                  <ChevronRight size={11} className="breadcrumb-separator" />

                  {/* Intermediate Ancestors Popover Trigger */}
                  <div className="relative inline-flex items-center" ref={breadcrumbDropdownRef} style={{ zIndex: 60 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBreadcrumbDropdownOpen(!isBreadcrumbDropdownOpen);
                      }}
                      className={`breadcrumb-ellipsis-btn ${isBreadcrumbDropdownOpen ? 'active' : ''}`}
                      title="View ancestor folder hierarchy"
                    >
                      <MoreHorizontal size={13} />
                    </button>

                    {isBreadcrumbDropdownOpen && (
                      <div className="breadcrumb-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="breadcrumb-dropdown-header">Jump to parent folder</div>
                        {folderPathHistory.slice(1, folderPathHistory.length - 1).map((crumb, sliceIdx) => {
                          const origIdx = sliceIdx + 1;
                          return (
                            <button
                              key={origIdx}
                              type="button"
                              className="breadcrumb-dropdown-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToBreadcrumb(origIdx);
                                setIsBreadcrumbDropdownOpen(false);
                              }}
                              title={crumb.name}
                            >
                              <Folder size={12} className="text-indigo-400 shrink-0" />
                              <span className="truncate">{crumb.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <ChevronRight size={11} className="breadcrumb-separator" />

                  {/* Current Active Folder */}
                  <button
                    type="button"
                    className="breadcrumb-item active flex-1 min-w-0"
                    title={folderPathHistory[folderPathHistory.length - 1].name}
                  >
                    <FolderOpen size={12} className="text-cyan-400 shrink-0" />
                    <span className="truncate text-cyan-300 font-semibold">
                      {folderPathHistory[folderPathHistory.length - 1].name}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {isLoading || loadingFolderContents ? (
          <div className="tree-loading">
            <div className="spinner-glow" />
            <p className="text-xs text-slate-400 font-medium">Syncing Autodesk Platform Data...</p>
          </div>
        ) : viewMode === 'window' ? (
          /* WINDOW DRILLDOWN VIEW */
          filteredWindowItems.length === 0 ? (
            <div className="tree-empty">
              <Layers size={28} className="text-slate-600 mb-2 opacity-60" />
              <p className="text-xs text-slate-400 font-medium">No items found in this directory</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Upload models to Autodesk Construction Cloud or BIM 360.</p>
            </div>
          ) : (
            <ul className="file-tree-list space-y-1.5">
              {filteredWindowItems.map((item) => {
                if (item.isFolder) {
                  const subCount = (subNodes[item.id] || []).length;
                  return (
                    <li key={item.id} className="tree-node">
                      <div
                        className="folder-window-card"
                        onClick={() => openFolderInWindow(item)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="folder-icon-circle">
                            <Folder size={16} className="text-indigo-400" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-xs text-slate-200 truncate">{item.displayName}</span>
                            <span className="text-[10px] text-slate-500">
                              {subCount > 0 ? `${subCount} items inside` : 'Folder'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs open-action">
                          <span className="text-[11px]">Open</span>
                          <ChevronRight size={13} />
                        </div>
                      </div>
                    </li>
                  );
                }

                // File node in window view
                return selectedHub && selectedProject ? (
                  <TreeItemNode
                    key={item.id}
                    hubId={selectedHub.id}
                    projectId={selectedProject.id}
                    item={item}
                    parentPath={currentFolder.name}
                    selectedItem={selectedItem}
                    expandedNodes={expandedNodes}
                    subNodes={subNodes}
                    loadingNodes={loadingNodes}
                    filterItem={filterItem}
                    onToggleFolder={handleToggleFolder}
                    onSelectModel={handleSelectModel}
                    formatFileSize={formatFileSize}
                  />
                ) : null;
              })}
            </ul>
          )
        ) : (
          /* INDENTED TREE VIEW */
          items.length === 0 ? (
            <div className="tree-empty">
              <Layers size={28} className="text-slate-600 mb-2 opacity-60" />
              <p className="text-xs text-slate-400 font-medium">No files or folders found in this project</p>
            </div>
          ) : (
            <ul className="file-tree-list space-y-1">
              {selectedHub && selectedProject && items.filter(filterItem).map((item) => (
                <TreeItemNode
                  key={item.id}
                  hubId={selectedHub.id}
                  projectId={selectedProject.id}
                  item={item}
                  parentPath={rootPath}
                  selectedItem={selectedItem}
                  expandedNodes={expandedNodes}
                  subNodes={subNodes}
                  loadingNodes={loadingNodes}
                  filterItem={filterItem}
                  onToggleFolder={handleToggleFolder}
                  onSelectModel={handleSelectModel}
                  formatFileSize={formatFileSize}
                />
              ))}
            </ul>
          )
        )}
      </div>
          </div>
        )}
      </div>
    </aside>
  );
};

