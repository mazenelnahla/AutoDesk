import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  AlertCircle,
  LogIn,
  Key,
  RotateCcw,
  Sliders,
  Sun,
  Moon,
  Loader2
} from 'lucide-react';
import type { APSItem } from '../types/aps';
import { getPublicToken } from '../services/apsData';

declare global {
  interface Window {
    Autodesk?: any;
  }
}

interface AutodeskViewerProps {
  selectedItem: APSItem | null;
  isAuthenticated: boolean;
  onLoginRequest?: () => void;
  onObjectSelected?: (objectData: any | null) => void;
}

export const AutodeskViewer: React.FC<AutodeskViewerProps> = ({
  selectedItem,
  isAuthenticated,
  onLoginRequest,
  onObjectSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const [isLoadingViewer, setIsLoadingViewer] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [explodeScale, setExplodeScale] = useState<number>(0);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  // Initialize Autodesk Viewer JS SDK & Load Document Node
  useEffect(() => {
    if (!selectedItem?.base64Urn) {
      if (onObjectSelected) onObjectSelected(null);
      return;
    }

    if (!window.Autodesk || !window.Autodesk.Viewing) {
      setViewerError('Autodesk Viewer JS SDK library loading...');
      return;
    }

    setIsLoadingViewer(true);
    setViewerError(null);
    if (onObjectSelected) onObjectSelected(null);

    // Token provider function: fetches 2-legged/public token from server session
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

    // Official APS initialization options
    window.Autodesk.Viewing.FeatureFlags?.set?.('DS_ENDPOINTS', true);

    const options = {
      env: 'AutodeskProduction',
      getAccessToken,
    };

    window.Autodesk.Viewing.Initializer(options, () => {
      if (!containerRef.current) return;

      // Clean up previous viewer instance if it exists
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
      viewerRef.current = viewer;

      // Listen for object selection changes in the 3D canvas
      const onSelectionChanged = (event: any) => {
        const dbIds = event.dbIdArray;
        if (!dbIds || dbIds.length === 0) {
          if (onObjectSelected) onObjectSelected(null);
          return;
        }

        const selectedDbId = dbIds[0];
        viewer.getProperties(
          selectedDbId,
          (result: any) => {
            if (onObjectSelected) {
              onObjectSelected({
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

      const documentId = 'urn:' + selectedItem.base64Urn;

      function onDocumentLoadSuccess(doc: any) {
        const defaultGeometry = doc.getRoot().getDefaultGeometry();
        viewer.loadDocumentNode(doc, defaultGeometry)
          .then(() => {
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
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [selectedItem?.base64Urn]);

  const handleExplodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setExplodeScale(val);
    if (viewerRef.current) {
      viewerRef.current.explode(val);
    }
  };

  const handleResetView = () => {
    if (viewerRef.current) {
      viewerRef.current.setViewCube('Home');
      viewerRef.current.explode(0);
      setExplodeScale(0);
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = !isDarkTheme;
    setIsDarkTheme(nextTheme);
    if (viewerRef.current) {
      viewerRef.current.setTheme(nextTheme ? 'dark-theme' : 'light-theme');
    }
  };

  return (
    <div className="viewer-viewport-container">
      {/* Viewport Floating Header Banner */}
      <div className="viewport-banner">
        <div className="flex items-center gap-2 overflow-hidden">
          <Box size={18} className="text-cyan-400 shrink-0" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs" title={selectedItem?.path || selectedItem?.displayName}>
            {selectedItem?.path || selectedItem?.displayName || 'Select a model version from your Autodesk Hub to view in 3D'}
          </span>
        </div>
        {selectedItem && (
          <span className="demo-live-badge shrink-0">
            {selectedItem.extension || '3D Model'}
          </span>
        )}
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

        {/* Interactive Floating Viewer Controls */}
        {selectedItem && (
          <div className="viewer-floating-toolbar">
            <div className="toolbar-slider-label">
              <Sliders size={14} className="text-cyan-400" />
              <span>Explode 3D:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={explodeScale}
                onChange={handleExplodeChange}
                className="explode-slider"
              />
            </div>
            <div className="toolbar-divider" />
            <button
              className="toolbar-btn"
              onClick={handleResetView}
              title="Reset Home Camera & Explode"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
            <button
              className="toolbar-btn"
              onClick={handleToggleTheme}
              title="Toggle Viewer Theme"
            >
              {isDarkTheme ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDarkTheme ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
