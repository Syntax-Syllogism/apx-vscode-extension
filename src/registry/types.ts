import type { z } from 'zod';

/** An apx-core descriptor id, e.g. `generate-selector` or `dead`. */
export type CommandId = string;

export type InputKind = 'org' | 'file' | 'folder' | 'multiString' | 'string' | 'boolean' | 'enum';

export type OrgRequirement = 'required' | 'optional' | 'none';

export interface InputDef {
	key: string;
	kind: InputKind;
	label: string;
	summary?: string;
	required?: boolean;
	options?: readonly string[];
	placeholder?: string;
	exclusiveGroup?: string;
	dependsOn?: string;
	default?: unknown;
}

export interface CommandDef {
	id: string;
	coreId: CommandId;
	cliId: string;
	title: string;
	group: string;
	subgroup?: string;
	kind: 'read' | 'write';
	destructive: boolean;
	requiresOrg: OrgRequirement;
	optionsSchema: z.ZodType;
	inputs: readonly InputDef[];
}
