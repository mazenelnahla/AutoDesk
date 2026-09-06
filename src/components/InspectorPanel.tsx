import React, { useState } from 'react';
import {
  FileText,
  Grid,
  Share2,
  HardDrive,
  Calendar,
  Layers,
  FileType,
} from 'lucide-react';
import type { APSItem } from '../types/aps';

interface InspectorPanelProps {
  selectedItem: APSItem | null;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedItem,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'properties'>('details');

  if (!selectedItem) {
    return (
      <aside className="inspector-panel empty">
        <div className="inspector-placeholder">
          <FileText size={32} className="text-slate-600 mb-2" />
          <p className="font-semibold text-slate-300">No file selected</p>
          <p className="text-xs text-slate-500 mt-1">
            Choose a file from the explorer tree to inspect its cloud properties and metadata.
          </p>
        </div>
      </aside>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  };

  return (
    <aside className="inspector-panel">
      {/* File Header */}
      <div className="inspector-header">
        <div className="flex items-start justify-between">
          <div className="w-full">
            <span className="rvt-badge">
              {selectedItem.isRevit ? 'Revit BIM File' : selectedItem.extension ? `${selectedItem.extension.toUpperCase()} File` : 'Cloud Item'}
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

        <div className="file-quick-meta">
          <div className="meta-chip">
            <span className="label">Type:</span>
            <span className="value">{selectedItem.extension || 'N/A'}</span>
          </div>
          <div className="meta-chip">
            <span className="label">Size:</span>
            <span className="value">{selectedItem.size ? `${(selectedItem.size / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <Layers size={14} />
          <span>File Information</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          <Grid size={14} />
          <span>Cloud Parameters</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="inspector-content">
        {activeTab === 'details' && (
          <div className="tab-pane">
            <div className="pane-section">
              <h4 className="section-title">Item Overview</h4>
              <div className="props-table">
                <div className="prop-row">
                  <span className="prop-key flex items-center gap-1.5">
                    <FileType size={13} className="text-cyan-400" />
                    File Name
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
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="tab-pane">
            <h4 className="section-title">Autodesk Cloud Identifiers</h4>
            <div className="props-table">
              <div className="prop-row">
                <span className="prop-key">Full Cloud Path</span>
                <span className="prop-val font-mono text-xs text-cyan-400 truncate max-w-[140px]" title={selectedItem.path || selectedItem.displayName}>
                  {selectedItem.path || selectedItem.displayName}
                </span>
              </div>
              <div className="prop-row">
                <span className="prop-key">Item Lineage ID</span>
                <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.id}>
                  {selectedItem.id}
                </span>
              </div>
              {selectedItem.versionUrn && (
                <div className="prop-row">
                  <span className="prop-key">Tip Version URN</span>
                  <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.versionUrn}>
                    {selectedItem.versionUrn}
                  </span>
                </div>
              )}
              {selectedItem.base64Urn && (
                <div className="prop-row">
                  <span className="prop-key">Base64 Safe URN</span>
                  <span className="prop-val font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={selectedItem.base64Urn}>
                    {selectedItem.base64Urn}
                  </span>
                </div>
              )}
            </div>
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
