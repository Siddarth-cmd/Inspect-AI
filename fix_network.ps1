# Fix network for InspectAI

# Change network profile from Public to Private
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
foreach ($adapter in $adapters) {
    Write-Host "Setting $($adapter.Name) to Private network..."
    Set-NetConnectionProfile -InterfaceIndex $adapter.ifIndex -NetworkCategory Private
}

# Verify the change
Get-NetConnectionProfile | Select-Object Name, NetworkCategory
