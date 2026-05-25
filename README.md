# MPLAB Shortcuts

A VS Code extension that adds a convenient side panel with quick-access buttons for common MPLAB development tasks.

## Features

- **Side Panel**: Adds an "MPLAB Shortcuts" panel to the activity bar with easy-to-use buttons
- **Build**: Trigger a full build of your MPLAB project
- **Clean Build**: Perform a clean build to rebuild everything from scratch
- **Export Hex**: Export your compiled `.hex` file with a smart save dialog that suggests a filename based on your project name and firmware version
- **Build Linked + Merge (Unified Hex)**: Build any linked (loadable) projects, then the main project, and merge the results into a single unified `.hex` with `hexmate` — e.g. combine a bootloader with its application image
- **Flash Device**: Pick a build configuration, build it (and any linked loadables), then program the connected programmer via MPLAB's built-in **Program Device** command
- **Flash Unified Hex**: Pick a configuration, build it (merging linked loadables into a unified hex when present), then flash that exact file directly via Microchip's `ipecmd` CLI — independent of MPLAB IDE's active configuration
- **Auto-update from GitHub Releases**: The extension periodically checks its GitHub repository for a newer `.vsix` and prompts to install — no Marketplace required

### Export Hex Features

The Export Hex function automatically:
- Scans the `out/` folder for compiled `.hex` files
- Reads version information from `AlarmSettings.h` (`FIRMWARE_VERSION_LSB` and `BETA_VERSION`)
- Suggests a filename in the format: `{Project Name} V{version}{beta}.hex`
- Cleans up the project name by removing `.X` suffix, replacing hyphens with spaces, and capitalizing words

### Build Linked + Merge (Unified Hex)

For projects that pull in other projects as **loadables** (e.g. a bootloader that
loads an application to produce a combined image), this builds everything and merges
it for you:

- Reads the active project's `.vscode/<project>.mplab.json`
- Finds linked (loadable) projects per configuration — the `projectType: "loadable"`
  entries and their `dependentConfigurationName`
- Prompts you to pick any configuration (or auto-selects if there's only one)
- Builds each **linked project first**, then the **main project**
  (`cmake --build <project>/_build/<project>/<config>`)
- If the picked configuration has linked loadables, merges the resulting hexes
  with `hexmate` into `out/<main project>/<config>-unified.hex`; otherwise the
  built `out/<main project>/<config>.hex` is the final output

Progress and build output are shown in the **MPLAB Shortcuts** output channel. The
per-config build directories must already have been emitted by MPLAB (open/emit the
project first); this command builds and merges, it does not emit.

### Flash Device

- Prompts you to pick a build configuration from `.vscode/<project>.mplab.json`
- Builds the chosen configuration (and any linked loadable projects) with `cmake --build`
- Then dispatches MPLAB's **Program Device** command (`mplab-core-da.programDevice`),
  which programs the device using the tool/serial currently selected in the MPLAB
  Tools view

The build step requires the per-config build directory to have been emitted by MPLAB
(open/emit the project first). The flashing itself relies on MPLAB's active
programmer selection — the same one used by MPLAB's own **Program Device** action.

### Flash Unified Hex

Flashes the current project via Microchip's CLI programmer (`ipecmd.sh`).
Unlike **Flash Device**, this does not depend on MPLAB IDE's active
configuration — the hex you just built is the hex that gets programmed.

What it does:

- Prompts you to pick **any** configuration in `.vscode/<project>.mplab.json`
- Builds the picked configuration (and any linked loadable projects)
- If the configuration has linked loadables, merges them with `hexmate` into
  `out/<project>/<config>-unified.hex`; otherwise uses the plain
  `out/<project>/<config>.hex` directly
- Reads the **device** (`device` or `targetDevice`) and the **tool** (`tool` or
  `platformTool`) from the picked configuration
- Maps the MPLAB tool name (e.g., `ICD5Tool`, `PICkit4Tool`, `SnapTool`) to the
  corresponding `ipecmd` `-TP` code; if the configuration has no specific tool
  (`default-tool`) it falls back to `mplab-shortcuts.flashUnified.tool`
- Runs `ipecmd.sh -TP<tool> -P<device> -F<hex> -M -OL`, streaming output to the
  **MPLAB Shortcuts** channel

Requires `ipecmd.sh` from MPLAB X (auto-detected from
`/Applications/microchip/mplabx/v*/mplab_platform/mplab_ipe/`, override via
`mplab-shortcuts.ipecmdPath`).

### Auto-update from GitHub Releases

Since this extension isn't on the VS Code Marketplace, the built-in extension
auto-updater won't find new versions. To get the same "click to update" feel,
the extension queries its own GitHub repository:

- On activation (and at most once per `autoUpdate.checkIntervalHours`), it asks
  `https://api.github.com/repos/<repo>/releases/latest` for the newest release
- If the release's `tag_name` (e.g. `v0.2.0`) is newer than the installed
  `version` in `package.json`, a notification offers **Update / Release notes /
  Skip this version / Later**
- **Update** downloads the first `.vsix` asset from the release, installs it via
  VS Code's `workbench.extensions.installExtension`, and prompts to reload the
  window
- Use **`MPLAB: Check for Updates`** from the command palette to force an
  immediate check (ignores the cached interval and any "Skip this version" you
  previously chose)

**Cutting a release** (maintainer workflow):

```sh
# 1. bump version in package.json + update CHANGELOG.md
npm run compile && npx vsce package        # produces mplab-shortcuts-<version>.vsix
gh release create v<version> mplab-shortcuts-<version>.vsix --notes "<changelog>"
```

The auto-updater will pick it up on every other user's next check.

## Requirements

- [MPLAB Extension Pack](https://marketplace.visualstudio.com/items?itemName=microchip.mplab-extension-pack) must be installed
- A valid MPLAB project open in VS Code
- For **Build Linked + Merge**: `cmake` and the XC8 `hexmate` tool (both auto-detected; see Configuration)
- For **Flash Unified Hex**: MPLAB X `ipecmd.sh` (auto-detected from the newest installed MPLAB X) and a supported programmer (PICkit, ICD, Snap, …)

## Configuration

| Setting | Description |
|---------|-------------|
| `mplab-shortcuts.cmakePath` | Path to the `cmake` executable. Leave empty to auto-detect (PATH, then `/opt/homebrew/bin/cmake`). |
| `mplab-shortcuts.hexmatePath` | Path to the XC8 `hexmate` executable. Leave empty to auto-detect the newest `/Applications/microchip/xc8/v*/pic/bin/hexmate`. |
| `mplab-shortcuts.ipecmdPath` | Path to the MPLAB `ipecmd.sh` CLI programmer (used by **Flash Unified Hex**). Leave empty to auto-detect the newest `/Applications/microchip/mplabx/v*/mplab_platform/mplab_ipe/ipecmd.sh`. |
| `mplab-shortcuts.flashUnified.tool` | Fallback ipecmd `-TP` code (e.g. `PK4`, `PK5`, `SN`, `ICD4`, `ICD5`) used when the `.mplab.json` configuration has no specific tool (e.g. `default-tool`). |
| `mplab-shortcuts.autoUpdate.enabled` | Periodically check GitHub Releases for a newer `.vsix` and prompt to install. Default `true`. |
| `mplab-shortcuts.autoUpdate.checkIntervalHours` | How often (hours) to check for updates. Default `24`. |
| `mplab-shortcuts.autoUpdate.repository` | GitHub repo (`owner/name`) to query. Defaults to `tomridl/mplab-shortcuts`. |

## Commands

The following commands are available via the Command Palette (Ctrl/Cmd+Shift+P):

| Command | Description |
|---------|-------------|
| `MPLAB: Build` | Build the current project |
| `MPLAB: Clean Build` | Clean and rebuild the project |
| `MPLAB: Export Hex` | Export the hex file with version info |
| `MPLAB: Build Linked + Merge (Unified Hex)` | Build linked (loadable) projects, then the main project, and merge into a unified hex |
| `MPLAB: Flash Device` | Pick a configuration, build it, and flash via MPLAB's Program Device |
| `MPLAB: Flash Unified Hex` | Pick a configuration, build it (merging linked loadables when present), then flash via `ipecmd` |
| `MPLAB: Check for Updates` | Force an immediate GitHub Releases check for a newer version |
| `MPLAB: List Available Commands` | Show all available MPLAB commands |

## Release Notes

### 0.3.4

- **Build Linked + Merge** now offers the configuration picker on every
  project, including app-only projects without linked loadables. When the
  picked configuration has no loadables, the command builds it and stops
  (no `hexmate` merge).

### 0.3.3

- **Flash Unified Hex**: strip the leading `PIC` from the device name before
  passing to `ipecmd -P` (ipecmd reinserts the prefix itself, so passing the
  full MPLAB name resulted in `PICPIC18F26K83` and a "Could not find device"
  error).

### 0.3.2

- **Flash Unified Hex**: recognize newer `.mplab.json` tool format
  (e.g. `"tool": "ICD 5"`) in addition to the older `"ICD5Tool"` variant —
  the mapping now normalizes whitespace + trailing `Tool` before lookup.

### 0.3.1

- **Flash Unified Hex** now works on projects without linked loadables (e.g.
  app-only projects): it builds the picked configuration and flashes the
  plain `out/<project>/<config>.hex` directly. When loadables are present it
  still merges with `hexmate` and flashes the unified hex.

### 0.3.0

- Added **Flash Unified Hex**: builds the linked loadables + main project,
  merges them with `hexmate`, then programs the resulting unified hex directly
  via Microchip's `ipecmd` CLI — independent of MPLAB IDE's active configuration
- Auto-detects the target **device** and **programmer tool** from the picked
  configuration in `.vscode/<project>.mplab.json`
- Added `mplab-shortcuts.ipecmdPath` and `mplab-shortcuts.flashUnified.tool`
  settings

### 0.2.0

- Added **Flash Device**: picks a build configuration, builds it (and any linked
  loadables), then programs the connected device via MPLAB's **Program Device**
  command
- Added **auto-update from GitHub Releases**: the extension now checks its own
  GitHub repo for new `.vsix` releases and offers a one-click install + reload
  flow, plus a manual `MPLAB: Check for Updates` command

### 0.1.0

- Added **Build Linked + Merge (Unified Hex)**: builds linked (loadable) projects and
  the main project, then merges them with `hexmate` into a unified hex
- Added `mplab-shortcuts.cmakePath` and `mplab-shortcuts.hexmatePath` settings

### 0.0.1

Initial release:
- Side panel with Build, Clean Build, and Export Hex buttons
- Smart hex file export with automatic version detection
- Command palette integration

---

**Enjoy!**
