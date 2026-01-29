import * as vscode from 'vscode';

class MplabShortcutsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'mplab-shortcuts.shortcutsView';

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.command) {
				case 'build':
					await this._executeCommand('runcmake.fullBuild');
					break;
				case 'cleanBuild':
					await this._executeCommand('runcmake.cleanBuild');
					break;
				case 'exportHex':
					await exportHexFile();
					break;
			}
		});
	}

	private async _executeCommand(commandId: string) {
		try {
			// Check if the command exists
			const commands = await vscode.commands.getCommands(true);
			if (!commands.includes(commandId)) {
				vscode.window.showErrorMessage(
					`Command "${commandId}" not found. Make sure the MPLAB extension is installed and a project is open.`
				);
				return;
			}
			await vscode.commands.executeCommand(commandId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to execute "${commandId}": ${errorMessage}`);
		}
	}

	private _getHtmlForWebview(_webview: vscode.Webview): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>MPLAB Shortcuts</title>
	<style>
		body {
			padding: 10px;
			font-family: var(--vscode-font-family);
		}
		.button-container {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		button {
			width: 100%;
			padding: 8px 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 500;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		button:active {
			transform: scale(0.98);
		}
		.icon {
			font-size: 16px;
		}
	</style>
</head>
<body>
	<div class="button-container">
		<button id="buildBtn">
			<span class="icon">🔨</span>
			Build
		</button>
		<button id="cleanBuildBtn">
			<span class="icon">🧹</span>
			Clean Build
		</button>
		<button id="exportHexBtn">
			<span class="icon">📦</span>
			Export Hex
		</button>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		
		document.getElementById('buildBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'build' });
		});
		
		document.getElementById('cleanBuildBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'cleanBuild' });
		});
		
		document.getElementById('exportHexBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'exportHex' });
		});
	</script>
</body>
</html>`;
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('MPLAB Shortcuts extension is now active!');

	// Register the webview view provider
	const provider = new MplabShortcutsViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MplabShortcutsViewProvider.viewType, provider)
	);

	// Register individual commands that can also be used via command palette
	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.build', async () => {
			await executeWithCheck('runcmake.fullBuild');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.cleanBuild', async () => {
			await executeWithCheck('runcmake.cleanBuild');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.exportHex', async () => {
			await exportHexFile();
		})
	);

	// Helper command to list all available microchip/mplab commands
	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.listCommands', async () => {
			const commands = await vscode.commands.getCommands(true);
			const mplabCommands = commands.filter(cmd => 
				cmd.toLowerCase().includes('microchip') || 
				cmd.toLowerCase().includes('mplab')
			);
			
			if (mplabCommands.length === 0) {
				vscode.window.showWarningMessage('No MPLAB/Microchip commands found. Is the MPLAB extension installed?');
				return;
			}

			const selected = await vscode.window.showQuickPick(mplabCommands, {
				placeHolder: 'Available MPLAB commands (select to copy)',
				title: 'MPLAB Commands'
			});

			if (selected) {
				await vscode.env.clipboard.writeText(selected);
				vscode.window.showInformationMessage(`Copied: ${selected}`);
			}
		})
	);
}

async function executeWithCheck(commandId: string) {
	try {
		const commands = await vscode.commands.getCommands(true);
		if (!commands.includes(commandId)) {
			vscode.window.showErrorMessage(
				`Command "${commandId}" not found. Make sure the MPLAB extension is installed and a project is open.`
			);
			return;
		}
		await vscode.commands.executeCommand(commandId);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to execute "${commandId}": ${errorMessage}`);
	}
}

async function exportHexFile() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder open.');
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri;
	const rawProjectName = workspaceFolders[0].name;
	
	// Clean up project name: remove .X, remove hyphens, capitalize each word
	const projectName = rawProjectName
		.replace(/\.X$/i, '')  // Remove .X suffix
		.split('-')            // Split by hyphens
		.map(word => {
			// If word is 2 chars or less, treat as abbreviation and uppercase all
			if (word.length <= 2) {
				return word.toUpperCase();
			}
			// Otherwise capitalize first letter
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');            // Join with spaces
	
	const outFolder = vscode.Uri.joinPath(workspaceRoot, 'out');

	try {
		// Read version info from AlarmSettings.h
		let versionString = '';
		try {
			const alarmSettingsFiles = await vscode.workspace.findFiles('**/AlarmSettings.h', null, 1);
			if (alarmSettingsFiles.length > 0) {
				const fileContent = await vscode.workspace.fs.readFile(alarmSettingsFiles[0]);
				const content = Buffer.from(fileContent).toString('utf8');
				
				// Parse FIRMWARE_VERSION_LSB
				const versionMatch = content.match(/#define\s+FIRMWARE_VERSION_LSB\s+(\d+)/);
				const firmwareVersion = versionMatch ? versionMatch[1] : '';
				
				// Parse BETA_VERSION
				const betaMatch = content.match(/#define\s+BETA_VERSION\s+'([^']+)'/);
				const betaVersion = betaMatch ? betaMatch[1] : '';
				
				if (firmwareVersion) {
					versionString = ` V${firmwareVersion}${betaVersion}`;
				}
			}
		} catch {
			// If we can't read version info, continue without it
		}

		// Read the out folder to find project folders
		const outContents = await vscode.workspace.fs.readDirectory(outFolder);
		const projectFolders = outContents.filter(([_, type]) => type === vscode.FileType.Directory);

		if (projectFolders.length === 0) {
			vscode.window.showErrorMessage('No project folders found in out/ directory.');
			return;
		}

		// Search for .hex files in project folders
		let hexFiles: { uri: vscode.Uri; name: string }[] = [];
		
		for (const [folderName] of projectFolders) {
			const projectFolder = vscode.Uri.joinPath(outFolder, folderName);
			const folderContents = await vscode.workspace.fs.readDirectory(projectFolder);
			
			for (const [fileName, fileType] of folderContents) {
				if (fileType === vscode.FileType.File && fileName.endsWith('.hex')) {
					hexFiles.push({
						uri: vscode.Uri.joinPath(projectFolder, fileName),
						name: fileName
					});
				}
			}
		}

		if (hexFiles.length === 0) {
			vscode.window.showErrorMessage('No .hex files found in out/ project folders.');
			return;
		}

		// If multiple hex files, let user choose
		let selectedHex = hexFiles[0];
		if (hexFiles.length > 1) {
			const picked = await vscode.window.showQuickPick(
				hexFiles.map(h => ({ label: h.name, uri: h.uri })),
				{ placeHolder: 'Select hex file to export' }
			);
			if (!picked) {
				return;
			}
			selectedHex = { uri: picked.uri, name: picked.label };
		}

		// Create suggested filename: {project name} V{firmware version}{beta version}.hex
		const suggestedName = `${projectName}${versionString}.hex`;

		// Show save dialog
		const saveUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(suggestedName),
			filters: { 'Hex Files': ['hex'], 'All Files': ['*'] },
			title: 'Export Hex File'
		});

		if (!saveUri) {
			return;
		}

		// Copy the file
		await vscode.workspace.fs.copy(selectedHex.uri, saveUri, { overwrite: true });
		vscode.window.showInformationMessage(`Hex file exported to: ${saveUri.fsPath}`);

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to export hex file: ${errorMessage}`);
	}
}

export function deactivate() {}
