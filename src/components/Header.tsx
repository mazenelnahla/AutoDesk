import React, { useState } from 'react';
import {
  Box,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import type { APSUser } from '../types/aps';

interface HeaderProps {
  user: APSUser | null;
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
  isLoadingAuth: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isAuthenticated,
  onLogin,
  onLogout,
  isLoadingAuth,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-container">
          <Box className="logo-icon text-cyan-400" size={26} />
          <div className="logo-badge">APS</div>
        </div>
        <div className="brand-titles">
          <h1 className="brand-name">Autodesk Platform Services</h1>
          <p className="brand-subtitle">Revit BIM Explorer & 3D Model Viewer</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Live Mode Auth Status or Sign In Button */}
        <div className="auth-section">
          {isAuthenticated ? (
            <div className="user-authenticated-container">
              {/* User Profile Pill & Dropdown */}
              <div className="user-dropdown-wrapper">
                <button
                  className="user-profile-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                >
                  {user?.profileImages?.sizeX40 ? (
                    <img
                      src={user.profileImages.sizeX40}
                      alt={user.userName || 'Autodesk User'}
                      className="user-avatar-img"
                    />
                  ) : (
                    <div className="user-avatar-fallback">
                      <UserIcon size={16} />
                    </div>
                  )}
                  <div className="user-name-wrapper">
                    <span className="user-name">{user?.userName || 'Autodesk User'}</span>
                    {user?.emailId && <span className="user-email-sub">{user.emailId}</span>}
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {showUserDropdown && (
                  <div className="user-dropdown-menu">
                    <div className="user-info-header">
                      <p className="user-info-name">{user?.userName || 'Autodesk User'}</p>
                      {user?.emailId && <p className="user-info-email">{user.emailId}</p>}
                    </div>
                    <div className="menu-divider" />
                    <a
                      href="https://aps.autodesk.com/myapps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="menu-item"
                    >
                      <ExternalLink size={14} />
                      <span>Autodesk Developer Portal</span>
                    </a>
                    <button className="menu-item text-red-400" onClick={onLogout}>
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct Logout Button */}
              <button
                className="btn-logout-direct"
                onClick={onLogout}
                title="Sign out of Autodesk"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              className="btn-autodesk-login"
              onClick={onLogin}
              disabled={isLoadingAuth}
            >
              {isLoadingAuth ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <LogIn size={16} />
              )}
              <span>Sign in with Autodesk</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
