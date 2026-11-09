$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot '../install.ps1'
$skillA = 'pnmrvvtl-check-the-docs'
$skillB = 'pnmrvvtl-verify-for-real'
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempRoot ('agent-skills-test-' + [Guid]::NewGuid().ToString('N'))
$linkPath = $null

function Assert-True($condition, $message) {
    if (-not $condition) { throw $message }
}

function Assert-Rejected([scriptblock]$action) {
    $rejected = $false
    try { & $action | Out-Null } catch { $rejected = $true }
    Assert-True $rejected 'An invalid or conflicting installation was accepted.'
}

try {
    $copyTarget = Join-Path $testRoot 'copies'
    & $installer -Destination $copyTarget -Skill $skillA -Copy | Out-Null
    $copiedFile = Join-Path $copyTarget "$skillA/SKILL.md"
    Assert-True (Test-Path -LiteralPath $copiedFile) 'The selected skill was not copied.'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $copyTarget $skillB))) 'An unselected skill was installed.'
    $originalContents = [IO.File]::ReadAllText($copiedFile)

    Assert-Rejected { & $installer -Destination $copyTarget -Skill $skillB,$skillA -Copy }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $copyTarget $skillB))) 'A conflict caused a partial installation.'
    Assert-True ([IO.File]::ReadAllText($copiedFile) -ceq $originalContents) 'The existing installation changed.'

    $preview = Join-Path $testRoot 'preview'
    & $installer -Destination $preview -Copy -WhatIf | Out-Null
    Assert-True (-not (Test-Path -LiteralPath $preview)) 'WhatIf wrote files.'
    Assert-Rejected { & $installer -Destination $preview -Skill '../example' -Copy }
    Assert-True (-not (Test-Path -LiteralPath $preview)) 'An invalid selection wrote files.'
    Assert-Rejected { & $installer -Destination (Join-Path $PSScriptRoot '../.test-output/install') -Copy }

    $allTarget = Join-Path $testRoot 'all'
    & $installer -Destination $allTarget -Copy | Out-Null
    $expected = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '../skills') -Directory).Count
    Assert-True (@(Get-ChildItem -LiteralPath $allTarget -Directory).Count -eq $expected) 'The full collection was not installed.'

    $links = Join-Path $testRoot 'links'
    & $installer -Destination $links -Skill $skillA | Out-Null
    $linkPath = Join-Path $links $skillA
    Assert-True ((Get-Item -LiteralPath $linkPath).Attributes -band [IO.FileAttributes]::ReparsePoint) 'Expected a linked installation.'
    Assert-True (Test-Path -LiteralPath (Join-Path $linkPath 'SKILL.md')) 'The linked skill is unreadable.'
    Assert-Rejected { & $installer -Destination $links -Skill $skillA -Copy }

    Write-Output 'Installer checks passed: selected/full copies, links, conflict preservation, invalid selection, repository boundary and WhatIf.'
} finally {
    # Delete the link itself before recursive cleanup; Windows PowerShell may otherwise follow junctions.
    if ($linkPath -and (Test-Path -LiteralPath $linkPath)) { [IO.Directory]::Delete($linkPath) }
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    if (-not $resolvedTestRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolvedTestRoot) -notlike 'agent-skills-test-*') {
        throw 'Refusing cleanup outside the temporary test directory.'
    }
    if (Test-Path -LiteralPath $resolvedTestRoot) { Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force }
}
