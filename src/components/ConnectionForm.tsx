import React, { useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { ConnectionConfig } from '../types/clickup';

interface ConnectionFormProps {
  onConnect: (config: ConnectionConfig) => Promise<void>;
  isConnecting: boolean;
  connectionStatus: {
    microsoft: boolean;
    clickup: boolean;
  };
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
  connectionStatus
}) => {
  const [config, setConfig] = useState<ConnectionConfig>({
    apiKey: '',
    domain: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config.apiKey.trim() && config.domain.trim()) {
      await onConnect(config);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Configuration et Connexion</h2>
        
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2">
            {connectionStatus.microsoft ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">
              Microsoft: {connectionStatus.microsoft ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {connectionStatus.clickup ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">
              ClickUp: {connectionStatus.clickup ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
            Clé API ClickUp
          </label>
          <input
            type="password"
            id="apiKey"
            value={config.apiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="pk_..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
            Domaine Microsoft
          </label>
          <input
            type="text"
            id="domain"
            value={config.domain}
            onChange={(e) => setConfig(prev => ({ ...prev, domain: e.target.value }))}
            placeholder="votre-domaine"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isConnecting || !config.apiKey.trim() || !config.domain.trim()}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connexion en cours...
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
    </div>
  );
};