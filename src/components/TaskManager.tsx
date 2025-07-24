import React, { useState } from 'react';
import { Play, PlayCircle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { ClickUpTask, ClickUpStatus } from '../types/clickup';

interface TaskManagerProps {
  tasks: ClickUpTask[];
  statuses: ClickUpStatus[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  onExecuteTask: (task: ClickUpTask) => Promise<void>;
  onExecuteAll: () => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  statuses,
  selectedStatus,
  onStatusChange,
  onExecuteTask,
  onExecuteAll,
  onRefresh,
  isLoading,
  disabled
}) => {
  const [executingTasks, setExecutingTasks] = useState<Set<string>>(new Set());

  const handleExecuteTask = async (task: ClickUpTask) => {
    setExecutingTasks(prev => new Set(prev).add(task.id));
    try {
      await onExecuteTask(task);
    } finally {
      setExecutingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tâches Automatisées</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={disabled}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Sélectionnez un statut</option>
            {statuses.map((status) => (
              <option key={status.status} value={status.status}>
                {status.status}
              </option>
            ))}
          </select>
          
          <button
            onClick={onRefresh}
            disabled={isLoading || disabled || !selectedStatus}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          
          <button
            onClick={onExecuteAll}
            disabled={disabled || tasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Exécuter tout
          </button>
        </div>
      </div>

      {disabled ? (
        <div className="text-center py-12 text-gray-500">
          Sélectionnez une liste et un statut d'abord
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? 'Chargement des tâches...' : 'Aucune tâche automatisée trouvée'}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    {getStatusIcon(task.status)}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
                      {task.status === 'pending' ? 'En attente' :
                       task.status === 'running' ? 'En cours' :
                       task.status === 'success' ? 'Succès' : 'Erreur'}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleExecuteTask(task)}
                  disabled={executingTasks.has(task.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {executingTasks.has(task.id) ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {executingTasks.has(task.id) ? 'Exécution...' : 'Exécuter'}
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <code className="text-sm text-gray-700 font-mono">{task.command}</code>
              </div>
              
              {task.output && (
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                  {task.output}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};