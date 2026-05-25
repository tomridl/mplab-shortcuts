# Session Notes — Flash Device + Auto-Update features

## What was added
- New "Flash Device" button on the MPLAB Shortcuts side panel + matching command
  `mplab-shortcuts.flashDevice` ("MPLAB: Flash Device" in the command palette).
- Flow: pick configuration (QuickPick over `.mplab.json` configurations) → build
  it (and any linked loadables) via `cmake --build` → call
  `mplab-core-da.programDevice`.
- Version bumped to 0.2.0; README and CHANGELOG updated.

## Key facts discovered about the MPLAB extension ecosystem (useful for future work)
- The "Program Device" command exposed by the MPLAB extension is:
  `mplab-core-da.programDevice` (contributed by `microchip.mplab-core-da`).
- Its full signature (from `mplab.toolsView.program` in `microchip.mplab-ui`):
  `(unknownFirstArg, target, toolName, serial)` — but called with no args it
  uses MPLAB's active configuration/tool state.
- `runcmake.fullBuild` accepts `{ configurationName: string, buildType?: ... }`
  but dispatches to a VS Code task, so its promise resolves before the build
  actually finishes. That's why we use `cmake --build` directly (mirroring
  `buildLinkedAndMerge`) when we need a real completion signal.
- There is no documented public command to set the active configuration. We
  build a specific config so the hex is fresh, but programDevice itself flashes
  whatever MPLAB has currently selected.

## Trade-offs / open questions
- Active-config mismatch: if the user picks config A in our QuickPick but MPLAB's
  active config is B, programDevice will flash B's hex. In practice users have
  one active config so this is usually fine. Future improvement: detect MPLAB's
  active config (perhaps from workspace state) and warn on mismatch.
- We don't run hexmate-merge before flash. If the user wants the unified
  bootloader+app image flashed, they should use Build Linked + Merge then flash
  separately, or program from MPLAB's UI. programDevice handles multi-image
  projects natively when MPLAB's project state declares them.

## Files touched
- `package.json` — version bump, new command contribution.
- `src/extension.ts` — webview button + handler, command registration, new
  `flashDevice()` function (reuses `getLinkedProjects`, `resolveCmake`,
  `runStreamed`, `getOutputChannel`).
- `README.md`, `CHANGELOG.md` — documented under 0.2.0.

## Build verification
- `npm run compile` runs clean (no TS errors).
- Not run in a live MPLAB workspace — runtime behavior of the flash flow was
  not exercised. Next step for the user: open an MPLAB project, click Flash
  Device, confirm the build + program sequence with a real programmer.

---

# Auto-Update from GitHub Releases

## What was added
- The extension now checks its own GitHub repository for newer releases and
  offers an in-editor "Update / Release notes / Skip / Later" prompt — gives
  the same UX as the Marketplace auto-updater without publishing.
- Manual command `MPLAB: Check for Updates` (`mplab-shortcuts.checkForUpdates`).
- Three new settings under `mplab-shortcuts.autoUpdate.*`:
  - `enabled` (bool, default true)
  - `checkIntervalHours` (number, default 24)
  - `repository` (string, default `tomridl/mplab-shortcuts`)
- `globalState` keys: `mplab-shortcuts.lastUpdateCheck` (timestamp),
  `mplab-shortcuts.skippedVersion` (string).

## Implementation choices
- Used Node's built-in `https` module rather than `fetch` so we don't rely on
  TypeScript lib config (and to get straightforward redirect handling — GitHub
  asset URLs redirect to objects.githubusercontent.com).
- Update check fires 5 seconds after `activate()` (background, non-blocking)
  and is throttled by `checkIntervalHours` via `globalState.lastUpdateCheck`.
- Install is done via the public command
  `workbench.extensions.installExtension` with a `vscode.Uri.file(<vsixPath>)`.
- After successful install, we clear `skippedVersion` so the user isn't stuck
  if they had skipped that version previously.
- `releases/latest` excludes prereleases by GitHub default — we don't need to
  filter ourselves.

## Release workflow (for the maintainer)
```sh
# bump version in package.json, update CHANGELOG.md, then:
npm run compile && npx vsce package
gh release create v<version> mplab-shortcuts-<version>.vsix --notes "<notes>"
```
Could later be automated with a `.github/workflows/release.yml` triggered on
tag push.

## Trade-offs / open questions
- No GitHub auth → 60 req/hr per IP rate limit. Fine with 24h throttling.
- We download the *first* `.vsix` asset in the release. If a release ever
  contains multiple `.vsix` files we'd need to disambiguate by name.
- Asset name does not need to match the extension name — we just take the
  first `.vsix`. Simpler, and matches the `vsce package` default naming.
- If GitHub is unreachable, silent fail for auto checks; visible warning for
  manual checks.

## Files touched (auto-update)
- `package.json` — new command, new settings.
- `src/extension.ts` — new `https`/`os` imports, ~180 LOC of updater code,
  `checkForUpdates` command registration, background timer in `activate()`.
- `README.md` — feature section, settings table, commands table, release notes.
- `CHANGELOG.md` — 0.2.0 entry expanded.

## Build verification (auto-update)
- `npm run compile` clean.
- Not exercised at runtime — needs a real release to be cut on the
  `tomridl/mplab-shortcuts` repo before the update prompt will fire.

---

# Flash Unified Hex (0.3.0)

## What was added
- New side-panel button "🚀 Flash Unified Hex" + matching command
  `mplab-shortcuts.flashUnified` ("MPLAB: Flash Unified Hex").
- Flow: pick config (filtered to those with linked loadables) → build linked
  loadables + main project → `hexmate` merge → flash the resulting
  `out/<project>/<config>-unified.hex` directly via Microchip's `ipecmd.sh`.
- Two new settings: `mplab-shortcuts.ipecmdPath` (auto-detect newest MPLAB X)
  and `mplab-shortcuts.flashUnified.tool` (fallback `-TP` code when the
  configuration's `tool` is `default-tool`).
- Version bumped to 0.3.0; README and CHANGELOG updated.

## Why a second flash command (vs. extending `flashDevice`)
- `mplab-core-da.programDevice` programs whatever **MPLAB's active
  configuration** points at, with no way to pass a specific hex path. So that
  command cannot flash the hexmate-merged unified hex.
- `ipecmd` accepts an arbitrary `-F<hexfile>`, decoupling the flash from
  MPLAB's UI state. Keeping the two commands separate makes the distinction
  obvious in the UI and in the command palette.

## .mplab.json schema findings (verified against real projects)
Two schema versions exist:

| Field          | v1.9 (XC8 / PIC18) | v1.3 (XC32 / PIC32) |
| -------------- | ------------------ | ------------------- |
| Target device  | `device`           | `targetDevice`      |
| Programmer     | `tool`             | `platformTool`      |

Sample v1.9 config snippet (qt6-can-boot):
```json
{ "device": "PIC18F26K80", "tool": "ICD5Tool", ... }
```
Sample v1.3 config snippet (PIC32TestBle): `targetDevice: "PIC32CX5109BZ31048"`,
`platformTool: "default-tool"` (no specific tool selected → fall back to setting).

Resolution in code:
```ts
const device = config.device || config.targetDevice;
const tool   = config.tool   || config.platformTool;
```

## MPLAB tool → ipecmd `-TP` mapping table (implemented)
| MPLAB identifier | ipecmd `-TP` |
| ---------------- | ------------ |
| `PICkit3Tool`    | `PICkit3`    |
| `PICkit4Tool`    | `PK4`        |
| `PICkit5Tool`    | `PK5`        |
| `ICD3Tool`       | `ICD3`       |
| `ICD4Tool`       | `ICD4`       |
| `ICD5Tool`       | `ICD5`       |
| `SnapTool`       | `SN`         |
| `RealICETool`    | `RealICE`    |
| `JTAGICE3Tool`   | `JTAGICE3`   |
| `Simulator`      | `SIM`        |
| `default-tool` / unknown | — (uses `mplab-shortcuts.flashUnified.tool` fallback) |

## ipecmd invocation
```
ipecmd.sh -TP<code> -P<device> -F<absolute path to unified.hex> -M -OL
```
- `-M` programs the device.
- `-OL` releases MCLR so the device runs after programming.
- All paths absolute (avoids cwd surprises since `cp.spawn`'s `cwd` is the
  workspace root).

## Refactor for reuse
- `buildLinkedAndMerge` now returns `{ unifiedHex, configName, mplab } | undefined`
  and accepts `{ silentOnSuccess }`. `flashUnified()` calls it with
  `silentOnSuccess: true` so the user only sees one final "Flashed ..." toast.
- The existing webview button keeps its old "Unified hex created: ..." toast
  because it does not pass `silentOnSuccess`.

## Trade-offs / open questions
- We don't auto-detect the connected programmer via `ipecmd -?TP`. If the
  `.mplab.json` tool is `default-tool` and the fallback setting is empty, we
  error out with a clear message asking the user to set
  `mplab-shortcuts.flashUnified.tool`. Could be smarter later.
- We don't pass any power/voltage flags. ICDs/PICkits used externally don't
  need them; target-powered setups may. Add a setting if it becomes a problem.
- We don't run a verify step (`-Y`). ipecmd already reports CRC after `-M`;
  adding `-Y` would roughly double flash time.
- The tool-name table covers the common MPLAB X identifiers seen in current
  projects. If MPLAB introduces a new programmer with a different identifier
  the user can override via the fallback setting until the table is updated.

## Files touched (Flash Unified)
- `package.json` — version 0.3.0, new command, two new settings.
- `src/extension.ts` — `resolveIpecmd`, `mapMplabToolToIpecmd`, `flashUnified`,
  `buildLinkedAndMerge` refactor + reuse, webview button + handler, command
  registration.
- `README.md`, `CHANGELOG.md` — documented under 0.3.0.
- `FLASH_UNIFIED_PLAN.md`, `FLASH_UNIFIED_TODO.json` — planning artifacts per
  the user's Planning Policy.

## Build verification (Flash Unified)
- `npm run compile` clean.
- `npm run lint` clean.
- Runtime: not exercised in a live MPLAB workspace from this session. Next
  step for the user: open a bootloader project with linked loadables, click
  **Flash Unified Hex**, confirm the ipecmd output in the **MPLAB Shortcuts**
  channel and that the device starts running.

## 0.3.3 — Strip PIC prefix for ipecmd -P
- Reported failure: ipecmd ran but errored with
  `Could not find device:PICPIC18F26K83` and
  `Unable to locate DFP, Please install required pack...`.
- Root cause: ipecmd internally prepends `PIC` to whatever follows `-P`, so
  `-PPIC18F26K83` becomes a lookup for `PICPIC18F26K83`. Confirmed by re-running
  the same command with `-P18F26K83` — programming/verify completed cleanly
  against an attached ICD 5.
- Fix: strip leading `/^PIC/i` from `config.device || config.targetDevice`
  before passing to `-P`. The full MPLAB-style name is still shown in the
  output channel header and the progress-notification title so the user sees
  a recognizable name.
- Note: this matches how ipecmd is documented in older `pk2cmd` / `ipecmd`
  references too — part names are supplied without the family prefix.

## 0.3.2 — Recognize the newer "ICD 5" tool-name format
- Reported failure: on `dr1-security-app.X` the command bailed with
  `Cannot determine programmer ... .mplab.json tool="ICD 5"`. The literal
  string in the live .mplab.json is `"tool": "ICD 5"` (space, no Tool
  suffix), but the table only had `ICD5Tool`.
- Schema variance confirmed by surveying live projects:
  - `qt6-blue-app.X`, `qt6-green-app.X`, `qt6-can-test.X`, `DR1_SWAT.X` use
    `"ICD5Tool"` / `"ICD4Tool"`.
  - `dr1-security-app.X` uses `"ICD 5"`.
- Fix: `mapMplabToolToIpecmd` normalizes (strip whitespace, strip trailing
  `Tool`, lowercase) before lookup. So `ICD 5`, `ICD5`, `ICD5Tool` all map
  to `ICD5`. Same treatment for PICkit3/4/5, Snap (+ `MPLAB Snap`), Real ICE,
  JTAGICE3, Simulator.

## 0.3.1 — Flash Unified works on app-only projects too
- Reported failure: on `dr1-security-app.X` (the loadable application — no
  loadables of its own) the command bailed with "No linked (loadable) projects
  found in any configuration of dr1-security-app." User wanted to still pick
  a configuration and flash via ipecmd.
- Fix: `buildLinkedAndMerge` now takes `allowNoLoadables` (default false).
  When true, the picker lists all configurations; if the picked config has no
  loadables we skip `hexmate` entirely and return the plain
  `out/<project>/<config>.hex`. `flashUnified` passes `allowNoLoadables: true`
  plus a "Select the configuration to build and flash" placeholder. The
  existing **Build Linked + Merge** button is unchanged (it still requires
  loadables, since merging is its whole point).
- Result field renamed `unifiedHex` → `hexPath` (it's no longer always
  unified). flashUnified output channel header updated from "Flashing unified
  hex via ipecmd" → "Flashing hex via ipecmd"; toast already uses
  `path.basename` so it didn't need a change.
