import { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AutodeskViewer } from './components/AutodeskViewer';
import { InspectorPanel } from './components/InspectorPanel';
import { LoginPage } from './components/LoginPage';
import { AuthLoadingScreen } from './components/AuthLoadingScreen';
import type {
  APSHub,
  APSProject,
  APSItem,
  APSUser,
  ViewerSelectedObject,
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

  // 3D Viewer Object Selection State
  const [selectedObject, setSelectedObject] = useState<ViewerSelectedObject | null>(null);

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
      setSelectedObject(null);
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
          setSelectedObject(null);
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
        setSelectedObject(null);
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
      setSelectedObject(null);
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

  // If auth is loading, render the modern high-end loading screen
  if (isLoadingAuth) {
    return <AuthLoadingScreen />;
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
          onSelectHub={(hub) => {
            setSelectedHub(hub);
            setSelectedObject(null);
          }}
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={(proj) => {
            setSelectedProject(proj);
            setSelectedObject(null);
          }}
          items={items}
          selectedItem={selectedItem}
          onSelectItem={(item) => {
            setSelectedItem(item);
            setSelectedObject(null);
          }}
          isLoading={isLoadingTree}
        />

        {/* Center 3D Model / Revit Viewer */}
        <AutodeskViewer
          selectedItem={selectedItem}
          isAuthenticated={!!user}
          onLoginRequest={handleLogin}
          onObjectSelected={(obj) => setSelectedObject(obj)}
        />

        {/* Right Metadata & Properties Inspector */}
        <InspectorPanel
          selectedItem={selectedItem}
          selectedObject={selectedObject}
        />
      </div>
    </div>
  );
}

export default App;

