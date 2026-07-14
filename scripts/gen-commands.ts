import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface ManifestFlag {
	name?: string;
	type?: string;
	summary?: string;
	description?: string;
	required?: boolean;
	options?: string[];
	default?: string;
}

interface ManifestCommand {
	id: string;
	description?: string;
	summary?: string;
	flags?: Record<string, ManifestFlag>;
}

interface OclifManifest {
	commands: Record<string, ManifestCommand>;
}

interface PackageJson {
	contributes?: {
		commands?: ContributedCommand[];
	};
}

interface ContributedCommand {
	command: string;
	title: string;
}

const allowList = new Set([
	'apx generate',
	'apx generate selector',
	'apx generate domain',
	'apx generate service',
	'apx generate unitofwork',
	'apx generate selector method',
	'apx generate selector field-injection',
	'apx generate action',
	'apx generate criteria',
]);

const titleById = new Map([
	['apx generate', 'SF Apx: Generate (Multiple)'],
	['apx generate selector', 'SF Apx: Generate Selector'],
	['apx generate domain', 'SF Apx: Generate Domain'],
	['apx generate service', 'SF Apx: Generate Service'],
	['apx generate unitofwork', 'SF Apx: Generate Unit of Work'],
	['apx generate selector method', 'SF Apx: Selector Method'],
	['apx generate selector field-injection', 'SF Apx: Selector Field Injection'],
	['apx generate action', 'SF Apx: Generate Action'],
	['apx generate criteria', 'SF Apx: Generate Criteria'],
]);

const groupById = new Map([
	['apx generate', 'AEP Generation'],
	['apx generate selector', 'AEP Generation'],
	['apx generate domain', 'AEP Generation'],
	['apx generate service', 'AEP Generation'],
	['apx generate unitofwork', 'AEP Generation'],
	['apx generate selector method', 'AEP Generation'],
	['apx generate selector field-injection', 'AEP Generation'],
	['apx generate action', 'AEP Generation'],
	['apx generate criteria', 'AEP Generation'],
]);

const subgroupById = new Map([
	['apx generate', 'Pattern Layers'],
	['apx generate selector', 'Pattern Layers'],
	['apx generate domain', 'Pattern Layers'],
	['apx generate service', 'Pattern Layers'],
	['apx generate unitofwork', 'Pattern Layers'],
	['apx generate selector method', 'Selector Injection (AT4DX)'],
	['apx generate selector field-injection', 'Selector Injection (AT4DX)'],
	['apx generate action', 'Domain Processes (AT4DX)'],
	['apx generate criteria', 'Domain Processes (AT4DX)'],
]);

const requireOneOfById = new Map([
	['apx generate', ['selector', 'domain', 'unit-of-work']],
]);

const flavorFlags = new Set(['at4dx', 'fflib']);

const guiHiddenFlagsByCommand = new Map<string, Set<string>>([]);

const placeholderByCommandFlag = new Map<string, string>([]);

const summaryByCommandFlag = new Map([
	['apx generate action:class-name', 'Action class name to generate.'],
	['apx generate criteria:class-name', 'Criteria class name to generate.'],
]);

export function generateRegistry(manifest: OclifManifest): string {
	const commands = lifecycleCommands(manifest).map((command) => commandDef(command));

	return `import type { CommandDef } from './types';\n\nexport const commands: readonly CommandDef[] = ${JSON.stringify(commands, null, '\t')} as const;\n`;
}

export function generateContributesCommands(manifest: OclifManifest): ContributedCommand[] {
	return lifecycleCommands(manifest).map((command) => ({
		command: vscodeCommandId(command.id),
		title: titleById.get(cliCommandId(command.id)) ?? cliCommandId(command.id),
	}));
}

export function updatePackageContributesCommands(packageJson: PackageJson, manifest: OclifManifest): PackageJson {
	return {
		...packageJson,
		contributes: {
			...packageJson.contributes,
			commands: generateContributesCommands(manifest),
		},
	};
}

function lifecycleCommands(manifest: OclifManifest): ManifestCommand[] {
	return Object.values(manifest.commands)
		.filter((command) => allowList.has(cliCommandId(command.id)))
		.sort((left, right) => [...allowList].indexOf(cliCommandId(left.id)) - [...allowList].indexOf(cliCommandId(right.id)));
}

function commandDef(command: ManifestCommand): Record<string, unknown> {
	const cliId = cliCommandId(command.id);
	return omitUndefined({
		id: vscodeCommandId(command.id),
		cliId,
		title: titleById.get(cliId) ?? cliId,
		group: groupById.get(cliId) ?? 'AEP Generation',
		subgroup: subgroupById.get(cliId),
		requireOneOf: requireOneOfById.get(cliId),
		flags: Object.entries(command.flags ?? {})
			.filter(([name]) => shouldPromptForFlag(cliId, name))
			.sort(([left], [right]) => flagOrder(cliId, left) - flagOrder(cliId, right))
			.map(([name, flag]) => omitUndefined({
				name,
				kind: flagKind(cliId, name, flag),
				summary: summaryFor(cliId, name, flag),
				required: flag.required || requiredOverride(cliId, name) || undefined,
				options: flag.options,
				placeholder: placeholderFor(cliId, name),
				exclusiveGroup: exclusiveGroupFor(command, name),
				dependsOnFlag: dependsOnFlagFor(command, name),
				default: flag.default,
			})),
	});
}

function requiredOverride(_commandId: string, _flagName: string): boolean {
	// No apx command currently needs a required-flag override beyond the manifest.
	return false;
}

function shouldPromptForFlag(commandId: string, name: string): boolean {
	if (name === 'json' || name === 'no-prompt' || name === 'api-version' || name === 'flags-dir') {
		return false;
	}

	return !guiHiddenFlagsByCommand.get(commandId)?.has(name);
}

function flagKind(_commandId: string, name: string, flag: ManifestFlag): string {
	if (name === 'target-org') {
		return 'org';
	}
	if (name === 'api-version') {
		return 'apiVersion';
	}
	if (name === 'output-path') {
		return 'outputDir';
	}
	if (flag.type === 'boolean') {
		return 'boolean';
	}
	if (flag.options?.length) {
		return 'enum';
	}
	if (flag.type === 'option' && /file|path|def$/.test(name)) {
		return 'file';
	}

	return 'string';
}

function exclusiveGroupFor(_command: ManifestCommand, flagName: string): string | undefined {
	if (flavorFlags.has(flagName)) {
		return 'flavor';
	}

	return undefined;
}

function dependsOnFlagFor(_command: ManifestCommand, _flagName: string): string | undefined {
	// No apx flag currently needs to be deferred behind another flag's selection.
	return undefined;
}

function placeholderFor(commandId: string, flagName: string): string | undefined {
	return placeholderByCommandFlag.get(`${commandId}:${flagName}`) ?? placeholderByCommandFlag.get(`*:${flagName}`);
}

function summaryFor(commandId: string, flagName: string, flag: ManifestFlag): string | undefined {
	return summaryByCommandFlag.get(`${commandId}:${flagName}`) ?? summaryByCommandFlag.get(`*:${flagName}`) ?? flag.summary ?? flag.description;
}

function flagOrder(_commandId: string, _flagName: string): number {
	// No apx command currently needs a non-manifest flag prompt order.
	return 0;
}

function cliCommandId(manifestId: string): string {
	return manifestId.replace(/:/g, ' ');
}

function vscodeCommandId(manifestId: string): string {
	return manifestId.replace(/:/g, '.').replaceAll(' ', '.');
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const manifestPath = resolve(process.argv[2] ?? 'vendor/apx.oclif.manifest.json');
	const outputPath = resolve(process.argv[3] ?? 'src/registry/commands.generated.ts');
	const packageJsonPath = resolve(process.argv[4] ?? 'package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as OclifManifest;
	writeFileSync(outputPath, generateRegistry(manifest));
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
	writeFileSync(packageJsonPath, `${JSON.stringify(updatePackageContributesCommands(packageJson, manifest), null, 2)}\n`);
}
