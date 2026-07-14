import * as vscode from 'vscode';
import { execSf } from './sfProcess';

export interface SfDetector {
	ensureReady(): Promise<boolean>;
}

export function createSfDetector(): SfDetector {
	let checked = false;

	return {
		async ensureReady(): Promise<boolean> {
			if (checked) {
				return true;
			}

			try {
				await execSf(['--version']);
				await execSf(['apx', '--help']);
				checked = true;
				return true;
			} catch (error) {
				const install = await vscode.window.showErrorMessage(
					`The Salesforce CLI with the apx plugin is required. ${error instanceof Error ? error.message : ''}`,
					'Install apx plugin',
				);
				if (install === 'Install apx plugin') {
					const terminal = vscode.window.createTerminal('Apx setup');
					terminal.show();
					terminal.sendText('sf plugins install @syntax-syllogism/apx');
				}

				return false;
			}
		},
	};
}
