import * as vscode from 'vscode';
import type { CommandDef } from '../registry/types';

type ApxNode = GroupNode | SubgroupNode | CommandNode;

interface GroupNode {
	type: 'group';
	label: string;
	commands: readonly CommandDef[];
}

interface SubgroupNode {
	type: 'subgroup';
	label: string;
	commands: readonly CommandDef[];
}

interface CommandNode {
	type: 'command';
	command: CommandDef;
}

export class ApxCommandsProvider implements vscode.TreeDataProvider<ApxNode> {
	public constructor(private readonly commands: readonly CommandDef[]) {}

	public getTreeItem(element: ApxNode): vscode.TreeItem {
		if (element.type === 'group') {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = 'apxGroup';
			item.iconPath = new vscode.ThemeIcon(element.label === 'AEP Generation' ? 'file-code' : 'person');
			return item;
		}

		if (element.type === 'subgroup') {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = 'apxSubgroup';
			item.iconPath = new vscode.ThemeIcon('symbol-class');
			return item;
		}

		const item = new vscode.TreeItem(trimTitle(element.command.title), vscode.TreeItemCollapsibleState.None);
		item.command = {
			command: element.command.id,
			title: element.command.title,
		};
		item.tooltip = element.command.cliId;
		item.iconPath = new vscode.ThemeIcon(commandIcon(element.command));
		item.contextValue = 'apxCommand';
		return item;
	}

	public getChildren(element?: ApxNode): ApxNode[] {
		if (element?.type === 'group') {
			if (element.commands.some((command) => command.subgroup)) {
				return orderedSubgroups(element.commands);
			}

			return element.commands.map((command) => ({ type: 'command', command }));
		}

		if (element?.type === 'subgroup') {
			return element.commands.map((command) => ({ type: 'command', command }));
		}

		if (element) {
			return [];
		}

		return orderedGroups(this.commands).map(([label, groupCommands]) => ({
			type: 'group',
			label,
			commands: groupCommands,
		}));
	}
}

function trimTitle(title: string): string {
	return title.replace(/^SF Apx:\s*/, '');
}

function orderedGroups(commands: readonly CommandDef[]): [string, CommandDef[]][] {
	return orderedBuckets(commands, (command) => command.group);
}

function orderedSubgroups(commands: readonly CommandDef[]): SubgroupNode[] {
	return orderedBuckets(commands, (command) => command.subgroup ?? '')
		.filter(([label]) => label.length > 0)
		.map(([label, subgroupCommands]) => ({ type: 'subgroup', label, commands: subgroupCommands }));
}

// Bucket order follows the registry order (driven by the allow-list in
// scripts/gen-commands.ts), which is the single source of truth for how groups,
// subgroups, and commands are sequenced. A Map preserves first-insertion order.
function orderedBuckets<T>(items: readonly T[], keyOf: (item: T) => string): [string, T[]][] {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const bucket = buckets.get(key) ?? [];
		bucket.push(item);
		buckets.set(key, bucket);
	}

	return [...buckets.entries()];
}

function commandIcon(command: CommandDef): string {
	if (command.destructive) {
		return 'warning';
	}

	return command.group === 'AEP Generation' ? 'file-code' : 'person';
}
