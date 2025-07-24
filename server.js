const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Fonction pour exécuter le script PowerShell
function executePowerShell(jsonParams) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'clickup-automation.ps1');
        
        const powershell = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-JsonParams', JSON.stringify(jsonParams)
        ]);

        let stdout = '';
        let stderr = '';

        powershell.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        powershell.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        powershell.on('close', (code) => {
            if (code === 0) {
                try {
                    // Tenter de parser le JSON de sortie
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch (error) {
                    // Si ce n'est pas du JSON, retourner le texte brut
                    resolve({ success: true, output: stdout.trim() });
                }
            } else {
                reject({ success: false, error: stderr || `Process exited with code ${code}` });
            }
        });

        powershell.on('error', (error) => {
            reject({ success: false, error: error.message });
        });
    });
}

// Route pour exécuter les actions PowerShell
app.post('/api/execute', async (req, res) => {
    try {
        const result = await executePowerShell(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json(error);
    }
});

// Route pour les logs en streaming (optionnel)
app.get('/api/logs', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Ici vous pourriez implémenter un système de logs en temps réel
    res.write('data: {"message": "Logs en temps réel activés"}\n\n');
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});