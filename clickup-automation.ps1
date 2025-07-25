#Requires -Version 5.1

<#
.SYNOPSIS
    Version adaptée du script d'automatisation ClickUp pour interface web
.DESCRIPTION
    Cette version adaptée accepte des paramètres JSON en entrée et retourne
    des résultats structurés pour l'interface web.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$JsonParams
)

# Parse les paramètres JSON
try {
    $params = $JsonParams | ConvertFrom-Json
}
catch {
    Write-Output (@{
            success = $false
            error   = "Erreur parsing JSON: $($_.Exception.Message)"
        } | ConvertTo-Json)
    exit 1
}

# Variables globales
$global:ApiKey = $params.apiKey
$global:Domain = $params.domain
$global:BaseUrl = "https://api.clickup.com/api/v2"
$global:Headers = @{
    'Authorization' = $global:ApiKey
    'Content-Type'  = 'application/json'
}

# Fonction pour écrire des logs structurés
function Write-StructuredLog {
    param(
        [string]$Level,
        [string]$Message,
        [object]$Data = $null
    )
    
    $logEntry = @{
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        level     = $Level
        message   = $Message
    }
    
    if ($Data) {
        $logEntry.data = $Data
    }
    
    Write-Output ($logEntry | ConvertTo-Json -Compress)
}

# Fonction pour initialiser les connexions Microsoft de manière silencieuse
function Initialize-MicrosoftConnections {
    Write-StructuredLog -Level "INFO" -Message "Début des connexions Microsoft"
    
    try {
        # Microsoft Graph
        Write-StructuredLog -Level "INFO" -Message "Connexion à Microsoft Graph"
        Connect-MgGraph -Scopes "Directory.Read.All", "User.Read.All", "Group.Read.All" -NoWelcome | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "Microsoft Graph connecté"
        
        # Exchange Online
        Write-StructuredLog -Level "INFO" -Message "Connexion à Exchange Online"
        Connect-ExchangeOnline -ShowBanner:$false | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "Exchange Online connecté"
        
        # SharePoint Online
        Write-StructuredLog -Level "INFO" -Message "Connexion à SharePoint Online"
        Connect-SPOService -Url "https://$global:Domain-admin.sharepoint.com/" | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "SharePoint Online connecté"
        
        # Microsoft Teams
        Write-StructuredLog -Level "INFO" -Message "Connexion à Microsoft Teams"
        Connect-MicrosoftTeams | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "Microsoft Teams connecté"
        
        # Azure AD
        Write-StructuredLog -Level "INFO" -Message "Connexion à Azure AD"
        Connect-AzureAD | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "Azure AD connecté"
        
        return $true
    }
    catch {
        Write-StructuredLog -Level "ERROR" -Message "Échec des connexions Microsoft" -Data @{ error = $_.Exception.Message }
        return $false
    }
}

# Fonction pour tester la connexion ClickUp
function Test-ClickUpConnection {
    Write-StructuredLog -Level "INFO" -Message "Test de connexion ClickUp"
    
    try {
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/team" -Headers $global:Headers -Method GET
        Write-StructuredLog -Level "SUCCESS" -Message "Connexion ClickUp réussie" -Data @{ workspaces = $response.teams.Count }
        return $true
    }
    catch {
        Write-StructuredLog -Level "ERROR" -Message "Échec connexion ClickUp" -Data @{ error = $_.Exception.Message }
        return $false
    }
}

# Fonction pour récupérer les workspaces
function Get-ClickUpWorkspaces {
    try {
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/team" -Headers $global:Headers -Method GET
        return @{
            success = $true
            data    = $response.teams | ForEach-Object { @{ id = $_.id; name = $_.name; type = "workspace" } }
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour récupérer les espaces
function Get-ClickUpSpaces {
    param([string]$TeamId)
    
    try {
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/team/$TeamId/space?archived=false" -Headers $global:Headers -Method GET
        return @{
            success = $true
            data    = $response.spaces | ForEach-Object { @{ id = $_.id; name = $_.name; type = "space" } }
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour récupérer dossiers et listes
function Get-ClickUpFoldersAndLists {
    param([string]$SpaceId)
    
    try {
        # Récupérer les dossiers
        $foldersResponse = Invoke-RestMethod -Uri "$global:BaseUrl/space/$SpaceId/folder?archived=false" -Headers $global:Headers -Method GET
        $folders = $foldersResponse.folders | ForEach-Object { @{ id = $_.id; name = $_.name; type = "folder" } }
        
        # Récupérer les listes directes
        $listsResponse = Invoke-RestMethod -Uri "$global:BaseUrl/space/$SpaceId/list?archived=false" -Headers $global:Headers -Method GET
        $lists = $listsResponse.lists | ForEach-Object { @{ id = $_.id; name = $_.name; type = "list" } }
        
        return @{
            success = $true
            data    = @($folders + $lists)
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour récupérer les listes d'un dossier
function Get-ClickUpFolderLists {
    param([string]$FolderId)
    
    try {
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/folder/$FolderId/list?archived=false" -Headers $global:Headers -Method GET
        return @{
            success = $true
            data    = $response.lists | ForEach-Object { @{ id = $_.id; name = $_.name; type = "list" } }
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour récupérer les statuts d'une liste
function Get-ClickUpListStatuses {
    param([string]$ListId)
    
    try {
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/list/$ListId" -Headers $global:Headers -Method GET
        return @{
            success = $true
            data    = $response.statuses | ForEach-Object { @{ status = $_.status; color = $_.color } }
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour récupérer et traiter les tâches
function Get-ProcessedTasks {
    param(
        [string]$ListId,
        [string]$StatusName
    )
    
    try {
        # Récupérer les tâches
        $response = Invoke-RestMethod -Uri "$global:BaseUrl/list/$ListId/task?archived=false&include_closed=true" -Headers $global:Headers -Method GET
        $filteredTasks = $response.tasks | Where-Object { $_.status.status -eq $StatusName }
        
        # Filtrer les tâches automatisées
        $automatedTasks = @()
        foreach ($task in $filteredTasks) {
            $typeControle = Get-CustomFieldValue -Task $task -FieldName "Type de contrôle"
            if ($typeControle -eq "Automatisé") {
                $controleCommand = Get-CustomFieldValue -Task $task -FieldName "Contrôle"
                if (-not [string]::IsNullOrWhiteSpace($controleCommand)) {
                    $automatedTasks += @{
                        id      = $task.id
                        name    = $task.name
                        command = $controleCommand
                        status  = "pending"
                    }
                }
            }
        }
        
        return @{
            success = $true
            data    = $automatedTasks
        }
    }
    catch {
        return @{
            success = $false
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour extraire la valeur d'un champ personnalisé
function Get-CustomFieldValue {
    param(
        [object]$Task,
        [string]$FieldName
    )
    
    if ($Task.custom_fields) {
        $field = $Task.custom_fields | Where-Object { $_.name -eq $FieldName }
        if ($field) {
            switch ($field.type) {
                "drop_down" {
                    if ($null -ne $field.value -and $field.type_config -and $field.type_config.options) {
                        if ($field.value -is [int] -or $field.value -match '^\d+$') {
                            $index = [int]$field.value
                            if ($index -ge 0 -and $index -lt $field.type_config.options.Count) {
                                return $field.type_config.options[$index].name
                            }
                        }
                        elseif ($field.value -is [string]) {
                            $selectedOption = $field.type_config.options | Where-Object { $_.id -eq $field.value }
                            if ($selectedOption) {
                                return $selectedOption.name
                            }
                        }
                    }
                }
                default {
                    return $field.value
                }
            }
        }
    }
    return $null
}

# Fonction pour exécuter une commande PowerShell
function Execute-PowerShellCommand {
    param(
        [string]$Command,
        [string]$TaskId,
        [string]$TaskName
    )
    
    Write-StructuredLog -Level "INFO" -Message "Début exécution tâche" -Data @{ taskId = $TaskId; taskName = $TaskName }
    
    try {
        $result = Invoke-Expression $Command 2>&1
        $output = $result | Out-String
        
        $newStatus = if ($output -match "OK") { "CONFORME" } else { "NON CONFORME" }
        
        Write-StructuredLog -Level "SUCCESS" -Message "Tâche terminée" -Data @{ 
            taskId = $TaskId
            status = $newStatus
            output = $output.Trim()
        }
        
        # Mettre à jour le statut dans ClickUp
        Update-TaskStatus -TaskId $TaskId -NewStatus $newStatus
        
        return @{
            success = $true
            status  = $newStatus
            output  = $output.Trim()
        }
    }
    catch {
        Write-StructuredLog -Level "ERROR" -Message "Erreur exécution tâche" -Data @{ 
            taskId = $TaskId
            error  = $_.Exception.Message
        }
        
        Update-TaskStatus -TaskId $TaskId -NewStatus "NON CONFORME"
        
        return @{
            success = $false
            status  = "NON CONFORME"
            error   = $_.Exception.Message
        }
    }
}

# Fonction pour mettre à jour le statut d'une tâche
function Update-TaskStatus {
    param(
        [string]$TaskId,
        [string]$NewStatus
    )
    
    try {
        $body = @{ status = $NewStatus } | ConvertTo-Json
        Invoke-RestMethod -Uri "$global:BaseUrl/task/$TaskId" -Headers $global:Headers -Method PUT -Body $body | Out-Null
        Write-StructuredLog -Level "SUCCESS" -Message "Statut ClickUp mis à jour" -Data @{ taskId = $TaskId; newStatus = $NewStatus }
    }
    catch {
        Write-StructuredLog -Level "ERROR" -Message "Échec mise à jour statut ClickUp" -Data @{ taskId = $TaskId; error = $_.Exception.Message }
    }
}

# Script principal
try {
    # Déterminer l'action à effectuer
    switch ($params.action) {
        "connect" {
            $msConnected = Initialize-MicrosoftConnections
            $clickupConnected = Test-ClickUpConnection
            
            Write-Output (@{
                    success            = $msConnected -and $clickupConnected
                    microsoftConnected = $msConnected
                    clickupConnected   = $clickupConnected
                } | ConvertTo-Json)
        }
        
        "getWorkspaces" {
            $result = Get-ClickUpWorkspaces
            Write-Output ($result | ConvertTo-Json)
        }
        
        "getSpaces" {
            $result = Get-ClickUpSpaces -TeamId $params.workspaceId
            Write-Output ($result | ConvertTo-Json)
        }
        
        "getFoldersAndLists" {
            $result = Get-ClickUpFoldersAndLists -SpaceId $params.spaceId
            Write-Output ($result | ConvertTo-Json)
        }
        
        "getFolderLists" {
            $result = Get-ClickUpFolderLists -FolderId $params.folderId
            Write-Output ($result | ConvertTo-Json)
        }
        
        "getListStatuses" {
            $result = Get-ClickUpListStatuses -ListId $params.listId
            Write-Output ($result | ConvertTo-Json)
        }
        
        "getTasks" {
            $result = Get-ProcessedTasks -ListId $params.listId -StatusName $params.status
            Write-Output ($result | ConvertTo-Json)
        }
        
        "executeTask" {
            Write-StructuredLog -Level "INFO" -Message "Case executeTask appelé" -Data @{ 
                taskId   = $params.taskId
                taskName = $params.taskName
                command  = $params.command
            }
    
            if ([string]::IsNullOrWhiteSpace($params.command)) {
                Write-Output (@{
                        success = $false
                        error   = "Commande vide ou nulle"
                    } | ConvertTo-Json)
                return
            }
    
            $result = Execute-PowerShellCommand -Command $params.command -TaskId $params.taskId -TaskName $params.taskName
    
            Write-StructuredLog -Level "INFO" -Message "Résultat execution" -Data $result
    
            Write-Output ($result | ConvertTo-Json)
        }
        
        default {
            Write-Output (@{
                    success = $false
                    error   = "Action non reconnue: $($params.action)"
                } | ConvertTo-Json)
        }
    }
}
catch {
    Write-Output (@{
            success = $false
            error   = "Erreur script principal: $($_.Exception.Message)"
        } | ConvertTo-Json)
}