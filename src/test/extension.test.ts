import * as assert from 'assert';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import * as vscode from 'vscode';
import type { GenerationPreview } from '@syntax-syllogism/apx-core' with { 'resolution-mode': 'import' };
import { findProjectRoots } from '../extension';
import { loadApxCore, type ApxCore } from '../core/load';
import type { OrgService } from '../core/orgService';
import { gatherInputs, type GatheredInputs, type InputApi } from '../input/gatherInputs';
import { NO_ORG } from '../input/orgPicker';
import { commandTable } from '../registry/commandTable';
import { buildCommands } from '../registry/commands';
import type { CommandDef } from '../registry/types';
import { createCommandRunner, type RunnerDeps } from '../runner/commandRunner';
import { newTrailingLines, overwriteDetail } from '../runner/render';
import { LastValueStore } from '../util/memento';
import { MemoryMemento, MemoryOutputChannel } from './helpers';

const repositoryRoot = resolve(__dirname, '..', '..');

suite('Apx registry', () => {
	test('registry builds one command per apx-core descriptor with mapped ids', async () => {
		const core = await loadApxCore();
		const commands = buildCommands(core);
		assert.deepStrictEqual(commands.map((command) => command.coreId), core.commandDescriptors.map((descriptor) => descriptor.id));
		assert.deepStrictEqual(commands.map((command) => command.id), [
			'apx.generate',
			'apx.generate.selector',
			'apx.generate.domain',
			'apx.generate.service',
			'apx.generate.unitofwork',
			'apx.generate.selector.method',
			'apx.generate.selector.field-injection',
			'apx.generate.action',
			'apx.generate.criteria',
			'apx.dead',
		]);
		const knownKinds = new Set(['org', 'file', 'folder', 'multiString', 'string', 'boolean', 'enum']);
		for (const command of commands) {
			for (const input of command.inputs) {
				assert.ok(knownKinds.has(input.kind), `${command.id}:${input.key} has unknown kind ${input.kind}`);
			}
		}
		assert.deepStrictEqual(commands.filter((command) => command.kind === 'read').map((command) => command.id), ['apx.dead']);
		assert.strictEqual(commandById(commands, 'apx.dead').group, 'Analyze');
		assert.strictEqual(commandById(commands, 'apx.dead').inputs.find((input) => input.key === 'deadOnly')?.dependsOn, 'destructiveManifest');
		assert.deepStrictEqual(commandById(commands, 'apx.generate.selector').inputs.find((input) => input.key === 'flavor')?.options, ['fflib', 'at4dx']);
		assert.strictEqual(commandById(commands, 'apx.generate.selector').inputs.find((input) => input.key === 'outputPath')?.default, core.DEFAULT_OUTPUT_PATH);
	});

	test('org input follows requiresOrg', async () => {
		const commands = buildCommands(await loadApxCore());
		const org = (id: string) => commandById(commands, id).inputs.find((input) => input.kind === 'org');
		assert.strictEqual(org('apx.generate.selector')?.required, true);
		assert.strictEqual(org('apx.dead')?.required, true);
		assert.strictEqual(org('apx.generate.service')?.required, false);
		assert.strictEqual(org('apx.generate.action'), undefined);
		assert.strictEqual(org('apx.generate.selector.field-injection'), undefined);
	});

	test('package.json contributes stay in sync with apx-core descriptors', async () => {
		const core = await loadApxCore();
		const pkg = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as { contributes: { commands: unknown } };
		assert.deepStrictEqual(pkg.contributes.commands, core.commandDescriptors.map((descriptor) => ({
			command: commandTable[descriptor.id].id,
			title: commandTable[descriptor.id].title,
		})));
	});

	test('extension source never spawns processes', () => {
		const offenders = sourceFiles(join(repositoryRoot, 'src'))
			.filter((file) => !file.includes(`${join('src', 'test')}`))
			.filter((file) => /child_process|cross-spawn/.test(readFileSync(file, 'utf8')));
		assert.deepStrictEqual(offenders, []);
	});

	test('extension host runs Node 22 or later', () => {
		assert.ok(Number(process.versions.node.split('.')[0]) >= 22, process.versions.node);
	});

	test('findProjectRoots keeps only folders with sfdx-project.json', async () => {
		const project = mkdtempSync(join(tmpdir(), 'apx-project-'));
		const plain = mkdtempSync(join(tmpdir(), 'apx-plain-'));
		writeFileSync(join(project, 'sfdx-project.json'), '{}');
		assert.deepStrictEqual(await findProjectRoots([plain, project]), [project]);
	});
});

suite('Apx gatherInputs', () => {
	test('aborts when a required org is cancelled', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.generate.selector');
		const api = fakeInputApi({ pickOrg: async () => undefined });
		assert.strictEqual(await gatherInputs(command, newStore(), api), undefined);
	});

	test('optional org offers "(none)" and omits the org when chosen', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.generate.service');
		const optionalFlags: boolean[] = [];
		const api = fakeInputApi({
			pickOrg: async (_last, optional) => { optionalFlags.push(optional); return NO_ORG; },
			answers: { 'Service basename': 'Billing' },
		});
		const inputs = await gatherInputs(command, newStore(), api);
		assert.deepStrictEqual(optionalFlags, [true]);
		assert.ok(inputs);
		assert.strictEqual(inputs.org, undefined);
		assert.strictEqual(inputs.options.serviceBasename, 'Billing');
	});

	test('commands without an org never ask for one', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.generate.selector.field-injection');
		let asked = false;
		const api = fakeInputApi({ pickOrg: async () => { asked = true; return 'org'; }, answers: { 'SObject API name': 'Account', 'Fields': 'Name' } });
		const inputs = await gatherInputs(command, newStore(), api);
		assert.ok(inputs);
		assert.strictEqual(asked, false);
		assert.strictEqual(inputs.org, undefined);
	});

	test('a schema failure warns and re-prompts the offending field', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.generate.selector.field-injection');
		const fieldAnswers = [' , ', 'Name, Id'];
		const warnings: string[] = [];
		const api = fakeInputApi({
			answers: { 'SObject API name': 'Account', 'Fields': () => fieldAnswers.shift() },
			showWarningMessage: async (message) => { warnings.push(message); return undefined; },
		});
		const inputs = await gatherInputs(command, newStore(), api);
		assert.ok(inputs);
		assert.deepStrictEqual(inputs.options.fields, ['Name', 'Id']);
		assert.strictEqual(warnings.length, 1);
		assert.ok(warnings[0].startsWith('Fields: '), warnings[0]);
	});

	test('dead code booleans are explicit and the dependent option is asked only when enabled', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.dead');
		const pickRounds: string[][] = [];
		const api = fakeInputApi({
			pickOrg: async () => 'dev',
			showBooleanPick: async (items) => {
				pickRounds.push(items.map((item) => item.input.key));
				return items.filter((item) => item.input.key === 'classes' || item.input.key === 'destructiveManifest');
			},
		});
		const store = newStore();
		const inputs = await gatherInputs(command, store, api);
		assert.ok(inputs);
		assert.deepStrictEqual(pickRounds, [['classes', 'destructiveManifest', 'includeSuppressed'], ['deadOnly']]);
		assert.strictEqual(inputs.org, 'dev');
		assert.strictEqual(inputs.options.classes, true);
		assert.strictEqual(inputs.options.destructiveManifest, true);
		assert.strictEqual(inputs.options.includeSuppressed, false);
		assert.strictEqual(inputs.options.deadOnly, false);
		assert.strictEqual(store.get('dead', 'classes'), 'true');
	});

	test('last values are stored per descriptor id and option key', async () => {
		const command = commandById(buildCommands(await loadApxCore()), 'apx.generate.selector');
		const memento = new MemoryMemento();
		const api = fakeInputApi({ pickOrg: async () => 'dev', answers: { 'SObject API name': 'Account' } });
		assert.ok(await gatherInputs(command, new LastValueStore(memento), api));
		assert.strictEqual(memento.get('apx.last.generate-selector.org'), 'dev');
		assert.strictEqual(memento.get('apx.last.generate-selector.sobject'), 'Account');
	});
});

suite('Apx command runner', () => {
	test('previews new files and applies the same preview after Apply', async () => {
		const real = await loadApxCore();
		const preview = previewOf(['new']);
		const harness = generationHarness(real, preview, { info: 'Apply' });
		await harness.run();
		assert.strictEqual(harness.applied.length, 1);
		assert.strictEqual(harness.applied[0].preview, preview);
		assert.strictEqual(harness.applied[0].overwrite, 'overwrite');
		assert.ok(harness.calls.info.some((args) => args[0] === 'Write the files SF Apx: Generate Selector planned?'));
		assert.ok(harness.output.value.includes('NEW  classes/AccountsSelector0.cls'), harness.output.value);
		assert.ok(harness.output.value.includes('APPLIED'));
		assert.deepStrictEqual(harness.calls.error, []);
	});

	test('existing files offer Overwrite all / Skip existing and pass the matching mode', async () => {
		const real = await loadApxCore();
		for (const [choice, overwrite] of [['Overwrite all', 'overwrite'], ['Skip existing', 'skip']] as const) {
			const harness = generationHarness(real, previewOf(['new', 'exists']), { warning: choice });
			await harness.run();
			assert.deepStrictEqual(harness.applied.map((call) => call.overwrite), [overwrite]);
			const modal = harness.calls.warning[0];
			assert.deepStrictEqual(modal.slice(2), ['Overwrite all', 'Skip existing']);
			assert.strictEqual((modal[1] as vscode.MessageOptions).modal, true);
			assert.ok((modal[1] as vscode.MessageOptions).detail?.startsWith('1 new, 1 existing files in'));
		}
	});

	test('cancelling the overwrite prompt writes nothing', async () => {
		const harness = generationHarness(await loadApxCore(), previewOf(['exists']), { warning: undefined });
		await harness.run();
		assert.deepStrictEqual(harness.applied, []);
		assert.ok(harness.calls.info.some((args) => args[0] === 'No files written.'));
	});

	test('a plan with only manual steps shows no modal', async () => {
		const preview: GenerationPreview = { ...previewOf([]), manualSteps: ['Add the binding by hand.'] };
		const harness = generationHarness(await loadApxCore(), preview, { info: 'Apply' });
		await harness.run();
		assert.deepStrictEqual(harness.applied, []);
		assert.deepStrictEqual(harness.calls.warning, []);
		assert.ok(harness.calls.info.every((args) => args.length === 1));
		assert.ok(harness.calls.info.some((args) => String(args[0]).includes('manual steps')));
	});

	test('cancellation during apply is reported as a stop, not an error', async () => {
		const real = await loadApxCore();
		const harness = generationHarness(real, previewOf(['new']), { info: 'Apply' }, async () => { throw new real.ApxError('cancelled', 'Cancelled'); });
		await harness.run();
		assert.deepStrictEqual(harness.calls.error, []);
		assert.deepStrictEqual(harness.calls.status, ['$(circle-slash) SF Apx: Generate Selector cancelled']);
	});

	test('failures surface describeError title and detail', async () => {
		const harness = generationHarness(await loadApxCore(), previewOf(['new']), { info: 'Apply' }, async () => { throw new Error('disk full'); });
		await harness.run();
		assert.strictEqual(harness.calls.error[0][0], 'disk full');
		assert.ok(harness.output.value.includes('Error: disk full'));
	});

	test('an expired session is invalidated and retried once', async () => {
		const real = await loadApxCore();
		let attempts = 0;
		const harness = generationHarness(real, previewOf(['new']), { info: 'Apply' }, undefined, async () => {
			attempts++;
			if (attempts === 1) { throw Object.assign(new Error('expired'), { name: 'RefreshTokenAuthError' }); }
		});
		await harness.run();
		assert.strictEqual(attempts, 2);
		assert.deepStrictEqual(harness.orgCalls, ['connect:dev', 'invalidate:dev', 'connect:dev']);
		assert.strictEqual(harness.applied.length, 1);
	});

	test('dead code writes its report and only writes the manifest after Write', async () => {
		const real = await loadApxCore();
		for (const answer of ['Write', undefined]) {
			const harness = deadHarness(real, answer);
			await harness.run();
			assert.ok(harness.output.value.includes('DEAD REPORT'), harness.output.value);
			assert.strictEqual(harness.calls.warning[0][0], `Write destructive manifest to ${join('/project/generated-files', 'dead-code')}?`);
			assert.deepStrictEqual(harness.written, answer === 'Write' ? ['/project/generated-files'] : []);
			assert.strictEqual(harness.output.value.includes('sf project deploy start'), answer === 'Write');
			assert.deepStrictEqual(harness.calls.error, []);
		}
	});

	test('overwriteDetail lists existing files with unsaved editor changes', () => {
		const preview = previewOf(['exists', 'exists', 'new']);
		const detail = overwriteDetail(preview, [preview.files[1].absolutePath, '/elsewhere.cls']);
		assert.ok(detail.startsWith('1 new, 2 existing files in /project/force-app'));
		assert.ok(detail.endsWith('would be overwritten:\nclasses/AccountsSelector1.cls'), detail);
		assert.strictEqual(overwriteDetail(preview, []), '1 new, 2 existing files in /project/force-app');
	});

	test('newTrailingLines returns only what the second report adds', () => {
		assert.deepStrictEqual(newTrailingLines('a\nb', 'a\nb\nc\nd'), ['c', 'd']);
	});
});

interface FakeInputOptions extends Partial<InputApi> {
	/** Input box answers keyed by input label. */
	answers?: Record<string, string | (() => string | undefined)>;
}

function fakeInputApi(options: FakeInputOptions = {}): InputApi {
	const { answers = {}, ...overrides } = options;
	return {
		pickOrg: async () => 'dev',
		pickFile: async () => undefined,
		pickOutputDirectory: async (picker) => picker.defaultValue,
		showInputBox: async (box) => {
			const key = Object.keys(answers).find((label) => box.prompt === label || box.prompt === `${label} (comma-separated)`);
			const answer = key === undefined ? undefined : answers[key];
			return typeof answer === 'function' ? answer() : answer;
		},
		showQuickPick: async (items) => items[0],
		showBooleanPick: async () => [],
		showWarningMessage: async () => undefined,
		...overrides,
	};
}

function newStore(): LastValueStore {
	return new LastValueStore(new MemoryMemento());
}

function commandById(commands: readonly CommandDef[], id: string): CommandDef {
	const command = commands.find((candidate) => candidate.id === id);
	assert.ok(command, `missing command ${id}`);
	return command;
}

function previewOf(statuses: readonly ('new' | 'exists')[]): GenerationPreview {
	return {
		commandId: 'generate-selector',
		baseDir: '/project/force-app',
		files: statuses.map((status, index) => ({
			status,
			relativePath: `classes/AccountsSelector${index}.cls`,
			absolutePath: `/project/force-app/classes/AccountsSelector${index}.cls`,
			content: '',
			artifactId: 'selectorClass',
		})),
	};
}

interface Answers {
	info?: string;
	warning?: string;
}

function uiHarness(core: ApxCore, answers: Answers) {
	const calls = { info: [] as unknown[][], warning: [] as unknown[][], error: [] as unknown[][], status: [] as string[] };
	const orgCalls: string[] = [];
	const output = new MemoryOutputChannel();
	const isModal = (args: unknown[]): boolean => (args[1] as vscode.MessageOptions | undefined)?.modal === true;
	const orgs: OrgService = {
		listOrgs: async () => [{ label: 'dev', value: 'dev' }],
		connect: async (org) => { orgCalls.push(`connect:${org}`); return {} as never; },
		resolveUsername: async () => 'dev@example.com',
		invalidate: async (org) => { orgCalls.push(`invalidate:${org}`); },
	};
	const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => undefined }) };
	const deps: RunnerDeps = {
		core: async () => core,
		orgs,
		output,
		withProgress: (async (_options: unknown, task: (progress: unknown, token: unknown) => unknown) => task({ report: () => undefined }, token)) as unknown as RunnerDeps['withProgress'],
		showInformationMessage: (async (...args: unknown[]) => { calls.info.push(args); return isModal(args) ? answers.info : undefined; }) as unknown as RunnerDeps['showInformationMessage'],
		showWarningMessage: (async (...args: unknown[]) => { calls.warning.push(args); return isModal(args) ? answers.warning : undefined; }) as unknown as RunnerDeps['showWarningMessage'],
		showErrorMessage: (async (...args: unknown[]) => { calls.error.push(args); return undefined; }) as unknown as RunnerDeps['showErrorMessage'],
		setStatusBarMessage: (text) => calls.status.push(text),
		executeCommand: (async () => undefined) as unknown as RunnerDeps['executeCommand'],
		dirtyDocuments: () => [],
	};
	return { calls, orgCalls, output, runner: createCommandRunner(deps) };
}

function generationHarness(real: ApxCore, preview: GenerationPreview, answers: Answers, onApply?: () => Promise<void>, onPlan?: () => Promise<void>) {
	const applied: { preview: GenerationPreview; overwrite: string }[] = [];
	const core = {
		...real,
		renderGenerationResult: () => ['APPLIED'],
		useCases: {
			...real.useCases,
			'generate-selector': {
				...real.useCases['generate-selector'],
				plan: async () => { await onPlan?.(); return preview; },
				apply: async (_conn: unknown, plan: GenerationPreview, ctx: { overwrite: string }) => {
					await onApply?.();
					applied.push({ preview: plan, overwrite: ctx.overwrite });
					return {};
				},
			},
		},
	} as unknown as ApxCore;
	const ui = uiHarness(core, answers);
	const command = commandById(buildCommands(real), 'apx.generate.selector');
	const inputs: GatheredInputs = { org: 'dev', options: { outputPath: 'force-app', sobject: 'Account', flavor: 'fflib' }, display: [] };
	return { ...ui, applied, run: () => ui.runner.run(command, inputs, '/project') };
}

function deadHarness(real: ApxCore, answer: string | undefined) {
	const written: string[] = [];
	const core = {
		...real,
		renderDeadCodeReport: (_result: unknown, options: { manifestDir?: string }) => options.manifestDir
			? `DEAD REPORT\nManifest written to ${options.manifestDir}\nsf project deploy start`
			: 'DEAD REPORT',
		resolveOutputBase: async () => '/project/generated-files',
		writeDeadCodeManifest: async (_result: unknown, outputBase: string) => {
			written.push(outputBase);
			return { manifestDir: join(outputBase, 'dead-code'), manifestFiles: ['package.xml'] };
		},
		useCases: {
			...real.useCases,
			dead: { ...real.useCases.dead, run: async () => ({ dead: [], manifest: { members: [] } }) },
		},
	} as unknown as ApxCore;
	const ui = uiHarness(core, { warning: answer });
	const command = commandById(buildCommands(real), 'apx.dead');
	const inputs: GatheredInputs = {
		org: 'dev',
		options: { outputPath: 'generated-files', classes: true, destructiveManifest: true, deadOnly: false, includeSuppressed: false },
		display: [],
	};
	return { ...ui, written, run: () => ui.runner.run(command, inputs, '/project') };
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const file = join(directory, name);
		return statSync(file).isDirectory() ? sourceFiles(file) : file.endsWith('.ts') ? [file] : [];
	});
}
