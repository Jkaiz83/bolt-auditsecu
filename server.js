// server.js
const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// --- Exécute le script PowerShell pour les autres actions ---
function executePowerShell(jsonParams) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'clickup-automation.ps1');

    console.log(`=== APPEL POWERSHELL ===`);
    console.log(`Script path: ${scriptPath}`);
    console.log(`Paramètres:`, jsonParams);

    // Vérifier que le fichier existe
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      console.error(`Script PowerShell non trouvé: ${scriptPath}`);
      return reject({ success: false, error: `Script non trouvé: ${scriptPath}` });
    }

    const powershell = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-NoProfile',  // Évite de charger le profil utilisateur
      '-NonInteractive', // Mode non interactif
      '-File', scriptPath,
      '-JsonParams', JSON.stringify(jsonParams)
    ], {
      cwd: __dirname,  // Définir le répertoire de travail
      encoding: 'utf8'
    });

    let stdout = '', stderr = '';

    powershell.stdout.on('data', (data) => {
      const chunk = data.toString('utf8');
      stdout += chunk;
      console.log(`PowerShell stdout: ${chunk}`);
    });

    powershell.stderr.on('data', (data) => {
      const chunk = data.toString('utf8');
      stderr += chunk;
      console.error(`PowerShell stderr: ${chunk}`);
    });

    powershell.on('close', (code) => {
      console.log(`PowerShell terminé avec le code: ${code}`);
      console.log(`Sortie complète: ${stdout}`);
      if (stderr) console.error(`Erreurs: ${stderr}`);

      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          console.log(`Résultat parsé:`, result);
          resolve(result);
        } catch (parseError) {
          console.error(`Erreur parsing JSON:`, parseError);
          console.log(`Contenu brut: "${stdout.trim()}"`);
          resolve({ success: true, output: stdout.trim() });
        }
      } else {
        reject({ success: false, error: stderr || `Code de sortie ${code}` });
      }
    });

    powershell.on('error', (error) => {
      console.error(`Erreur spawn PowerShell:`, error);
      reject({ success: false, error: `Erreur spawn: ${error.message}` });
    });

    // Timeout de sécurité (30 secondes)
    setTimeout(() => {
      powershell.kill();
      reject({ success: false, error: 'Timeout: PowerShell a pris trop de temps' });
    }, 30000);
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
        const lists = (listRes.data.lists || []).map(l => ({ ...l, type: 'list' }));
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

        // Fonction pour extraire la valeur d'un champ personnalisé
        function getCustomFieldValue(task, fieldName) {
          if (!task.custom_fields) return null;

          const field = task.custom_fields.find(f => f.name === fieldName);
          if (!field) {
            // Essayer aussi avec des espaces en plus/moins au cas où
            const fieldTrimmed = task.custom_fields.find(f => f.name.trim() === fieldName.trim());
            if (!fieldTrimmed) return null;
            return getFieldValue(fieldTrimmed);
          }

          return getFieldValue(field);
        }

        // Fonction helper pour extraire la valeur selon le type
        function getFieldValue(field) {
          switch (field.type) {
            case 'drop_down':
            case 'labels':
              if (field.value !== null && field.value !== undefined && field.type_config && field.type_config.options) {
                // Chercher par index si c'est un nombre
                if (typeof field.value === 'number' || /^\d+$/.test(field.value)) {
                  const index = parseInt(field.value);
                  if (index >= 0 && index < field.type_config.options.length) {
                    return field.type_config.options[index].name;
                  }
                }

                // Chercher par ID
                const selectedOption = field.type_config.options.find(opt => opt.id === field.value);
                if (selectedOption) {
                  return selectedOption.name;
                }
              }
              return field.value;

            case 'text':
            case 'short_text':
            case 'long_text':
              // Pour les champs texte, retourner directement la valeur
              return field.value || null;

            case 'number':
              return field.value;

            default:
              return field.value;
          }
        }

        // Fonction helper pour extraire la valeur selon le type
        function getFieldValue(field) {
          switch (field.type) {
            case 'drop_down':
            case 'labels':
              if (field.value !== null && field.value !== undefined && field.type_config && field.type_config.options) {
                // Chercher par index si c'est un nombre
                if (typeof field.value === 'number' || /^\d+$/.test(field.value)) {
                  const index = parseInt(field.value);
                  if (index >= 0 && index < field.type_config.options.length) {
                    return field.type_config.options[index].name;
                  }
                }

                // Chercher par ID
                const selectedOption = field.type_config.options.find(opt => opt.id === field.value);
                if (selectedOption) {
                  return selectedOption.name;
                }
              }
              return field.value;

            case 'text':
            case 'short_text':
            case 'long_text':
              // Pour les champs texte, retourner directement la valeur
              return field.value || null;

            case 'number':
              return field.value;

            default:
              return field.value;
          }
        }

      case 'getTasks': {
        // Récupère toutes les tâches de la liste avec le statut donné
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        const resp = await axios.get(
          `https://api.clickup.com/api/v2/list/${listId}/task${query}`,
          { headers: { Authorization: apiKey } }
        );

        console.log(`=== DEBUG TÂCHES ===`);
        console.log(`Tâches récupérées: ${resp.data.tasks.length}`);

        // Filtrer les tâches automatisées
        const automatedTasks = resp.data.tasks
          .filter(task => {
            const typeControle = getCustomFieldValue(task, 'Type de contrôle');
            console.log(`Tâche "${task.name}": Type de contrôle = "${typeControle}"`);
            return typeControle === 'Automatisé';
          })
          .map(task => {
            // Essayer "Contrôle" puis "Contrôle " (avec espace) au cas où
            let command = getCustomFieldValue(task, 'Contrôle');
            if (!command) {
              command = getCustomFieldValue(task, 'Contrôle '); // Avec espace
            }

            console.log(`Tâche "${task.name}": Commande = ${command ? `"${command.substring(0, 50)}..."` : 'null'}`);

            return {
              id: task.id,
              name: task.name,
              command: command || '',
              status: 'pending'
            };
          })
          .filter(task => task.command && task.command.trim() !== ''); // Ne garder que les tâches avec une commande

        console.log(`Tâches automatisées finales: ${automatedTasks.length}`);
        console.log(`=== FIN DEBUG ===`);

        return res.json({ success: true, data: automatedTasks });
      }

      case 'executeTask': {
        const { taskId, taskName, command } = req.body;

        console.log(`=== EXECUTION TÂCHE ===`);
        console.log(`ID: ${taskId}`);
        console.log(`Nom: ${taskName}`);
        console.log(`Commande: ${command}`);

        if (!command || command.trim() === '') {
          return res.json({
            success: false,
            error: 'Aucune commande définie pour cette tâche'
          });
        }

        // Exécuter la commande via PowerShell
        const psResult = await executePowerShell({
          action: 'executeTask',
          apiKey: req.body.apiKey,
          domain: req.body.domain,
          taskId,
          taskName,
          command
        });

        console.log(`Résultat PowerShell:`, psResult);

        return res.json(psResult);
      }

      default:
        //Toutes les autres actions passent par PowerShell
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
