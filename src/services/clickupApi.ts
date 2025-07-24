import { ApiResponse, ClickUpWorkspace, ClickUpSpace, ClickUpList, ClickUpStatus, ClickUpTask, ConnectionConfig } from '../types/clickup';

class ClickUpApiService {
  private baseUrl = '/api/execute';

  private async makeRequest<T>(params: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de communication avec le serveur'
      };
    }
  }

  async connect(config: ConnectionConfig): Promise<ApiResponse> {
    return this.makeRequest({
      action: 'connect',
      apiKey: config.apiKey,
      domain: config.domain
    });
  }

  async getWorkspaces(config: ConnectionConfig): Promise<ApiResponse<ClickUpWorkspace[]>> {
    return this.makeRequest({
      action: 'getWorkspaces',
      apiKey: config.apiKey,
      domain: config.domain
    });
  }

  async getSpaces(config: ConnectionConfig, workspaceId: string): Promise<ApiResponse<ClickUpSpace[]>> {
    return this.makeRequest({
      action: 'getSpaces',
      apiKey: config.apiKey,
      domain: config.domain,
      workspaceId
    });
  }

  async getFoldersAndLists(config: ConnectionConfig, spaceId: string): Promise<ApiResponse<ClickUpList[]>> {
    return this.makeRequest({
      action: 'getFoldersAndLists',
      apiKey: config.apiKey,
      domain: config.domain,
      spaceId
    });
  }

  async getFolderLists(config: ConnectionConfig, folderId: string): Promise<ApiResponse<ClickUpList[]>> {
    return this.makeRequest({
      action: 'getFolderLists',
      apiKey: config.apiKey,
      domain: config.domain,
      folderId
    });
  }

  async getListStatuses(config: ConnectionConfig, listId: string): Promise<ApiResponse<ClickUpStatus[]>> {
    return this.makeRequest({
      action: 'getListStatuses',
      apiKey: config.apiKey,
      domain: config.domain,
      listId
    });
  }

  async getTasks(config: ConnectionConfig, listId: string, status: string): Promise<ApiResponse<ClickUpTask[]>> {
    return this.makeRequest({
      action: 'getTasks',
      apiKey: config.apiKey,
      domain: config.domain,
      listId,
      status
    });
  }

  async executeTask(config: ConnectionConfig, taskId: string, taskName: string, command: string): Promise<ApiResponse> {
    return this.makeRequest({
      action: 'executeTask',
      apiKey: config.apiKey,
      domain: config.domain,
      taskId,
      taskName,
      command
    });
  }
}

export const clickupApi = new ClickUpApiService();