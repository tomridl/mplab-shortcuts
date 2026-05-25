# Flash Device — Implementation Plan

## Goal
Add a new "Flash Device" button to the MPLAB Shortcuts side panel. Behavior:
1. User clicks Flash button
2. Show QuickPick of build configurations (read from `.vscode/<project>.mplab.json`)
3. Build the chosen configuration (plus any linked loadable projects), waiting for completion
4. Invoke MPLAB's built-in `mplab-core-da.programDevice` to flash via the connected programmer

## Why this design
- User said: pick config first, then MPLAB ext command, build-then-flash.
- `mplab-core-da.programDevice` (declared in `microchip.mplab-core-da` extension, title "Program Device") uses MPLAB's active state — tool/serial/target/active-config — to flash. Calling it with no args is what `MPLAB: Program Device` in the command palette does.
- We don't have a documented way to programmatically set the active configuration. The clean compromise: we build the user-picked config so its hex is fresh on disk; MPLAB then programs whatever its active config points at. If users want a *different* config from the active one, they'd normally change it in the MPLAB UI anyway.
- Build is via `cmake --build _build/<project>/<config>` (mirrors `buildLinkedAndMerge`) — gives us a real promise that resolves on actual build completion, unlike `runcmake.fullBuild` which dispatches to a VS Code task.
- Linked (loadable) projects are also built before the main project, just like `buildLinkedAndMerge`. We skip the hexmate merge step — programDevice handles multi-image programming itself.

## Code changes

### package.json
- Add command `mplab-shortcuts.flashDevice` with title `MPLAB: Flash Device`.

### src/extension.ts
- Add `flashDevice()` async function:
  - Read `.vscode/<project>.mplab.json` (same as `buildLinkedAndMerge`)
  - List all config names; QuickPick if >1, else use the only one
  - Build chosen config + its linked projects via `cmake --build` (reuse `runStreamed`, `resolveCmake`, `getLinkedProjects`)
  - On success, `vscode.commands.executeCommand('mplab-core-da.programDevice')`
- Register `mplab-shortcuts.flashDevice` command
- Wire a new `'flashDevice'` case in the webview message handler
- Add a "Flash Device" button to the webview HTML

### README.md & CHANGELOG.md
- Document the new feature under 0.2.0 / unreleased.

## Out of scope
- Setting the active configuration programmatically — would require reverse-engineering MPLAB UI internals.
- Merging into a unified hex before flash — programDevice handles multi-image projects natively. If users want a hexmate-merged hex flashed, that's a separate workflow.
