# Change Log

All notable changes to the "mplab-shortcuts" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.4]

- **Build Linked + Merge** now lists every configuration in the picker (was
  previously filtered to those with linked loadables, which bailed out early
  on app-only projects). When the picked configuration has no loadables, the
  command just builds it and stops — no `hexmate` merge, no "Unified hex"
  toast. When it has loadables, the merge step runs as before.

## [0.3.3]

- **Flash Unified Hex** strips the leading `PIC` from the device name before
  passing it to `ipecmd -P`. `ipecmd` prepends `PIC` to whatever it receives,
  so `PIC18F26K83` from `.mplab.json` was being expanded to `PICPIC18F26K83`
  and failing to locate the part / DFP.

## [0.3.2]

- **Flash Unified Hex** now recognizes the newer MPLAB tool-name format
  (e.g. `"tool": "ICD 5"` with whitespace, no `Tool` suffix) in addition to
  the older `"ICD5Tool"` style. The mapping normalizes whitespace + trailing
  `Tool` before lookup, so `ICD 5`, `ICD5`, and `ICD5Tool` all resolve to the
  ipecmd code `ICD5` (same for PICkit 3/4/5, Snap, Real ICE, JTAGICE3,
  Simulator).

## [0.3.1]

- **Flash Unified Hex** now accepts projects without linked loadables. The
  config picker lists every configuration in `.vscode/<project>.mplab.json`;
  when the picked config has no loadables, the build step skips `hexmate` and
  flashes `out/<project>/<config>.hex` directly. The "Build Linked + Merge"
  button still requires loadables (unchanged behavior).

## [0.3.0]

- Added **Flash Unified Hex** command and side-panel button: runs the Build
  Linked + Merge flow, then programs the resulting unified hex directly via
  Microchip's `ipecmd.sh` CLI — independent of MPLAB IDE's active configuration
- Auto-detects the target device (from `device` / `targetDevice`) and the
  programmer tool (from `tool` / `platformTool`) in `.vscode/<project>.mplab.json`,
  mapping MPLAB tool identifiers (e.g. `ICD5Tool`, `PICkit4Tool`, `SnapTool`)
  to the corresponding `ipecmd -TP` codes
- Added `mplab-shortcuts.ipecmdPath` setting (auto-detected from the newest
  installed MPLAB X) and `mplab-shortcuts.flashUnified.tool` (fallback `-TP`
  code when the config has no specific tool)

## [0.2.0]

- Added **Flash Device** command and side-panel button: prompts for a build
  configuration, builds it (and any linked loadables) with `cmake --build`, then
  invokes MPLAB's **Program Device** (`mplab-core-da.programDevice`) to flash via
  the connected programmer
- Added **auto-update from GitHub Releases**: periodic check against
  `tomridl/mplab-shortcuts`, one-click install of the latest `.vsix` asset, and
  a manual `MPLAB: Check for Updates` command. Configurable via
  `mplab-shortcuts.autoUpdate.*` settings

## [0.1.0]

- Added **Build Linked + Merge (Unified Hex)** command and side-panel button:
  builds linked (loadable) projects, then the main project, and merges the hexes
  with `hexmate` into `out/<main project>/<config>-unified.hex`
- Added `mplab-shortcuts.cmakePath` and `mplab-shortcuts.hexmatePath` settings
  (both auto-detected when left empty)

## [0.0.1]

- Initial release