import * as assert from 'assert';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as vscode from 'vscode';
import { loadApxCore } from '../core/load';
import { pickFolder } from '../input/filePicker';
import { prioritizeOrgChoices } from '../input/orgPicker';
import { pickOutputDirectory } from '../input/outputDirPicker';
import { showWorkspaceQuickPick } from '../input/workspaceQuickPick';
import { buildCommands } from '../registry/commands';
import { ApxCommandsProvider } from '../tree/apxCommandsProvider';
import { withOpenDialog, withQuickPick, withWarningMessage, withWorkspaceFolders } from './helpers';

suite('Apx pickers and tree', () => {
	test('prioritizeOrgChoices moves the last-used org first without changing cancel semantics', () => {
		const choices = [
			{ label: 'one', value: 'one' },
			{ label: 'two', value: 'two' },
		];

		assert.deepStrictEqual(prioritizeOrgChoices(choices, 'two').map((choice) => choice.value), ['two', 'one']);
		assert.deepStrictEqual(prioritizeOrgChoices(choices).map((choice) => choice.value), ['one', 'two']);
	});

	test('pickFolder returns project-relative paths and root as dot', async () => {
		await withWorkspaceFolders(['/repo'], async () => {
			await withOpenDialog([vscode.Uri.file('/repo/force-app')], async () => {
				assert.strictEqual(await pickFolder('Output folder'), 'force-app');
			});

			await withOpenDialog([vscode.Uri.file('/repo')], async () => {
				assert.strictEqual(await pickFolder('Output folder'), '.');
			});
		});
	});

	test('pickFolder rejects out-of-workspace folders', async () => {
		const warnings: string[] = [];
		await withWorkspaceFolders(['/repo'], async () => {
			await withOpenDialog([vscode.Uri.file('/outside')], async () => {
				await withWarningMessage(async (message) => {
					warnings.push(message);
					return undefined;
				}, async () => {
					assert.strictEqual(await pickFolder('Output folder'), undefined);
				});
			});
		});

		assert.deepStrictEqual(warnings, ['Choose a folder inside the current workspace.']);
	});

	test('showWorkspaceQuickPick injects last-used first, deduplicates, and returns undefined on cancel', async () => {
		const capturedItems: vscode.QuickPickItem[][] = [];
		await withQuickPick((items) => {
			capturedItems.push([...items]);
			return items[0];
		}, async () => {
			const result = await showWorkspaceQuickPick({
				items: [
					{ label: 'force-app', value: 'force-app' },
					{ label: 'force-app duplicate', value: 'force-app' },
					{ label: 'generated-files', value: 'generated-files' },
				],
				lastValue: 'force-app',
				placeHolder: 'Pick a folder',
			});
			assert.strictEqual(result, 'force-app');
		});

		assert.deepStrictEqual(capturedItems[0].map((item) => (item as unknown as { value: string }).value), [
			'force-app',
			'generated-files',
		]);

		await withQuickPick(() => undefined, async () => {
			const result = await showWorkspaceQuickPick({
				items: [{ label: 'force-app', value: 'force-app' }],
				placeHolder: 'Pick a folder',
			});
			assert.strictEqual(result, undefined);
		});
	});

	test('pickOutputDirectory shows Quick Pick with default as first item', async () => {
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return items[0];
			}, async () => {
				const result = await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, 'generated-files');
			});
		});

		const items = capturedItems[0];
		assert.ok(items, 'showQuickPick should have been called');
		assert.strictEqual(items[0].label, 'generated-files');
		assert.strictEqual(items[0].description, 'Default');
	});

	test('pickOutputDirectory includes last-used as second item when different from default', async () => {
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({
					label: 'Output folder',
					defaultValue: 'generated-files',
					lastValue: 'force-app',
				});
			});
		});

		const items = capturedItems[0];
		assert.strictEqual(items[0].label, 'generated-files');
		assert.strictEqual(items[0].description, 'Default');
		assert.strictEqual(items[1].label, 'force-app');
		assert.strictEqual(items[1].description, 'Last used');
	});

	test('pickOutputDirectory returns undefined when Quick Pick is cancelled', async () => {

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick(() => undefined, async () => {
				const result = await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, undefined);
			});
		});
	});

	test('pickOutputDirectory falls back to folder picker for Choose Different Folder', async () => {

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => items.find((item) => item.label.includes('Choose Different Folder')), async () => {
				await withOpenDialog([vscode.Uri.file('/repo/custom-dir')], async () => {
					const result = await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
					assert.strictEqual(result, 'custom-dir');
				});
			});
		});
	});

	test('pickOutputDirectory rejects out-of-workspace folders from custom fallback', async () => {
		const warnings: string[] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => items.find((item) => item.label.includes('Choose Different Folder')), async () => {
				await withOpenDialog([vscode.Uri.file('/outside')], async () => {
					await withWarningMessage(async (msg) => {
						warnings.push(msg);
						return undefined;
					}, async () => {
						const result = await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
						assert.strictEqual(result, undefined);
					});
				});
			});
		});

		assert.deepStrictEqual(warnings, ['Choose a folder inside the current workspace.']);
	});

	test('pickOutputDirectory discovers sfdx-project.json package directories', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'apx-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [
				{ path: 'force-app', default: true },
				{ path: 'packages/shared' },
			],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
			});
		});

		const labels = capturedItems[0].map((item) => item.label);
		assert.ok(labels.includes('force-app'), 'should include default package dir');
		assert.ok(labels.includes('packages/shared'), 'should include other package dirs');
	});

	test('pickOutputDirectory puts sfdx default package before non-default packages', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'apx-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [
				{ path: 'packages/shared' },
				{ path: 'force-app', default: true },
			],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
			});
		});

		const packageItems = capturedItems[0].filter((item) => item.description === 'Package directory');
		assert.strictEqual(packageItems[0].label, 'force-app');
		assert.strictEqual(packageItems[1].label, 'packages/shared');
	});

	test('pickOutputDirectory ignores malformed sfdx-project.json without throwing', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'apx-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), 'not valid json {{{');

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick(() => undefined, async () => {
				const result = await pickOutputDirectory({ label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, undefined);
			});
		});
	});

	test('pickOutputDirectory deduplicates candidates', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'apx-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [{ path: 'generated-files', default: true }],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({
					label: 'Output folder',
					defaultValue: 'generated-files',
					lastValue: 'generated-files',
				});
			});
		});

		const generatedFilesItems = capturedItems[0].filter((item) => item.label === 'generated-files');
		assert.strictEqual(generatedFilesItems.length, 1, 'generated-files should appear only once');
		assert.strictEqual(generatedFilesItems[0].description, 'Default');
	});

	test('tree provider groups AEP generation into subgroups and lists Dead Code under Analyze', async () => {
		const provider = new ApxCommandsProvider(buildCommands(await loadApxCore()));
		const groups = provider.getChildren();
		assert.deepStrictEqual(groups.map((node) => node.type === 'group' ? node.label : ''), ['AEP Generation', 'Analyze']);

		const subgroups = provider.getChildren(groups[0]);
		assert.deepStrictEqual(subgroups.map((node) => node.type === 'subgroup' ? node.label : ''), ['Pattern Layers', 'Selector Injection (AT4DX)', 'Domain Processes (AT4DX)']);
		const ids = (node: (typeof subgroups)[number]): string[] => provider.getChildren(node).map((child) => child.type === 'command' ? child.command.id : '');
		assert.deepStrictEqual(ids(subgroups[0]), ['apx.generate', 'apx.generate.selector', 'apx.generate.domain', 'apx.generate.service', 'apx.generate.unitofwork']);
		assert.deepStrictEqual(ids(subgroups[1]), ['apx.generate.selector.method', 'apx.generate.selector.field-injection']);
		assert.deepStrictEqual(ids(subgroups[2]), ['apx.generate.action', 'apx.generate.criteria']);
		assert.deepStrictEqual(ids(groups[1]), ['apx.dead']);
	});
});
