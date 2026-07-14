import type { CommandDef } from './types';

export const commands: readonly CommandDef[] = [
	{
		"id": "apx.generate",
		"cliId": "apx generate",
		"title": "SF Apx: Generate (Multiple)",
		"group": "AEP Generation",
		"subgroup": "Pattern Layers",
		"requireOneOf": [
			"selector",
			"domain",
			"unit-of-work"
		],
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "binding-sequence",
				"kind": "string",
				"summary": "Binding sequence value for AT4DX unit-of-work metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "selector",
				"kind": "boolean",
				"summary": "Include selector artifacts in aggregate generation."
			},
			{
				"name": "domain",
				"kind": "boolean",
				"summary": "Include domain artifacts in aggregate generation."
			},
			{
				"name": "unit-of-work",
				"kind": "boolean",
				"summary": "Include unit-of-work artifacts in aggregate generation."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.selector",
		"cliId": "apx generate selector",
		"title": "SF Apx: Generate Selector",
		"group": "AEP Generation",
		"subgroup": "Pattern Layers",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.domain",
		"cliId": "apx generate domain",
		"title": "SF Apx: Generate Domain",
		"group": "AEP Generation",
		"subgroup": "Pattern Layers",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.service",
		"cliId": "apx generate service",
		"title": "SF Apx: Generate Service",
		"group": "AEP Generation",
		"subgroup": "Pattern Layers",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias."
			},
			{
				"name": "service-basename",
				"kind": "string",
				"summary": "Base name used for generated service classes.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.unitofwork",
		"cliId": "apx generate unitofwork",
		"title": "SF Apx: Generate Unit of Work",
		"group": "AEP Generation",
		"subgroup": "Pattern Layers",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "binding-sequence",
				"kind": "string",
				"summary": "Binding sequence value for AT4DX unit-of-work metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.selector.method",
		"cliId": "apx generate selector method",
		"title": "SF Apx: Selector Method",
		"group": "AEP Generation",
		"subgroup": "Selector Injection (AT4DX)",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Selector method-injection class name.",
				"required": true
			},
			{
				"name": "sobject-selector-class-name",
				"kind": "string",
				"summary": "Selector implementation class name used by method injection.",
				"required": true
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.selector.field-injection",
		"cliId": "apx generate selector field-injection",
		"title": "SF Apx: Selector Field Injection",
		"group": "AEP Generation",
		"subgroup": "Selector Injection (AT4DX)",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "fields",
				"kind": "string",
				"summary": "Comma-separated API names for field-set displayed fields.",
				"required": true
			},
			{
				"name": "fieldset-name",
				"kind": "string",
				"summary": "Optional field-set API name for selector field injection."
			},
			{
				"name": "label",
				"kind": "string",
				"summary": "Optional label value for generated metadata artifacts."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.action",
		"cliId": "apx generate action",
		"title": "SF Apx: Generate Action",
		"group": "AEP Generation",
		"subgroup": "Domain Processes (AT4DX)",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Action class name to generate.",
				"required": true
			},
			{
				"name": "trigger-operation",
				"kind": "enum",
				"summary": "Trigger operation enum value for AT4DX domain-process bindings.",
				"options": [
					"Before_Insert",
					"Before_Update",
					"Before_Delete",
					"After_Insert",
					"After_Update",
					"After_Delete",
					"After_Undelete"
				]
			},
			{
				"name": "order",
				"kind": "string",
				"summary": "Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1)."
			},
			{
				"name": "process-name",
				"kind": "string",
				"summary": "Optional process token used to build AT4DX binding developer names."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "apx.generate.criteria",
		"cliId": "apx generate criteria",
		"title": "SF Apx: Generate Criteria",
		"group": "AEP Generation",
		"subgroup": "Domain Processes (AT4DX)",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Criteria class name to generate.",
				"required": true
			},
			{
				"name": "trigger-operation",
				"kind": "enum",
				"summary": "Trigger operation enum value for AT4DX domain-process bindings.",
				"options": [
					"Before_Insert",
					"Before_Update",
					"Before_Delete",
					"After_Insert",
					"After_Update",
					"After_Delete",
					"After_Undelete"
				]
			},
			{
				"name": "order",
				"kind": "string",
				"summary": "Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1)."
			},
			{
				"name": "process-name",
				"kind": "string",
				"summary": "Optional process token used to build AT4DX binding developer names."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	}
] as const;
