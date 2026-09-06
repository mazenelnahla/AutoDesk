import React, { useState } from 'react';
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
} from 'lucide-react';
import type { APSHub, APSProject, APSItem } from '../types/aps';

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
  accessToken?: string | null;
}

interface TreeNodeProps {
  item: APSItem;
  parentPath: string;
  selectedItem: APSItem | null;
  expandedFolders: { [id: string]: boolean };
  folderContents: { [folderId: string]: APSItem[] };
  loadingFolders: { [folderId: string]: boolean };
  filterItem: (item: APSItem) => boolean;
  onToggleFolder: (folderId: string, parentPath: string, e: React.MouseEvent) => void;
  onSelectItem: (item: APSItem) => void;
  formatFileSize: (bytes?: number) => string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  parentPath,
  selectedItem,
  expandedFolders,
  folderContents,
  loadingFolders,
  filterItem,
  onToggleFolder,
  onSelectItem,
  formatFileSize,
}) => {
  const isSelected = selectedItem?.id === item.id;
  const isExpanded = !!expandedFolders[item.id];
  const subItems = folderContents[item.id] || [];
  const isFolderLoading = !!loadingFolders[item.id];
  const currentPath = item.path || `${parentPath}/${item.displayName}`;

  if (item.isFolder) {
    return (
      <li className="tree-folder-node">
        <div
          className="folder-row"
          onClick={(e) => onToggleFolder(item.id, currentPath, e)}
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
            {isFolderLoading ? (
              <div className="flex items-center gap-2 py-1 px-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin text-cyan-400" />
                <span>Loading folder...</span>
              </div>
            ) : subItems.length === 0 ? (
              <div className="py-1 px-2 text-xs text-slate-500 italic">
                Empty folder
              </div>
            ) : (
              <ul className="file-tree-list">
                {subItems.filter(filterItem).map((subItem) => (
                  <TreeNode
                    key={subItem.id}
                    item={subItem}
                    parentPath={currentPath}
                    selectedItem={selectedItem}
                    expandedFolders={expandedFolders}
                    folderContents={folderContents}
                    loadingFolders={loadingFolders}
                    filterItem={filterItem}
                    onToggleFolder={onToggleFolder}
                    onSelectItem={onSelectItem}
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

  return (
    <li
      className={`tree-file-node ${isSelected ? 'selected' : ''} ${
        item.isRevit ? 'is-revit' : ''
      }`}
      onClick={() => onSelectItem({ ...item, path: currentPath })}
    >
      <div className="file-row">
        <FileCode
          size={16}
          className={item.isRevit ? 'file-icon-revit' : 'file-icon-generic'}
        />
        <div className="file-details">
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
        {isSelected && <CheckCircle2 size={16} className="text-cyan-400" />}
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
  accessToken,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRevit, setOnlyRevit] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<{ [id: string]: boolean }>({});
  const [folderContents, setFolderContents] = useState<{ [folderId: string]: APSItem[] }>({});
  const [loadingFolders, setLoadingFolders] = useState<{ [folderId: string]: boolean }>({});

  // Reset folder expansion and contents when switching projects
  React.useEffect(() => {
    setExpandedFolders({});
    setFolderContents({});
    setLoadingFolders({});
  }, [selectedProject?.id]);

  const toggleFolder = async (folderId: string, parentPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const willExpand = !expandedFolders[folderId];
    setExpandedFolders((prev) => ({ ...prev, [folderId]: willExpand }));

    if (willExpand && !folderContents[folderId] && selectedProject && accessToken) {
      setLoadingFolders((prev) => ({ ...prev, [folderId]: true }));
      try {
        const res = await fetch(
          `/api/data/projects/${selectedProject.id}/folders/${folderId}/contents`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (res.ok) {
          const data: APSItem[] = await res.json();
          const itemsWithFullPaths = data.map((d) => ({
            ...d,
            path: `${parentPath}/${d.displayName}`,
          }));
          setFolderContents((prev) => ({ ...prev, [folderId]: itemsWithFullPaths }));
        }
      } catch (err) {
        console.error('Error fetching subfolder contents:', err);
      } finally {
        setLoadingFolders((prev) => ({ ...prev, [folderId]: false }));
      }
    }
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
            placeholder="Search Revit (.rvt) files..."
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
          <span>Data Management Tree</span>
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
            {items.filter(filterItem).map((item) => (
              <TreeNode
                key={item.id}
                item={item}
                parentPath={rootPath}
                selectedItem={selectedItem}
                expandedFolders={expandedFolders}
                folderContents={folderContents}
                loadingFolders={loadingFolders}
                filterItem={filterItem}
                onToggleFolder={toggleFolder}
                onSelectItem={onSelectItem}
                formatFileSize={formatFileSize}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
