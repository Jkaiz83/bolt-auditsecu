class ClickUpApp {
    constructor() {
        this.config = {
            apiKey: '',
            domain: ''
        };
        
        // Cache pour éviter les appels répétés
        this.cache = {
            workspaces: null,
            spaces: new Map(),
            lists: new Map(),
            statuses: new Map(),
            tasks: new Map()
        };
        
        this.currentWorkspace = null;
        this.currentSpace = null;
        this.currentList = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initNavigation();
        this.restoreFromLocalStorage();
    }

    // Sauvegarde/restauration de la configuration
    saveToLocalStorage() {
        try {
            localStorage.setItem('clickup_config', JSON.stringify({
                apiKey: this.config.apiKey,
                domain: this.config.domain
            }));
        } catch (e) {
            console.warn('Impossible de sauvegarder la configuration');
        }
    }

    restoreFromLocalStorage() {
        try {
            const saved = localStorage.getItem('clickup_config');
            if (saved) {
                const config = JSON.parse(saved);
                document.getElementById('api-key').value = config.apiKey || '';
                document.getElementById('domain').value = config.domain || '';
            }
        } catch (e) {
            console.warn('Impossible de restaurer la configuration');
        }
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

        // Refresh buttons avec loading states
        document.getElementById('refresh-workspaces').addEventListener('click', () => this.refreshWorkspaces());
        document.getElementById('refresh-spaces').addEventListener('click', () => this.refreshSpaces());
        document.getElementById('refresh-lists').addEventListener('click', () => this.refreshLists());
        document.getElementById('refresh-tasks').addEventListener('click', () => this.refreshTasks());

        // Execute all tasks
        document.getElementById('execute-all-tasks').addEventListener('click', () => this.executeAllTasks());

        // Clear logs
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());

        // Status filter change
        document.getElementById('status-filter').addEventListener('change', () => this.loadTasks());

        // Recherche en temps réel
        this.setupSearch();
    }

    setupSearch() {
        // Ajouter des champs de recherche pour chaque section
        const searchInputs = {
            workspaces: this.createSearchInput('workspaces'),
            spaces: this.createSearchInput('spaces'),
            lists: this.createSearchInput('lists'),
            tasks: this.createSearchInput('tasks')
        };

        Object.entries(searchInputs).forEach(([section, input]) => {
            input.addEventListener('input', (e) => {
                this.filterItems(section, e.target.value);
            });
        });
    }

    createSearchInput(section) {
        const header = document.querySelector(`#${section} .section-header`);
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Rechercher dans ${section}...`;
        input.className = 'search-input';
        input.id = `search-${section}`;
        header.appendChild(input);
        return input;
    }

    filterItems(section, searchTerm) {
        const container = document.getElementById(`${section}-list`) || document.getElementById(`${section}-container`);
        const items = container.querySelectorAll('.item-card, .task-card');
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            item.style.display = matches ? 'block' : 'none';
        });
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
            this.showLoadingState(true, params.action);
            
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(`Erreur de communication: ${error.message}`, 'error');
            return { success: false, error: error.message };
        } finally {
            this.showLoadingState(false, params.action);
        }
    }

    showLoadingState(loading, action) {
        // Afficher un indicateur global de chargement
        let loader = document.getElementById('global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'global-loader';
            loader.innerHTML = '<div class="spinner"></div><span>Chargement...</span>';
            document.body.appendChild(loader);
        }
        
        if (loading) {
            loader.style.display = 'flex';
            loader.querySelector('span').textContent = this.getLoadingMessage(action);
        } else {
            loader.style.display = 'none';
        }
    }

    getLoadingMessage(action) {
        const messages = {
            connect: 'Connexion en cours...',
            getWorkspaces: 'Chargement des workspaces...',
            getSpaces: 'Chargement des espaces...',
            getFoldersAndLists: 'Chargement des listes...',
            getTasks: 'Chargement des tâches...',
            executeTask: 'Exécution de la tâche...'
        };
        return messages[action] || 'Chargement...';
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
            this.saveToLocalStorage();
            
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

    // Méthodes de refresh avec gestion du cache
    async refreshWorkspaces() {
        this.cache.workspaces = null;
        await this.loadWorkspaces();
    }

    async refreshSpaces() {
        if (this.currentWorkspace) {
            this.cache.spaces.delete(this.currentWorkspace.id);
            await this.loadSpaces();
        }
    }

    async refreshLists() {
        if (this.currentSpace) {
            this.cache.lists.delete(this.currentSpace.id);
            await this.loadLists();
        }
    }

    async refreshTasks() {
        if (this.currentList) {
            const cacheKey = `${this.currentList.id}_${document.getElementById('status-filter').value}`;
            this.cache.tasks.delete(cacheKey);
            await this.loadTasks();
        }
    }

    async loadWorkspaces() {
        // Vérifier le cache
        if (this.cache.workspaces) {
            this.displayWorkspaces(this.cache.workspaces);
            return;
        }

        const params = {
            action: 'getWorkspaces',
            apiKey: this.config.apiKey,
            domain: this.config.domain
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.cache.workspaces = result.data;
            this.displayWorkspaces(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des workspaces: ${result.error}`, 'error');
        }
    }

    displayWorkspaces(workspaces) {
        const container = document.getElementById('workspaces-list');
        container.innerHTML = '';

        if (workspaces.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun workspace trouvé</p>';
            return;
        }

        workspaces.forEach(workspace => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.dataset.searchText = workspace.name.toLowerCase();
            card.innerHTML = `
                <div class="item-header">
                    <h4>${workspace.name}</h4>
                    <span class="item-badge">${workspace.members?.length || 0} membres</span>
                </div>
                <p>ID: ${workspace.id}</p>
                <div class="item-actions">
                    <button class="btn-small btn-primary" onclick="event.stopPropagation();">
                        Sélectionner
                    </button>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.selectWorkspace(workspace);
            });
            
            container.appendChild(card);
        });

        this.updateItemCount('workspaces', workspaces.length);
    }

    updateItemCount(section, count) {
        const header = document.querySelector(`#${section} .section-header h1`);
        header.textContent = `${header.textContent.split(' (')[0]} (${count})`;
    }

    selectWorkspace(workspace) {
        this.currentWorkspace = workspace;
        
        // Update UI
        document.querySelectorAll('#workspaces-list .item-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Reset subsequent selections
        this.currentSpace = null;
        this.currentList = null;
        
        // Clear subsequent sections
        document.getElementById('spaces-list').innerHTML = '<p class="empty-state">Chargement des espaces...</p>';
        document.getElementById('lists-container').innerHTML = '<p class="empty-state">Sélectionnez un espace d\'abord</p>';
        document.getElementById('tasks-list').innerHTML = '<p class="empty-state">Sélectionnez une liste et un statut d\'abord</p>';
        
        // Enable spaces refresh and load spaces
        document.getElementById('refresh-spaces').disabled = false;
        this.loadSpaces();
        this.showToast(`Workspace sélectionné: ${workspace.name}`, 'success');
    }

    async loadSpaces() {
        if (!this.currentWorkspace) return;

        // Vérifier le cache
        const cached = this.cache.spaces.get(this.currentWorkspace.id);
        if (cached) {
            this.displaySpaces(cached);
            return;
        }

        const params = {
            action: 'getSpaces',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            workspaceId: this.currentWorkspace.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.cache.spaces.set(this.currentWorkspace.id, result.data);
            this.displaySpaces(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des espaces: ${result.error}`, 'error');
        }
    }

    displaySpaces(spaces) {
        const container = document.getElementById('spaces-list');
        container.innerHTML = '';

        if (spaces.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun espace trouvé</p>';
            return;
        }

        spaces.forEach(space => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.dataset.searchText = space.name.toLowerCase();
            card.innerHTML = `
                <div class="item-header">
                    <h4>${space.name}</h4>
                    <span class="item-badge ${space.private ? 'private' : 'public'}">
                        ${space.private ? 'Privé' : 'Public'}
                    </span>
                </div>
                <p>ID: ${space.id}</p>
                <div class="item-stats">
                    <span>📁 ${space.statuses?.length || 0} statuts</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.selectSpace(space);
            });
            
            container.appendChild(card);
        });

        this.updateItemCount('spaces', spaces.length);
    }

    selectSpace(space) {
        this.currentSpace = space;
        
        // Update UI
        document.querySelectorAll('#spaces-list .item-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Reset list selection
        this.currentList = null;
        document.getElementById('lists-container').innerHTML = '<p class="empty-state">Chargement des listes...</p>';
        document.getElementById('tasks-list').innerHTML = '<p class="empty-state">Sélectionnez une liste et un statut d\'abord</p>';
        
        // Enable lists refresh and load lists
        document.getElementById('refresh-lists').disabled = false;
        this.loadLists();
        this.showToast(`Espace sélectionné: ${space.name}`, 'success');
    }

    async loadLists() {
        if (!this.currentSpace) return;

        // Vérifier le cache
        const cached = this.cache.lists.get(this.currentSpace.id);
        if (cached) {
            this.displayLists(cached);
            return;
        }

        const params = {
            action: 'getFoldersAndLists',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            spaceId: this.currentSpace.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.cache.lists.set(this.currentSpace.id, result.data);
            this.displayLists(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des listes: ${result.error}`, 'error');
        }
    }

    displayLists(items) {
        const container = document.getElementById('lists-container');
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucune liste trouvée</p>';
            return;
        }

        // Séparer les dossiers et les listes
        const folders = items.filter(item => item.type === 'folder');
        const lists = items.filter(item => item.type === 'list');

        // Afficher les listes directes
        lists.forEach(list => {
            this.createListCard(list, container);
        });

        // Afficher les dossiers et leurs listes
        folders.forEach(folder => {
            this.createFolderCard(folder, container);
        });

        this.updateItemCount('lists', items.length);
    }

    createListCard(list, container) {
        const card = document.createElement('div');
        card.className = 'item-card list-card';
        card.dataset.searchText = list.name.toLowerCase();
        card.innerHTML = `
            <div class="item-header">
                <h4>📄 ${list.name}</h4>
                <span class="item-badge">Liste</span>
            </div>
            <p>ID: ${list.id}</p>
            <div class="item-stats">
                <span>📋 ${list.task_count || 0} tâches</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.selectList(list);
        });
        
        container.appendChild(card);
    }

    createFolderCard(folder, container) {
        const card = document.createElement('div');
        card.className = 'item-card folder-card';
        card.dataset.searchText = folder.name.toLowerCase();
        card.innerHTML = `
            <div class="item-header">
                <h4>📁 ${folder.name}</h4>
                <span class="item-badge">Dossier</span>
            </div>
            <p>ID: ${folder.id}</p>
            <div class="folder-actions">
                <button class="btn-small btn-secondary expand-folder" data-folder-id="${folder.id}">
                    Voir les listes
                </button>
            </div>
        `;
        
        // Gérer l'expansion du dossier
        const expandBtn = card.querySelector('.expand-folder');
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFolder(folder, card);
        });
        
        container.appendChild(card);
    }

    async toggleFolder(folder, folderCard) {
        const existingLists = folderCard.nextElementSibling?.classList.contains('folder-lists');
        
        if (existingLists) {
            // Fermer le dossier
            folderCard.nextElementSibling.remove();
            folderCard.querySelector('.expand-folder').textContent = 'Voir les listes';
            return;
        }

        // Ouvrir le dossier
        const listsContainer = document.createElement('div');
        listsContainer.className = 'folder-lists';
        listsContainer.innerHTML = '<div class="loading">Chargement des listes...</div>';
        
        folderCard.after(listsContainer);
        folderCard.querySelector('.expand-folder').textContent = 'Masquer';

        // Charger les listes du dossier
        const params = {
            action: 'getFolderLists',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            folderId: folder.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            listsContainer.innerHTML = '';
            result.data.forEach(list => {
                this.createListCard(list, listsContainer);
            });
        } else {
            listsContainer.innerHTML = '<div class="error">Erreur lors du chargement des listes</div>';
        }
    }

    async selectList(list) {
        this.currentList = list;
        
        // Update UI
        document.querySelectorAll('.list-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.item-card').classList.add('selected');
        
        // Load list statuses
        await this.loadListStatuses();
        this.showToast(`Liste sélectionnée: ${list.name}`, 'success');
    }

    async loadListStatuses() {
        if (!this.currentList) return;

        // Vérifier le cache
        const cached = this.cache.statuses.get(this.currentList.id);
        if (cached) {
            this.displayStatusFilter(cached);
            return;
        }

        const params = {
            action: 'getListStatuses',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            listId: this.currentList.id
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.cache.statuses.set(this.currentList.id, result.data);
            this.displayStatusFilter(result.data);
        }
    }

    displayStatusFilter(statuses) {
        const select = document.getElementById('status-filter');
        select.innerHTML = '<option value="">Tous les statuts</option>';
        
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.status;
            option.textContent = `${status.status} (${status.type})`;
            if (status.color) {
                option.style.color = status.color;
            }
            select.appendChild(option);
        });
        
        select.disabled = false;
        document.getElementById('refresh-tasks').disabled = false;
    }

    async loadTasks() {
        if (!this.currentList) return;
        
        const status = document.getElementById('status-filter').value;
        const cacheKey = `${this.currentList.id}_${status}`;
        
        // Vérifier le cache
        const cached = this.cache.tasks.get(cacheKey);
        if (cached) {
            this.displayTasks(cached);
            return;
        }

        const params = {
            action: 'getTasks',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            listId: this.currentList.id,
            status: status
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.cache.tasks.set(cacheKey, result.data);
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
            container.innerHTML = '<p class="empty-state">Aucune tâche trouvée</p>';
            document.getElementById('execute-all-tasks').disabled = true;
            return;
        }

        // Grouper les tâches par statut
        const tasksByStatus = {};
        tasks.forEach(task => {
            if (!tasksByStatus[task.status]) {
                tasksByStatus[task.status] = [];
            }
            tasksByStatus[task.status].push(task);
        });

        // Afficher chaque groupe
        Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
            const statusHeader = document.createElement('div');
            statusHeader.className = 'status-group-header';
            statusHeader.innerHTML = `
                <h3>${status} (${statusTasks.length})</h3>
                <button class="btn-small btn-secondary execute-status-tasks" data-status="${status}">
                    Exécuter toutes
                </button>
            `;
            container.appendChild(statusHeader);

            const statusContainer = document.createElement('div');
            statusContainer.className = 'status-tasks-container';
            
            statusTasks.forEach(task => {
                const taskCard = this.createTaskCard(task);
                statusContainer.appendChild(taskCard);
            });
            
            container.appendChild(statusContainer);
        });

        // Bind execute status buttons
        document.querySelectorAll('.execute-status-tasks').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.target.dataset.status;
                this.executeTasksByStatus(status);
            });
        });

        this.updateItemCount('tasks', tasks.length);
    }

    createTaskCard(task) {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.dataset.searchText = task.name.toLowerCase();
        
        const priority = task.priority ? `<span class="priority-badge ${task.priority.priority}">${task.priority.priority}</span>` : '';
        const assignees = task.assignees && task.assignees.length > 0 ? 
            `<div class="assignees">${task.assignees.map(a => `<span class="assignee">${a.username}</span>`).join('')}</div>` : '';
        
        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-info">
                    <h4>${task.name}</h4>
                    <div class="task-meta">
                        <span class="task-status ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                        ${priority}
                        <span class="task-id">#${task.id}</span>
                    </div>
                    ${assignees}
                </div>
                <div class="task-actions">
                    <button class="btn btn-primary execute-task" 
                            data-task-id="${task.id}" 
                            data-task-name="${task.name}" 
                            data-command="${task.command || ''}">
                        Exécuter
                    </button>
                    <button class="btn btn-secondary view-task" 
                            data-task-id="${task.id}">
                        Voir
                    </button>
                </div>
            </div>
            <div class="task-details">
                <div class="task-command">${task.command || 'Aucune commande définie'}</div>
                <div class="task-dates">
                    <small>Créé: ${new Date(task.date_created).toLocaleDateString()}</small>
                    ${task.due_date ? `<small>Échéance: ${new Date(task.due_date).toLocaleDateString()}</small>` : ''}
                </div>
            </div>
            <div class="task-output" id="output-${task.id}" style="display: none;"></div>
        `;

        // Bind task actions
        const executeBtn = taskCard.querySelector('.execute-task');
        const viewBtn = taskCard.querySelector('.view-task');
        
        executeBtn.addEventListener('click', (e) => {
            const taskId = e.target.dataset.taskId;
            const taskName = e.target.dataset.taskName;
            const command = e.target.dataset.command;
            this.executeTask(taskId, taskName, command, e.target);
        });

        viewBtn.addEventListener('click', (e) => {
            const taskId = e.target.dataset.taskId;
            this.viewTaskDetails(taskId);
        });

        return taskCard;
    }

    async executeTasksByStatus(status) {
        const statusContainer = document.querySelector(`[data-status="${status}"]`).closest('.status-group-header').nextElementSibling;
        const executeButtons = statusContainer.querySelectorAll('.execute-task');
        
        for (const button of executeButtons) {
            const taskId = button.dataset.taskId;
            const taskName = button.dataset.taskName;
            const command = button.dataset.command;
            
            await this.executeTask(taskId, taskName, command, button);
            
            // Wait a bit between executions
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.showToast(`Toutes les tâches "${status}" ont été exécutées`, 'success');
    }

    async executeTask(taskId, taskName, command, button) {
        if (!command || command.trim() === '') {
            this.showToast('Aucune commande définie pour cette tâche', 'warning');
            return;
        }

        this.setButtonLoading(button, true);
        
        // Update task status to running
        const taskCard = button.closest('.task-card');
        const statusElement = taskCard.querySelector('.task-status');
        const originalStatus = statusElement.textContent;
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
            const newStatus = result.status || 'TERMINE';
            statusElement.className = `task-status ${newStatus.toLowerCase().replace(' ', '-')}`;
            statusElement.textContent = newStatus;
            outputElement.innerHTML = `
                <div class="output-success">
                    <strong>✅ Exécution réussie</strong>
                    <pre>${result.output || 'Terminé avec succès'}</pre>
                </div>
            `;
            
            this.addLog('success', `Tâche "${taskName}" exécutée avec succès`);
        } else {
            statusElement.className = 'task-status error';
            statusElement.textContent = 'ERREUR';
            outputElement.innerHTML = `
                <div class="output-error">
                    <strong>❌ Échec de l'exécution</strong>
                    <pre>${result.error}</pre>
                </div>
            `;
            
            this.addLog('error', `Erreur lors de l'exécution de "${taskName}": ${result.error}`);
        }

        // Invalider le cache des tâches pour forcer le rechargement
        const status = document.getElementById('status-filter').value;
        const cacheKey = `${this.currentList.id}_${status}`;
        this.cache.tasks.delete(cacheKey);
    }

    async viewTaskDetails(taskId) {
        const params = {
            action: 'getTaskDetails',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            taskId: taskId
        };

        const result = await this.makeRequest(params);
        
        if (result.success && result.data) {
            this.showTaskModal(result.data);
        } else {
            this.showToast(`Erreur lors du chargement des détails: ${result.error}`, 'error');
        }
    }

    showTaskModal(task) {
        // Créer une modal pour afficher les détails de la tâche
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content task-modal">
                <div class="modal-header">
                    <h2>${task.name}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="task-detail-grid">
                        <div class="detail-section">
                            <h3>Informations générales</h3>
                            <div class="detail-item">
                                <label>ID:</label>
                                <span>${task.id}</span>
                            </div>
                            <div class="detail-item">
                                <label>Statut:</label>
                                <span class="task-status ${task.status.status}">${task.status.status}</span>
                            </div>
                            <div class="detail-item">
                                <label>Priorité:</label>
                                <span class="priority-badge ${task.priority?.priority || 'normal'}">${task.priority?.priority || 'Normale'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Créé le:</label>
                                <span>${new Date(task.date_created).toLocaleString()}</span>
                            </div>
                            ${task.due_date ? `
                                <div class="detail-item">
                                    <label>Échéance:</label>
                                    <span>${new Date(task.due_date).toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="detail-section">
                            <h3>Assignation</h3>
                            <div class="assignees-list">
                                ${task.assignees && task.assignees.length > 0 ? 
                                    task.assignees.map(assignee => `
                                        <div class="assignee-item">
                                            <img src="${assignee.profilePicture}" alt="${assignee.username}" class="assignee-avatar">
                                            <span>${assignee.username}</span>
                                        </div>
                                    `).join('') : 
                                    '<p>Aucun assigné</p>'
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${task.description ? `
                        <div class="detail-section">
                            <h3>Description</h3>
                            <div class="task-description">${task.description}</div>
                        </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h3>Commande d'automatisation</h3>
                        <div class="command-display">
                            <pre>${task.custom_fields?.find(f => f.name === 'command')?.value || 'Aucune commande définie'}</pre>
                        </div>
                    </div>
                    
                    ${task.attachments && task.attachments.length > 0 ? `
                        <div class="detail-section">
                            <h3>Pièces jointes</h3>
                            <div class="attachments-list">
                                ${task.attachments.map(att => `
                                    <a href="${att.url}" target="_blank" class="attachment-item">
                                        📎 ${att.title || att.name}
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Fermer</button>
                    <button class="btn btn-primary" onclick="window.open('${task.url}', '_blank')">
                        Ouvrir dans ClickUp
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Gérer la fermeture de la modal
        const closeButtons = modal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async executeAllTasks() {
        const executeButtons = document.querySelectorAll('.execute-task');
        
        if (executeButtons.length === 0) {
            this.showToast('Aucune tâche à exécuter', 'warning');
            return;
        }

        const confirmModal = this.createConfirmModal(
            'Confirmer l\'exécution',
            `Êtes-vous sûr de vouloir exécuter toutes les ${executeButtons.length} tâches ?`,
            'Exécuter tout',
            'Annuler'
        );

        const confirmed = await this.showModal(confirmModal);
        if (!confirmed) return;

        let successCount = 0;
        let errorCount = 0;

        for (const button of executeButtons) {
            const taskId = button.dataset.taskId;
            const taskName = button.dataset.taskName;
            const command = button.dataset.command;
            
            try {
                await this.executeTask(taskId, taskName, command, button);
                successCount++;
            } catch (error) {
                errorCount++;
                this.addLog('error', `Erreur lors de l'exécution de "${taskName}": ${error.message}`);
            }
            
            // Wait a bit between executions to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.showToast(`Exécution terminée: ${successCount} réussies, ${errorCount} échouées`, 
                      errorCount > 0 ? 'warning' : 'success');
    }

    createConfirmModal(title, message, confirmText, cancelText) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content confirm-modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary cancel-btn">${cancelText}</button>
                    <button class="btn btn-primary confirm-btn">${confirmText}</button>
                </div>
            </div>
        `;
        return modal;
    }

    showModal(modal) {
        return new Promise((resolve) => {
            document.body.appendChild(modal);
            
            const confirmBtn = modal.querySelector('.confirm-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            
            confirmBtn.addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="loading-spinner"></span> Chargement...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Exécuter';
        }
    }

    addLog(level, message) {
        const container = document.getElementById('logs-container');
        
        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        
        const timestamp = new Date().toLocaleString();
        const icon = level === 'success' ? '✅' : level === 'error' ? '❌' : '🔔';
        
        logEntry.innerHTML = `
            <div class="log-header">
                <span class="log-icon">${icon}</span>
                <span class="log-timestamp">${timestamp}</span>
                <span class="log-level">${level.toUpperCase()}</span>
            </div>
            <div class="log-message">${message}</div>
        `;
        
        container.appendChild(logEntry);
        container.scrollTop = container.scrollHeight;

        // Limiter le nombre de logs (garder les 100 derniers)
        const logs = container.querySelectorAll('.log-entry');
        if (logs.length > 100) {
            logs[0].remove();
        }
    }

    clearLogs() {
        const container = document.getElementById('logs-container');
        container.innerHTML = '<p class="empty-state">Aucun log pour le moment</p>';
        this.showToast('Logs effacés', 'info');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✅' : 
                    type === 'error' ? '❌' : 
                    type === 'warning' ? '⚠️' : 'ℹ️';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        const autoRemove = setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
        
        // Remove on click
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoRemove);
            toast.remove();
        });

        // Slide in animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
    }

    // Méthodes utilitaires pour l'export/import de données
    exportData() {
        const data = {
            config: this.config,
            currentWorkspace: this.currentWorkspace,
            currentSpace: this.currentSpace,
            currentList: this.currentList,
            cache: {
                workspaces: this.cache.workspaces,
                spaces: Object.fromEntries(this.cache.spaces),
                lists: Object.fromEntries(this.cache.lists),
                statuses: Object.fromEntries(this.cache.statuses),
                tasks: Object.fromEntries(this.cache.tasks)
            },
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clickup-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('Données exportées avec succès', 'success');
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Restaurer la configuration
                this.config = data.config || this.config;
                document.getElementById('api-key').value = this.config.apiKey || '';
                document.getElementById('domain').value = this.config.domain || '';
                
                // Restaurer le cache
                if (data.cache) {
                    this.cache.workspaces = data.cache.workspaces;
                    this.cache.spaces = new Map(Object.entries(data.cache.spaces || {}));
                    this.cache.lists = new Map(Object.entries(data.cache.lists || {}));
                    this.cache.statuses = new Map(Object.entries(data.cache.statuses || {}));
                    this.cache.tasks = new Map(Object.entries(data.cache.tasks || {}));
                }
                
                // Restaurer les sélections
                this.currentWorkspace = data.currentWorkspace;
                this.currentSpace = data.currentSpace;
                this.currentList = data.currentList;
                
                this.showToast('Données importées avec succès', 'success');
                
                // Rafraîchir l'affichage
                if (this.cache.workspaces) {
                    this.displayWorkspaces(this.cache.workspaces);
                }
                
            } catch (error) {
                this.showToast('Erreur lors de l\'import des données', 'error');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    // Méthode pour ajouter des boutons d'export/import
    addDataManagementButtons() {
        const connectionSection = document.getElementById('connection');
        const card = connectionSection.querySelector('.card');
        
        const dataManagementDiv = document.createElement('div');
        dataManagementDiv.className = 'data-management';
        dataManagementDiv.innerHTML = `
            <h4>Gestion des données</h4>
            <div class="data-buttons">
                <button class="btn btn-secondary" id="export-data">
                    📤 Exporter les données
                </button>
                <label class="btn btn-secondary" for="import-data">
                    📥 Importer les données
                </label>
                <input type="file" id="import-data" accept=".json" style="display: none;">
            </div>
        `;
        
        card.appendChild(dataManagementDiv);
        
        // Bind events
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('import-data').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importData(e.target.files[0]);
            }
        });
    }

    // Méthode pour ajouter des statistiques globales
    async loadGlobalStats() {
        if (!this.config.apiKey) return;

        try {
            const params = {
                action: 'getGlobalStats',
                apiKey: this.config.apiKey,
                domain: this.config.domain
            };

            const result = await this.makeRequest(params);
            
            if (result.success && result.data) {
                this.displayGlobalStats(result.data);
            }
        } catch (error) {
            console.error('Error loading global stats:', error);
        }
    }

    displayGlobalStats(stats) {
        // Créer un widget de statistiques globales
        const statsWidget = document.createElement('div');
        statsWidget.className = 'global-stats-widget';
        statsWidget.innerHTML = `
            <h4>📊 Statistiques globales</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-number">${stats.totalWorkspaces || 0}</span>
                    <span class="stat-label">Workspaces</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.totalSpaces || 0}</span>
                    <span class="stat-label">Espaces</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.totalLists || 0}</span>
                    <span class="stat-label">Listes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.totalTasks || 0}</span>
                    <span class="stat-label">Tâches</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.automatedTasks || 0}</span>
                    <span class="stat-label">Automatisées</span>
                </div>
            </div>
        `;

        const connectionSection = document.getElementById('connection');
        const firstCard = connectionSection.querySelector('.card');
        firstCard.parentNode.insertBefore(statsWidget, firstCard);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ClickUpApp();
    
    // Ajouter les boutons de gestion des données
    app.addDataManagementButtons();
    
    // Charger les statistiques globales après la connexion
    window.clickUpApp = app; // Rendre l'app accessible globalement pour le debug
});
