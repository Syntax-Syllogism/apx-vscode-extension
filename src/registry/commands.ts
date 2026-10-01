import { z } from 'zod';
import type { ApxCore } from '../core/load';
import { commandTable, groupLabels } from './commandTable';
import type { CommandDef, InputDef } from './types';

function fieldDetails(field: z.ZodType): Pick<InputDef, 'required' | 'default' | 'options'> {
	let current = field;
	let required = true;
	let defaultValue: unknown;
	while (current instanceof z.ZodOptional || current instanceof z.ZodDefault || current instanceof z.ZodNullable) {
		if (current instanceof z.ZodOptional || current instanceof z.ZodDefault) { required = false; }
		if (current instanceof z.ZodDefault) { defaultValue = current.parse(undefined); }
		current = current.def.innerType as z.ZodType;
	}
	return { required, default: defaultValue, options: current instanceof z.ZodEnum ? current.options.map(String) : undefined };
}

export function buildCommands(core: ApxCore): CommandDef[] {
	return core.commandDescriptors.map((descriptor) => {
		const presentation = commandTable[descriptor.id];
		if (!presentation) { throw new Error(`No VS Code command id mapped for apx-core descriptor "${descriptor.id}"`); }
		const schema = descriptor.optionsSchema as z.ZodType;
		const hints = core.uiHints(schema);
		const shape = (schema as unknown as z.ZodObject<z.ZodRawShape>).shape;
		const inputs: InputDef[] = descriptor.requiresOrg === 'none'
			? []
			: [{ key: 'org', kind: 'org', label: 'Salesforce org', required: descriptor.requiresOrg === 'required' }];
		for (const [key, field] of Object.entries(shape)) {
			const hint = hints[key];
			if (!hint) { continue; }
			inputs.push({
				key,
				kind: hint.kind,
				label: hint.label,
				summary: hint.summary ?? hint.label,
				placeholder: hint.placeholder,
				exclusiveGroup: hint.exclusiveGroup,
				dependsOn: hint.dependsOn,
				...fieldDetails(field as z.ZodType),
			});
		}
		return {
			id: presentation.id,
			coreId: descriptor.id,
			cliId: descriptor.cliId,
			title: presentation.title,
			group: groupLabels[descriptor.group] ?? descriptor.group,
			subgroup: presentation.subgroup,
			kind: core.useCases[descriptor.id as keyof ApxCore['useCases']].kind,
			destructive: descriptor.destructive,
			requiresOrg: descriptor.requiresOrg,
			optionsSchema: schema,
			inputs,
		};
	});
}
