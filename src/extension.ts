import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';

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
				case 'buildMerge':
					await buildLinkedAndMerge();
					break;
				case 'flashDevice':
					await flashDevice();
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
		<button id="buildMergeBtn">
			<span class="icon">🔗</span>
			Build Linked + Merge
		</button>
		<button id="flashDeviceBtn">
			<span class="icon">⚡</span>
			Flash Device
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

		document.getElementById('buildMergeBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'buildMerge' });
		});

		document.getElementById('flashDeviceBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'flashDevice' });
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

	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.buildMerge', async () => {
			await buildLinkedAndMerge();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.flashDevice', async () => {
			await flashDevice();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mplab-shortcuts.checkForUpdates', async () => {
			await checkForUpdates(context, true);
		})
	);

	// Kick off a background update check shortly after activation so we don't
	// delay startup. The check itself is throttled by checkIntervalHours.
	const updateTimer = setTimeout(() => {
		void checkForUpdates(context, false);
	}, 5000);
	context.subscriptions.push({ dispose: () => clearTimeout(updateTimer) });

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

// ---------------------------------------------------------------------------
// Build linked (loadable) projects, build the main project, merge with hexmate
// ---------------------------------------------------------------------------

interface LinkedProject {
	/** Project folder name without the .X suffix, e.g. "qt6-can-app". */
	projectName: string;
	/** Configuration name to build for the linked project. */
	config: string;
}

let buildMergeOutput: vscode.OutputChannel | undefined;
function getOutputChannel(): vscode.OutputChannel {
	if (!buildMergeOutput) {
		buildMergeOutput = vscode.window.createOutputChannel('MPLAB Shortcuts');
	}
	return buildMergeOutput;
}

/**
 * Resolve the loadable (linked) projects referenced by a configuration's file
 * set in an .mplab.json, following nested { "fileSet": "..." } references. A
 * loadable is a file entry with projectType === "loadable" (it points at the
 * linked project's own .mplab.json).
 */
function getLinkedProjects(mplab: any, configName: string): LinkedProject[] {
	const config = (mplab.configurations || []).find((c: any) => c.name === configName);
	if (!config) {
		return [];
	}

	const fileSets = new Map<string, any>(
		(mplab.fileSets || []).map((f: any) => [f.name, f])
	);

	const result: LinkedProject[] = [];
	const visited = new Set<string>();

	const walk = (fileSetName: string) => {
		if (!fileSetName || visited.has(fileSetName)) {
			return;
		}
		visited.add(fileSetName);

		const set = fileSets.get(fileSetName);
		if (!set) {
			return;
		}

		for (const item of set.files || []) {
			if (typeof item !== 'object' || item === null) {
				continue;
			}
			const include: string | undefined = typeof item.include === 'string' ? item.include : undefined;
			const isLoadable = item.projectType === 'loadable' ||
				(include !== undefined && include.endsWith('.mplab.json'));

			if (isLoadable && include) {
				const base = include.split('/').pop()!.replace(/\.mplab\.json$/i, '');
				result.push({
					projectName: base,
					config: item.dependentConfigurationName || configName
				});
			} else if (typeof item.fileSet === 'string') {
				walk(item.fileSet);
			}
		}
	};

	walk(config.fileSet);
	return result;
}

/** Resolve the cmake executable (setting → PATH → Homebrew fallback). */
function resolveCmake(): string {
	const configured = vscode.workspace.getConfiguration('mplab-shortcuts').get<string>('cmakePath');
	if (configured) {
		return configured;
	}
	if (fs.existsSync('/opt/homebrew/bin/cmake')) {
		return '/opt/homebrew/bin/cmake';
	}
	return 'cmake';
}

/** Resolve the XC8 hexmate executable (setting → newest installed XC8). */
function resolveHexmate(): string | undefined {
	const configured = vscode.workspace.getConfiguration('mplab-shortcuts').get<string>('hexmatePath');
	if (configured) {
		return fs.existsSync(configured) ? configured : undefined;
	}
	// Auto-detect the newest /Applications/microchip/xc8/v*/pic/bin/hexmate
	const xc8Root = '/Applications/microchip/xc8';
	try {
		const versions = fs.readdirSync(xc8Root)
			.filter(v => /^v[0-9.]+$/.test(v))
			.sort()
			.reverse();
		for (const v of versions) {
			const candidate = path.join(xc8Root, v, 'pic', 'bin', 'hexmate');
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
	} catch {
		// fall through
	}
	return undefined;
}

/** Run a command, streaming output to the channel. Resolves true on exit 0. */
function runStreamed(cmd: string, args: string[], cwd: string, out: vscode.OutputChannel): Promise<boolean> {
	return new Promise((resolve) => {
		out.appendLine(`$ ${cmd} ${args.join(' ')}`);
		const child = cp.spawn(cmd, args, { cwd });
		child.stdout.on('data', (d) => out.append(d.toString()));
		child.stderr.on('data', (d) => out.append(d.toString()));
		child.on('error', (err) => {
			out.appendLine(`\n[error] ${err.message}`);
			resolve(false);
		});
		child.on('close', (code) => {
			out.appendLine(`\n[exit ${code}]`);
			resolve(code === 0);
		});
	});
}

async function buildLinkedAndMerge() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder open.');
		return;
	}

	const ws = workspaceFolders[0];
	const wsPath = ws.uri.fsPath;
	const mainProject = ws.name.replace(/\.X$/i, ''); // qt6-can-boot.X -> qt6-can-boot

	// Read the main project's .mplab.json
	const mplabUri = vscode.Uri.joinPath(ws.uri, '.vscode', `${mainProject}.mplab.json`);
	let mplab: any;
	try {
		const buf = await vscode.workspace.fs.readFile(mplabUri);
		mplab = JSON.parse(Buffer.from(buf).toString('utf8'));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Could not read .vscode/${mainProject}.mplab.json: ${msg}`);
		return;
	}

	// Find configurations that have linked (loadable) projects
	const configNames: string[] = (mplab.configurations || []).map((c: any) => c.name);
	const mergeable = configNames.filter((name) => getLinkedProjects(mplab, name).length > 0);

	if (mergeable.length === 0) {
		vscode.window.showWarningMessage(
			`No linked (loadable) projects found in any configuration of ${mainProject}.`
		);
		return;
	}

	let configName: string | undefined = mergeable[0];
	if (mergeable.length > 1) {
		configName = await vscode.window.showQuickPick(mergeable, {
			placeHolder: 'Select the configuration to build and merge'
		});
		if (!configName) {
			return;
		}
	}

	const linked = getLinkedProjects(mplab, configName);

	// Resolve tools
	const cmake = resolveCmake();
	const hexmate = resolveHexmate();
	if (!hexmate) {
		vscode.window.showErrorMessage(
			'hexmate not found. Set "mplab-shortcuts.hexmatePath" to your XC8 hexmate executable.'
		);
		return;
	}

	const out = getOutputChannel();
	out.clear();
	out.show(true);
	out.appendLine(`Build + merge for ${mainProject}:${configName}`);
	out.appendLine(`Linked projects: ${linked.map(l => `${l.projectName}:${l.config}`).join(', ') || '(none)'}`);

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'MPLAB: Build linked + merge', cancellable: false },
		async (progress) => {
			// Build linked projects first, then the main project
			const buildOrder = [
				...linked.map(l => ({ project: l.projectName, config: l.config })),
				{ project: mainProject, config: configName! }
			];

			for (const target of buildOrder) {
				const buildDir = path.join(wsPath, '_build', target.project, target.config);
				if (!fs.existsSync(buildDir)) {
					vscode.window.showErrorMessage(
						`Build directory not found: ${buildDir}. Open/emit ${target.project}:${target.config} in MPLAB first.`
					);
					return;
				}
				progress.report({ message: `Building ${target.project}:${target.config}` });
				out.appendLine(`\n=== Building ${target.project} : ${target.config} ===`);
				const ok = await runStreamed(cmake, ['--build', buildDir, '--parallel'], wsPath, out);
				if (!ok) {
					vscode.window.showErrorMessage(`Build failed: ${target.project}:${target.config} (see "MPLAB Shortcuts" output).`);
					return;
				}
			}

			// Collect hex files (out/<project>/<config>.hex)
			const hexPath = (project: string, config: string) =>
				path.join(wsPath, 'out', project, `${config}.hex`);
			const mainHex = hexPath(mainProject, configName!);
			const linkedHexes = linked.map(l => hexPath(l.projectName, l.config));

			for (const h of [mainHex, ...linkedHexes]) {
				if (!fs.existsSync(h)) {
					vscode.window.showErrorMessage(`Expected hex not found after build: ${h}`);
					return;
				}
			}

			// Merge with hexmate (linked images + bootloader -> unified)
			const unifiedHex = path.join(wsPath, 'out', mainProject, `${configName}-unified.hex`);
			progress.report({ message: 'Merging with hexmate' });
			out.appendLine(`\n=== Merging -> ${unifiedHex} ===`);
			const merged = await runStreamed(hexmate, [...linkedHexes, mainHex, `-o${unifiedHex}`], wsPath, out);
			if (!merged) {
				vscode.window.showErrorMessage('hexmate merge failed (see "MPLAB Shortcuts" output).');
				return;
			}

			out.appendLine(`\nUnified hex created: ${unifiedHex}`);
			vscode.window.showInformationMessage(`Unified hex created: ${unifiedHex}`);
		}
	);
}

// ---------------------------------------------------------------------------
// Flash device: pick a configuration, build it (and any linked loadables),
// then invoke MPLAB's "Program Device" command to flash via the connected tool.
// ---------------------------------------------------------------------------

async function flashDevice() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder open.');
		return;
	}

	const programCommandId = 'mplab-core-da.programDevice';
	const commands = await vscode.commands.getCommands(true);
	if (!commands.includes(programCommandId)) {
		vscode.window.showErrorMessage(
			`Command "${programCommandId}" not found. Make sure the MPLAB extension is installed.`
		);
		return;
	}

	const ws = workspaceFolders[0];
	const wsPath = ws.uri.fsPath;
	const mainProject = ws.name.replace(/\.X$/i, '');

	const mplabUri = vscode.Uri.joinPath(ws.uri, '.vscode', `${mainProject}.mplab.json`);
	let mplab: any;
	try {
		const buf = await vscode.workspace.fs.readFile(mplabUri);
		mplab = JSON.parse(Buffer.from(buf).toString('utf8'));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Could not read .vscode/${mainProject}.mplab.json: ${msg}`);
		return;
	}

	const configNames: string[] = (mplab.configurations || []).map((c: any) => c.name);
	if (configNames.length === 0) {
		vscode.window.showErrorMessage(`No configurations found in ${mainProject}.mplab.json.`);
		return;
	}

	let configName: string | undefined = configNames[0];
	if (configNames.length > 1) {
		configName = await vscode.window.showQuickPick(configNames, {
			placeHolder: 'Select the configuration to build and flash'
		});
		if (!configName) {
			return;
		}
	}

	const linked = getLinkedProjects(mplab, configName);
	const cmake = resolveCmake();

	const out = getOutputChannel();
	out.clear();
	out.show(true);
	out.appendLine(`Flash device for ${mainProject}:${configName}`);
	if (linked.length > 0) {
		out.appendLine(`Linked projects: ${linked.map(l => `${l.projectName}:${l.config}`).join(', ')}`);
	}

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'MPLAB: Flash device', cancellable: false },
		async (progress) => {
			const buildOrder = [
				...linked.map(l => ({ project: l.projectName, config: l.config })),
				{ project: mainProject, config: configName! }
			];

			for (const target of buildOrder) {
				const buildDir = path.join(wsPath, '_build', target.project, target.config);
				if (!fs.existsSync(buildDir)) {
					vscode.window.showErrorMessage(
						`Build directory not found: ${buildDir}. Open/emit ${target.project}:${target.config} in MPLAB first.`
					);
					return;
				}
				progress.report({ message: `Building ${target.project}:${target.config}` });
				out.appendLine(`\n=== Building ${target.project} : ${target.config} ===`);
				const ok = await runStreamed(cmake, ['--build', buildDir, '--parallel'], wsPath, out);
				if (!ok) {
					vscode.window.showErrorMessage(`Build failed: ${target.project}:${target.config} (see "MPLAB Shortcuts" output).`);
					return;
				}
			}

			progress.report({ message: 'Programming device' });
			out.appendLine(`\n=== Programming device via MPLAB ===`);
			try {
				await vscode.commands.executeCommand(programCommandId);
				out.appendLine(`Program Device command dispatched. Watch MPLAB output for tool progress.`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Failed to flash device: ${errorMessage}`);
				out.appendLine(`\n[error] ${errorMessage}`);
			}
		}
	);
}

// ---------------------------------------------------------------------------
// Auto-update from GitHub Releases
// ---------------------------------------------------------------------------

interface ReleaseAsset {
	name: string;
	browser_download_url: string;
}
interface GitHubRelease {
	tag_name: string;
	name?: string;
	body?: string;
	html_url: string;
	prerelease: boolean;
	assets: ReleaseAsset[];
}

const LAST_CHECK_KEY = 'mplab-shortcuts.lastUpdateCheck';
const SKIPPED_VERSION_KEY = 'mplab-shortcuts.skippedVersion';

function parseSemver(s: string): [number, number, number] | null {
	const m = s.replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!m) {
		return null;
	}
	return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function compareSemver(a: string, b: string): number {
	const pa = parseSemver(a);
	const pb = parseSemver(b);
	if (!pa || !pb) {
		return 0;
	}
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) {
			return pa[i] - pb[i];
		}
	}
	return 0;
}

/** GET with up to 5 redirects, returns { statusCode, body } or rejects. */
function httpsGet(url: string, headers: Record<string, string>, redirects = 5): Promise<{ statusCode: number; body: Buffer }> {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers }, (res) => {
			const code = res.statusCode || 0;
			if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirects > 0) {
				res.resume();
				resolve(httpsGet(res.headers.location, headers, redirects - 1));
				return;
			}
			const chunks: Buffer[] = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve({ statusCode: code, body: Buffer.concat(chunks) }));
			res.on('error', reject);
		});
		req.on('error', reject);
	});
}

/** Download URL to a file, following redirects. Resolves true on 2xx. */
function httpsDownload(url: string, dest: string, headers: Record<string, string>, redirects = 5): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers }, (res) => {
			const code = res.statusCode || 0;
			if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirects > 0) {
				res.resume();
				resolve(httpsDownload(res.headers.location, dest, headers, redirects - 1));
				return;
			}
			if (code < 200 || code >= 300) {
				res.resume();
				resolve(false);
				return;
			}
			const file = fs.createWriteStream(dest);
			res.pipe(file);
			file.on('finish', () => file.close(() => resolve(true)));
			file.on('error', (err) => {
				fs.unlink(dest, () => reject(err));
			});
		});
		req.on('error', reject);
	});
}

async function fetchLatestRelease(repository: string): Promise<GitHubRelease | null> {
	const url = `https://api.github.com/repos/${repository}/releases/latest`;
	try {
		const { statusCode, body } = await httpsGet(url, {
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'mplab-shortcuts-updater'
		});
		if (statusCode !== 200) {
			return null;
		}
		return JSON.parse(body.toString('utf8')) as GitHubRelease;
	} catch {
		return null;
	}
}

async function checkForUpdates(context: vscode.ExtensionContext, manual: boolean) {
	const config = vscode.workspace.getConfiguration('mplab-shortcuts');
	if (!manual && !config.get<boolean>('autoUpdate.enabled', true)) {
		return;
	}

	const repository = config.get<string>('autoUpdate.repository', 'tomridl/mplab-shortcuts');
	const intervalHours = config.get<number>('autoUpdate.checkIntervalHours', 24);
	const now = Date.now();
	const last = context.globalState.get<number>(LAST_CHECK_KEY, 0);
	if (!manual && now - last < intervalHours * 60 * 60 * 1000) {
		return;
	}
	await context.globalState.update(LAST_CHECK_KEY, now);

	const release = await fetchLatestRelease(repository);
	if (!release) {
		if (manual) {
			vscode.window.showWarningMessage(`MPLAB Shortcuts: could not reach GitHub to check ${repository}.`);
		}
		return;
	}

	const currentVersion = (context.extension.packageJSON.version as string) || '0.0.0';
	const latestVersion = release.tag_name.replace(/^v/i, '');
	if (compareSemver(latestVersion, currentVersion) <= 0) {
		if (manual) {
			vscode.window.showInformationMessage(`MPLAB Shortcuts is up to date (v${currentVersion}).`);
		}
		return;
	}

	const skipped = context.globalState.get<string>(SKIPPED_VERSION_KEY);
	if (!manual && skipped === latestVersion) {
		return;
	}

	const vsixAsset = release.assets.find(a => a.name.endsWith('.vsix'));
	if (!vsixAsset) {
		if (manual) {
			vscode.window.showWarningMessage(`MPLAB Shortcuts: release v${latestVersion} has no .vsix asset.`);
		}
		return;
	}

	const choice = await vscode.window.showInformationMessage(
		`MPLAB Shortcuts v${latestVersion} is available (you have v${currentVersion}).`,
		'Update', 'Release notes', 'Skip this version', 'Later'
	);

	if (choice === 'Release notes') {
		await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
		return;
	}
	if (choice === 'Skip this version') {
		await context.globalState.update(SKIPPED_VERSION_KEY, latestVersion);
		return;
	}
	if (choice !== 'Update') {
		return;
	}

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Installing MPLAB Shortcuts v${latestVersion}`, cancellable: false },
		async (progress) => {
			progress.report({ message: 'Downloading…' });
			const tmpPath = path.join(os.tmpdir(), `mplab-shortcuts-${latestVersion}.vsix`);
			let downloaded = false;
			try {
				downloaded = await httpsDownload(vsixAsset.browser_download_url, tmpPath, {
					'User-Agent': 'mplab-shortcuts-updater',
					'Accept': 'application/octet-stream'
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`MPLAB Shortcuts: download failed: ${msg}`);
				return;
			}
			if (!downloaded) {
				vscode.window.showErrorMessage('MPLAB Shortcuts: download failed (non-2xx response).');
				return;
			}

			progress.report({ message: 'Installing…' });
			try {
				await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmpPath));
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`MPLAB Shortcuts: install failed: ${msg}`);
				return;
			}

			// Clear any previous skip — the new version is installed.
			await context.globalState.update(SKIPPED_VERSION_KEY, undefined);

			const reload = await vscode.window.showInformationMessage(
				`MPLAB Shortcuts v${latestVersion} installed. Reload window to activate?`,
				'Reload', 'Later'
			);
			if (reload === 'Reload') {
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}
	);
}

export function deactivate() {}
