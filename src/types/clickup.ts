export interface ClickUpWorkspace {
  id: string;
  name: string;
  type: 'workspace';
}

export interface ClickUpSpace {
  id: string;
  name: string;
  type: 'space';
}

export interface ClickUpList {
  id: string;
  name: string;
  type: 'list' | 'folder';
}

export interface ClickUpStatus {
  status: string;
  color: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  command: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  microsoftConnected?: boolean;
  clickupConnected?: boolean;
}

export interface ConnectionConfig {
  apiKey: string;
  domain: string;
}