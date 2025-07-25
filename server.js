// server.js
const express = require('express');
const axios   = require('axios');
const { spawn } = require('child_process');
const path    = require('path');
require('dotenv').config();

const app  = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// --- Exécute le script PowerShell pour les autres actions ---
function executePowerShell(jsonParams) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'clickup-automation.ps1');
    //powershell.exe à la place de pwsh
    const powershell = spawn('pwsh', [
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-JsonParams', JSON.stringify(jsonParams)
    ]);

    let stdout = '', stderr = '';
    powershell.stdout.on('data', d => stdout += d.toString());
    powershell.stderr.on('data', d => stderr += d.toString());

    powershell.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ success: true, output: stdout.trim() });
        }
      } else {
        reject({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    powershell.on('error', e => reject({ success: false, error: e.message }));
  });
}

// --- Endpoint unique dispatché selon l'action reçue ---
app.post('/api/execute', async (req, res) => {
  const { action, apiKey, workspaceId, spaceId, folderId, listId, status } = req.body;

  try {
    switch (action) {
      case 'getWorkspaces': {
        // Récupère tous les workspaces (teams)
        const resp = await axios.get(
          'https://api.clickup.com/api/v2/team',
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.teams });
      }

      case 'getSpaces': {
        // Récupère les espaces d'un workspace
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/team/${workspaceId}/space`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.spaces });
      }

      case 'getFoldersAndLists': {
        // Récupère dossiers + listes directes dans un espace
        const [foldRes, listRes] = await Promise.all([
          axios.get(
            `https://api.clickup.com/api/v2/space/${spaceId}/folder`,
            { headers: { Authorization: apiKey } }
          ),
          axios.get(
            `https://api.clickup.com/api/v2/space/${spaceId}/list`,
            { headers: { Authorization: apiKey } }
          )
        ]);
        const folders = (foldRes.data.folders || []).map(f => ({ ...f, type: 'folder' }));
        const lists   = (listRes.data.lists  || []).map(l => ({ ...l, type: 'list' }));
        return res.json({ success: true, data: [...folders, ...lists] });
      }

      case 'getFolderLists': {
        // Récupère les listes à l'intérieur d'un dossier
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/folder/${folderId}/list`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.lists });
      }

      case 'getListStatuses': {
        // Récupère statuts d'une liste
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/list/${listId}`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.statuses });
      }

      case 'getTasks': {
        // Récupère tâches d'une liste (filtrables par status)
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/list/${listId}/task${query}`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.tasks });
      }

      default:
        // Toutes les autres actions passent par PowerShell
        const psResult = await executePowerShell(req.body);
        return res.json(psResult);
    }

  } catch (err) {
    console.error(`[${action}] ERROR:`, err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data?.err || err.message
    });
  }
});

// Démarre le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
