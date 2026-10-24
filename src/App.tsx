import { scheduleRecordKey, indexScheduleRecords } from './utils/scheduleRecords';
import { useEffect, useState, useCallback } from 'react';
import { useMcpBridge } from './services/useMcpBridge';
import { PanelRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AutodeskViewer } from './components/AutodeskViewer';
import { InspectorPanel } from './components/InspectorPanel';
import { ExcelDataModal } from './components/ExcelDataModal';
import { LoginPage } from './components/LoginPage';
import { AuthLoadingScreen } from './components/AuthLoadingScreen';
import type {
  APSHub,
  APSProject,
  APSItem,
  APSUser,
  ViewerSelectedObject,
  ElementScheduleData,
  ScannedModelIdentMap,
  ProjectSection,
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
import {
  saveScheduleData,
  fetchScheduleForProject,
} from './utils/excelSchedule';

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

  // Model-scanned Saipem_IDENT mapping from AutodeskViewer
  const [modelIdentsMap, setModelIdentsMap] = useState<ScannedModelIdentMap>({});
  const [modelSections, setModelSections] = useState<ProjectSection[]>([]);

  // Excel Schedule State (keyed by Saipem_IDENT, scoped per project)
  const [scheduleDataMap, setScheduleDataMap] = useState<Record<string, ElementScheduleData>>({});
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [focusedSaipemIdent, setFocusedSaipemIdent] = useState<string | null>(null);
  const [focusedDbId, setFocusedDbId] = useState<number | null>(null);
  const [isolatedDbIds, setIsolatedDbIds] = useState<number[] | null>(null);
  const [isolatedIdent, setIsolatedIdent] = useState<string | null>(null);
  const [isIsolated, setIsIsolated] = useState<boolean>(false);
  const [isolateTrigger, setIsolateTrigger] = useState<number>(0);

  // Sidebar Collapse / Expand State
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('aps_left_collapsed') === 'true';
  });
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('aps_right_collapsed') === 'true';
  });

  const toggleLeftSidebar = useCallback(() => {
    setIsLeftCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('aps_left_collapsed', String(next));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if ((window as any).apsViewer?.resize) {
          (window as any).apsViewer.resize();
        }
      }, 260);
      return next;
    });
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setIsRightCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('aps_right_collapsed', String(next));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        if ((window as any).apsViewer?.resize) {
          (window as any).apsViewer.resize();
        }
      }, 260);
      return next;
    });
  }, []);

  const handleIsolatePart = useCallback((dbId?: number, ident?: string, dbIds?: number[]) => {
    let resolvedDbIds: number[] = [];
    if (dbIds && dbIds.length > 0) {
      resolvedDbIds = dbIds;
    } else if (dbId) {
      resolvedDbIds = [dbId];
    } else if (ident && modelIdentsMap[ident]?.dbIds) {
      resolvedDbIds = modelIdentsMap[ident].dbIds;
    }

    setFocusedDbId(dbId ?? null);
    setFocusedSaipemIdent(ident ?? null);
    setIsolatedDbIds(resolvedDbIds.length > 0 ? resolvedDbIds : (dbId ? [dbId] : null));
    setIsolatedIdent(ident ?? null);
    setIsIsolated(true);
    setIsolateTrigger((prev) => prev + 1);
  }, [modelIdentsMap]);

  const handleClearIsolation = useCallback(() => {
    setFocusedDbId(null);
    setFocusedSaipemIdent(null);
    setIsolatedDbIds(null);
    setIsolatedIdent(null);
    setIsIsolated(false);
    setIsolateTrigger((prev) => prev + 1);
  }, []);

  // Model dbIds and scanned classifications are never transferable across models.
  useEffect(() => {
    setSelectedObject(null);
    setModelIdentsMap({});
    setModelSections([]);
    setScheduleDataMap({});
    setIsExcelModalOpen(false);
    handleClearIsolation();
  }, [selectedProject?.id, selectedItem?.base64Urn, selectedItem?.id, handleClearIsolation]);

  useMcpBridge(!!user, {
    modelId: selectedItem?.base64Urn,
    projectName: selectedProject?.name,
    modelName: selectedItem?.displayName,
    selectedObject,
    sections: modelSections,
    scheduleDataMap,
    modelIdentsMap: Object.fromEntries(Object.entries(modelIdentsMap).map(([ident, { dbIds, name, category }]) => [ident, { dbIds, name, category }])),
    isIsolated,
    isolatedCount: isolatedDbIds?.length || 0,
  }, handleIsolatePart, handleClearIsolation);

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

  // Load and fetch schedule data scoped to the currently selected project and matching its Saipem_IDENTs
  useEffect(() => {
    if (!selectedProject) {
      setScheduleDataMap({});
      return;
    }

    const modelKey = selectedItem?.base64Urn || selectedItem?.id;
    const { scheduleMap } = fetchScheduleForProject({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      modelKey,
      modelIdents: modelIdentsMap,
    });
    setScheduleDataMap(scheduleMap);
  }, [selectedProject?.id, selectedProject?.name, selectedItem?.base64Urn, selectedItem?.id, modelIdentsMap]);

  // Callback when 3D model properties are scanned in AutodeskViewer
  const handleModelIdentsScanned = useCallback((scanned: ScannedModelIdentMap) => {
    setModelIdentsMap(scanned);
    if (selectedProject) {
      const modelKey = selectedItem?.base64Urn || selectedItem?.id;
      const { scheduleMap } = fetchScheduleForProject({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        modelKey,
        modelIdents: scanned,
      });
      setScheduleDataMap(scheduleMap);
    }
  }, [selectedProject, selectedItem]);



  // Handler to update or insert single element schedule entry
  const handleUpdateScheduleData = useCallback((entry: ElementScheduleData) => {
    if (!entry.saipemIdent) return;
    const taggedEntry: ElementScheduleData = {
      ...entry,
      modelUrn: selectedItem?.base64Urn || selectedItem?.id,
      projectId: entry.projectId || selectedProject?.id,
      projectName: entry.projectName || selectedProject?.name,
      updatedAt: new Date().toISOString(),
    };

    setScheduleDataMap((prev) => {
      const updated = {
        ...indexScheduleRecords(Object.values(prev)),
        [scheduleRecordKey(taggedEntry)]: taggedEntry,
      };
      const modelKey = selectedItem?.base64Urn || selectedItem?.id;
      saveScheduleData(modelKey, updated, selectedProject?.id);
      return updated;
    });
  }, [selectedItem, selectedProject]);

  // Handler to bulk import multiple records from Excel
  const handleImportExcelSchedule = useCallback((newItems: ElementScheduleData[]) => {
    setScheduleDataMap((prev) => {
      const updated = indexScheduleRecords(Object.values(prev));
      newItems.forEach((item) => {
        if (item.saipemIdent) {
          const taggedItem = {
            ...item,
            modelUrn: selectedItem?.base64Urn || selectedItem?.id,
            projectId: item.projectId || selectedProject?.id,
            projectName: item.projectName || selectedProject?.name,
          };
          updated[scheduleRecordKey(taggedItem)] = { ...updated[scheduleRecordKey(taggedItem)], ...taggedItem };
        }
      });
      const modelKey = selectedItem?.base64Urn || selectedItem?.id;
      saveScheduleData(modelKey, updated, selectedProject?.id);
      return updated;
    });
  }, [selectedItem, selectedProject]);

  // Handler to explicitly assign an Excel record to the currently selected 3D piece
  const handleAssignToSelectedObject = useCallback((item: ElementScheduleData) => {
    if (!selectedObject) return;

    const assignedEntry: ElementScheduleData = {
      ...item,
      dbId: selectedObject.dbId,
      elementName: selectedObject.name || item.elementName,
      updatedAt: new Date().toISOString(),
    };

    handleUpdateScheduleData(assignedEntry);
  }, [selectedObject, handleUpdateScheduleData]);

  // 2. Load Hubs when user is logged in (Auto-select first hub)
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
          setSelectedHub((prev) => (prev ? prev : liveHubs[0]));
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

  // 3. Load Projects when Selected Hub changes (Auto-select first project)
  useEffect(() => {
    if (!user || !selectedHub) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingTree(true);

    // Immediately clear projects and project selection if current project does not belong to selectedHub
    setSelectedProject((prev) => (prev && prev.hubId === selectedHub.id ? prev : null));

    fetchLiveProjects(selectedHub.id)
      .then((liveProjects) => {
        if (isCancelled) return;
        setProjects(liveProjects);
        if (liveProjects.length > 0) {
          setSelectedProject((prev) => {
            const exists = prev && prev.hubId === selectedHub.id && liveProjects.find((p) => p.id === prev.id);
            return exists ? prev : liveProjects[0];
          });
        } else {
          setSelectedProject(null);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Error fetching live projects:', err);
        setProjects([]);
        setSelectedProject(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingTree(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedHub, user]);

  // 4. Load Top Folders when Selected Project changes
  useEffect(() => {
    if (!user || !selectedProject || !selectedHub) {
      setItems([]);
      setSelectedItem(null);
      setSelectedObject(null);
      return;
    }

    // Safety guard: ensure the project belongs to the selected hub
    if (selectedProject.hubId && selectedProject.hubId !== selectedHub.id) {
      return;
    }

    let isCancelled = false;
    setIsLoadingTree(true);

    const basePath = `/${selectedHub.name}/${selectedProject.name}`;

    fetchLiveContents(selectedHub.id, selectedProject.id)
      .then((liveItems) => {
        if (isCancelled) return;
        const itemsWithPaths = (liveItems || []).map((item) => ({
          ...item,
          path: `${basePath}/${item.displayName}`,
        }));
        setItems(itemsWithPaths);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Error fetching project top contents:', err);
        setItems([]);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingTree(false);
        }
      });

    return () => {
      isCancelled = true;
    };
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
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        totalScheduleCount={Object.keys(scheduleDataMap).length}
      />

      {/* Main Content Area */}
      <div className="app-main-layout">
        {/* Left Sidebar Tree & AI Assistant */}
        <Sidebar
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={toggleLeftSidebar}
          hubs={hubs}
          selectedHub={selectedHub}
          onSelectHub={(hub) => {
            if (hub.id === selectedHub?.id) return;
            handleClearIsolation();
            setSelectedHub(hub);
            setSelectedProject(null);
            setProjects([]);
            setItems([]);
            setSelectedItem(null);
            setSelectedObject(null);
          }}
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={(proj) => {
            if (proj.id === selectedProject?.id) return;
            handleClearIsolation();
            setSelectedProject(proj);
            setItems([]);
            setSelectedItem(null);
            setSelectedObject(null);
          }}
          items={items}
          selectedItem={selectedItem}
          onSelectItem={(item) => {
            setSelectedItem(item);
            setSelectedObject(null);
            handleClearIsolation();
          }}
          isLoading={isLoadingTree}
          selectedObject={selectedObject}
          scheduleDataMap={scheduleDataMap}
          modelIdentsMap={modelIdentsMap}
          modelSections={modelSections}
          isIsolated={isIsolated}
          isolatedDbIds={isolatedDbIds}
          onIsolatePart={handleIsolatePart}
          onClearIsolation={handleClearIsolation}
        />

        {/* Center 3D Model / Revit Viewer */}
        <AutodeskViewer
          key={`${selectedProject?.id || ""}:${selectedItem?.base64Urn || selectedItem?.id || ""}`}
          selectedItem={selectedItem}
          isAuthenticated={!!user}
          onLoginRequest={handleLogin}
          onObjectSelected={(obj) => setSelectedObject(obj)}
          onIsolatePart={handleIsolatePart}
          scheduleDataMap={scheduleDataMap}
          onOpenExcelModal={() => setIsExcelModalOpen(true)}
          focusedSaipemIdent={focusedSaipemIdent}
          focusedDbId={focusedDbId}
          isolatedDbIds={isolatedDbIds}
          isIsolated={isIsolated}
          isolateTrigger={isolateTrigger}
          onClearIsolation={handleClearIsolation}
          onModelIdentsScanned={handleModelIdentsScanned}
          onModelSectionsScanned={(sections) => setModelSections(sections)}
        />

        {/* Persistent inspector rail, mirroring the left navigation. */}
        <div className={`inspector-shell${isRightCollapsed ? ' is-collapsed' : ''}`}>
        <div id="inspector-content" className="inspector-shell-content" hidden={isRightCollapsed}>
        <InspectorPanel
          isCollapsed={isRightCollapsed}
          onToggleCollapse={toggleRightSidebar}
          selectedItem={selectedItem}
          selectedProject={selectedProject}
          selectedObject={selectedObject}
          scheduleDataMap={scheduleDataMap}
          modelIdentsMap={modelIdentsMap}
          onUpdateScheduleData={handleUpdateScheduleData}
          onOpenExcelModal={() => setIsExcelModalOpen(true)}
          onSelectSaipemIdent={(ident) => {
            setFocusedSaipemIdent(ident);
          }}
          onIsolatePart={handleIsolatePart}
          onClearIsolation={handleClearIsolation}
          isIsolated={isIsolated}
          isolatedIdent={isolatedIdent}
        />
        </div>
        <nav className="inspector-side-rail" aria-label="Inspector navigation">
          <button
            type="button"
            className={`side-rail-btn${!isRightCollapsed ? ' active' : ''}`}
            onClick={() => { if (isRightCollapsed) toggleRightSidebar(); }}
            title="Open Inspector"
            aria-label="Open Inspector"
            aria-expanded={!isRightCollapsed}
            aria-controls="inspector-content"
          >
            <PanelRight size={18} />
          </button>
          <button
            type="button"
            className="side-rail-btn"
            onClick={toggleRightSidebar}
            title={isRightCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            aria-label={isRightCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            aria-expanded={!isRightCollapsed}
            aria-controls="inspector-content"
          >
            {isRightCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </nav>
        </div>
      </div>

      {/* Excel Data & Saipem_IDENT Hub Modal */}
      <ExcelDataModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        scheduleList={Object.values(scheduleDataMap)}
        onImportSchedule={handleImportExcelSchedule}
        onAssignToSelectedObject={handleAssignToSelectedObject}
        onSelectSaipemIdent={(ident) => {
          setFocusedSaipemIdent(ident);
        }}
        onIsolatePart={handleIsolatePart}
        currentModelName={selectedItem?.displayName}
        modelUrn={selectedItem?.base64Urn || selectedItem?.id}
        selectedObject={selectedObject}
        selectedProject={selectedProject}
        scannedModelIdents={modelIdentsMap}
      />
    </div>
  );
}

export default App;
