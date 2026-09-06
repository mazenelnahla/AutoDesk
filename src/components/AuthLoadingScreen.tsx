import React from 'react';
import { Box, ShieldCheck, Sparkles } from 'lucide-react';

export const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="auth-loading-viewport">
      {/* Dynamic Background Ambient Glow Orbs */}
      <div className="auth-loading-glow orb-1" />
      <div className="auth-loading-glow orb-2" />
      <div className="auth-loading-glow orb-3" />

      {/* Main Glassmorphic Card */}
      <div className="auth-loading-card">
        {/* Animated Brand Holographic Badge */}
        <div className="auth-loading-logo-wrapper">
          <div className="auth-logo-pulse-ring" />
          <div className="auth-logo-pulse-ring delay" />
          <div className="auth-logo-core">
            <Box size={38} className="auth-box-icon" />
          </div>
        </div>

        {/* Brand & Loading Status */}
        <div className="auth-loading-content">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="auth-badge-aps">APS CLOUD ENGINE</span>
            <Sparkles size={13} className="text-cyan-400 animate-pulse" />
          </div>
          <h2 className="auth-loading-title">Autodesk Platform Services</h2>
          <p className="auth-loading-subtitle">
            Verifying 3-legged OAuth session & initializing ACC / BIM 360 data hub...
          </p>
        </div>

        {/* Futuristic Multi-Step Progress Bar */}
        <div className="auth-progress-container">
          <div className="auth-progress-bar-glow" />
          <div className="auth-progress-bar-fill" />
        </div>

        {/* Security & Token Info Footer */}
        <div className="auth-loading-footer">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span>OAuth 2.0 PKCE Session Exchange</span>
        </div>
      </div>
    </div>
  );
};
