// app.js
class ClickUpApp {
    constructor() {
        this.config = { apiKey: '', domain: '' };
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

    bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {  // Fonction fléchée pour garder le contexte
            e.preventDefault();
            this.showSection(e.target.dataset.section);
        });
    });
 
    // Formulaire de connexion
    document.getElementById('connection-form')
        .addEventListener('submit', (e) => { 
            e.preventDefault(); 
            this.handleConnection(); 
        });
 
    // Boutons de rafraîchissement
    document.getElementById('refresh-workspaces')
        .addEventListener('click', () => this.refreshWorkspaces());
    document.getElementById('refresh-spaces')
        .addEventListener('click', () => this.refreshSpaces());
    document.getElementById('refresh-lists')
        .addEventListener('click', () => this.refreshLists());
    document.getElementById('refresh-tasks')
        .addEventListener('click', () => this.refreshTasks());
 
    // Boutons d'exécution
    document.getElementById('execute-all-tasks')
        .addEventListener('click', () => this.executeAllTasks());
    document.getElementById('clear-logs')
        .addEventListener('click', () => this.clearLogs());
    // Filtre de statut
    document.getElementById('status-filter')
        .addEventListener('change', () => this.loadTasks());
    this.setupSearch();
}

    setupSearch() {
        const sections = ['workspaces', 'spaces', 'lists', 'tasks'];
        sections.forEach(sec => {
            const header = document.querySelector(`#${sec} .section-header`);
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Rechercher dans ${sec}...`;
            input.className = 'search-input';
            input.id = `search-${sec}`;
            header.appendChild(input);
            input.addEventListener('input', e => this.filterItems(sec, e.target.value));
        });
    }

    filterItems(section, term) {
        const container = document.getElementById(`${section}-list`) || document.getElementById(`${section}-container`);
        const cards = container.querySelectorAll('.item-card, .task-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(term.toLowerCase()) ? 'block' : 'none';
        });
    }

    initNavigation() {
        this.showSection('connection');
    }

    showSection(id) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-section="${id}"]`).classList.add('active');
    }

    async makeRequest(params) {
        this.showLoadingState(true, params.action);
        try {
            const resp = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error('API Error:', err);
            this.showToast(`Erreur: ${err.message}`, 'error');
            return { success: false, error: err.message };
        } finally {
            this.showLoadingState(false);
        }
    }

    showLoadingState(show, action) {
        let loader = document.getElementById('global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = '<div class="spinner"></div><span>Chargement...</span>';
            document.body.appendChild(loader);
        }
        loader.style.display = show ? 'flex' : 'none';
        if (show) loader.querySelector('span').textContent = this.getLoadingMessage(action);
    }

    getLoadingMessage(action) {
        const msgs = {
            connect: 'Connexion…',
            getWorkspaces: 'Chargement workspaces…',
            getSpaces: 'Chargement espaces…',
            getFoldersAndLists: 'Chargement listes…',
            getTasks: 'Chargement tâches…',
            executeTask: 'Exécution tâche…'
        };
        return msgs[action] || 'Chargement…';
    }

    async handleConnection() {
        const apiKey = document.getElementById('api-key').value.trim();
        const domain = document.getElementById('domain').value.trim();
        if (!apiKey || !domain) return this.showToast('Champs manquants', 'error');
        this.config = { apiKey, domain };
        const result = await this.makeRequest({ action: 'connect', apiKey, domain });
        if (result.success) {
            this.updateConnectionStatus(true, true);
            this.saveToLocalStorage();
            this.enableNavigation();
            await this.loadWorkspaces();
        }
    }

    updateConnectionStatus(ms, cu) {
        if (ms) document.getElementById('ms-status').classList.add('connected');
        if (cu) document.getElementById('clickup-status').classList.add('connected');
    }

    saveToLocalStorage() {
        localStorage.setItem('clickup_config', JSON.stringify(this.config));
    }

    restoreFromLocalStorage() {
        const saved = JSON.parse(localStorage.getItem('clickup_config')||'{}');
        document.getElementById('api-key').value = saved.apiKey||'';
        document.getElementById('domain').value = saved.domain||'';
        this.config = saved;
    }

    enableNavigation() {
        document.getElementById('refresh-workspaces').disabled = false;
    }

    async refreshWorkspaces() { this.cache.workspaces = null; await this.loadWorkspaces(); }
    async refreshSpaces()     { this.cache.spaces.delete(this.currentWorkspace.id); await this.loadSpaces(); }
    async refreshLists()      { this.cache.lists.delete(this.currentSpace.id); await this.loadLists(); }
    async refreshTasks()      { this.cache.tasks.delete(`${this.currentList.id}_${document.getElementById('status-filter').value}`); await this.loadTasks(); }

    async loadWorkspaces() {
        if (this.cache.workspaces) return this.displayWorkspaces(this.cache.workspaces);
        const result = await this.makeRequest({ action: 'getWorkspaces', apiKey: this.config.apiKey });
        if (result.success) {
            this.cache.workspaces = result.data;
            this.displayWorkspaces(result.data);
        }
    }

    displayWorkspaces(ws) {
        const c = document.getElementById('workspaces-list'); c.innerHTML = '';
        if (!ws.length) return c.innerHTML = '<p>Aucun workspace</p>';
        ws.forEach(w => {
            const card = document.createElement('div'); card.className='item-card';
            card.dataset.searchText = w.name.toLowerCase();
            card.innerHTML = `<h4>${w.name}</h4><p>ID: ${w.id}</p>`;
            card.addEventListener('click', () => this.selectWorkspace(w));
            c.appendChild(card);
        });
        this.updateItemCount('workspaces', ws.length);
    }

    updateItemCount(sec, count) {
        const h = document.querySelector(`#${sec} .section-header h1`);
        h.textContent = `${h.textContent.split(' (')[0]} (${count})`;
    }

    selectWorkspace(w) {
        this.currentWorkspace = w;
        Array.from(document.querySelectorAll('#workspaces-list .item-card')).forEach(c=>c.classList.remove('selected'));
        event.currentTarget?.classList.add('selected');
        document.getElementById('refresh-spaces').disabled = false;
        this.loadSpaces();
    }

    async loadSpaces() {
        if (!this.currentWorkspace) return;
        if (this.cache.spaces.has(this.currentWorkspace.id)) return this.displaySpaces(this.cache.spaces.get(this.currentWorkspace.id));
        const r = await this.makeRequest({ action:'getSpaces', apiKey:this.config.apiKey, workspaceId:this.currentWorkspace.id });
        if (r.success) { this.cache.spaces.set(this.currentWorkspace.id, r.data); this.displaySpaces(r.data); }
    }

    displaySpaces(sp) {
        const c = document.getElementById('spaces-list'); c.innerHTML='';
        sp.forEach(s => {
            const card = document.createElement('div'); card.className='item-card';
            card.dataset.searchText = s.name.toLowerCase();
            card.innerHTML = `<h4>${s.name}</h4><p>ID: ${s.id}</p>`;
            card.addEventListener('click', () => this.selectSpace(s));
            c.appendChild(card);
        });
        this.updateItemCount('spaces', sp.length);
    }

    selectSpace(s) {
        this.currentSpace = s;
        Array.from(document.querySelectorAll('#spaces-list .item-card')).forEach(c=>c.classList.remove('selected'));
        event.currentTarget?.classList.add('selected');
        document.getElementById('refresh-lists').disabled = false;
        this.loadLists();
    }

    async loadLists() {
        if (!this.currentSpace) return;
        if (this.cache.lists.has(this.currentSpace.id)) return this.displayLists(this.cache.lists.get(this.currentSpace.id));
        const r = await this.makeRequest({ action:'getFoldersAndLists', apiKey:this.config.apiKey, spaceId:this.currentSpace.id });
        if (r.success) { this.cache.lists.set(this.currentSpace.id, r.data); this.displayLists(r.data); }
    }

    displayLists(items) {
        const c = document.getElementById('lists-container'); c.innerHTML='';
        const folders = items.filter(i=>i.type==='folder');
        const lists = items.filter(i=>i.type==='list');
        lists.forEach(l=>this.createListCard(l, c));
        folders.forEach(f=>this.createFolderCard(f, c));
        this.updateItemCount('lists', items.length);
    }

    createListCard(list, container) {
        const card = document.createElement('div'); card.className='item-card';
        card.innerHTML = `<h4>${list.name}</h4><p>ID: ${list.id}</p>`;
        card.addEventListener('click', () => this.selectList(list));
        container.appendChild(card);
    }

    createFolderCard(folder, container) {
        const card = document.createElement('div'); card.className='item-card';
        card.innerHTML = `<h4>${folder.name}</h4><button class='expand-folder'>Voir listes</button>`;
        card.querySelector('.expand-folder').addEventListener('click', e => {
            e.stopPropagation(); this.toggleFolder(folder, card);
        });
        container.appendChild(card);
    }

    async toggleFolder(folder, card) {
        const next = card.nextElementSibling;
        if (next && next.classList.contains('folder-lists')) { next.remove(); return; }
        const listsContainer = document.createElement('div'); listsContainer.className='folder-lists';
        card.after(listsContainer);
        const r = await this.makeRequest({ action:'getFolderLists', apiKey:this.config.apiKey, folderId:folder.id });
        listsContainer.innerHTML = '';
        if (r.success) r.data.forEach(l=>this.createListCard(l, listsContainer));
    }

    selectList(l) {
        this.currentList = l;
        Array.from(document.querySelectorAll('.list-card')).forEach(c=>c.classList.remove('selected'));
        event.currentTarget?.classList.add('selected');
        document.getElementById('refresh-tasks').disabled = false;
        this.loadListStatuses();
    }

    async loadListStatuses() {
        if (!this.currentList) return;
        if (this.cache.statuses.has(this.currentList.id)) return this.displayStatusFilter(this.cache.statuses.get(this.currentList.id));
        const r = await this.makeRequest({ action:'getListStatuses', apiKey:this.config.apiKey, listId:this.currentList.id });
        if (r.success) { this.cache.statuses.set(this.currentList.id, r.data); this.displayStatusFilter(r.data); }
    }

    displayStatusFilter(statuses) {
        const sel = document.getElementById('status-filter'); sel.innerHTML = '<option value="">Tous</option>';
        statuses.forEach(s=>{
            const o = document.createElement('option'); o.value=s.status; o.textContent=s.status; sel.appendChild(o);
        });
        sel.disabled=false;
    }

    async loadTasks() {
        if (!this.currentList) return;
        const status = document.getElementById('status-filter').value;
        const key = `${this.currentList.id}_${status}`;
        if (this.cache.tasks.has(key)) return this.displayTasks(this.cache.tasks.get(key));
        const r = await this.makeRequest({ action:'getTasks', apiKey:this.config.apiKey, listId:this.currentList.id, status });
        if (r.success) { this.cache.tasks.set(key, r.data); this.displayTasks(r.data); }
    }

    displayTasks(tasks) {
        const container = document.getElementById('tasks-list'); container.innerHTML='';
        if (!tasks.length) {
            container.innerHTML='<p class="empty-state">Aucune tâche</p>';
            document.getElementById('execute-all-tasks').disabled=true;
            this.updateItemCount('tasks', 0);
            return;
        }

        const tasksByStatus = {};
        tasks.forEach(task => {
            const key = task.status?.status || 'Inconnu';
            if (!tasksByStatus[key]) tasksByStatus[key]=[];
            tasksByStatus[key].push(task);
        });

        Object.entries(tasksByStatus).forEach(([statusLabel, statusTasks]) => {
            const header = document.createElement('div'); header.className='status-group-header';
            header.innerHTML = `<h3>${statusLabel} (${statusTasks.length})</h3>
                <button class='btn-small btn-secondary execute-status-tasks' data-status='${statusLabel}'>Exécuter toutes</button>`;
            container.appendChild(header);
            const group = document.createElement('div'); group.className='status-tasks-container';
            statusTasks.forEach(t=>group.appendChild(this.createTaskCard(t)));
            container.appendChild(group);
        });

        document.querySelectorAll('.execute-status-tasks').forEach(btn => btn.addEventListener('click', e => this.executeTasksByStatus(e.currentTarget.dataset.status)));
        this.updateItemCount('tasks', tasks.length);
    }

    createTaskCard(task) {
        const statusText = task.status?.status || '';
        const statusClass = statusText.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, '-');

        const card = document.createElement('div'); card.className='task-card';
        card.dataset.searchText = task.name.toLowerCase();

        const priority = task.priority
            ? `<span class="priority-badge ${task.priority.priority}">${task.priority.priority}</span>`
            : '';
        const assignees = (task.assignees || [])
            .map(a => `<span class="assignee">${a.username}</span>`)
            .join('');
        const assigneesHtml = assignees ? `<div class="assignees">${assignees}</div>` : '';

        card.innerHTML = `
            <div class="task-header">
                <div class="task-info">
                    <h4>${task.name}</h4>
                    <div class="task-meta">
                        <span class="task-status ${statusClass}">${statusText}</span>
                        ${priority}
                        <span class="task-id">#${task.id}</span>
                    </div>
                    ${assigneesHtml}
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
                    <small>Créé : ${new Date(task.date_created).toLocaleDateString()}</small>
                    ${task.due_date ? `<small>Échéance : ${new Date(task.due_date).toLocaleDateString()}</small>` : ''}
                </div>
            </div>
            <div class="task-output" id="output-${task.id}" style="display:none;"></div>
        `;

        card.querySelector('.execute-task')
        .addEventListener('click', (e) => {  // Fonction fléchée
            const btn = e.currentTarget;
            this.executeTask(btn.dataset.taskId, btn.dataset.taskName, btn.dataset.command);
        });
    // Et aussi :
    card.querySelector('.view-task')
        .addEventListener('click', (e) => this.viewTaskDetails(e.currentTarget.dataset.taskId));
 
    return card;
    }


      async executeTask(taskId, taskName, command) {
        console.log('=== EXÉCUTION TÂCHE ===');
        console.log(`ID: ${taskId}, Nom: ${taskName}`);
        console.log(`Commande: ${command}`);
 
        if (!command || command.trim() === '') {
            this.showToast('Aucune commande définie pour cette tâche', 'error');
            return;
        }
 
        const result = await this.makeRequest({
            action: 'executeTask',
            apiKey: this.config.apiKey,
            domain: this.config.domain,
            taskId,
            taskName,
            command
        });
 
        if (result.success) {
            this.showToast(`Tâche "${taskName}" exécutée avec succès`, 'success');
            this.addLog('success', `Tâche "${taskName}" : ${result.status}`);
            // Mettre à jour l'affichage de la tâche
            const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskCard) {
                const outputDiv = taskCard.querySelector(`#output-${taskId}`);
                if (outputDiv) {
                    outputDiv.style.display = 'block';
                    outputDiv.innerHTML = `<strong>Résultat:</strong> ${result.status}<br><pre>${result.output || ''}</pre>`;
                }
            }
        } else {
            this.showToast(`Erreur: ${result.error}`, 'error');
            this.addLog('error', `Tâche "${taskName}" : ${result.error}`);
        }
    }
 
    async executeAllTasks() {
        const taskCards = document.querySelectorAll('.execute-task');
        if (taskCards.length === 0) {
            this.showToast('Aucune tâche à exécuter', 'info');
            return;
        }
 
        this.showToast(`Exécution de ${taskCards.length} tâches...`, 'info');
        for (const button of taskCards) {
            const taskId = button.dataset.taskId;
            const taskName = button.dataset.taskName;
            const command = button.dataset.command;
            await this.executeTask(taskId, taskName, command);
            // Attendre un peu entre les exécutions
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.showToast('Toutes les tâches ont été exécutées', 'success');
    }
 
    executeTasksByStatus(status) {
        const statusButtons = document.querySelectorAll(`.status-tasks-container .execute-task`);
        statusButtons.forEach(async (button) => {
            const taskId = button.dataset.taskId;
            const taskName = button.dataset.taskName;
            const command = button.dataset.command;
            await this.executeTask(taskId, taskName, command);
        });
    }
 
    addLog(type, message) {
        const logsContainer = document.getElementById('logs-container');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
<span class="log-timestamp">[${timestamp}]</span> ${message}
        `;
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
 
    clearLogs() {
        const logsContainer = document.getElementById('logs-container');
        logsContainer.innerHTML = '<p class="empty-state">Aucun log pour le moment</p>';
    }
 
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }


    // ... (reste des méthodes: executeTask, executeTasksByStatus, viewTaskDetails, modals, logs, etc.)
}

document.addEventListener('DOMContentLoaded', () => {
    window.clickUpApp = new ClickUpApp();
});
