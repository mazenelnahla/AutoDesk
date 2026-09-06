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

declare global {
  interface Window {
    Autodesk?: any;
  }
}

interface AutodeskViewerProps {
  selectedItem: APSItem | null;
  accessToken: string | null;
  onLoginRequest?: () => void;
}

export const AutodeskViewer: React.FC<AutodeskViewerProps> = ({
  selectedItem,
  accessToken,
  onLoginRequest,
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
      return;
    }

    if (!window.Autodesk || !window.Autodesk.Viewing) {
      setViewerError('Autodesk Viewer JS SDK library loading...');
      return;
    }

    setIsLoadingViewer(true);
    setViewerError(null);

    // Token provider function: passes active 3-legged ACC OAuth token
    const getAccessToken = (callback: (token: string, expires: number) => void) => {
      if (accessToken) {
        callback(accessToken, 3600);
      } else {
        fetch('/api/auth/token')
          .then((res) => res.json())
          .then((data) => {
            callback(data.access_token || '', data.expires_in || 3600);
          })
          .catch((err) => {
            console.warn('Failed to retrieve token:', err);
            callback('', 0);
          });
      }
    };

    const options = {
      env: 'AutodeskProduction',
      api: 'derivativeV2',
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

      const documentId = 'urn:' + selectedItem.base64Urn;

      function onDocumentLoadSuccess(doc: any) {
        const defaultModel = doc.getRoot().getDefaultGeometry();
        viewer.loadDocumentNode(doc, defaultModel)
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
        setViewerError(`Model Derivative Status: Error ${errorCode} (${errorMsg || 'Untranslated model derivative'})`);
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
  }, [selectedItem, accessToken]);

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
            {selectedItem?.path || selectedItem?.displayName || 'Select a Revit file from your Autodesk account'}
          </span>
        </div>
        {selectedItem && (
          <span className="demo-live-badge shrink-0">
            {selectedItem.extension || '.rvt'}
          </span>
        )}
      </div>

      {/* Main 3D Viewport Area */}
      <div className="viewport-canvas-wrapper">
        {!accessToken ? (
          <div className="viewer-error-overlay">
            <Key size={36} className="text-cyan-400 mb-3" />
            <p className="error-title text-lg font-bold">Autodesk Authentication Required</p>
            <p className="error-desc text-sm text-slate-300 max-w-md text-center mt-1">
              Sign in with your Autodesk account to read live BIM 360 / ACC Hubs and render 3D Revit models.
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
            <p className="error-title text-base font-semibold text-slate-300">No Revit Model Selected</p>
            <p className="error-desc text-xs text-slate-400 mt-1">
              Choose a <code className="text-cyan-400">.rvt</code> file from the left sidebar tree to load its 3D model derivative.
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
