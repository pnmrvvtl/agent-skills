<#
.SYNOPSIS
  Install selected skills without replacing any existing installation.
.EXAMPLE
  ./install.ps1 -Skill pnmrvvtl-check-the-docs
.EXAMPLE
  ./install.ps1 -Agent Claude -Copy
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet('Codex', 'Claude', 'OpenCode', 'Grok', 'Antigravity')]
    [string]$Agent = 'Codex',
    [string[]]$Skill,
    [string]$Destination,
    [switch]$Copy
)

$ErrorActionPreference = 'Stop'
$repoSkills = Join-Path $PSScriptRoot 'skills'
$available = @(Get-ChildItem -LiteralPath $repoSkills -Directory | Sort-Object Name)
if ($Skill) {
    foreach ($name in $Skill) {
        if ($name -notin $available.Name) { throw "Unknown skill: $name" }
    }
    $selected = @($available | Where-Object { $_.Name -in $Skill })
} else {
    $selected = $available
}

if (-not $Destination) {
    $relativeTarget = switch ($Agent) {
        'Codex' { '.agents/skills' }
        'Claude' { '.claude/skills' }
        'OpenCode' { '.agents/skills' }
        'Grok' { '.grok/skills' }
        'Antigravity' { '.gemini/config/skills' }
    }
    $Destination = Join-Path $HOME $relativeTarget
}
$targetRoot = [IO.Path]::GetFullPath($Destination)
$repoRoot = [IO.Path]::GetFullPath($PSScriptRoot)
if ($targetRoot -eq $repoRoot -or $targetRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose an installation destination outside this repository.'
}

# Check every selected destination before creating anything; never delete a user's existing skill.
foreach ($item in $selected) {
    $target = Join-Path $targetRoot $item.Name
    if (Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue) {
        throw "Already installed: $target. No existing skills were changed."
    }
}

$copyHere = $Copy -or $Agent -eq 'Antigravity'
foreach ($item in $selected) {
    $target = Join-Path $targetRoot $item.Name
    if ($PSCmdlet.ShouldProcess($target, 'Install skill')) {
        New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
        if ($copyHere) {
            Copy-Item -LiteralPath $item.FullName -Destination $target -Recurse -ErrorAction Stop
            Write-Output "COPY $($item.Name)"
        } else {
            $linkType = if ($env:OS -eq 'Windows_NT') { 'Junction' } else { 'SymbolicLink' }
            New-Item -ItemType $linkType -Path $target -Target $item.FullName -ErrorAction Stop | Out-Null
            Write-Output "LINK $($item.Name)"
        }
    }
}
