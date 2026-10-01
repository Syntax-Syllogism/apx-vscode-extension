import * as vscode from 'vscode';
import type { OrgService } from '../core/orgService';
import type { CommandDef, InputDef } from '../registry/types';
import { LastValueStore } from '../util/memento';
import { pickFile } from './filePicker';
import { NO_ORG, pickOrg } from './orgPicker';
import { pickOutputDirectory, type PickOutputDirectoryOptions } from './outputDirPicker';

export interface GatheredInputs {
	/** Alias or username; undefined when the command needs no org or "(none)" was chosen. */
	org?: string;
	options: Record<string, unknown>;
	display: string[];
}

export interface InputApi {
	/** Resolves to an org value, {@link NO_ORG} for "(none)", or undefined on cancel. */
	pickOrg(lastValue: string | undefined, optional: boolean): Promise<string | undefined>;
	pickFile(label: string, defaultDirectory?: string): Promise<string | undefined>;
	pickOutputDirectory(options: PickOutputDirectoryOptions): Promise<string | undefined>;
	showInputBox(options: vscode.InputBoxOptions): Thenable<string | undefined>;
	showQuickPick<T extends vscode.QuickPickItem>(items: readonly T[], options?: vscode.QuickPickOptions): Thenable<T | undefined>;
	showBooleanPick(items: readonly BooleanPick[], placeHolder: string): Thenable<readonly BooleanPick[] | undefined>;
	showWarningMessage(message: string): Thenable<unknown>;
}

export interface BooleanPick extends vscode.QuickPickItem {
	input: InputDef;
}

/** Validation re-prompts per command run before giving up, so a bad schema cannot loop forever. */
const MAX_VALIDATION_ATTEMPTS = 5;

export function createVsCodeInputApi(orgs: OrgService): InputApi {
	return {
		pickOrg: (lastValue, optional) => pickOrg(orgs, lastValue, optional),
		pickFile,
		pickOutputDirectory,
		showInputBox: (options) => vscode.window.showInputBox(options),
		showQuickPick: (items, options) => vscode.window.showQuickPick(items, options),
		showBooleanPick: (items, placeHolder) => vscode.window.showQuickPick(items, { canPickMany: true, placeHolder }),
		showWarningMessage: (message) => vscode.window.showWarningMessage(message),
	};
}

export async function gatherInputs(command: CommandDef, store: LastValueStore, api: InputApi, projectRoot?: string): Promise<GatheredInputs | undefined> {
	const gathered: GatheredInputs = { options: {}, display: [] };
	const groups = new Set<string>();
	for (const input of command.inputs) {
		if (input.kind === 'boolean' || input.dependsOn) { continue; }
		if (input.exclusiveGroup) {
			if (groups.has(input.exclusiveGroup)) { continue; }
			groups.add(input.exclusiveGroup);
			const choices = command.inputs.filter((candidate) => candidate.exclusiveGroup === input.exclusiveGroup);
			const selected = await api.showQuickPick(choices.map((candidate) => ({ label: candidate.label, input: candidate })), { placeHolder: `Choose ${input.exclusiveGroup}` });
			if (!selected || !await gatherOne(command, selected.input, gathered, store, api, projectRoot, true)) { return undefined; }
		} else if (!await gatherOne(command, input, gathered, store, api, projectRoot, Boolean(input.required))) {
			return undefined;
		}
	}
	if (!await gatherBooleans(command, command.inputs.filter((input) => input.kind === 'boolean' && !input.dependsOn), gathered, store, api)) { return undefined; }
	return validate(command, gathered, store, api, projectRoot);
}

/**
 * Runs the descriptor's zod schema over the gathered options. On failure the first
 * issue is shown and the offending field is asked for again.
 */
async function validate(command: CommandDef, gathered: GatheredInputs, store: LastValueStore, api: InputApi, projectRoot?: string): Promise<GatheredInputs | undefined> {
	for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
		const parsed = command.optionsSchema.safeParse(gathered.options);
		if (parsed.success) { return gathered; }
		const issue = parsed.error.issues[0];
		const key = issue?.path[0];
		const input = command.inputs.find((candidate) => candidate.key === key && candidate.kind !== 'boolean' && candidate.kind !== 'org');
		await api.showWarningMessage(input ? `${input.label}: ${issue.message}` : issue?.message ?? 'Invalid options');
		if (!input) { return undefined; }
		delete gathered.options[input.key];
		gathered.display = gathered.display.filter((line) => !line.startsWith(`${input.label}: `));
		if (!await gatherOne(command, input, gathered, store, api, projectRoot, true)) { return undefined; }
	}
	return undefined;
}

async function gatherBooleans(command: CommandDef, inputs: readonly InputDef[], gathered: GatheredInputs, store: LastValueStore, api: InputApi): Promise<boolean> {
	if (!inputs.length) { return true; }
	const items = inputs.map((input) => ({
		label: input.label,
		description: input.summary === input.label ? undefined : input.summary,
		picked: (store.get(command.coreId, input.key) ?? String(input.default ?? false)) === 'true',
		input,
	}));
	const picked = await api.showBooleanPick(items, 'Select options to enable');
	if (!picked) { return false; }
	const enabled = new Set(picked.map((item) => item.input.key));
	for (const input of inputs) {
		const value = enabled.has(input.key);
		gathered.options[input.key] = value;
		await store.set(command.coreId, input.key, String(value));
		if (value) { gathered.display.push(`${input.label}: yes`); }
	}
	for (const key of enabled) {
		const dependents = command.inputs.filter((candidate) => candidate.dependsOn === key);
		const booleans = dependents.filter((candidate) => candidate.kind === 'boolean');
		if (!await gatherBooleans(command, booleans, gathered, store, api)) { return false; }
		for (const dependent of dependents.filter((candidate) => candidate.kind !== 'boolean')) {
			if (!await gatherOne(command, dependent, gathered, store, api, undefined, Boolean(dependent.required))) { return false; }
		}
	}
	return true;
}

/** Returns false only when gathering should stop (a required value was cancelled). */
async function gatherOne(command: CommandDef, input: InputDef, gathered: GatheredInputs, store: LastValueStore, api: InputApi, projectRoot: string | undefined, required: boolean): Promise<boolean> {
	const lastValue = store.get(command.coreId, input.key);
	let value: string | undefined;
	switch (input.kind) {
		case 'org': {
			const preferred = lastValue ?? (vscode.workspace.getConfiguration('apx').get<string>('defaultTargetOrg') || undefined);
			const org = await api.pickOrg(preferred, !required);
			if (org === undefined) { return false; }
			if (org === NO_ORG) {
				gathered.display.push(`${input.label}: (none)`);
				return true;
			}
			await store.set(command.coreId, input.key, org);
			gathered.org = org;
			gathered.display.push(`${input.label}: ${org}`);
			return true;
		}
		case 'folder':
			value = await api.pickOutputDirectory({
				label: input.summary ?? input.label,
				defaultValue: typeof input.default === 'string' ? input.default : undefined,
				lastValue,
				workspaceRoot: projectRoot,
			});
			break;
		case 'file':
			value = await api.pickFile(input.summary ?? input.label, projectRoot);
			break;
		case 'enum': {
			const preferred = lastValue ?? input.default;
			const choices = [...(input.options ?? [])];
			if (typeof preferred === 'string' && choices.includes(preferred)) {
				choices.splice(choices.indexOf(preferred), 1);
				choices.unshift(preferred);
			}
			const items = choices.map((choice) => ({ label: choice, description: choice === preferred ? 'default' : undefined }));
			value = (await api.showQuickPick(items, { placeHolder: input.summary ?? input.label, ignoreFocusOut: true }))?.label;
			break;
		}
		default:
			value = await api.showInputBox({
				ignoreFocusOut: true,
				prompt: input.kind === 'multiString' ? `${input.summary ?? input.label} (comma-separated)` : input.summary ?? input.label,
				placeHolder: input.placeholder ?? (typeof input.default === 'string' && input.default ? input.default : required ? undefined : 'Optional'),
				value: lastValue,
			});
	}
	if (value === undefined) { return !required; }
	if (!value.trim()) { return !required; }
	await store.set(command.coreId, input.key, value);
	gathered.options[input.key] = input.kind === 'multiString' ? splitList(value) : value;
	gathered.display.push(`${input.label}: ${value}`);
	for (const dependent of command.inputs.filter((candidate) => candidate.dependsOn === input.key && candidate.kind !== 'boolean')) {
		if (!await gatherOne(command, dependent, gathered, store, api, projectRoot, Boolean(dependent.required))) { return false; }
	}
	return true;
}

function splitList(value: string): string[] {
	return value.split(',').map((item) => item.trim()).filter(Boolean);
}
