import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  X,
  FileCode,
  Sparkles,
  Layers,
  Filter,
  Check,
  Box,
  Link,
  Upload,
  FolderTree,
} from 'lucide-react';
import type { ElementScheduleData, ScheduleStatus, ViewerSelectedObject, APSProject, ScannedModelIdentMap } from '../types/aps';
import {
  parseExcelSchedule,
  exportToExcelFile,
  downloadSampleExcelTemplate,
  loadMasterExcelPool,
  fetchScheduleForProject,
} from '../utils/excelSchedule';

interface ExcelDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleList: ElementScheduleData[];
  onImportSchedule: (newItems: ElementScheduleData[]) => void;
  onAssignToSelectedObject?: (item: ElementScheduleData) => void;
  onSelectSaipemIdent?: (ident: string) => void;
  onIsolatePart?: (dbId?: number, saipemIdent?: string, dbIds?: number[]) => void;
  currentModelName?: string;
  selectedObject?: ViewerSelectedObject | null;
  selectedProject?: APSProject | null;
  scannedModelIdents?: ScannedModelIdentMap;
}

export const ExcelDataModal: React.FC<ExcelDataModalProps> = ({
  isOpen,
  onClose,
  scheduleList,
  onImportSchedule,
  onAssignToSelectedObject,
  onSelectSaipemIdent,
  onIsolatePart,
  currentModelName,
  selectedObject,
  selectedProject,
  scannedModelIdents = {},
}) => {
  const [viewScope, setViewScope] = useState<'project' | 'all'>('project');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleStatus>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [masterPoolItems, setMasterPoolItems] = useState<ElementScheduleData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync master pool when modal opens
  useEffect(() => {
    if (isOpen) {
      setMasterPoolItems(loadMasterExcelPool());
    }
  }, [isOpen, scheduleList]);

  const activeDisplayList = useMemo(() => {
    if (viewScope === 'all') {
      return masterPoolItems;
    }
    return scheduleList;
  }, [viewScope, masterPoolItems, scheduleList]);

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      const contextProject = selectedProject
        ? { id: selectedProject.id, name: selectedProject.name }
        : undefined;
      const parsedItems = await parseExcelSchedule(file, contextProject);
      onImportSchedule(parsedItems);
      setMasterPoolItems(loadMasterExcelPool());
      setSuccessMsg(`Successfully imported ${parsedItems.length} records! Unique Saipem_IDENT parts matched and saved.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setErrorMsg(err.message || 'Failed to process Excel spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFetchModelIdents = () => {
    if (!selectedProject) {
      alert('Please select or open a project first.');
      return;
    }
    const { scheduleMap } = fetchScheduleForProject({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      modelIdents: scannedModelIdents,
    });
    const items = Object.values(scheduleMap);
    onImportSchedule(items);
    setMasterPoolItems(loadMasterExcelPool());
    setSuccessMsg(`Fetched ${items.length} records matching unique Saipem_IDENT parts for project "${selectedProject.name}"!`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const filteredItems = useMemo(() => {
    return activeDisplayList.filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.saipemIdent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName && item.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.elementName && item.elementName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.assignee && item.assignee.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeDisplayList, searchTerm, statusFilter]);

  // Statistics calculation based on active displayed list
  const totalCount = activeDisplayList.length;
  const completedCount = activeDisplayList.filter((i) => i.status === 'completed' || i.completionPercentage >= 100).length;
  const inProgressCount = activeDisplayList.filter((i) => i.status === 'in_progress').length;
  const delayedCount = activeDisplayList.filter((i) => i.status === 'delayed').length;
  const avgCompletion = totalCount > 0
    ? Math.round(activeDisplayList.reduce((acc, curr) => acc + (curr.completionPercentage || 0), 0) / totalCount)
    : 0;

  const getStatusBadge = (status: ScheduleStatus, pct: number) => {
    switch (status) {
      case 'completed':
        return (
          <span className="schedule-status-badge badge-completed">
            <CheckCircle2 size={12} />
            <span>Completed ({pct}%)</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="schedule-status-badge badge-progress">
            <Clock size={12} />
            <span>In Progress ({pct}%)</span>
          </span>
        );
      case 'delayed':
        return (
          <span className="schedule-status-badge badge-delayed">
            <AlertTriangle size={12} />
            <span>Delayed ({pct}%)</span>
          </span>
        );
      default:
        return (
          <span className="schedule-status-badge badge-notstarted">
            <XCircle size={12} />
            <span>Not Started</span>
          </span>
        );
    }
  };

  const handleAssignRowToSelectedPiece = (row: ElementScheduleData) => {
    if (!selectedObject) {
      alert('Please click on a 3D part in the viewer first to assign this Excel record to it.');
      return;
    }

    if (onAssignToSelectedObject) {
      onAssignToSelectedObject(row);
    }
    if (onSelectSaipemIdent) {
      onSelectSaipemIdent(row.saipemIdent);
    }
    setSuccessMsg(`Assigned Saipem_IDENT [${row.saipemIdent}] to 3D piece "${selectedObject.name}" (dbId: ${selectedObject.dbId})!`);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  if (!isOpen) return null;

  return (
    <div className="excel-modal-backdrop" onClick={onClose}>
      <div className="excel-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="excel-modal-header">
          <div className="excel-header-left">
            <div className="excel-header-icon-box">
              <FileSpreadsheet size={22} />
            </div>
            <div className="excel-header-titles">
              <div className="excel-title-row">
                <h3 className="excel-modal-title">Live Schedule & Excel Data Hub</h3>
                <span className="saipem-ident-pill">
                  <span className="pulse-dot"></span>
                  Saipem_IDENT Active
                </span>
              </div>
              <p className="excel-modal-subtitle">
                {selectedProject ? `Project: ${selectedProject.name}` : 'All Projects'}
                {currentModelName ? ` • Active Model: ${currentModelName}` : ''}
              </p>
            </div>
          </div>

          <div className="excel-header-actions">
            {scannedModelIdents && Object.keys(scannedModelIdents).length > 0 && (
              <button
                type="button"
                className="excel-btn-template"
                onClick={handleAutoFetchModelIdents}
                title="Auto-fetch Excel records for unique Saipem_IDENT parts detected in active 3D model"
              >
                <Sparkles size={13} className="text-emerald-400" />
                <span>Sync {Object.keys(scannedModelIdents).length} Model Parts</span>
              </button>
            )}
            <button
              type="button"
              className="excel-btn-template"
              onClick={() => downloadSampleExcelTemplate('Saipem_Schedule_Template.xlsx', selectedProject?.name)}
              title="Download Excel template with sample Saipem_IDENT columns"
            >
              <Download size={13} />
              <span>Sample Template</span>
            </button>
            <button
              type="button"
              className="excel-btn-export"
              onClick={() => exportToExcelFile(activeDisplayList, `${selectedProject?.name || currentModelName || 'Project'}_Schedule.xlsx`, selectedProject?.name)}
              disabled={activeDisplayList.length === 0}
              title="Export live schedule data to Excel"
            >
              <Download size={13} />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              className="excel-modal-close"
              onClick={onClose}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Selected 3D Piece Context Banner */}
        {selectedObject && (
          <div className="excel-target-piece-banner">
            <div className="target-piece-left">
              <div className="target-piece-icon">
                <Box size={16} />
              </div>
              <div className="target-piece-info">
                <div className="target-piece-title-row">
                  <span className="target-piece-label">Target 3D Piece:</span>
                  <span className="target-piece-name">{selectedObject.name}</span>
                  <span className="target-piece-dbid">dbId: {selectedObject.dbId}</span>
                </div>
                <p className="target-piece-hint">
                  Click <strong className="target-piece-highlight">"Assign to Piece"</strong> on any row below to bind its Saipem_IDENT, dates, and completion status.
                </p>
              </div>
            </div>
            <div className="target-piece-badge">
              <Link size={12} />
              <span>Ready to Bind</span>
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          id="excel-modal-file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
          accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          style={{ display: 'none' }}
        />

        {/* Upload Dropzone & Direct Upload Button */}
        <div
          className={`excel-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          title="Click or drag to select Excel file"
        >
          <div className="dropzone-content">
            <div className="dropzone-icon-box">
              <UploadCloud size={30} />
            </div>
            <div className="dropzone-text">
              <span className="dropzone-primary-text">
                {isProcessing ? 'Processing spreadsheet...' : 'Drop Excel (.xlsx / .xls / .csv) file here, or click to browse'}
              </span>
              <span className="dropzone-secondary-text">
                Auto-detects columns: <strong>Saipem_IDENT</strong>, dbId, Start/End dates, & Complete %
              </span>
            </div>
            <button
              type="button"
              className="btn-browse-excel"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={13} />
              <span>Browse Files</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="excel-alert alert-error">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="excel-alert alert-success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Statistics Bar */}
        <div className="excel-stats-grid">
          <div className="stat-card stat-card-total">
            <span className="stat-label">Total Assigned Parts</span>
            <div className="stat-value-box">
              <span className="stat-value text-total">{totalCount}</span>
              <Layers size={15} className="stat-icon" />
            </div>
          </div>
          <div className="stat-card stat-card-avg">
            <span className="stat-label">Avg. Completion</span>
            <div className="stat-value-box">
              <span className="stat-value text-avg">{avgCompletion}%</span>
              <Sparkles size={15} className="stat-icon" />
            </div>
          </div>
          <div className="stat-card stat-card-completed">
            <span className="stat-label">Completed</span>
            <div className="stat-value-box">
              <span className="stat-value text-completed">{completedCount}</span>
              <CheckCircle2 size={15} className="stat-icon" />
            </div>
          </div>
          <div className="stat-card stat-card-progress">
            <span className="stat-label">In Progress</span>
            <div className="stat-value-box">
              <span className="stat-value text-progress">{inProgressCount}</span>
              <Clock size={15} className="stat-icon" />
            </div>
          </div>
          <div className="stat-card stat-card-delayed">
            <span className="stat-label">Delayed</span>
            <div className="stat-value-box">
              <span className="stat-value text-delayed">{delayedCount}</span>
              <AlertTriangle size={15} className="stat-icon" />
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="excel-filter-bar">
          <div className="excel-scope-toggle-group">
            <button
              type="button"
              className={`filter-pill scope-pill ${viewScope === 'project' ? 'active' : ''}`}
              onClick={() => setViewScope('project')}
              title="View schedule records scoped to this project"
            >
              <FolderTree size={12} />
              <span>{selectedProject?.name || 'This Project'} ({scheduleList.length})</span>
            </button>
            <button
              type="button"
              className={`filter-pill scope-pill ${viewScope === 'all' ? 'active' : ''}`}
              onClick={() => setViewScope('all')}
              title="View all records in the master Excel pool"
            >
              <Layers size={12} />
              <span>All Master ({masterPoolItems.length})</span>
            </button>
          </div>

          <div className="excel-search-container">
            <Search size={14} className="excel-search-icon" />
            <input
              type="text"
              placeholder="Search by Saipem_IDENT, project, element name..."
              className="excel-search-field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="excel-search-clear"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="excel-filter-group">
            <Filter size={13} className="excel-filter-icon" />
            <div className="filter-pill-group">
              {(['all', 'completed', 'in_progress', 'delayed', 'not_started'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="excel-table-container">
          {filteredItems.length === 0 ? (
            <div className="excel-empty-state">
              <div className="empty-state-icon-box">
                <FileCode size={34} />
              </div>
              <p className="empty-state-title">No matching schedule records found</p>
              <p className="empty-state-subtitle">
                Upload an Excel file with <strong>Saipem_IDENT</strong> columns or click on 3D elements to add live schedule data.
              </p>
            </div>
          ) : (
            <table className="excel-data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Saipem_IDENT</th>
                  <th>dbId</th>
                  <th>Element Name / Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Completion (%)</th>
                  <th>Status</th>
                  <th>Assignee / Contractor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row, idx) => {
                  const isCurrentBound = selectedObject && (row.dbId === selectedObject.dbId);
                  const isModelMatched = Boolean(scannedModelIdents && scannedModelIdents[row.saipemIdent]);

                  return (
                    <tr key={`${row.saipemIdent}-${idx}`} className={isCurrentBound ? 'row-currently-assigned' : ''}>
                      <td>
                        <span className="ident-tag" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                          {row.projectName || selectedProject?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="table-ident-cell">
                          <span className="ident-tag">
                            {row.saipemIdent}
                          </span>
                          {isModelMatched && (
                            <span className="bound-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }} title="Unique Saipem_IDENT detected in active 3D model">
                              IN 3D MODEL
                            </span>
                          )}
                          {isCurrentBound && (
                            <span className="bound-tag">
                              BOUND
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="dbid-tag">
                          {row.dbId ?? '—'}
                        </span>
                      </td>
                      <td>
                        <div className="element-name-cell">
                          <span className="element-primary-name" title={row.elementName}>
                            {row.elementName || '3D BIM Element'}
                          </span>
                          {row.category && (
                            <span className="element-category-name" title={row.category}>
                              {row.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td><span className="date-tag">{row.startDate || '—'}</span></td>
                      <td><span className="date-tag">{row.endDate || '—'}</span></td>
                      <td>
                        <div className="progress-cell">
                          <div className="table-progress-bar">
                            <div
                              className="table-progress-fill"
                              style={{ width: `${row.completionPercentage}%` }}
                            />
                          </div>
                          <span className="progress-pct">
                            {row.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td>{getStatusBadge(row.status, row.completionPercentage)}</td>
                      <td>
                        <span className="assignee-cell" title={row.assignee}>
                          {row.assignee || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          {selectedObject ? (
                            <button
                              type="button"
                              className="btn-assign-row"
                              title={`Assign this Excel record to "${selectedObject.name}"`}
                              onClick={() => handleAssignRowToSelectedPiece(row)}
                            >
                              <Check size={12} />
                              <span>Assign to Piece</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-assign-row"
                              title="Select this Saipem_IDENT to view tracking & status"
                              onClick={() => {
                                if (onSelectSaipemIdent) onSelectSaipemIdent(row.saipemIdent);
                                onClose();
                              }}
                            >
                              <Check size={12} />
                              <span>Select Record</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-focus-3d"
                            title="Focus & Isolate in 3D Viewer"
                            onClick={() => {
                              if (onSelectSaipemIdent) onSelectSaipemIdent(row.saipemIdent);
                              const targetDbIds = scannedModelIdents ? scannedModelIdents[row.saipemIdent]?.dbIds : undefined;
                              if (onIsolatePart) onIsolatePart(row.dbId, row.saipemIdent, targetDbIds);
                              onClose();
                            }}
                          >
                            <Eye size={12} />
                            <span>Isolate 3D</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="excel-modal-footer">
          <span className="excel-footer-count">
            Showing <strong>{filteredItems.length}</strong> of {totalCount} rows
          </span>
          <button type="button" className="excel-btn-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
