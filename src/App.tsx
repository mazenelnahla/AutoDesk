import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AutodeskViewer } from './components/AutodeskViewer';
import { InspectorPanel } from './components/InspectorPanel';
import { LoginPage } from './components/LoginPage';
import type {
  APSHub,
  APSProject,
  APSItem,
  APSUser,
  OAuthTokens,
} from './types/aps';
import {
  exchangeCodeForTokens,
  getTokens,
  saveTokens,
  refreshAuthTokens,
  clearAuth,
  fetchUserProfile,
  getStoredUser,
} from './services/auth';
import {
  fetchLiveHubs,
  fetchLiveProjects,
  fetchLiveTopFolders,
  fetchLiveFolderContents,
} from './services/apsData';

export function App() {
  const [tokens, setTokens] = useState<OAuthTokens | null>(getTokens);
  const [user, setUser] = useState<APSUser | null>(getStoredUser);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data Management state
  const [hubs, setHubs] = useState<APSHub[]>([]);
  const [selectedHub, setSelectedHub] = useState<APSHub | null>(null);
  const [projects, setProjects] = useState<APSProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<APSProject | null>(null);
  const [items, setItems] = useState<APSItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<APSItem | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // 1. Handle OAuth Callback on Mount (Backend redirect or direct PKCE)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const directAccessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const expiresIn = urlParams.get('expires_in');

    if (directAccessToken) {
      const newTokens: OAuthTokens = {
        access_token: directAccessToken,
        refresh_token: refreshToken || undefined,
        expires_in: Number(expiresIn) || 3600,
        token_type: 'Bearer',
        expires_at: Date.now() + (Number(expiresIn) || 3600) * 1000,
      };
      setIsLoadingAuth(true);
      fetchUserProfile(directAccessToken)
        .then((profile) => {
          saveTokens(newTokens);
          setTokens(newTokens);
          setUser(profile);
          setAuthError(null);
        })
        .catch((err) => {
          console.error('Failed to fetch user profile:', err);
          clearAuth();
          setTokens(null);
          setUser(null);
          setAuthError(err.message || 'Failed to retrieve Autodesk profile. Please login again.');
        })
        .finally(() => {
          setIsLoadingAuth(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (code) {
      setIsLoadingAuth(true);
      exchangeCodeForTokens(code, {
        clientId: import.meta.env.VITE_APS_CLIENT_ID || '',
        redirectUri: window.location.origin + '/',
        scopes: ['data:read', 'viewables:read', 'user-profile:read'],
      })
        .then(async (newTokens) => {
          const profile = await fetchUserProfile(newTokens.access_token);
          setTokens(newTokens);
          setUser(profile);
          setAuthError(null);
        })
        .catch((err) => {
          console.error('OAuth Callback Error:', err);
          clearAuth();
          setTokens(null);
          setUser(null);
          setAuthError(err.message || 'Autodesk authentication failed.');
        })
        .finally(() => {
          setIsLoadingAuth(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  // 1b. Check token expiration / auto-refresh session / sync user profile
  useEffect(() => {
    if (!tokens) return;

    const isExpiringSoon = Date.now() >= tokens.expires_at - 60000;
    if (isExpiringSoon) {
      if (tokens.refresh_token) {
        refreshAuthTokens(tokens.refresh_token)
          .then((refreshed) => setTokens(refreshed))
          .catch((err) => {
            console.error('Session refresh failed:', err);
            handleLogout();
            setAuthError('Authentication session expired. Please sign in again.');
          });
      } else {
        handleLogout();
        setAuthError('Authentication session expired. Please sign in again.');
      }
    } else if (!user && tokens.access_token) {
      fetchUserProfile(tokens.access_token)
        .then(setUser)
        .catch((err) => {
          console.error('User profile sync failed:', err);
          handleLogout();
          setAuthError(err.message || 'Failed to verify Autodesk user profile.');
        });
    }
  }, [tokens, user]);

  // 2. Load Hubs when Auth token is ready
  useEffect(() => {
    const activeToken = tokens?.access_token;
    if (!activeToken) {
      setHubs([]);
      setSelectedHub(null);
      setProjects([]);
      setSelectedProject(null);
      setItems([]);
      setSelectedItem(null);
      return;
    }

    setIsLoadingTree(true);

    fetchLiveHubs(activeToken)
      .then((liveHubs) => {
        if (liveHubs && liveHubs.length > 0) {
          setHubs(liveHubs);
          setSelectedHub(liveHubs[0]);
        } else {
          setHubs([]);
          setSelectedHub(null);
          setProjects([]);
          setSelectedProject(null);
          setItems([]);
          setSelectedItem(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch live ACC hubs:', err);
        setHubs([]);
        setSelectedHub(null);
        setProjects([]);
        setSelectedProject(null);
        setItems([]);
        setSelectedItem(null);
      })
      .finally(() => {
        setIsLoadingTree(false);
      });
  }, [tokens]);

  // 3. Load Projects when Selected Hub changes
  useEffect(() => {
    const activeToken = tokens?.access_token;
    if (!selectedHub || !activeToken) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }

    setIsLoadingTree(true);

    fetchLiveProjects(selectedHub.id, activeToken)
      .then((liveProjects) => {
        setProjects(liveProjects);
        if (liveProjects.length > 0) {
          setSelectedProject(liveProjects[0]);
        } else {
          setSelectedProject(null);
        }
      })
      .catch((err) => {
        console.error('Error fetching live projects:', err);
      })
      .finally(() => {
        setIsLoadingTree(false);
      });
  }, [selectedHub, tokens]);

  // 4. Load Folder Contents when Selected Project changes
  useEffect(() => {
    const activeToken = tokens?.access_token;
    if (!selectedProject || !selectedHub || !activeToken) {
      setItems([]);
      setSelectedItem(null);
      return;
    }

    setIsLoadingTree(true);

    const basePath = `/${selectedHub.name}/${selectedProject.name}`;

    // Fetch top folders using topFolders endpoint or rootFolderId contents
    const loadItems = async () => {
      try {
        let liveItems = [];
        if (selectedProject.rootFolderId) {
          try {
            liveItems = await fetchLiveFolderContents(selectedProject.id, selectedProject.rootFolderId, activeToken);
          } catch (e) {
            console.warn('Root folder contents fetch failed, falling back to topFolders:', e);
            liveItems = await fetchLiveTopFolders(selectedHub.id, selectedProject.id, activeToken);
          }
        } else {
          liveItems = await fetchLiveTopFolders(selectedHub.id, selectedProject.id, activeToken);
        }

        const itemsWithPaths = (liveItems || []).map((item) => ({
          ...item,
          path: item.path || `${basePath}/${item.displayName}`,
        }));
        setItems(itemsWithPaths);
        const revitFile = itemsWithPaths.find((i) => i.isRevit);
        if (revitFile) {
          setSelectedItem(revitFile);
        } else if (itemsWithPaths.length > 0) {
          setSelectedItem(itemsWithPaths[0]);
        }
      } catch (err) {
        console.error('Error fetching project folder contents:', err);
        setItems([]);
      } finally {
        setIsLoadingTree(false);
      }
    };

    loadItems();
  }, [selectedProject, selectedHub, tokens]);

  // Handlers
  const handleLogin = () => {
    setAuthError(null);
    window.location.href = '/api/auth/login';
  };

  const handleLogout = () => {
    clearAuth();
    setTokens(null);
    setUser(null);
  };

  // If not logged in or user profile missing, render the Autodesk Login Landing Page
  if (!tokens || !user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isLoadingAuth={isLoadingAuth}
        authError={authError}
      />
    );
  }

  // Once authenticated, render Main Dashboard Layout
  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        user={user}
        isAuthenticated={!!tokens}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoadingAuth={isLoadingAuth}
      />

      {/* Main Content Area */}
      <div className="app-main-layout">
        {/* Left Sidebar Tree */}
        <Sidebar
          hubs={hubs}
          selectedHub={selectedHub}
          onSelectHub={(hub) => setSelectedHub(hub)}
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={(proj) => setSelectedProject(proj)}
          items={items}
          selectedItem={selectedItem}
          onSelectItem={(item) => setSelectedItem(item)}
          isLoading={isLoadingTree}
          accessToken={tokens?.access_token || null}
        />

        {/* Center 3D Revit Viewer */}
        <AutodeskViewer
          selectedItem={selectedItem}
          accessToken={tokens?.access_token || null}
          onLoginRequest={handleLogin}
        />

        {/* Right Metadata Inspector */}
        <InspectorPanel
          selectedItem={selectedItem}
        />
      </div>
    </div>
  );
}

export default App;
