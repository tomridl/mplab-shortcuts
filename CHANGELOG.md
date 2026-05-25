# Change Log

All notable changes to the "mplab-shortcuts" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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