# Flash Unified Hex — Implementation Plan

## Goal
Add a "Flash Unified Hex" action to the MPLAB Shortcuts side panel that flashes
the merged bootloader+application hex produced by Build Linked + Merge, using
Microchip's CLI programmer (`ipecmd`). This bypasses MPLAB's `programDevice`
command (which can only flash whichever config is *active* in MPLAB) and lets
us flash a specific unified hex file.

## Flow
1. User clicks "Flash Unified Hex"
2. Pick a configuration (QuickPick over configs in `.vscode/<project>.mplab.json`
   that have linked loadables — same filter as Build Linked + Merge).
3. Build the chosen config + linked loadables, then merge them with `hexmate`
   into `out/<mainProject>/<config>-unified.hex` (reuse existing logic).
4. Read `device` and `tool` from the picked config in `.mplab.json`.
5. Map MPLAB tool name → ipecmd code (table below). Fall back to a setting if
   unknown or if tool is `default-tool`.
6. Resolve `ipecmd.sh` (newest `/Applications/microchip/mplabx/v*/mplab_platform/mplab_ipe/ipecmd.sh`,
   override via `mplab-shortcuts.ipecmdPath`).
7. Spawn `ipecmd.sh -TP<tool> -P<device> -F<unified.hex> -M -OL` streamed to
   the existing output channel.

## .mplab.json schema (verified)
Two schema versions in the wild:

**v1.9 (XC8, PIC18/PIC16):**
```json
{
  "configurations": [{
    "name": "PARK_LIGHTS_TILT",
    "device": "PIC18F26K80",
    "tool": "ICD5Tool",
    ...
  }]
}
```

**v1.3 (XC32, PIC32):**
```json
{
  "configurations": [{
    "name": "default",
    "targetDevice": "PIC32CX5109BZ31048",
    "platformTool": "default-tool",
    ...
  }]
}
```

Resolution order:
- device  = `config.device || config.targetDevice`
- tool    = `config.tool   || config.platformTool`

## MPLAB tool name → ipecmd `-TP` code
Based on MPLAB X documentation:

| MPLAB tool name   | ipecmd code |
| ----------------- | ----------- |
| `PICkit3Tool`     | `PICkit3`   |
| `PICkit4Tool`     | `PK4`       |
| `PICkit5Tool`     | `PK5`       |
| `ICD3Tool`        | `ICD3`      |
| `ICD4Tool`        | `ICD4`      |
| `ICD5Tool`        | `ICD5`      |
| `SnapTool`        | `SN`        |
| `RealICETool`     | `RealICE`   |
| `JTAGICE3Tool`    | `JTAGICE3`  |
| `Simulator`       | `SIM`       |
| `default-tool`    | (no map — fall back to setting) |

Unknown / `default-tool` → use `mplab-shortcuts.flashUnified.tool` setting; if
not set either, show an error explaining the user must configure their
programmer in MPLAB or via the setting.

## ipecmd invocation
```sh
ipecmd.sh -TP<code> -P<device> -F<path/to/unified.hex> -M -OL
```
- `-TP<code>`: programming tool
- `-P<device>`: target part (full device name accepted, e.g., `PIC18F26K80`)
- `-F<file>`: hex file to program
- `-M`: program the device
- `-OL`: release the MCLR line at the end (so the device runs)

We pass the unified hex path absolute to avoid cwd surprises.

## Code changes

### package.json
- Bump version to `0.3.0`.
- Add command `mplab-shortcuts.flashUnified` with title `MPLAB: Flash Unified Hex`.
- Add settings:
  - `mplab-shortcuts.ipecmdPath` (string, default `""`) — path to `ipecmd.sh`.
    Auto-detect newest `/Applications/microchip/mplabx/v*/mplab_platform/mplab_ipe/ipecmd.sh`.
  - `mplab-shortcuts.flashUnified.tool` (string, default `""`) — fallback
    ipecmd `-TP` code when `.mplab.json` doesn't specify a real tool.

### src/extension.ts
- Refactor `buildLinkedAndMerge` to return `{ unifiedHex, configName } | undefined`
  so `flashUnified` can reuse the build+merge step. The existing webview button
  keeps current behavior.
- Add `resolveIpecmd()` (mirror of `resolveHexmate`).
- Add `mapMplabToolToIpecmd(toolName)` returning a code or `undefined`.
- Add `flashUnified()`:
  - Calls the refactored build+merge.
  - Reads device/tool from `.mplab.json` for the picked config.
  - Maps tool, falls back to setting, errors with explanation if neither.
  - Spawns ipecmd via `runStreamed` with absolute paths.
- Register `mplab-shortcuts.flashUnified` command.
- Add `'flashUnified'` case in the webview message handler.
- Add "Flash Unified Hex" button to the webview HTML.

### README.md + CHANGELOG.md
- Document the new button, command, and settings under 0.3.0.

### SESSION_NOTES.md
- Append a section covering: what was added, .mplab.json schema findings,
  tool-name mapping table, trade-offs (`default-tool` fallback, ipecmd vs.
  MPLAB IDE programmer state).

## Out of scope
- Auto-detecting the connected programmer over USB. ipecmd has `-?TP` to list
  attached tools but parsing that reliably is more than the user asked for.
- Programmer power/voltage options. Defaults work for ICDs/PICkits used
  externally (not target-powered). If users need `-W` etc., a future setting.
- Verification step (`-Y`). Could add later as a setting.

## Verification
- `npm run compile` + `npm run lint` clean.
- Runtime: open an MPLAB project with linked loadables, click Flash Unified Hex,
  confirm ipecmd output in the channel and that the device gets programmed.
