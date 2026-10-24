import { STATUS_COLORS, effectiveStatus } from '../utils/statusColors';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  AlertCircle,
  LogIn,
  Key,
  Loader2,
  Sparkles,
  EyeOff
} from 'lucide-react';
import type { APSItem, ElementScheduleData, ScannedModelIdentMap } from '../types/aps';
import { getPublicToken } from '../services/apsData';
import { extractSaipemIdentFromProps } from '../utils/excelSchedule';
import { PartProgressPanel } from './PartProgressPanel';

declare global {
  interface Window {
    Autodesk?: any;
    THREE?: any;
  }
}

interface AutodeskViewerProps {
  selectedItem: APSItem | null;
  isAuthenticated: boolean;
  onLoginRequest?: () => void;
  onObjectSelected?: (objectData: any | null) => void;
  scheduleDataMap?: Record<string, ElementScheduleData>;
  onOpenExcelModal?: () => void;
  focusedSaipemIdent?: string | null;
  focusedDbId?: number | null;
  focusedDbIds?: number[] | null;
  isolatedDbIds?: number[] | null;
  isIsolated?: boolean;
  isolateTrigger?: number;
  onClearIsolation?: () => void;
  onIsolatePart?: (dbId?: number, ident?: string, dbIds?: number[]) => void;
  onModelIdentsScanned?: (scanned: ScannedModelIdentMap) => void;
  onModelSectionsScanned?: (sections: import('../types/aps').ProjectSection[]) => void;
}

export const AutodeskViewer: React.FC<AutodeskViewerProps> = ({
  selectedItem,
  isAuthenticated,
  onLoginRequest,
  onObjectSelected,
  scheduleDataMap = {},
  onOpenExcelModal,
  focusedSaipemIdent,
  focusedDbId,
  focusedDbIds,
  isolatedDbIds,
  isIsolated = false,
  isolateTrigger,
  onClearIsolation,
  onIsolatePart,
  onModelIdentsScanned,
  onModelSectionsScanned,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const [isLoadingViewer, setIsLoadingViewer] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const isDarkTheme = true;

  // Map of Saipem_IDENT to dbIds scanned from the model
  const modelIdentToDbIds = useRef<Record<string, number[]>>({});

  const onObjectSelectedRef = useRef(onObjectSelected);
  useEffect(() => {
    onObjectSelectedRef.current = onObjectSelected;
  }, [onObjectSelected]);

  const onModelIdentsScannedRef = useRef(onModelIdentsScanned);
  useEffect(() => {
    onModelIdentsScannedRef.current = onModelIdentsScanned;
  }, [onModelIdentsScanned]);

  const onModelSectionsScannedRef = useRef(onModelSectionsScanned);
  useEffect(() => {
    onModelSectionsScannedRef.current = onModelSectionsScanned;
  }, [onModelSectionsScanned]);

  const scheduleDataRef = useRef(scheduleDataMap);
  scheduleDataRef.current = scheduleDataMap;

  const applyModelColors = useCallback((viewer: any) => {
    const model = viewer?.model;
    const tree = model?.getInstanceTree();
    const THREE = window.THREE || window.Autodesk?.Viewing?.Private?.THREE;
    if (!tree || !THREE || viewerRef.current !== viewer) return;

    const colors = Object.fromEntries(Object.entries(STATUS_COLORS).map(([status, hex]) => {
      const value = parseInt(hex.slice(1), 16);
      return [status, new THREE.Vector4(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1)];
    }));
    const gray = colors.not_started;

    viewer.clearThemingColors(model);
    // Full intensity replaces the source material color, including untracked parts.
    viewer.setThemingColor(tree.getRootId(), gray, model, true);

    // Explicit part records override shared IDENT records.
    Object.values(scheduleDataRef.current)
      .sort((a, b) => Number(a.dbId != null) - Number(b.dbId != null))
      .forEach((item) => {
        const dbIds = item.dbId != null
          ? [item.dbId]
          : modelIdentToDbIds.current[item.saipemIdent] || [];
        const color = colors[effectiveStatus(item)];
        dbIds.forEach((dbId) => viewer.setThemingColor(dbId, color, model, true));
      });
  }, []);

  useEffect(() => {
    applyModelColors(viewerRef.current);
  }, [scheduleDataMap, applyModelColors]);

  // Scan all model nodes to index Saipem_IDENT properties and sections once the model is loaded
  const indexModelProperties = useCallback((viewer: any) => {
    if (!viewer?.model) return;

    const instanceTree = viewer.model.getInstanceTree();
    if (!instanceTree) return;

    modelIdentToDbIds.current = {};

    const nodeIds: number[] = [];
    instanceTree.enumNodeChildren(instanceTree.getRootId(), (id: number) => {
      let hasGeometry = false;
      instanceTree.enumNodeFragments(id, () => { hasGeometry = true; }, false);
      if (hasGeometry) nodeIds.push(id);
    }, true);
    const model = viewer.model;
    Promise.all([
      new Promise<any[]>((resolve, reject) => model.getBulkProperties(nodeIds, { ignoreHidden: false }, resolve, reject)),
      new Promise<Record<string, number>>((resolve, reject) => model.getExternalIdMapping(resolve, reject)),
    ]).then(([props, externalIds]) => {
      const externalIdByDbId = new Map(Object.entries(externalIds).map(([externalId, dbId]) => [dbId, externalId]));
      if (!props || viewerRef.current !== viewer) return;
      const scannedMap: ScannedModelIdentMap = {};
      const sectionMap: Record<string, { name: string; category?: string; dbIds: number[]; idents: Set<string> }> = {};

      props.forEach((item) => {
        if (!item.properties) return;
        const ident = extractSaipemIdentFromProps(item.properties) || `MODEL-ELEMENT-${item.dbId}`;

        // Find Category / Family / Section
        const catProp = item.properties.find((p: any) => {
          const n = (p.displayName || p.attributeName || '').toLowerCase();
          return n === 'category' || n === 'family name' || n === 'type' || n.includes('section') || n.includes('workset');
        });
        const sectionName = catProp && catProp.displayValue ? String(catProp.displayValue).trim() : 'General Elements';

        if (!sectionMap[sectionName]) {
          sectionMap[sectionName] = {
            name: sectionName,
            category: catProp ? String(catProp.displayValue) : 'Section',
            dbIds: [],
            idents: new Set<string>(),
          };
        }
        sectionMap[sectionName].dbIds.push(item.dbId);
        if (ident) {
          sectionMap[sectionName].idents.add(ident);
        }

        if (ident) {
          if (!modelIdentToDbIds.current[ident]) {
            modelIdentToDbIds.current[ident] = [];
          }
          modelIdentToDbIds.current[ident].push(item.dbId);

          if (!scannedMap[ident]) {
            scannedMap[ident] = {
              dbIds: [item.dbId],
              name: item.name,
              category: catProp ? String(catProp.displayValue) : undefined,
            };
          } else {
            scannedMap[ident].dbIds.push(item.dbId);
          }
          scannedMap[ident].elements ??= {};
          scannedMap[ident].elements![item.dbId] = {
            name: item.name,
            category: catProp ? String(catProp.displayValue) : undefined,
            externalId: item.externalId || externalIdByDbId.get(item.dbId),
            parameters: Object.fromEntries(item.properties.map((p: any) => [
              `${p.displayCategory || 'General'}/${p.displayName || p.attributeName}`,
              String(p.displayValue ?? ''),
            ])),
          };
        }
      });

      applyModelColors(viewer);

      if (onModelIdentsScannedRef.current) {
        onModelIdentsScannedRef.current(scannedMap);
      }

      if (onModelSectionsScannedRef.current) {
        const sectionsList = Object.entries(sectionMap)
          .map(([id, info]) => ({
            id,
            name: info.name,
            category: info.category,
            source: 'model' as const,
            elementCount: info.dbIds.length,
            dbIds: info.dbIds,
            assignedIdents: Array.from(info.idents),
          }))
          .sort((a, b) => b.elementCount - a.elementCount);

        onModelSectionsScannedRef.current(sectionsList);
      }
    }).catch((error: unknown) => {
      console.error('Model inventory scan failed', error);
      setViewerError('Could not scan model properties. Reload the model to retry.');
    });
  }, [applyModelColors]);

  // Internal count of isolated parts for badge indicator
  const [isolatedPartsCount, setIsolatedPartsCount] = useState<number>(0);

  // Handle focus / isolate part from external trigger (like InspectorPanel, Excel modal or Saipem_IDENT focus)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.model) return;

    if (!isIsolated) {
      try {
        if (typeof viewer.isolate === 'function') {
          viewer.isolate([], viewer.model);
        }
        if (typeof viewer.clearSelection === 'function') {
          viewer.clearSelection();
        }
        if (typeof viewer.fitToView === 'function') {
          viewer.fitToView();
        }
      } catch (e) {
        console.error('Failed to reset viewer isolation', e);
      }
      setIsolatedPartsCount(0);
      return;
    }

    let targetDbIds: number[] = [];

    if (isolatedDbIds && isolatedDbIds.length > 0) {
      targetDbIds = [...targetDbIds, ...isolatedDbIds];
    }

    if (focusedDbIds && focusedDbIds.length > 0) {
      targetDbIds = [...targetDbIds, ...focusedDbIds];
    }

    if (focusedDbId) {
      targetDbIds.push(focusedDbId);
    }

    if (focusedSaipemIdent) {
      if (modelIdentToDbIds.current[focusedSaipemIdent]) {
        targetDbIds = [...targetDbIds, ...modelIdentToDbIds.current[focusedSaipemIdent]];
      } else {
        const lower = focusedSaipemIdent.trim().toLowerCase();
        for (const [k, v] of Object.entries(modelIdentToDbIds.current)) {
          if (k.trim().toLowerCase() === lower) {
            targetDbIds = [...targetDbIds, ...v];
            break;
          }
        }
      }
    }

    // Deduplicate valid numeric dbIds
    targetDbIds = Array.from(new Set(targetDbIds.filter((id) => typeof id === 'number' && !isNaN(id))));

    if (targetDbIds.length > 0) {
      try {
        if (typeof viewer.isolate === 'function') {
          viewer.isolate(targetDbIds, viewer.model);
        }
        if (typeof viewer.select === 'function') {
          viewer.select(targetDbIds);
        }
        if (typeof viewer.fitToView === 'function') {
          viewer.fitToView(targetDbIds);
        }
        setIsolatedPartsCount(targetDbIds.length);
      } catch (e) {
        console.error('Failed to isolate target elements in viewer', e);
      }
    }
  }, [isolateTrigger, isIsolated, isolatedDbIds, focusedDbId, focusedDbIds, focusedSaipemIdent]);

  // Initialize Autodesk Viewer JS SDK & Load Document Node ONLY when base64Urn changes
  const activeUrn = selectedItem?.base64Urn;

  useEffect(() => {
    if (!activeUrn) {
      if (onObjectSelectedRef.current) onObjectSelectedRef.current(null);
      if (onClearIsolation) onClearIsolation();
      return;
    }

    if (!window.Autodesk || !window.Autodesk.Viewing) {
      setViewerError('Autodesk Viewer JS SDK library loading...');
      return;
    }

    setIsLoadingViewer(true);
    setViewerError(null);
    if (onObjectSelectedRef.current) onObjectSelectedRef.current(null);

    const getAccessToken = async (callback: (token: string, expires: number) => void) => {
      try {
        const { access_token, expires_in } = await getPublicToken();
        callback(access_token, expires_in);
      } catch (err: any) {
        console.error('Failed to obtain viewer access token:', err);
        setViewerError('Could not obtain access token from server.');
        setIsLoadingViewer(false);
        callback('', 0);
      }
    };

    window.Autodesk.Viewing.FeatureFlags?.set?.('DS_ENDPOINTS', true);

    const options = {
      env: 'AutodeskProduction',
      getAccessToken,
    };

    window.Autodesk.Viewing.Initializer(options, () => {
      if (!containerRef.current) return;

      if (viewerRef.current) {
        try {
          viewerRef.current.finish();
          viewerRef.current = null;
        } catch (e) {
          console.error(e);
        }
      }

      const config = {
        extensions: ['Autodesk.DocumentBrowser'],
      };

      const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, config);
      const startedCode = viewer.start();

      if (startedCode > 0) {
        setViewerError(`Failed to initialize Autodesk Viewer (code ${startedCode})`);
        setIsLoadingViewer(false);
        return;
      }

      viewer.setTheme(isDarkTheme ? 'dark-theme' : 'light-theme');
      viewer.setGhosting(true);
      viewerRef.current = viewer;
      (window as any).apsViewer = viewer;

      // Listen for selection changes in the 3D canvas
      const onSelectionChanged = (event: any) => {
        const dbIds = event.dbIdArray;
        if (!dbIds || dbIds.length === 0) {
          if (onObjectSelectedRef.current) onObjectSelectedRef.current(null);
          return;
        }

        const selectedDbId = dbIds[0];
        viewer.getProperties(
          selectedDbId,
          (result: any) => {
            if (onObjectSelectedRef.current) {
              onObjectSelectedRef.current({
                dbId: selectedDbId,
                name: result.name || `Object #${selectedDbId}`,
                properties: result.properties || [],
              });
            }
          },
          (err: any) => {
            console.error('Failed to retrieve properties for dbId ' + selectedDbId, err);
          }
        );
      };

      viewer.addEventListener(
        window.Autodesk.Viewing.SELECTION_CHANGED_EVENT,
        onSelectionChanged
      );

      modelIdentToDbIds.current = {};

      // Apply the base color as soon as the tree exists, including streamed geometry.
      viewer.addEventListener(
        window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
        () => applyModelColors(viewer)
      );

      // Listen for model geometry loaded to index properties
      viewer.addEventListener(
        window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
        () => {
          applyModelColors(viewer);
          indexModelProperties(viewer);
        }
      );

      const documentId = 'urn:' + activeUrn;

      function onDocumentLoadSuccess(doc: any) {
        const defaultGeometry = doc.getRoot().getDefaultGeometry();
        viewer.loadDocumentNode(doc, defaultGeometry)
          .then(() => {
            applyModelColors(viewer);
            setIsLoadingViewer(false);
          })
          .catch((err: any) => {
            console.warn('loadDocumentNode notice:', err);
            setIsLoadingViewer(false);
          });
      }

      function onDocumentLoadFailure(errorCode: number, errorMsg: string) {
        console.warn(`Autodesk Document.load notice: ${errorMsg} (${errorCode})`);
        setViewerError(`Model Derivative Load Error (${errorCode}): ${errorMsg || 'Please ensure model is translated'}`);
        setIsLoadingViewer(false);
      }

      window.Autodesk.Viewing.Document.load(
        documentId,
        onDocumentLoadSuccess,
        onDocumentLoadFailure
      );
    });

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.finish();
          viewerRef.current = null;
          (window as any).apsViewer = null;
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [activeUrn, indexModelProperties, applyModelColors]);


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => viewerRef.current?.resize());
    });
    observer.observe(container);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [activeUrn, isAuthenticated]);

  const trackedCount = Object.keys(scheduleDataMap).length;

  return (
    <div className="viewer-viewport-container">
      {/* Viewport Floating Header Banner */}
      <div className="viewport-banner">
        <div className="flex items-center gap-2 overflow-hidden">
          <Box size={18} className="text-cyan-400 shrink-0" />
          <span className="font-semibold text-slate-400 dark:text-slate-200 truncate text-xs" title={selectedItem?.path || selectedItem?.displayName}>
            {selectedItem?.path || selectedItem?.displayName || 'Select a model version from your Autodesk Hub to view in 3D'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isIsolated && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all font-medium cursor-pointer shadow-sm"
              onClick={onClearIsolation}
              title="Click to reset 3D view and show all model elements"
            >
              <EyeOff size={13} className="text-amber-400" />
              <span>Show All {isolatedPartsCount > 0 ? `(${isolatedPartsCount})` : ''}</span>
            </button>
          )}
          {trackedCount > 0 && (
            <span className="saipem-live-count-badge" onClick={onOpenExcelModal} title="Click to open Excel Schedule Hub">
              <Sparkles size={11} className="text-emerald-400" />
              <span>{trackedCount} Saipem_IDENT Parts</span>
            </span>
          )}
          {selectedItem && (
            <span className="demo-live-badge shrink-0">
              {selectedItem.extension || '3D Model'}
            </span>
          )}
        </div>
      </div>

      {/* Main 3D Viewport Area */}
      <div className="viewport-canvas-wrapper">
        {!isAuthenticated ? (
          <div className="viewer-error-overlay">
            <Key size={36} className="text-cyan-400 mb-3" />
            <p className="error-title text-lg font-bold">Autodesk Authentication Required</p>
            <p className="error-desc text-sm text-slate-300 max-w-md text-center mt-1">
              Sign in with your Autodesk account to read live BIM 360 / ACC Hubs and render 3D models.
            </p>
            <button
              className="btn-autodesk-login mt-4"
              onClick={onLoginRequest}
            >
              <LogIn size={16} />
              <span>Sign in with Autodesk</span>
            </button>
          </div>
        ) : !selectedItem ? (
          <div className="viewer-error-overlay">
            <Box size={36} className="text-slate-500 mb-3" />
            <p className="error-title text-base font-semibold text-slate-300">No Model Version Selected</p>
            <p className="error-desc text-xs text-slate-400 mt-1">
              Expand Hub &rarr; Project &rarr; Folder &rarr; Item &rarr; Version in the sidebar to load the 3D model.
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="autodesk-sdk-container">
            {isLoadingViewer && (
              <div className="viewer-loading-overlay">
                <Loader2 className="animate-spin text-cyan-400 mb-2" size={32} />
                <p>Loading Autodesk Viewer URN model derivative...</p>
              </div>
            )}
            {viewerError && (
              <div className="viewer-error-overlay">
                <AlertCircle size={32} className="text-amber-400 mb-2" />
                <p className="error-title">Viewer Status Notice</p>
                <p className="error-desc">{viewerError}</p>
              </div>
            )}
          </div>
        )}


      </div>
      {selectedItem && <PartProgressPanel records={scheduleDataMap} onFocus={(dbId) => {
        const viewer = viewerRef.current;
        if (!viewer?.model) return;
        viewer.setGhosting(true);
        viewer.isolate([dbId], viewer.model);
        viewer.select([dbId]);
        viewer.fitToView([dbId]);
        setIsolatedPartsCount(1);
        onIsolatePart?.(dbId, undefined, [dbId]);
      }} />}
    </div>
  );
};
