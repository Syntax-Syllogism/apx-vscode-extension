import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { loadApxCore } from './core/load';
import { createOrgService } from './core/orgService';
import { createVsCodeInputApi, gatherInputs } from './input/gatherInputs';
import { showWorkspaceQuickPick } from './input/workspaceQuickPick';
import { commandTable } from './registry/commandTable';
import { buildCommands } from './registry/commands';
import { createCommandRunner } from './runner/commandRunner';
import { ApxCommandsProvider } from './tree/apxCommandsProvider';
import { LastValueStore } from './util/memento';

export function activate(context: vscode.ExtensionContext): void {
	const output = vscode.window.createOutputChannel('Apx');
	const store = new LastValueStore(context.workspaceState);
	const orgs = createOrgService();
	const provider = new ApxCommandsProvider([]);
	// apx-core and @salesforce/core load lazily: the tree fills in once they resolve,
	// and no command pays for them until it is first run.
	const commandsPromise = loadApxCore().then((core) => {
		const commands = buildCommands(core);
		provider.refresh(commands);
		return commands;
	});
	commandsPromise.catch((error: unknown) => output.appendLine(error instanceof Error ? error.stack ?? error.message : String(error)));
	const runner = createCommandRunner({
		output, orgs, core: loadApxCore,
		withProgress: vscode.window.withProgress,
		showInformationMessage: vscode.window.showInformationMessage,
		showWarningMessage: vscode.window.showWarningMessage,
		showErrorMessage: vscode.window.showErrorMessage,
		dirtyDocuments: () => vscode.workspace.textDocuments.filter((document) => document.isDirty && document.uri.scheme === 'file').map((document) => document.uri.fsPath),
	});

	context.subscriptions.push(output, vscode.window.registerTreeDataProvider('apxCommands', provider));
	for (const [coreId, presentation] of Object.entries(commandTable)) {
		context.subscriptions.push(vscode.commands.registerCommand(presentation.id, async () => {
			try {
				const command = (await commandsPromise).find((candidate) => candidate.coreId === coreId);
				if (!command) { return; }
				const projectRoot = await pickProjectRoot();
				if (!projectRoot) { return; }
				if (command.requiresOrg === 'required' && !(await orgs.listOrgs()).length) {
					const action = await vscode.window.showWarningMessage('No authenticated Salesforce orgs found.', 'Log in to an org');
					if (action === 'Log in to an org') {
						const terminal = vscode.window.createTerminal('Salesforce login');
						terminal.show();
						terminal.sendText('sf org login web');
					}
					return;
				}
				const inputs = await gatherInputs(command, store, createVsCodeInputApi(orgs), projectRoot);
				if (inputs) { await runner.run(command, inputs, projectRoot); }
			} catch (error) {
				output.appendLine(error instanceof Error ? error.stack ?? error.message : String(error));
				vscode.window.showErrorMessage('Unable to run the Apx command. See the Apx output channel.');
			}
		}));
	}
}

export function deactivate(): void {}

/** The workspace folder containing sfdx-project.json; asks when there are several. */
async function pickProjectRoot(): Promise<string | undefined> {
	const roots = await findProjectRoots((vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath));
	if (!roots.length) {
		vscode.window.showErrorMessage('Open a Salesforce DX project (a folder with sfdx-project.json) to use Apx.');
		return undefined;
	}
	if (roots.length === 1) { return roots[0]; }
	return showWorkspaceQuickPick({
		items: roots.map((root) => ({ label: path.basename(root), description: root, value: root })),
		placeHolder: 'Select the Salesforce DX project',
		matchOnDescription: true,
	});
}

export async function findProjectRoots(folders: readonly string[]): Promise<string[]> {
	const found = await Promise.all(folders.map(async (folder) => {
		try {
			await fs.access(path.join(folder, 'sfdx-project.json'));
			return folder;
		} catch {
			return undefined;
		}
	}));
	return found.filter((folder): folder is string => Boolean(folder));
}
