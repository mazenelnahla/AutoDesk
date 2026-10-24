import React, { useState } from 'react';
import {
  Box,
  LogIn,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet
} from 'lucide-react';
import type { APSUser } from '../types/aps';

interface HeaderProps {
  user: APSUser | null;
  isAuthenticated: boolean;
  onLogin: () => void;
  isLoadingAuth: boolean;
  onOpenExcelModal?: () => void;
  totalScheduleCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isAuthenticated,
  onLogin,
  isLoadingAuth,
  onOpenExcelModal,
  totalScheduleCount = 0,
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
          <h1 className="brand-name">Buildspace</h1>
          <p className="brand-subtitle">Construction intelligence workspace</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Global Upload / Manage Excel Button */}
        {isAuthenticated && onOpenExcelModal && (
          <button
            className="btn-header-excel"
            onClick={onOpenExcelModal}
            title="Import and manage the schedule for the current project"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            <span>Import schedule</span>
            {totalScheduleCount > 0 && (
              <span className="header-excel-count-pill">{totalScheduleCount}</span>
            )}
          </button>
        )}

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
                  </div>
                )}
              </div>

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
              <span>Retry APS connection</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
