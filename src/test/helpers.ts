import * as vscode from 'vscode';

export async function withWorkspaceFolders(roots: readonly string[], task: () => Promise<void>): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
	Object.defineProperty(vscode.workspace, 'workspaceFolders', {
		configurable: true,
		value: roots.map((root, index) => ({ uri: vscode.Uri.file(root), name: root, index })),
	});
	try {
		await task();
	} finally {
		if (descriptor) {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', descriptor);
		} else {
			delete (vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders;
		}
	}
}

export async function withOpenDialog(result: readonly vscode.Uri[] | undefined, task: () => Promise<void>): Promise<void> {
	const original = vscode.window.showOpenDialog;
	vscode.window.showOpenDialog = async () => result as vscode.Uri[] | undefined;
	try {
		await task();
	} finally {
		vscode.window.showOpenDialog = original;
	}
}

export async function withQuickPick(
	handler: (items: readonly vscode.QuickPickItem[]) => vscode.QuickPickItem | undefined,
	task: () => Promise<void>,
): Promise<void> {
	const original = vscode.window.showQuickPick;
	(vscode.window as unknown as { showQuickPick: unknown }).showQuickPick = async (items: readonly vscode.QuickPickItem[]) => handler(items);
	try {
		await task();
	} finally {
		vscode.window.showQuickPick = original;
	}
}

export async function withWarningMessage(handler: (message: string) => Thenable<string | undefined>, task: () => Promise<void>): Promise<void> {
	const original = vscode.window.showWarningMessage;
	vscode.window.showWarningMessage = handler as typeof vscode.window.showWarningMessage;
	try {
		await task();
	} finally {
		vscode.window.showWarningMessage = original;
	}
}

export class MemoryMemento implements vscode.Memento {
	private readonly values = new Map<string, unknown>();

	public get<T>(key: string): T | undefined;
	public get<T>(key: string, defaultValue: T): T;
	public get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}

	public keys(): readonly string[] {
		return [...this.values.keys()];
	}

	public update(key: string, value: unknown): Thenable<void> {
		this.values.set(key, value);
		return Promise.resolve();
	}
}

export class MemoryOutputChannel implements vscode.OutputChannel {
	public value = '';
	public readonly name = 'Apx';

	public append(value: string): void {
		this.value += value;
	}

	public appendLine(value: string): void {
		this.value += `${value}\n`;
	}

	public clear(): void {}
	public show(): void {}
	public hide(): void {}
	public dispose(): void {}
	public replace(value: string): void {
		this.value = value;
	}
}
