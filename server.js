// server.js
const express = require('express');
const axios   = require('axios');
const { spawn } = require('child_process');
const path    = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// --- ta fonction existante pour PowerShell ---
function executePowerShell(jsonParams) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'clickup-automation.ps1');
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

// --- nouveau /api/execute dispatché selon action ---
app.post('/api/execute', async (req, res) => {
  const { action, apiKey, domain, workspaceId, folderId, listId, status } = req.body;

  try {
    switch (action) {
      case 'getWorkspaces': {
        // GET /team → teams[]
        const resp = await axios.get(
          'https://api.clickup.com/api/v2/team',
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.teams });
      }

      case 'getSpaces': {
        // GET /team/{team_id}/space → spaces[]
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/team/${workspaceId}/space`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.spaces });
      }

      case 'getFoldersAndLists': {
        // Récupère dossiers…
        const [foldRes, listRes] = await Promise.all([
          axios.get(
            `https://api.clickup.com/api/v2/space/${workspaceId}/folder`,
            { headers: { Authorization: apiKey } }
          ),
          axios.get(
            `https://${domain}.clickup.com/api/v2/space/${workspaceId}/list`,
            { headers: { Authorization: apiKey } }
          )
        ]);
        const folders = (foldRes.data.folders || [])
          .map(f => ({ ...f, type: 'folder' }));
        const lists   = (listRes.data.lists  || [])
          .map(l => ({ ...l, type: 'list' }));
        return res.json({ success: true, data: [...folders, ...lists] });
      }

      case 'getListStatuses': {
        // GET /list/{list_id} → statuses[]
        const resp = await axios.get(
          `https://${domain}.clickup.com/api/v2/list/${listId}`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.statuses });
      }

      case 'getTasks': {
        // GET /list/{list_id}/task?status=… → tasks[]
        const q = status ? `?status=${encodeURIComponent(status)}` : '';
        const resp = await axios.get(
          `https://${domain}.clickup.com/api/v2/list/${listId}/task${q}`,
          { headers: { Authorization: apiKey } }
        );
        return res.json({ success: true, data: resp.data.tasks });
      }

      // … ajoute d’autres actions custom si besoin …

      default:
        // (fallback) toutes les autres actions passent à ton PowerShell
        const psResult = await executePowerShell(req.body);
        return res.json(psResult);
    }

  } catch (err) {
    console.error(`[${action}]`, err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data?.err || err.message
    });
  }
});

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
