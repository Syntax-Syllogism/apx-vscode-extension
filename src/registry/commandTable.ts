// Pure data (no imports) so scripts/sync-contributes.mjs can load it with Node's type stripping.

export interface CommandPresentation {
	/** Contributed VS Code command id. Kept stable so existing keybindings keep working. */
	id: string;
	title: string;
	subgroup?: string;
}

/** apx-core descriptor id → VS Code command presentation. */
export const commandTable: Readonly<Record<string, CommandPresentation>> = {
	'generate': { id: 'apx.generate', title: 'SF Apx: Generate (Multiple)', subgroup: 'Pattern Layers' },
	'generate-selector': { id: 'apx.generate.selector', title: 'SF Apx: Generate Selector', subgroup: 'Pattern Layers' },
	'generate-domain': { id: 'apx.generate.domain', title: 'SF Apx: Generate Domain', subgroup: 'Pattern Layers' },
	'generate-service': { id: 'apx.generate.service', title: 'SF Apx: Generate Service', subgroup: 'Pattern Layers' },
	'generate-unitofwork': { id: 'apx.generate.unitofwork', title: 'SF Apx: Generate Unit of Work', subgroup: 'Pattern Layers' },
	'generate-selector-method': { id: 'apx.generate.selector.method', title: 'SF Apx: Selector Method', subgroup: 'Selector Injection (AT4DX)' },
	'generate-selector-field-injection': { id: 'apx.generate.selector.field-injection', title: 'SF Apx: Selector Field Injection', subgroup: 'Selector Injection (AT4DX)' },
	'generate-action': { id: 'apx.generate.action', title: 'SF Apx: Generate Action', subgroup: 'Domain Processes (AT4DX)' },
	'generate-criteria': { id: 'apx.generate.criteria', title: 'SF Apx: Generate Criteria', subgroup: 'Domain Processes (AT4DX)' },
	'dead': { id: 'apx.dead', title: 'SF Apx: Find Dead Code' },
};

/** apx-core descriptor group → tree view group label. */
export const groupLabels: Readonly<Record<string, string>> = {
	generate: 'AEP Generation',
	analyze: 'Analyze',
};
