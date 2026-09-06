import React from 'react';
import {
  Box,
  LogIn,
  RefreshCw,
  Layers,
  FolderTree,
  FileCheck,
  ShieldCheck,
  Zap,
  AlertCircle,
} from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
  isLoadingAuth: boolean;
  authError?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  isLoadingAuth,
  authError,
}) => {
  return (
    <div className="login-page-container">
      {/* Background Ambient Glows */}
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      {/* Header bar */}
      <header className="login-header">
        <div className="logo-container">
          <Box className="logo-icon text-cyan-400" size={24} />
          <div className="logo-badge">APS</div>
        </div>
        <span className="login-header-title">Autodesk Platform Services</span>
      </header>

      {/* Main Login Hero Card */}
      <main className="login-hero-wrapper">
        <div className="login-card">
          <div className="login-icon-badge">
            <Box size={42} className="text-cyan-400 animate-pulse" />
          </div>

          <h1 className="login-title">Autodesk BIM Explorer</h1>
          <p className="login-subtitle">
            Sign in with your Autodesk account to access BIM 360 & ACC hubs, explore 3D Revit models, and inspect rich BIM metadata.
          </p>

          {authError && (
            <div className="p-3 mb-4 rounded-lg bg-red-950/60 border border-red-500/40 flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle size={20} className="text-red-400 shrink-0" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-red-300">Authentication Failed</p>
                <p className="text-xs text-red-200/80">{authError}</p>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            className="login-primary-btn"
            onClick={onLogin}
            disabled={isLoadingAuth}
          >
            {isLoadingAuth ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                <span>Redirecting to Autodesk...</span>
              </>
            ) : (
              <>
                <LogIn size={20} />
                <span>Sign in with Autodesk</span>
              </>
            )}
          </button>

          <div className="login-security-notice">
            <ShieldCheck size={15} className="text-cyan-400" />
            <span>OAuth 2.0 Secure Authentication directly via Autodesk Portal</span>
          </div>

          {/* Features Grid */}
          <div className="login-features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FolderTree size={20} className="text-cyan-400" />
              </div>
              <div>
                <h3>Cloud Hubs & Projects</h3>
                <p>Browse your BIM 360 and ACC folders and Revit files seamlessly.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Layers size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3>3D Model Viewer</h3>
                <p>Render interactive 3D models with Autodesk Viewer SDK engine.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <FileCheck size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3>Revit BIM Inspector</h3>
                <p>Inspect categories, sheets, levels, and element properties in real-time.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={20} className="text-amber-400" />
              </div>
              <div>
                <h3>Instant Live Data</h3>
                <p>Live synchronized authorization tokens & Data Management APIs.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <p>Powered by Autodesk Platform Services & Express API Proxy</p>
      </footer>
    </div>
  );
};
