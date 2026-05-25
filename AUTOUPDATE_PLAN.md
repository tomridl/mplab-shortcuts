# Auto-Update from GitHub Releases — Implementation Plan

## Goal
Make the extension check GitHub Releases for newer versions and prompt the user
to install them — no Marketplace required.

## UX
- Silently checks once per N hours (default 24h) after extension activation.
- If a newer release is available, shows an info notification with:
  - **Update** — downloads the `.vsix` asset, installs it, prompts to reload.
  - **View release notes** — opens the release page on GitHub.
  - **Skip this version** — won't nag again until a *newer* version appears.
  - **Later** — dismiss; we'll nag again next interval.
- Manual command `MPLAB: Check for Updates` bypasses cache + skipped-version.

## Settings
- `mplab-shortcuts.autoUpdate.enabled` (bool, default `true`)
- `mplab-shortcuts.autoUpdate.checkIntervalHours` (number, default `24`)
- `mplab-shortcuts.autoUpdate.repository` (string, default `tomridl/mplab-shortcuts`)
  — lets the user fork and point at their own repo without rebuilding the extension.

## Mechanics
- API: `GET https://api.github.com/repos/{owner}/{repo}/releases/latest`
  - Unauthenticated, 60 req/hour rate limit per IP. Throttled via the
    `checkIntervalHours` setting + `globalState` "last check" timestamp.
  - `releases/latest` excludes prereleases automatically.
- Version compare: strip leading `v`, parse `major.minor.patch`, numeric compare.
- Download: stream the first `.vsix` asset to OS temp dir.
- Install: `vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmpPath))`.
- Reload: `vscode.commands.executeCommand('workbench.action.reloadWindow')`.

## State (persisted in globalState)
- `mplab-shortcuts.lastUpdateCheck` — timestamp (number) of last check.
- `mplab-shortcuts.skippedVersion` — string version the user chose to skip.

## Release workflow (manual, user does these)
1. Bump `version` in `package.json`.
2. Update `CHANGELOG.md`.
3. `npm run compile && npx vsce package`.
4. `gh release create v<version> mplab-shortcuts-<version>.vsix --notes-from-tag`
   (or write notes inline).

Optionally add a `.github/workflows/release.yml` later that does steps 3–4 on tag push.

## Files
- `package.json` — add settings + command contribution.
- `src/extension.ts` — append update-check logic (~150 LOC), invoke from `activate()`.
- `README.md`, `CHANGELOG.md` — document the auto-update feature.
