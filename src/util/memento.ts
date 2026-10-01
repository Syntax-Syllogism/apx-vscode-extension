import type * as vscode from 'vscode';

export class LastValueStore {
	public constructor(private readonly memento: vscode.Memento) {}

	public get(descriptorId: string, optionKey: string): string | undefined {
		return this.memento.get<string>(this.key(descriptorId, optionKey));
	}

	public async set(descriptorId: string, optionKey: string, value: string | undefined): Promise<void> {
		if (!value) {
			return;
		}

		await this.memento.update(this.key(descriptorId, optionKey), value);
	}

	private key(descriptorId: string, optionKey: string): string {
		return `apx.last.${descriptorId}.${optionKey}`;
	}
}
