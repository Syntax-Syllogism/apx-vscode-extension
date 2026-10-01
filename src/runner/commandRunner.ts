import * as path from 'path';
import * as vscode from 'vscode';
import type { Connection } from '@salesforce/core';
import type { DeadUseCaseResult, GenerationOutcome, GenerationPreview, ProgressEvent } from '@syntax-syllogism/apx-core' with { 'resolution-mode': 'import' };
import type { ApxCore } from '../core/load';
import type { OrgService } from '../core/orgService';
import type { GatheredInputs } from '../input/gatherInputs';
import type { CommandDef } from '../registry/types';
import { appendLines, newTrailingLines, overwriteDetail } from './render';

export interface RunnerDeps {
	core: () => Promise<ApxCore>;
	orgs: OrgService;
	output: vscode.OutputChannel;
	withProgress: typeof vscode.window.withProgress;
	showInformationMessage: typeof vscode.window.showInformationMessage;
	showWarningMessage: typeof vscode.window.showWarningMessage;
	showErrorMessage: typeof vscode.window.showErrorMessage;
	setStatusBarMessage?: (text: string, hideAfterTimeout: number) => unknown;
	executeCommand?: typeof vscode.commands.executeCommand;
	/** Absolute paths of open editors with unsaved changes. */
	dirtyDocuments?: () => readonly string[];
}

export interface CommandRunner {
	run(command: CommandDef, inputs: GatheredInputs, projectRoot: string): Promise<void>;
}

type Context = { projectRoot: string; signal: AbortSignal; onProgress: (event: ProgressEvent) => void };
type Schema = { safeParse: (options: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown[] } } };
type ReadCase = { kind: 'read'; descriptor: { optionsSchema: Schema }; run: (conn: Connection | undefined, options: never, ctx: Context) => Promise<unknown> };
type WriteCase = {
	kind: 'write';
	descriptor: { optionsSchema: Schema };
	plan: (conn: Connection | undefined, options: never, ctx: Context) => Promise<GenerationPreview>;
	apply: (conn: Connection | undefined, plan: GenerationPreview, ctx: Context & { overwrite: 'overwrite' | 'skip' }) => Promise<GenerationOutcome>;
};

export function createCommandRunner(deps: RunnerDeps): CommandRunner {
	return {
		async run(command, inputs, projectRoot): Promise<void> {
			const core = await deps.core();
			const useCase = core.useCases[command.coreId as keyof ApxCore['useCases']] as unknown as ReadCase | WriteCase;
			const parsed = useCase.descriptor.optionsSchema.safeParse(inputs.options);
			if (!parsed.success) {
				deps.output.appendLine(`Invalid options: ${JSON.stringify(parsed.error?.issues, null, 2)}`);
				deps.output.show(true);
				deps.showErrorMessage('Invalid options');
				return;
			}
			const options = parsed.data as Record<string, unknown>;
			deps.output.show(true);
			deps.output.appendLine(`\n${command.title}\n${inputs.display.join('\n')}`);
			try {
				let conn = inputs.org ? await deps.orgs.connect(inputs.org) : undefined;
				const execute = async <T>(title: string, action: (connection: Connection | undefined, ctx: Context) => Promise<T>): Promise<T> => {
					const perform = async (): Promise<T> => deps.withProgress(
						{ location: vscode.ProgressLocation.Notification, title, cancellable: true },
						async (progress, token) => {
							const controller = new AbortController();
							const subscription = token.onCancellationRequested(() => {
								controller.abort();
								// Use cases only check the signal between phases and queries.
								progress.report({ message: 'Cancelling after current step…' });
							});
							if (token.isCancellationRequested) { controller.abort(); }
							const onProgress = (event: ProgressEvent): void => {
								if (controller.signal.aborted) { return; }
								const counts = event.total ? ` (${event.done ?? 0}/${event.total})` : '';
								progress.report({ message: `${event.message ?? event.phase}${counts}` });
							};
							try { return await action(conn, { projectRoot, signal: controller.signal, onProgress }); }
							finally { subscription.dispose(); }
						},
					);
					try { return await perform(); }
					catch (error) {
						if (!inputs.org || !isAuthError(error)) { throw error; }
						await deps.orgs.invalidate(inputs.org);
						conn = await deps.orgs.connect(inputs.org);
						return perform();
					}
				};
				if (useCase.kind === 'write') {
					await runGeneration(deps, core, command, useCase, options, execute);
				} else {
					await runRead(deps, core, command, useCase, options, inputs, projectRoot, execute);
				}
			} catch (error) {
				reportError(deps, core, command, error);
			}
		},
	};
}

type Execute = <T>(title: string, action: (connection: Connection | undefined, ctx: Context) => Promise<T>) => Promise<T>;

async function runGeneration(deps: RunnerDeps, core: ApxCore, command: CommandDef, useCase: WriteCase, options: Record<string, unknown>, execute: Execute): Promise<void> {
	const preview = await execute(`Planning ${command.title}`, (connection, ctx) => useCase.plan(connection, options as never, ctx));
	deps.output.appendLine('');
	appendLines(deps.output, core.renderGenerationPlan(preview));
	deps.output.show(true);
	if (!preview.files.length) {
		deps.showInformationMessage(preview.manualSteps?.length
			? `${command.title}: no files to write. Follow the manual steps in the Apx output channel.`
			: `${command.title}: no files to write.`);
		return;
	}
	const existing = preview.files.filter((file) => file.status === 'exists');
	const detail = overwriteDetail(preview, deps.dirtyDocuments?.() ?? []);
	const choice = existing.length
		? await deps.showWarningMessage(`${existing.length} of the files ${command.title} would write already exist.`, { modal: true, detail }, 'Overwrite all', 'Skip existing')
		: await deps.showInformationMessage(`Write the files ${command.title} planned?`, { modal: true, detail }, 'Apply');
	if (choice !== 'Apply' && choice !== 'Overwrite all' && choice !== 'Skip existing') {
		deps.showInformationMessage('No files written.');
		return;
	}
	const overwrite = choice === 'Skip existing' ? 'skip' : 'overwrite';
	// Apply the exact preview the user approved; never re-plan.
	const outcome = await execute(`Applying ${command.title}`, (connection, ctx) => useCase.apply(connection, preview, { ...ctx, overwrite }));
	appendLines(deps.output, core.renderGenerationResult(outcome, { commandId: command.coreId }));
	const reveal = await deps.showInformationMessage(`${command.title} completed.`, 'Reveal in Explorer');
	if (reveal === 'Reveal in Explorer') {
		await (deps.executeCommand ?? vscode.commands.executeCommand)('revealInExplorer', vscode.Uri.file(preview.baseDir));
	}
}

async function runRead(deps: RunnerDeps, core: ApxCore, command: CommandDef, useCase: ReadCase, options: Record<string, unknown>, inputs: GatheredInputs, projectRoot: string, execute: Execute): Promise<void> {
	const result = await execute(`Running ${command.title}`, (connection, ctx) => useCase.run(connection, options as never, ctx)) as DeadUseCaseResult;
	const username = inputs.org ? await deps.orgs.resolveUsername(inputs.org).catch(() => inputs.org) : undefined;
	const reportOptions = { includeSuppressed: options.includeSuppressed === true, deadOnly: options.deadOnly === true, username };
	const report = core.renderDeadCodeReport(result, reportOptions);
	deps.output.appendLine('');
	deps.output.appendLine(report);
	deps.output.show(true);
	if (!options.destructiveManifest || !result.manifest) {
		deps.showInformationMessage(`${command.title} completed.`);
		return;
	}
	const outputBase = await core.resolveOutputBase(String(options.outputPath), projectRoot);
	const choice = await deps.showWarningMessage(`Write destructive manifest to ${path.join(outputBase, 'dead-code')}?`, { modal: true, detail: 'The deploy command to run next is printed in the Apx output channel. Nothing is deployed from VS Code.' }, 'Write');
	if (choice !== 'Write') {
		deps.showInformationMessage('Destructive manifest not written.');
		return;
	}
	const written = await core.writeDeadCodeManifest(result, outputBase);
	const manifestDir = written.manifestDir ?? path.join(outputBase, 'dead-code');
	// Only print what the report adds once a manifest exists (written path + deploy command).
	appendLines(deps.output, newTrailingLines(report, core.renderDeadCodeReport({ ...result, ...written }, { ...reportOptions, manifestDir })));
	deps.showInformationMessage(`Destructive manifest written to ${manifestDir}.`);
}

function reportError(deps: RunnerDeps, core: ApxCore, command: CommandDef, error: unknown): void {
	if (core.isApxError(error) && error.code === 'cancelled' || error instanceof Error && error.name === 'AbortError') {
		deps.output.appendLine(`${command.title} cancelled.`);
		(deps.setStatusBarMessage ?? vscode.window.setStatusBarMessage)(`$(circle-slash) ${command.title} cancelled`, 5000);
		return;
	}
	const { title, detail } = core.describeError(error);
	const hint = isAuthError(error) ? 'Re-authenticate with `sf org login web`, then try again.' : undefined;
	const fullDetail = [detail, hint].filter(Boolean).join('\n\n') || undefined;
	deps.output.appendLine(`Error: ${title}${fullDetail ? `\n${fullDetail}` : ''}`);
	if (!core.isApxError(error) && error instanceof Error && error.stack) { deps.output.appendLine(error.stack); }
	deps.output.show(true);
	deps.showErrorMessage(title, { detail: fullDetail });
}

function isAuthError(error: unknown): boolean {
	const value = error as { code?: string; name?: string; errorCode?: string };
	return value?.code === 'INVALID_SESSION_ID' || value?.errorCode === 'INVALID_SESSION_ID' || value?.name === 'RefreshTokenAuthError' || value?.name === 'INVALID_SESSION_ID';
}
