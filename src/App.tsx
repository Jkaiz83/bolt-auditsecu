import React from 'react';
import { useState, useEffect } from 'react';
import { ConnectionForm } from './components/ConnectionForm';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { SpaceSelector } from './components/SpaceSelector';
import { ListSelector } from './components/ListSelector';
import { TaskManager } from './components/TaskManager';
import { Toast } from './components/Toast';
import { clickupApi } from './services/clickupApi';
import { 
  ConnectionConfig, 
  ClickUpWorkspace, 
  ClickUpSpace, 
  ClickUpList, 
  ClickUpStatus, 
  ClickUpTask 
} from './types/clickup';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

function App() {
  // État de connexion
  const [config, setConfig] = useState<ConnectionConfig>({ apiKey: '', domain: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    microsoft: false,
    clickup: false
  });

  // États des données ClickUp
  const [workspaces, setWorkspaces] = useState<ClickUpWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<ClickUpWorkspace | null>(null);
  const [spaces, setSpaces] = useState<ClickUpSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ClickUpSpace | null>(null);
  const [lists, setLists] = useState<ClickUpList[]>([]);
  const [selectedList, setSelectedList] = useState<ClickUpList | null>(null);
  const [statuses, setStatuses] = useState<ClickUpStatus[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);

  // États de chargement
  const [loadingStates, setLoadingStates] = useState({
    workspaces: false,
    spaces: false,
    lists: false,
    tasks: false
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleConnect = async (newConfig: ConnectionConfig) => {
    setIsConnecting(true);
    try {
      const result = await clickupApi.connect(newConfig);
      if (result.success) {
        setConfig(newConfig);
        setConnectionStatus({
          microsoft: result.microsoftConnected || false,
          clickup: result.clickupConnected || false
        });
        showToast('success', 'Connexion réussie !');
        loadWorkspaces(newConfig);
      } else {
        showToast('error', `Erreur de connexion: ${result.error}`);
      }
    } catch (error) {
      showToast('error', 'Erreur lors de la connexion');
    } finally {
      setIsConnecting(false);
    }
  };

  const loadWorkspaces = async (configToUse = config) => {
    setLoadingStates(prev => ({ ...prev, workspaces: true }));
    try {
      const result = await clickupApi.getWorkspaces(configToUse);
      if (result.success && result.data) {
        setWorkspaces(result.data);
      } else {
        showToast('error', `Erreur lors du chargement des workspaces: ${result.error}`);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, workspaces: false }));
    }
  };

  const handleSelectWorkspace = (workspace: ClickUpWorkspace) => {
    setSelectedWorkspace(workspace);
    setSelectedSpace(null);
    setSelectedList(null);
    setSpaces([]);
    setLists([]);
    setTasks([]);
    setStatuses([]);
    setSelectedStatus('');
    loadSpaces(workspace.id);
    showToast('success', `Workspace sélectionné: ${workspace.name}`);
  };

  const loadSpaces = async (workspaceId: string) => {
    setLoadingStates(prev => ({ ...prev, spaces: true }));
    try {
      const result = await clickupApi.getSpaces(config, workspaceId);
      if (result.success && result.data) {
        setSpaces(result.data);
      } else {
        showToast('error', `Erreur lors du chargement des espaces: ${result.error}`);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, spaces: false }));
    }
  };

  const handleSelectSpace = (space: ClickUpSpace) => {
    setSelectedSpace(space);
    setSelectedList(null);
    setLists([]);
    setTasks([]);
    setStatuses([]);
    setSelectedStatus('');
    loadLists(space.id);
    showToast('success', `Espace sélectionné: ${space.name}`);
  };

  const loadLists = async (spaceId: string) => {
    setLoadingStates(prev => ({ ...prev, lists: true }));
    try {
      const result = await clickupApi.getFoldersAndLists(config, spaceId);
      if (result.success && result.data) {
        setLists(result.data);
      } else {
        showToast('error', `Erreur lors du chargement des listes: ${result.error}`);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, lists: false }));
    }
  };

  const handleSelectList = async (list: ClickUpList) => {
    if (list.type === 'folder') {
      // Charger les listes du dossier
      try {
        const result = await clickupApi.getFolderLists(config, list.id);
        if (result.success && result.data) {
          setLists(prev => [...prev, ...result.data]);
        }
      } catch (error) {
        showToast('error', 'Erreur lors du chargement des listes du dossier');
      }
      return;
    }

    setSelectedList(list);
    setTasks([]);
    setSelectedStatus('');
    loadListStatuses(list.id);
    showToast('success', `Liste sélectionnée: ${list.name}`);
  };

  const loadListStatuses = async (listId: string) => {
    try {
      const result = await clickupApi.getListStatuses(config, listId);
      if (result.success && result.data) {
        setStatuses(result.data);
      } else {
        showToast('error', `Erreur lors du chargement des statuts: ${result.error}`);
      }
    } catch (error) {
      showToast('error', 'Erreur lors du chargement des statuts');
    }
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    if (status && selectedList) {
      loadTasks(selectedList.id, status);
    }
  };

  const loadTasks = async (listId: string, status: string) => {
    setLoadingStates(prev => ({ ...prev, tasks: true }));
    try {
      const result = await clickupApi.getTasks(config, listId, status);
      if (result.success && result.data) {
        setTasks(result.data);
      } else {
        showToast('error', `Erreur lors du chargement des tâches: ${result.error}`);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, tasks: false }));
    }
  };

  const handleExecuteTask = async (task: ClickUpTask) => {
    try {
      // Mettre à jour le statut de la tâche localement
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'running' as const } : t
      ));

      const result = await clickupApi.executeTask(config, task.id, task.name, task.command);
      
      if (result.success) {
        setTasks(prev => prev.map(t => 
          t.id === task.id ? { 
            ...t, 
            status: result.status === 'CONFORME' ? 'success' as const : 'error' as const,
            output: result.output || 'Exécution terminée'
          } : t
        ));
        showToast('success', `Tâche "${task.name}" exécutée avec succès`);
      } else {
        setTasks(prev => prev.map(t => 
          t.id === task.id ? { 
            ...t, 
            status: 'error' as const,
            output: result.error || 'Erreur inconnue'
          } : t
        ));
        showToast('error', `Erreur lors de l'exécution de "${task.name}": ${result.error}`);
      }
    } catch (error) {
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'error' as const } : t
      ));
      showToast('error', `Erreur lors de l'exécution de "${task.name}"`);
    }
  };

  const handleExecuteAll = async () => {
    for (const task of tasks) {
      await handleExecuteTask(task);
      // Attendre un peu entre les exécutions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    showToast('success', 'Toutes les tâches ont été exécutées');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Interface ClickUp Automation</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Connexion */}
          <ConnectionForm
            onConnect={handleConnect}
            isConnecting={isConnecting}
            connectionStatus={connectionStatus}
          />

          {/* Workspaces */}
          {connectionStatus.clickup && (
            <WorkspaceSelector
              workspaces={workspaces}
              selectedWorkspace={selectedWorkspace}
              onSelectWorkspace={handleSelectWorkspace}
              onRefresh={() => loadWorkspaces()}
              isLoading={loadingStates.workspaces}
            />
          )}

          {/* Spaces */}
          {selectedWorkspace && (
            <SpaceSelector
              spaces={spaces}
              selectedSpace={selectedSpace}
              onSelectSpace={handleSelectSpace}
              onRefresh={() => selectedWorkspace && loadSpaces(selectedWorkspace.id)}
              isLoading={loadingStates.spaces}
              disabled={!selectedWorkspace}
            />
          )}

          {/* Lists */}
          {selectedSpace && (
            <ListSelector
              lists={lists}
              selectedList={selectedList}
              onSelectList={handleSelectList}
              onRefresh={() => selectedSpace && loadLists(selectedSpace.id)}
              isLoading={loadingStates.lists}
              disabled={!selectedSpace}
            />
          )}

          {/* Tasks */}
          {selectedList && (
            <TaskManager
              tasks={tasks}
              statuses={statuses}
              selectedStatus={selectedStatus}
              onStatusChange={handleStatusChange}
              onExecuteTask={handleExecuteTask}
              onExecuteAll={handleExecuteAll}
              onRefresh={() => selectedList && selectedStatus && loadTasks(selectedList.id, selectedStatus)}
              isLoading={loadingStates.tasks}
              disabled={!selectedList}
            />
          )}
        </div>
      </main>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={removeToast}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
