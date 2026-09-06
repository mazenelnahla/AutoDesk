import React, { useState, useEffect } from 'react';
import {
  FileText,
  Grid,
  Share2,
  HardDrive,
  Calendar,
  Layers,
  FileType,
  Box,
  Tag,
  Search,
  X
} from 'lucide-react';
import type { APSItem, ViewerSelectedObject } from '../types/aps';
import { formatPropUnit, formatPropValue } from '../utils/unitMap';

interface InspectorPanelProps {
  selectedItem: APSItem | null;
  selectedObject?: ViewerSelectedObject | null;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedItem,
  selectedObject,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'properties'>('details');
  const [propSearch, setPropSearch] = useState('');

  // Automatically switch to Properties tab when user clicks/selects an element in the 3D model
  useEffect(() => {
    if (selectedObject) {
      setActiveTab('properties');
    }
  }, [selectedObject]);

  if (!selectedItem) {
    return (
      <aside className="inspector-panel empty">
        <div className="inspector-placeholder">
          <FileText size={32} className="text-slate-600 mb-2" />
          <p className="font-semibold text-slate-300">No model loaded</p>
          <p className="text-xs text-slate-500 mt-1">
            Choose a file from the cloud explorer to inspect its metadata and 3D object properties.
          </p>
        </div>
      </aside>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  };

  // Group 3D properties by category
  const rawProps = selectedObject?.properties || [];
  const filteredProps = rawProps.filter((p) => {
    if (!propSearch.trim()) return !p.hidden;
    const q = propSearch.toLowerCase();
    const formattedVal = formatPropValue(p).toLowerCase();
    return (
      (p.displayName && p.displayName.toLowerCase().includes(q)) ||
      formattedVal.includes(q) ||
      (p.displayCategory && p.displayCategory.toLowerCase().includes(q))
    );
  });

  const categoriesMap: { [cat: string]: typeof filteredProps } = {};
  filteredProps.forEach((p) => {
    const cat = p.displayCategory || 'General Parameters';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(p);
  });

  return (
    <aside className="inspector-panel">
      {/* File Header */}
      <div className="inspector-header">
        <div className="flex items-start justify-between">
          <div className="w-full">
            <span className="rvt-badge">
              {selectedItem.isRevit ? 'Revit BIM Model' : selectedItem.extension ? `${selectedItem.extension.toUpperCase()} File` : 'Cloud Asset'}
            </span>
            <h3 className="inspector-filename" title={selectedItem.path || selectedItem.displayName}>
              {selectedItem.displayName}
            </h3>
            {selectedItem.path && (
              <p className="text-[11px] text-slate-400 font-mono mt-1 break-all leading-tight">
                {selectedItem.path}
              </p>
            )}
          </div>
        </div>

        {selectedObject ? (
          <div className="selected-object-chip mt-2.5 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Box size={14} className="text-cyan-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-cyan-300 truncate">{selectedObject.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">dbId: {selectedObject.dbId}</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
              Selected
            </span>
          </div>
        ) : (
          <div className="file-quick-meta">
            <div className="meta-chip">
              <span className="label">Type:</span>
              <span className="value">{selectedItem.extension || 'BIM'}</span>
            </div>
            <div className="meta-chip">
              <span className="label">Size:</span>
              <span className="value">{selectedItem.size ? `${(selectedItem.size / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <Layers size={14} />
          <span>File Details</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          <Grid size={14} />
          <span>Properties {selectedObject ? `(${rawProps.length})` : ''}</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="inspector-content">
        {activeTab === 'details' && (
          <div className="tab-pane">
            <div className="pane-section">
              <h4 className="section-title">Model Overview</h4>
              <div className="props-table">
                <div className="prop-row">
                  <span className="prop-key flex items-center gap-1.5">
                    <FileType size={13} className="text-cyan-400" />
                    Display Name
                  </span>
                  <span className="prop-val truncate max-w-[150px]" title={selectedItem.displayName}>
                    {selectedItem.displayName}
                  </span>
                </div>
                <div className="prop-row">
                  <span className="prop-key flex items-center gap-1.5">
                    <HardDrive size={13} className="text-cyan-400" />
                    Storage Size
                  </span>
                  <span className="prop-val">
                    {formatFileSize(selectedItem.size)}
                  </span>
                </div>
                {selectedItem.lastModified && (
                  <div className="prop-row">
                    <span className="prop-key flex items-center gap-1.5">
                      <Calendar size={13} className="text-cyan-400" />
                      Last Modified
                    </span>
                    <span className="prop-val">
                      {new Date(selectedItem.lastModified).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedItem.folderId && (
                  <div className="prop-row">
                    <span className="prop-key">Folder ID</span>
                    <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.folderId}>
                      {selectedItem.folderId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pane-section mt-4">
              <h4 className="section-title">Autodesk Cloud Identifiers</h4>
              <div className="props-table">
                <div className="prop-row">
                  <span className="prop-key">Item Lineage ID</span>
                  <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.id}>
                    {selectedItem.id}
                  </span>
                </div>
                {selectedItem.versionUrn && (
                  <div className="prop-row">
                    <span className="prop-key">Version URN</span>
                    <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.versionUrn}>
                      {selectedItem.versionUrn}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="tab-pane">
            {selectedObject ? (
              <div className="space-y-3">
                {/* Modern Search Bar */}
                <div className="prop-search-container">
                  <Search size={14} className="prop-search-icon" />
                  <input
                    type="text"
                    placeholder={`Search ${rawProps.length} BIM parameters...`}
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

                {/* Filter counts summary */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>Showing <strong className="text-slate-200">{filteredProps.length}</strong> of {rawProps.length} items</span>
                  <span className="text-[10px] text-cyan-400 font-medium">{Object.keys(categoriesMap).length} categories</span>
                </div>

                {/* Categorized Properties List */}
                {Object.keys(categoriesMap).length === 0 ? (
                  <div className="prop-empty-search">
                    <Search size={22} className="text-slate-500 mb-1.5 opacity-50" />
                    <p className="text-xs font-semibold text-slate-300">No properties matched</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Try searching for dimensions, material, name, or area.</p>
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
                          <span className="modern-category-counter">
                            {propsList.length}
                          </span>
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
            ) : (
              /* No Object Selected State */
              <div className="empty-properties-card">
                <div className="empty-icon-circle">
                  <Box size={24} className="text-cyan-400" />
                </div>
                <h5 className="empty-title">Select 3D Component</h5>
                <p className="empty-desc">
                  Click on any wall, floor, column, window, or MEP element in the 3D canvas to inspect its Autodesk BIM parameters.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {selectedItem.base64Urn && (
        <div className="inspector-footer">
          <button
            className="btn-secondary flex-1"
            onClick={() => {
              if (selectedItem.base64Urn) {
                navigator.clipboard.writeText(selectedItem.base64Urn);
                alert('Base64 URN copied to clipboard!');
              }
            }}
          >
            <Share2 size={14} />
            <span>Copy Base64 URN</span>
          </button>
        </div>
      )}
    </aside>
  );
};
