# MPLAB Shortcuts

A VS Code extension that adds a convenient side panel with quick-access buttons for common MPLAB development tasks.

## Features

- **Side Panel**: Adds an "MPLAB Shortcuts" panel to the activity bar with easy-to-use buttons
- **Build**: Trigger a full build of your MPLAB project
- **Clean Build**: Perform a clean build to rebuild everything from scratch
- **Export Hex**: Export your compiled `.hex` file with a smart save dialog that suggests a filename based on your project name and firmware version

### Export Hex Features

The Export Hex function automatically:
- Scans the `out/` folder for compiled `.hex` files
- Reads version information from `AlarmSettings.h` (`FIRMWARE_VERSION_LSB` and `BETA_VERSION`)
- Suggests a filename in the format: `{Project Name} V{version}{beta}.hex`
- Cleans up the project name by removing `.X` suffix, replacing hyphens with spaces, and capitalizing words

## Requirements

- [MPLAB Extension Pack](https://marketplace.visualstudio.com/items?itemName=microchip.mplab-extension-pack) must be installed
- A valid MPLAB project open in VS Code

## Commands

The following commands are available via the Command Palette (Ctrl/Cmd+Shift+P):

| Command | Description |
|---------|-------------|
| `MPLAB: Build` | Build the current project |
| `MPLAB: Clean Build` | Clean and rebuild the project |
| `MPLAB: Export Hex` | Export the hex file with version info |
| `MPLAB: List Available Commands` | Show all available MPLAB commands |

## Release Notes

### 0.0.1

Initial release:
- Side panel with Build, Clean Build, and Export Hex buttons
- Smart hex file export with automatic version detection
- Command palette integration

---

**Enjoy!**
