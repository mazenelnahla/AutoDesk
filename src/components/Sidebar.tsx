import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  ChevronRight,
  ChevronDown,
  Building2,
  HardDrive,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  History,
  ArrowLeft,
  LayoutList,
  FolderTree,
  Home,
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import type { APSHub, APSProject, APSItem, APSVersion } from '../types/aps';
import {
  fetchLiveContents,
  fetchLiveItemVersions,
  toUrlSafeBase64
} from '../services/apsData';

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
}

interface TreeItemNodeProps {
  hubId: string;
  projectId: string;
  item: APSItem;
  parentPath: string;
  selectedItem: APSItem | null;
  expandedNodes: { [id: string]: boolean };
  subNodes: { [id: string]: APSItem[] };
  itemVersions: { [itemId: string]: APSVersion[] };
  loadingNodes: { [id: string]: boolean };
  filterItem: (item: APSItem) => boolean;
  onToggleNode: (nodeId: string, nodeType: 'folder' | 'item', item: APSItem, parentPath: string, e: React.MouseEvent) => void;
  onSelectVersion: (version: APSVersion, item: APSItem, fullPath: string) => void;
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
  itemVersions,
  loadingNodes,
  filterItem,
  onToggleNode,
  onSelectVersion,
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
          onClick={(e) => onToggleNode(item.id, 'folder', item, currentPath, e)}
        >
          <button
            type="button"
            className="tree-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleNode(item.id, 'folder', item, currentPath, e);
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
                    itemVersions={itemVersions}
                    loadingNodes={loadingNodes}
                    filterItem={filterItem}
                    onToggleNode={onToggleNode}
                    onSelectVersion={onSelectVersion}
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

  // File item
  const versions = itemVersions[item.id] || [];
  const isSelected =
    selectedItem?.id === item.id ||
    versions.some((v) => selectedItem?.versionUrn === v.id);

  return (
    <li className={`tree-node tree-file-node ${isSelected ? 'selected' : ''}`}>
      <div
        className={`file-row ${isSelected ? 'active-item' : ''}`}
        onClick={(e) => {
          onToggleNode(item.id, 'item', item, currentPath, e);
        }}
      >
        <button
          type="button"
          className="tree-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleNode(item.id, 'item', item, currentPath, e);
          }}
          title="Toggle model versions"
        >
          {isExpanded ? (
            <ChevronDown size={13} className="tree-arrow text-cyan-400" />
          ) : (
            <ChevronRight size={13} className="tree-arrow text-slate-400" />
          )}
        </button>
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
      </div>

      {isExpanded && (
        <div className="tree-children pl-4 border-l-2 border-cyan-500/40 ml-3.5 my-1.5 space-y-1">
          {isLoadingSub ? (
            <div className="flex items-center gap-2 py-2 px-2.5 text-xs text-slate-400 bg-slate-900/40 rounded-md">
              <Loader2 size={13} className="animate-spin text-cyan-400" />
              <span>Fetching model versions...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-2 px-3 text-xs text-slate-500 italic bg-slate-900/30 rounded-md">
              No version history
            </div>
          ) : (
            <ul className="file-tree-list">
              {versions.map((version) => {
                const isVersionSelected = selectedItem?.versionUrn === version.id;
                return (
                  <li
                    key={version.id}
                    className={`tree-version-node ${isVersionSelected ? 'selected-version' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVersion(version, item, currentPath);
                    }}
                  >
                    <div className="version-row flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md cursor-pointer transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <History size={13} className="text-cyan-400 shrink-0" />
                        <span className="text-xs text-slate-300 truncate font-mono">
                          {version.name || 'Version'}
                        </span>
                      </div>
                      {isVersionSelected ? (
                        <CheckCircle2 size={14} className="text-cyan-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Load</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRevit, setOnlyRevit] = useState(false);
  const [viewMode, setViewMode] = useState<'window' | 'tree'>('window');

  // Window drilldown breadcrumbs history: list of { id, name, path }
  const [folderPathHistory, setFolderPathHistory] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Project Root' },
  ]);

  const [expandedNodes, setExpandedNodes] = useState<{ [id: string]: boolean }>({});
  const [subNodes, setSubNodes] = useState<{ [folderId: string]: APSItem[] }>({});
  const [itemVersions, setItemVersions] = useState<{ [itemId: string]: APSVersion[] }>({});
  const [loadingNodes, setLoadingNodes] = useState<{ [id: string]: boolean }>({});
  const [loadingFolderContents, setLoadingFolderContents] = useState<boolean>(false);

  // Reset folder navigation and cache when project changes
  useEffect(() => {
    setFolderPathHistory([{ id: null, name: selectedProject ? selectedProject.name : 'Project Root' }]);
    setExpandedNodes({});
    setSubNodes({});
    setItemVersions({});
    setLoadingNodes({});
  }, [selectedProject?.id]);

  const rootPath = selectedHub && selectedProject ? `/${selectedHub.name}/${selectedProject.name}` : '';
  const currentFolder = folderPathHistory[folderPathHistory.length - 1];

  // Load folder contents for window view drilldown
  const openFolderInWindow = async (folder: APSItem) => {
    if (!selectedHub || !selectedProject) return;

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

  const handleToggleNode = async (
    nodeId: string,
    nodeType: 'folder' | 'item',
    item: APSItem,
    parentPath: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!selectedHub || !selectedProject) return;

    const willExpand = !expandedNodes[nodeId];
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: willExpand }));

    if (willExpand) {
      if (nodeType === 'folder' && !subNodes[nodeId]) {
        setLoadingNodes((prev) => ({ ...prev, [nodeId]: true }));
        try {
          const contents = await fetchLiveContents(selectedHub.id, selectedProject.id, nodeId);
          const mapped = contents.map((c) => ({
            ...c,
            path: `${parentPath}/${c.displayName}`,
          }));
          setSubNodes((prev) => ({ ...prev, [nodeId]: mapped }));
        } catch (err) {
          console.error('Failed to load folder contents:', err);
        } finally {
          setLoadingNodes((prev) => ({ ...prev, [nodeId]: false }));
        }
      } else if (nodeType === 'item') {
        if (!itemVersions[nodeId]) {
          setLoadingNodes((prev) => ({ ...prev, [nodeId]: true }));
          try {
            const versions = await fetchLiveItemVersions(selectedHub.id, selectedProject.id, nodeId);
            setItemVersions((prev) => ({ ...prev, [nodeId]: versions }));

            if (versions.length > 0) {
              const latestVersion = versions[0];
              const safeUrn = toUrlSafeBase64(latestVersion.id);
              onSelectItem({
                ...item,
                path: `${parentPath} (${latestVersion.name})`,
                versionUrn: latestVersion.id,
                base64Urn: safeUrn,
              });
            }
          } catch (err) {
            console.error('Failed to load item versions:', err);
          } finally {
            setLoadingNodes((prev) => ({ ...prev, [nodeId]: false }));
          }
        }
      }
    }
  };

  const handleSelectVersion = (version: APSVersion, item: APSItem, fullPath: string) => {
    const safeUrn = toUrlSafeBase64(version.id);
    onSelectItem({
      ...item,
      path: `${fullPath} (${version.name})`,
      versionUrn: version.id,
      base64Urn: safeUrn,
    });
  };

  const filterItem = (item: APSItem): boolean => {
    if (onlyRevit && !item.isFolder && !item.isRevit) {
      return false;
    }
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
    <aside className="sidebar-container">
      {/* Top Hubs & Projects Selector Header */}
      <div className="sidebar-section">
        <div className="selector-group">
          <label className="selector-label">
            <Building2 size={13} className="text-cyan-400" />
            <span>ACC / BIM 360 Hub</span>
          </label>
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
        <button
          className={`filter-badge-btn ${onlyRevit ? 'active' : ''}`}
          onClick={() => setOnlyRevit(!onlyRevit)}
          title="Show only .rvt Revit 3D models"
        >
          <Sparkles size={12} />
          <span>.RVT</span>
        </button>
      </div>

      {/* Folder Contents & File Tree Container */}
      <div className="sidebar-tree-container">
        <div className="tree-header-row flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">

            <div className="flex items-baseline gap-2 min-w-0">
              <Database size={14} className="text-cyan-400" />
              <span className="text-[13px] font-semibold text-slate-100 tracking-tight whitespace-nowrap">Cloud Explorer</span>
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
              title="Go back to parent folder"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>

            {/* Breadcrumb Trail */}
            <div className="breadcrumb-trail">
              {folderPathHistory.map((crumb, idx) => {
                const isLast = idx === folderPathHistory.length - 1;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="breadcrumb-separator">/</span>}
                    <button
                      type="button"
                      onClick={() => navigateToBreadcrumb(idx)}
                      className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                      title={crumb.name}
                    >
                      {idx === 0 ? <Home size={11} className="shrink-0" /> : null}
                      <span className="truncate max-w-[110px]">{crumb.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}
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
                    itemVersions={itemVersions}
                    loadingNodes={loadingNodes}
                    filterItem={filterItem}
                    onToggleNode={handleToggleNode}
                    onSelectVersion={handleSelectVersion}
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
                  itemVersions={itemVersions}
                  loadingNodes={loadingNodes}
                  filterItem={filterItem}
                  onToggleNode={handleToggleNode}
                  onSelectVersion={handleSelectVersion}
                  formatFileSize={formatFileSize}
                />
              ))}
            </ul>
          )
        )}
      </div>
    </aside>
  );
};

