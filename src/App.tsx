import { useEffect, useState, useCallback } from 'react';
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
} from './types/aps';
import {
  fetchUserProfile,
  initiateLogin,
  initiateLogout,
} from './services/auth';
import {
  fetchLiveHubs,
  fetchLiveProjects,
  fetchLiveContents,
} from './services/apsData';

export function App() {
  const [user, setUser] = useState<APSUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data Management state
  const [hubs, setHubs] = useState<APSHub[]>([]);
  const [selectedHub, setSelectedHub] = useState<APSHub | null>(null);
  const [projects, setProjects] = useState<APSProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<APSProject | null>(null);
  const [items, setItems] = useState<APSItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<APSItem | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // 1. Check current session & fetch profile on load
  const checkSession = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const profile = await fetchUserProfile();
      setUser(profile);
      if (window.location.search.includes('auth_success')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: any) {
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // 2. Load Hubs when user is logged in
  useEffect(() => {
    if (!user) {
      setHubs([]);
      setSelectedHub(null);
      setProjects([]);
      setSelectedProject(null);
      setItems([]);
      setSelectedItem(null);
      return;
    }

    setIsLoadingTree(true);

    fetchLiveHubs()
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
        console.error('Failed to fetch hubs:', err);
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
  }, [user]);

  // 3. Load Projects when Selected Hub changes
  useEffect(() => {
    if (!user || !selectedHub) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }

    setIsLoadingTree(true);

    fetchLiveProjects(selectedHub.id)
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
        setProjects([]);
        setSelectedProject(null);
      })
      .finally(() => {
        setIsLoadingTree(false);
      });
  }, [selectedHub, user]);

  // 4. Load Top Folders when Selected Project changes
  useEffect(() => {
    if (!user || !selectedProject || !selectedHub) {
      setItems([]);
      setSelectedItem(null);
      return;
    }

    setIsLoadingTree(true);

    const basePath = `/${selectedHub.name}/${selectedProject.name}`;

    fetchLiveContents(selectedHub.id, selectedProject.id)
      .then((liveItems) => {
        const itemsWithPaths = (liveItems || []).map((item) => ({
          ...item,
          path: `${basePath}/${item.displayName}`,
        }));
        setItems(itemsWithPaths);
      })
      .catch((err) => {
        console.error('Error fetching project top contents:', err);
        setItems([]);
      })
      .finally(() => {
        setIsLoadingTree(false);
      });
  }, [selectedProject, selectedHub, user]);

  const handleLogin = () => {
    initiateLogin();
  };

  const handleLogout = () => {
    setUser(null);
    initiateLogout();
  };

  // If auth is loading, render a sleek loader
  if (isLoadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <p className="text-sm font-medium text-cyan-400">Authenticating with Autodesk Platform Services...</p>
        </div>
      </div>
    );
  }

  // If not logged in, render the Login Landing Page
  if (!user) {
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
        isAuthenticated={!!user}
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
        />

        {/* Center 3D Model / Revit Viewer */}
        <AutodeskViewer
          selectedItem={selectedItem}
          isAuthenticated={!!user}
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
