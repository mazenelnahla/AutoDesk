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
  Filter,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  History
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
      <li className="tree-folder-node">
        <div
          className="folder-row"
          onClick={(e) => onToggleNode(item.id, 'folder', item, currentPath, e)}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="tree-arrow" />
          ) : (
            <ChevronRight size={14} className="tree-arrow" />
          )}
          {isExpanded ? (
            <FolderOpen size={16} className="folder-icon open" />
          ) : (
            <Folder size={16} className="folder-icon" />
          )}
          <span className="folder-name">{item.displayName}</span>
        </div>

        {isExpanded && (
          <div className="pl-4 border-l border-slate-700/40 ml-2 mt-1 space-y-1">
            {isLoadingSub ? (
              <div className="flex items-center gap-2 py-1 px-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin text-cyan-400" />
                <span>Loading contents...</span>
              </div>
            ) : folderContents.length === 0 ? (
              <div className="py-1 px-2 text-xs text-slate-500 italic">
                Empty folder
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

  // It's a file item (which can expand into versions)
  const versions = itemVersions[item.id] || [];
  const isSelected = selectedItem?.id === item.id || versions.some((v) => selectedItem?.versionUrn === v.id);

  return (
    <li className={`tree-item-group ${isSelected ? 'selected' : ''}`}>
      <div
        className={`file-row ${isSelected ? 'active-item' : ''}`}
        onClick={(e) => onToggleNode(item.id, 'item', item, currentPath, e)}
      >
        {isExpanded ? (
          <ChevronDown size={13} className="tree-arrow text-slate-400" />
        ) : (
          <ChevronRight size={13} className="tree-arrow text-slate-400" />
        )}
        <FileCode
          size={16}
          className={item.isRevit ? 'file-icon-revit' : 'file-icon-generic'}
        />
        <div className="file-details flex-1 min-w-0">
          <span className="file-name">{item.displayName}</span>
          <div className="file-meta">
            {item.size ? (
              <span className="file-size">{formatFileSize(item.size)}</span>
            ) : null}
            {item.lastModified && (
              <span className="file-date">
                <Clock size={11} />
                {new Date(item.lastModified).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="pl-4 border-l border-cyan-500/30 ml-3 mt-1 space-y-1">
          {isLoadingSub ? (
            <div className="flex items-center gap-2 py-1 px-2 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin text-cyan-400" />
              <span>Loading versions...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-1 px-2 text-xs text-slate-500 italic">
              No versions available
            </div>
          ) : (
            <ul className="file-tree-list">
              {versions.map((version) => {
                const isVersionSelected = selectedItem?.versionUrn === version.id;
                return (
                  <li
                    key={version.id}
                    className={`tree-version-node ${isVersionSelected ? 'selected-version' : ''}`}
                    onClick={() => onSelectVersion(version, item, currentPath)}
                  >
                    <div className="version-row flex items-center justify-between gap-2 py-1 px-2 rounded cursor-pointer hover:bg-cyan-500/10 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <History size={13} className="text-cyan-400 shrink-0" />
                        <span className="text-xs text-slate-300 truncate font-mono">
                          {version.name || 'Version'}
                        </span>
                      </div>
                      {isVersionSelected && (
                        <CheckCircle2 size={14} className="text-cyan-400 shrink-0" />
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
  const [expandedNodes, setExpandedNodes] = useState<{ [id: string]: boolean }>({});
  const [subNodes, setSubNodes] = useState<{ [folderId: string]: APSItem[] }>({});
  const [itemVersions, setItemVersions] = useState<{ [itemId: string]: APSVersion[] }>({});
  const [loadingNodes, setLoadingNodes] = useState<{ [id: string]: boolean }>({});

  // Reset node expansion and contents when switching projects
  useEffect(() => {
    setExpandedNodes({});
    setSubNodes({});
    setItemVersions({});
    setLoadingNodes({});
  }, [selectedProject?.id]);

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
        // Automatically fetch versions for this item
        if (!itemVersions[nodeId]) {
          setLoadingNodes((prev) => ({ ...prev, [nodeId]: true }));
          try {
            const versions = await fetchLiveItemVersions(selectedHub.id, selectedProject.id, nodeId);
            setItemVersions((prev) => ({ ...prev, [nodeId]: versions }));

            // If user clicked the item directly, load the newest version
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

  const rootPath = selectedHub && selectedProject ? `/${selectedHub.name}/${selectedProject.name}` : '';

  return (
    <aside className="sidebar-container">
      {/* Top Hubs & Projects Selector */}
      <div className="sidebar-section">
        <div className="selector-group">
          <label className="selector-label">
            <Building2 size={14} className="text-cyan-400" />
            <span>Autodesk Hub</span>
          </label>
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
              <option value="">No ACC / BIM 360 Hubs Found</option>
            ) : (
              hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.hubType.toUpperCase()})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="selector-group">
          <label className="selector-label">
            <HardDrive size={14} className="text-indigo-400" />
            <span>Project</span>
          </label>
          <select
            className="sidebar-select"
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const p = projects.find((proj) => proj.id === e.target.value);
              if (p) onSelectProject(p);
            }}
            disabled={!selectedHub || projects.length === 0}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="sidebar-search-bar">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className={`filter-badge-btn ${onlyRevit ? 'active' : ''}`}
          onClick={() => setOnlyRevit(!onlyRevit)}
          title="Show only .rvt Revit files"
        >
          <Filter size={13} />
          <span>.RVT only</span>
        </button>
      </div>

      {/* Folder Contents & File Tree */}
      <div className="sidebar-tree-container">
        <div className="tree-header">
          <Database size={14} className="text-cyan-400" />
          <span>Hub & Project Hierarchy</span>
        </div>

        {isLoading ? (
          <div className="tree-loading">
            <div className="spinner" />
            <p>Loading Autodesk BIM folder structure...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="tree-empty">
            <p>No files or folders found in this project.</p>
          </div>
        ) : (
          <ul className="file-tree-list">
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
        )}
      </div>
    </aside>
  );
};
