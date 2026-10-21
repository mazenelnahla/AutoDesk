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
        <span className="login-header-title">BUILDSPACE / CONSTRUCTION INTELLIGENCE</span>
      </header>

      {/* Main Login Hero Card */}
      <main className="login-hero-wrapper">
        <div className="login-card">
          <div className="login-icon-badge">
            <Box size={42} className="text-cyan-400 animate-pulse" />
          </div>

          <h1 className="login-title">Your model. Your progress.<br /><em>One clear view.</em></h1>
          <p className="login-subtitle">
            Bring your construction data into focus. Open your ACC models, connect element schedules, and see exactly where your project stands.
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
                <span>Continue with Autodesk</span>
              </>
            )}
          </button>

          <div className="login-security-notice">
            <ShieldCheck size={15} className="text-cyan-400" />
            <span>Secure sign-in with your Autodesk account</span>
          </div>

          {/* Features Grid */}
          <div className="login-features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FolderTree size={20} className="text-cyan-400" />
              </div>
              <div>
                <h3>Open your project</h3>
                <p>Browse ACC and BIM 360 projects, folders, and model files.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Layers size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3>Explore every element</h3>
                <p>Explore beams, walls, and model properties in an interactive 3D view.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <FileCheck size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3>Connect your schedule</h3>
                <p>Link progress, start dates, and finish dates using Saipem_IDENT.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={20} className="text-amber-400" />
              </div>
              <div>
                <h3>Ask your model</h3>
                <p>Query model elements and project data with your local AI assistant.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <p>BUILDSPACE · Powered by Autodesk Platform Services</p>
      </footer>
    </div>
  );
};
