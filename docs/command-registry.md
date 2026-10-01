# Command Registry

The Command Registry defines the Apx commands and their inputs. It is built at runtime from `@syntax-syllogism/apx-core`'s `commandDescriptors` and `uiHints`; nothing is generated or vendored.

## Overview

The registry has three parts:

1. **Types** (`src/registry/types.ts`) — `CommandDef`, `InputDef`, `InputKind`, `OrgRequirement`.
2. **Presentation table** (`src/registry/commandTable.ts`) — maps each apx-core descriptor id to a VS Code command id, title and optional sidebar subgroup. Pure data with no imports, so `scripts/sync-contributes.mjs` can load it.
3. **Builder** (`src/registry/commands.ts`) — `buildCommands(core)` turns descriptors into `CommandDef[]`, in descriptor order.

`package.json` `contributes.commands` is rewritten from the descriptors and the table by:

```bash
npm run sync:contributes
```

A test fails if `package.json` drifts from the descriptors.

## Command Definition (`CommandDef`)

```typescript
interface CommandDef {
  id: string;                    // VS Code command id, e.g. 'apx.generate.selector'
  coreId: string;                // apx-core descriptor id, e.g. 'generate-selector'
  cliId: string;                 // matching CLI command (tree tooltip)
  title: string;                 // e.g. 'SF Apx: Generate Selector'
  group: string;                 // 'AEP Generation' | 'Analyze' (from descriptor.group)
  subgroup?: string;             // sidebar nesting inside AEP Generation
  kind: 'read' | 'write';        // from core.useCases[coreId].kind
  destructive: boolean;
  requiresOrg: 'required' | 'optional' | 'none';
  optionsSchema: z.ZodType;      // descriptor.optionsSchema, used for safeParse
  inputs: InputDef[];
}
```

## Input Definition (`InputDef`)

```typescript
interface InputDef {
  key: string;                   // option key in the schema, or 'org'
  kind: InputKind;
  label: string;
  summary?: string;
  required?: boolean;
  options?: string[];            // enum values
  placeholder?: string;
  exclusiveGroup?: string;
  dependsOn?: string;            // asked only after this option is set/enabled
  default?: unknown;             // schema default
}
```

## How Inputs Are Built

For each descriptor:

1. **Org** — when `requiresOrg` is `required` or `optional`, an `org` input comes first (`required` only for `required`). Commands with `requiresOrg: 'none'` never prompt for an org.
2. **Options** — for each key in the zod object shape that has a `uiHints` entry, an input is added in schema order. `kind`, `label`, `summary`, `placeholder`, `exclusiveGroup` and `dependsOn` come from the hint.
3. **Schema details** — `fieldDetails()` unwraps `ZodOptional` / `ZodDefault` / `ZodNullable` to derive `required`, `default` and enum `options`.

Schema keys without a hint are not prompted; the schema default applies.

## Input Kinds

| Kind | Prompt |
|---|---|
| `org` | Org picker |
| `folder` | Quick Pick-first folder picker |
| `file` | Native file picker |
| `string` | Input box |
| `multiString` | Input box, comma-separated, split into an array |
| `enum` | Quick Pick |
| `boolean` | Multi-select Quick Pick |

See [input-system.md](input-system.md).

## Current Commands

| Descriptor | VS Code command | Org | Kind |
|---|---|---|---|
| `generate` | `apx.generate` | required | write |
| `generate-selector` | `apx.generate.selector` | required | write |
| `generate-domain` | `apx.generate.domain` | required | write |
| `generate-service` | `apx.generate.service` | optional | write |
| `generate-unitofwork` | `apx.generate.unitofwork` | required | write |
| `generate-selector-method` | `apx.generate.selector.method` | none | write |
| `generate-selector-field-injection` | `apx.generate.selector.field-injection` | none | write |
| `generate-action` | `apx.generate.action` | none | write |
| `generate-criteria` | `apx.generate.criteria` | none | write |
| `dead` | `apx.dead` | required | read |

The `apx.generate.*` ids are unchanged from 0.1.x, so existing keybindings keep working.

## Extending the Registry

- **New command** — add the use case to apx-core, bump the pin, add a `commandTable` entry, run `npm run sync:contributes`. `buildCommands` throws if a descriptor has no table entry.
- **New input kind** — see [extending.md](extending.md#adding-support-for-a-new-input-kind).
- **Labels, placeholders, order, dependencies** — change `uiHints` or the schema in apx-core.
