class ClickUpApp {
    constructor() {
        this.config = {
            apiKey: '',
            domain: ''
        };
        this.currentWorkspace = null;
        this.currentSpace = null;
        this.currentList = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initNavigation();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });

        // Connection form
        document.getElementById('connection-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConnection();
        });

        // Refresh buttons
        document.getElementById('refresh-workspaces').addEventListener('click', () => this.loadWorkspaces());
        document.getElementById('refresh-spaces').addEventListener('click', () => this.loadSpaces());
        document.getElementById('refresh-lists').addEventListener('click', () => this.loadLists());
        document.getElementById('refresh-tasks').addEventListener('click', () => this.loadTasks());

        // Execute all tasks
        document.getElementById('execute-all-tasks').addEventListener('click', () => this.executeAllTasks());

        // Clear logs
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());

        // Status filter change
        document.getElementById('status-filter').addEventListener('change', () => this.loadTasks());
    }

    initNavigation() {
        this.showSection('connection');
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        document.getElementById(sectionId).classList.add('active');
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    }

    async makeRequest(params) {
        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            this.showToast('Erreur de communication avec le serveur', 'error');
            return { success: false, error: error.message };
        }
    }

    async handleConnection() {
        const apiKey = document.getElementById('api-key').value.trim();
        const domain = document.getElementById('domain').value.trim();
        
        if (!apiKey || !domain) {
            this.showToast('Veuillez remplir tous les champs', 'error');
            return;
        }

        this.config.apiKey = apiKey;
        this.config.domain = domain;

        const btn = document.getElementById('connect-btn');
        this.setButtonLoading(btn, true);

        const params = {
            action: 'connect',
            apiKey: apiKey,
            domain: domain
        };

        const result = await this.makeRequest(params);
        
        this.setButtonLoading(btn, false);

        if (result.success) {
            this.updateConnectionStatus(result.microsoftConnected, result.clickupConnected);
            this.showToast('Connexion réussie!', 'success');
            
            // Enable navigation and load workspaces
            this.enableNavigation();
            await this.loadWorkspaces();
        } else {
            this.showToast(`Erreur de connexion: ${result.error}`, 'error');
        }
    }

    updateConnectionStatus(msConnected, clickupConnected) {
        const msStatus = document.getElementById('ms-status');
        const clickupStatus = document.getElementById('clickup-status');

        if (msConnected) {
            msStatus.classList.add('connected');
            msStatus.querySelector('.status-text').textContent = 'Connecté';
        }

        if (clickupConnected) {
            clickupStatus.classList.add('connected');
            clickupStatus.querySelector('.status-text').textContent = 'Connecté';
        }
    }

    enableNavigation() {
        document.getElementById('refresh-workspaces').disabled = false;
    }

    async loadWorkspaces() {
        const params = {
            action: 'getWorkspaces',
            apiKey: this.config.apiKey,
            domain: this.config.domain
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.displayWorkspaces(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des workspaces: ${result.error}`, 'error');
        }
    }

    displayWorkspaces(workspaces) {
        const container = document.getElementById('workspaces-list');
        container.innerHTML = '';

        workspaces.forEach(workspace => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h4>${workspace.name}</h4>
                <p>ID: ${workspace.id}</p>
            `;
            
            card.addEventListener('click', () => {
                this.selectWorkspace(workspace);
            });
            
            container.appendChild(card);
        });
    }

    selectWorkspace(workspace) {
        this.currentWorkspace = workspace;
        
        // Update UI
        document.querySelectorAll('#workspaces-list .item-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Enable spaces refresh and load spaces
        document.getElementById('refresh-spaces').disabled = false;
        this.loadSpaces();
        this.showToast(`Workspace sélectionné: ${workspace.name}`, 'success');
    }

    async loadSpaces() {
        if (!this.currentWorkspace) return;

        const params = {
            action: 'getSpaces',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            workspaceId: this.currentWorkspace.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.displaySpaces(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des espaces: ${result.error}`, 'error');
        }
    }

    displaySpaces(spaces) {
        const container = document.getElementById('spaces-list');
        container.innerHTML = '';

        spaces.forEach(space => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h4>${space.name}</h4>
                <p>ID: ${space.id}</p>
            `;
            
            card.addEventListener('click', () => {
                this.selectSpace(space);
            });
            
            container.appendChild(card);
        });
    }

    selectSpace(space) {
        this.currentSpace = space;
        
        // Update UI
        document.querySelectorAll('#spaces-list .item-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Enable lists refresh and load lists
        document.getElementById('refresh-lists').disabled = false;
        this.loadLists();
        this.showToast(`Espace sélectionné: ${space.name}`, 'success');
    }

    async loadLists() {
        if (!this.currentSpace) return;

        const params = {
            action: 'getFoldersAndLists',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            spaceId: this.currentSpace.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.displayLists(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des listes: ${result.error}`, 'error');
        }
    }

    displayLists(items) {
        const container = document.getElementById('lists-container');
        container.innerHTML = '';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h4>${item.name}</h4>
                <p>Type: ${item.type} | ID: ${item.id}</p>
            `;
            
            card.addEventListener('click', () => {
                if (item.type === 'list') {
                    this.selectList(item);
                } else if (item.type === 'folder') {
                    this.loadFolderLists(item);
                }
            });
            
            container.appendChild(card);
        });
    }

    async loadFolderLists(folder) {
        const params = {
            action: 'getFolderLists',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            folderId: folder.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            // Display folder lists inline or in a modal
            this.displayFolderLists(result.data, folder.name);
        }
    }

    displayFolderLists(lists, folderName) {
        const container = document.getElementById('lists-container');
        
        // Add a separator for folder lists
        const separator = document.createElement('div');
        separator.innerHTML = `<h4>Listes du dossier "${folderName}":</h4>`;
        separator.style.gridColumn = '1 / -1';
        separator.style.marginTop = '2rem';
        container.appendChild(separator);

        lists.forEach(list => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h4>${list.name}</h4>
                <p>Liste | ID: ${list.id}</p>
            `;
            
            card.addEventListener('click', () => {
                this.selectList(list);
            });
            
            container.appendChild(card);
        });
    }

    async selectList(list) {
        this.currentList = list;
        
        // Update UI
        document.querySelectorAll('#lists-container .item-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Load list statuses
        await this.loadListStatuses();
        this.showToast(`Liste sélectionnée: ${list.name}`, 'success');
    }

    async loadListStatuses() {
        if (!this.currentList) return;

        const params = {
            action: 'getListStatuses',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            listId: this.currentList.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.displayStatusFilter(result.data);
        }
    }

    displayStatusFilter(statuses) {
        const select = document.getElementById('status-filter');
        select.innerHTML = '<option value="">Sélectionnez un statut</option>';
        
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.status;
            option.textContent = status.status;
            select.appendChild(option);
        });
        
        select.disabled = false;
        document.getElementById('refresh-tasks').disabled = false;
    }

    async loadTasks() {
        if (!this.currentList) return;
        
        const status = document.getElementById('status-filter').value;
        if (!status) return;

        const params = {
            action: 'getTasks',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            listId: this.currentList.id,
            status: status
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.displayTasks(result.data);
            if (result.data.length > 0) {
                document.getElementById('execute-all-tasks').disabled = false;
            }
        } else {
            this.showToast(`Erreur lors du chargement des tâches: ${result.error}`, 'error');
        }
    }

    displayTasks(tasks) {
        const container = document.getElementById('tasks-list');
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucune tâche automatisée trouvée</p>';
            return;
        }

        tasks.forEach(task => {
            const taskCard = document.createElement('div');
            taskCard.className = 'task-card';
            taskCard.innerHTML = `
                <div class="task-header">
                    <div class="task-info">
                        <h4>${task.name}</h4>
                        <span class="task-status ${task.status}">${task.status}</span>
                    </div>
                    <button class="btn btn-primary execute-task" data-task-id="${task.id}" data-task-name="${task.name}" data-command="${task.command}">
                        Exécuter
                    </button>
                </div>
                <div class="task-command">${task.command}</div>
                <div class="task-output" id="output-${task.id}" style="display: none;"></div>
            `;
            
            container.appendChild(taskCard);
        });

        // Bind execute buttons
        document.querySelectorAll('.execute-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                const taskName = e.target.dataset.taskName;
                const command = e.target.dataset.command;
                this.executeTask(taskId, taskName, command, e.target);
            });
        });
    }

    async executeTask(taskId, taskName, command, button) {
        this.setButtonLoading(button, true);
        
        // Update task status to running
        const statusElement = button.closest('.task-card').querySelector('.task-status');
        statusElement.className = 'task-status running';
        statusElement.textContent = 'En cours...';

        const params = {
            action: 'executeTask',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            taskId: taskId,
            taskName: taskName,
            command: command
        };

        const result = await this.makeRequest(params);
        
        this.setButtonLoading(button, false);
        
        // Show output
        const outputElement = document.getElementById(`output-${taskId}`);
        outputElement.style.display = 'block';
        
        if (result.success) {
            statusElement.className = `task-status ${result.status === 'CONFORME' ? 'success' : 'error'}`;
            statusElement.textContent = result.status;
            outputElement.textContent = result.output || 'Exécution terminée';
            
            this.addLog('success', `Tâche "${taskName}" exécutée avec succès`);
        } else {
            statusElement.className = 'task-status error';
            statusElement.textContent = 'Erreur';
            outputElement.textContent = result.error;
            
            this.addLog('error', `Erreur lors de l'exécution de "${taskName}": ${result.error}`);
        }
    }

    async executeAllTasks() {
        const executeButtons = document.querySelectorAll('.execute-task');
        
        for (const button of executeButtons) {
            const taskId = button.dataset.taskId;
            const taskName = button.dataset.taskName;
            const command = button.dataset.command;
            
            await this.executeTask(taskId, taskName, command, button);
            
            // Wait a bit between executions
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.showToast('Toutes les tâches ont été exécutées', 'success');
    }

    setButtonLoading(button, loading) {
        const text = button.querySelector('.btn-text') || button;
        const spinner = button.querySelector('.loading-spinner');
        
        if (loading) {
            button.disabled = true;
            if (spinner) spinner.style.display = 'inline-block';
            if (text !== button) text.textContent = 'Chargement...';
        } else {
            button.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (text !== button) text.textContent = button.dataset.originalText || 'Exécuter';
        }
    }

    addLog(level, message) {
        const container = document.getElementById('logs-container');
        
        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        logEntry.innerHTML = `
            <div class="log-timestamp">${new Date().toLocaleString()}</div>
            <div>${message}</div>
        `;
        
        container.appendChild(logEntry);
        container.scrollTop = container.scrollHeight;
    }

    clearLogs() {
        const container = document.getElementById('logs-container');
        container.innerHTML = '<p class="empty-state">Aucun log pour le moment</p>';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        // Remove on click
        toast.addEventListener('click', () => {
            toast.remove();
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClickUpApp();
});