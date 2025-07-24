import React from 'react';
import { Folder, RefreshCw } from 'lucide-react';
import { ClickUpSpace } from '../types/clickup';

interface SpaceSelectorProps {
  spaces: ClickUpSpace[];
  selectedSpace: ClickUpSpace | null;
  onSelectSpace: (space: ClickUpSpace) => void;
  onRefresh: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const SpaceSelector: React.FC<SpaceSelectorProps> = ({
  spaces,
  selectedSpace,
  onSelectSpace,
  onRefresh,
  isLoading,
  disabled
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Espaces</h2>
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
          Sélectionnez un workspace d'abord
        </div>
      ) : spaces.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? 'Chargement des espaces...' : 'Aucun espace trouvé'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              onClick={() => onSelectSpace(space)}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedSpace?.id === space.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Folder className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{space.name}</h3>
                  <p className="text-sm text-gray-500">ID: {space.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};