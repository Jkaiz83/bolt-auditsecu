import React from 'react';
import { List, FolderOpen, RefreshCw } from 'lucide-react';
import { ClickUpList } from '../types/clickup';

interface ListSelectorProps {
  lists: ClickUpList[];
  selectedList: ClickUpList | null;
  onSelectList: (list: ClickUpList) => void;
  onRefresh: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const ListSelector: React.FC<ListSelectorProps> = ({
  lists,
  selectedList,
  onSelectList,
  onRefresh,
  isLoading,
  disabled
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Listes et Dossiers</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading || disabled}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {disabled ? (
        <div className="text-center py-12 text-gray-500">
          Sélectionnez un espace d'abord
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? 'Chargement des listes...' : 'Aucune liste trouvée'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <div
              key={list.id}
              onClick={() => onSelectList(list)}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedList?.id === list.id
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {list.type === 'folder' ? (
                  <FolderOpen className="w-6 h-6 text-purple-600" />
                ) : (
                  <List className="w-6 h-6 text-purple-600" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{list.name}</h3>
                  <p className="text-sm text-gray-500">
                    {list.type === 'folder' ? 'Dossier' : 'Liste'} | ID: {list.id}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};