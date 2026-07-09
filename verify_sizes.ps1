# verify_sizes.ps1
# PowerShell script to audit the sizes of .ifc, .json, and .obj files.
# Calculates ratio: K = (ifc_size + json_size) / obj_size for each model configuration.

$registryFile = Join-Path $PSScriptRoot "registry_flat.json"
if (-not (Test-Path $registryFile)) {
    Write-Error "registry_flat.json not found."
    exit 1
}

$registry = Get-Content $registryFile -Raw | ConvertFrom-Json
$results = [System.Collections.Generic.List[PSObject]]::new()

Write-Host ""
Write-Host "=== Auditing Bridge Model File Sizes ===" -ForegroundColor Cyan
Write-Host ("{0,-40} {1,12} {2,12} {3,12} {4,10}" -f "Model Folder", "IFC Size (KB)", "JSON Size (KB)", "OBJ Size (KB)", "Ratio (K)")
Write-Host ("-" * 90)

$totalIfc = 0
$totalJson = 0
$totalObj = 0
$count = 0

foreach ($entry in $registry) {
    $ifcPath = Join-Path $PSScriptRoot $entry.ifc
    $jsonPath = Join-Path $PSScriptRoot $entry.json
    $objPath = $ifcPath -replace '\.ifc$', '.obj'
    
    if ((Test-Path $ifcPath) -and (Test-Path $jsonPath) -and (Test-Path $objPath)) {
        $ifcInfo = Get-Item $ifcPath
        $jsonInfo = Get-Item $jsonPath
        $objInfo = Get-Item $objPath
        
        $ifcSize = $ifcInfo.Length
        $jsonSize = $jsonInfo.Length
        $objSize = $objInfo.Length
        
        $totalIfc += $ifcSize
        $totalJson += $jsonSize
        $totalObj += $objSize
        $count++
        
        $k = 0
        if ($objSize -gt 0) {
            $k = ($ifcSize + $jsonSize) / $objSize
        }
        
        $folderName = Split-Path (Split-Path $ifcPath -Parent) -Leaf
        
        Write-Host ("{0,-40} {1,12:F1} {2,12:F1} {3,12:F1} {4,10:F2}" -f $folderName, ($ifcSize / 1KB), ($jsonSize / 1KB), ($objSize / 1KB), $k)
        
        $results.Add([PSCustomObject]@{
            Folder = $folderName
            IfcKB = ($ifcSize / 1KB)
            JsonKB = ($jsonSize / 1KB)
            ObjKB = ($objSize / 1KB)
            K = $k
        })
    }
}

Write-Host ("-" * 90)
if ($count -gt 0) {
    $avgIfc = ($totalIfc / $count) / 1KB
    $avgJson = ($totalJson / $count) / 1KB
    $avgObj = ($totalObj / $count) / 1KB
    
    $avgK = 0
    if ($totalObj -gt 0) {
        $avgK = ($totalIfc + $totalJson) / $totalObj
    }
    
    Write-Host ("{0,-40} {1,12:F1} {2,12:F1} {3,12:F1} {4,10:F2}" -f "AVERAGE", $avgIfc, $avgJson, $avgObj, $avgK) -ForegroundColor Green
    Write-Host ""
    Write-Host "Total Models Audited: $count" -ForegroundColor Green
    if ($totalIfc + $totalJson -gt 0) {
        $reduction = (1 - ($totalObj / ($totalIfc + $totalJson))) * 100
        Write-Host ("Overall Size Change: {0:F1}%" -f $reduction) -ForegroundColor Green
    }
} else {
    Write-Host "No complete IFC + JSON + OBJ configurations found." -ForegroundColor Yellow
}
Write-Host ""
