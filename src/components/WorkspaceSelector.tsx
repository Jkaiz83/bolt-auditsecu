import React from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { ClickUpWorkspace } from '../types/clickup';

interface WorkspaceSelectorProps {
  workspaces: ClickUpWorkspace[];
  selectedWorkspace: ClickUpWorkspace | null;
  onSelectWorkspace: (workspace: ClickUpWorkspace) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  selectedWorkspace,
  onSelectWorkspace,
  onRefresh,
  isLoading
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Workspaces</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? 'Chargement des workspaces...' : 'Aucun workspace trouvé'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace)}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedWorkspace?.id === workspace.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
                  <p className="text-sm text-gray-500">ID: {workspace.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};