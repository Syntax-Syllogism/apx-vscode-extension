# Command Registry

The Command Registry defines all available Apx commands and their flags. It is automatically generated from the apx CLI plugin's oclif manifest.

## Overview

The registry has two layers:

1. **Type definitions** (`src/registry/types.ts`) — `CommandDef` and `FlagDef` interfaces
2. **Command data** (`src/registry/commands.generated.ts`) — Auto-generated from the oclif manifest

## Regenerating Commands

When the apx plugin releases new commands or changes flag definitions, regenerate the registry:

```bash
npm run gen:commands -- vendor/apx.oclif.manifest.json src/registry/commands.generated.ts
```

This script:

1. Parses the oclif manifest (JSON)
2. Filters to whitelisted commands (see `allowList`)
3. Extracts flags and infers UI metadata
4. Writes `src/registry/commands.generated.ts`
5. Updates `package.json` contributes list

## Command Definition (`CommandDef`)

```typescript
interface CommandDef {
  id: string;                     // VS Code command ID (e.g., 'apx.generate.selector')
  cliId: string;                  // CLI command ID (e.g., 'apx generate selector')
  title: string;                  // Display title (e.g., 'SF Apx: Generate Selector')
  group: string;                  // Sidebar group (always 'AEP Generation' in this extension)
  subgroup?: string;              // Subgroup (Pattern Layers, Selector Injection (AT4DX), Domain Processes (AT4DX))
  supportsNoPrompt?: boolean;     // If true, add --no-prompt automatically (unused by any apx command today)
  destructive?: boolean;          // If true, use dry-run → confirm → apply workflow (unused by any apx command today)
  requireOneOf?: string[];        // At least one of these flags must be selected (e.g., selector, domain, unit-of-work)
  flags: FlagDef[];               // Flag definitions in prompt order
}
```

`supportsNoPrompt` and `destructive` are carried over from the shared `CommandDef` shape (the sibling `warden-code-ext` extension uses both), but no apx command sets either today — apx has no confirmation-skipping flag and no destructive/dry-run-then-apply workflow.

## Flag Definition (`FlagDef`)

```typescript
interface FlagDef {
  name: string;                 // CLI flag name (e.g., 'target-org')
  kind: FlagKind;               // UI type ('org' | 'file' | 'outputDir' | 'string' | 'boolean' | 'apiVersion' | 'enum')
  summary?: string;             // Description shown to user
  required?: boolean;           // If true, flag is mandatory
  options?: string[];           // For enum kind: allowed values
  placeholder?: string;         // For string kind: example text
  exclusiveGroup?: string;      // Mutually exclusive group name
  dependsOnFlag?: string;       // Only prompt once the named flag has been chosen
  default?: string;             // Default value
}
```

## Flag Kinds

The UI presentation of each flag is determined by its `kind`:

| Kind | Picker | Use case |
|------|--------|----------|
| `org` | Org picker with cached value | `--target-org` |
| `outputDir` | Directory picker (Quick Pick + fallback to native dialog) | `--output-path` for generated files |
| `string` | Text input box | SObject names, class names, prefixes, ordering tokens |
| `apiVersion` | Text input box with version number validation | `--api-version` (currently hidden from the UI, see below) |
| `enum` | Quick Pick with predefined options | `--trigger-operation` |
| `boolean` | Multi-select Quick Pick | `--dry-run`, artifact toggles (selector, domain, unit-of-work) |
| `file` | Workspace JSON Quick Pick, filtered by Git ignore rules | Reserved for parity with the shared runner code; no apx flag uses it today |

## Generation Rules

The `scripts/gen-commands.ts` script applies these rules:

### Whitelisting

Only commands in the `allowList` are exposed. This prevents accidental inclusion of CLI-only or internal commands. The full whitelist (all 9 apx commands):

- `apx generate`
- `apx generate selector`
- `apx generate domain`
- `apx generate service`
- `apx generate unitofwork`
- `apx generate selector method`
- `apx generate selector field-injection`
- `apx generate action`
- `apx generate criteria`

### Flag Kind Inference

Flag kind is inferred based on the flag name and type:

```typescript
function flagKind(name: string, flag: ManifestFlag): string {
  if (name === 'target-org') return 'org';
  if (name === 'api-version') return 'apiVersion';
  if (name === 'output-path') return 'outputDir';
  if (flag.type === 'boolean') return 'boolean';
  if (flag.options?.length) return 'enum';
  if (flag.type === 'option' && /file|path|def$/.test(name)) return 'file';
  return 'string';  // Default
}
```

### Exclusive Groups

apx has one mutually exclusive, single-select flag group:

- **`flavor`** — Flags: `--at4dx`, `--fflib`
  - Used to select AEP architecture pattern
  - Only one can be selected

### Hidden Flags

Some CLI flags are hidden from the UI (not prompted for), across every command:

- `--json` — Extension reads human-readable output
- `--no-prompt` — Would be added automatically if a command set `supportsNoPrompt: true`; no apx command does
- `--api-version` — Not exposed; could be added if needed
- `--flags-dir` — Not supported

No apx command currently needs a per-command hidden-flag override (`guiHiddenFlagsByCommand` is empty in `scripts/gen-commands.ts`).

### Flag Ordering

Flags are prompted in manifest order for every apx command; `flagOrder()` in `scripts/gen-commands.ts` always returns `0` because no apx command needs a flag reordered ahead of the rest (unlike the sibling `warden-code-ext`, which reorders `--user` ahead of `--target-org`).

### Deferred (dependent) flags

A flag with `dependsOnFlag: '<other-flag>'` is not prompted in the normal sequence.
Instead, it is gathered as a follow-up immediately after `<other-flag>` is selected
inside its exclusive group. No apx flag currently has a `dependsOnFlag` — the mechanism
exists in `gatherInputs.ts` and `gen-commands.ts` for parity with the shared code
(it's how the sibling `warden-code-ext` defers `--external-id` until `--users-def` is chosen),
but `dependsOnFlagFor()` always returns `undefined` for apx today.

### Placeholders

No apx command currently needs a placeholder override — `placeholderByCommandFlag` is empty
in `scripts/gen-commands.ts`. Extend it (`'*:flagName'` for a wildcard, or
`'<cliId>:flagName'` for a specific command) if a future apx flag needs example text.

### Summaries

Summaries are displayed as descriptions in pickers and input boxes, sourced in this priority:

1. Custom summary from `summaryByCommandFlag` map
2. Wildcard summary (`*:flagName`)
3. Flag's own `summary` from manifest
4. Flag's own `description` from manifest
5. (no summary if none match)

apx uses this to disambiguate `--class-name` between `generate action` ("Action class name to generate.") and `generate criteria` ("Criteria class name to generate.") — the manifest's own summary text for both is a stale "Selector method-injection class name." copied from `generate selector method`.

## Extending the Registry

### To add a new command

1. Ensure the command is added to the apx CLI plugin (not this extension)
2. Add the command ID to `allowList` in `scripts/gen-commands.ts`
3. Add a title mapping to `titleById`
4. Add group/subgroup mappings to `groupById` / `subgroupById`
5. Add any ordering, placeholder, or summary overrides
6. Run `npm run gen:commands` to regenerate

### To add a new flag kind

1. Add the kind string to `FlagKind` in `src/registry/types.ts`
2. Add inference logic to `flagKind()` in `scripts/gen-commands.ts`
3. Add UI handling in `src/input/gatherInputs.ts` (new `gatherFlag()` branch or new method on `InputApi`)
4. Wire the real implementation in `createVsCodeInputApi()`
5. Add tests to `src/test/extension.test.ts`

See [input-system.md](input-system.md#adding-a-new-flag-kind) for the full process.

### To adjust UI metadata

Edit the maps in `scripts/gen-commands.ts`:

- `titleById` — Display name for Command Palette
- `groupById` — Sidebar group (always `AEP Generation` today)
- `subgroupById` — Subgroup (Pattern Layers, Selector Injection (AT4DX), Domain Processes (AT4DX))
- `placeholderByCommandFlag` — Placeholder text for input boxes
- `summaryByCommandFlag` — Description text for pickers
- `guiHiddenFlagsByCommand` — Flags to exclude from UI
- `flavorFlags` — The `flavor` exclusive flag group members (`at4dx`, `fflib`)
- `dependsOnFlagFor()` — Defer a flag until another is selected
- Flag ordering in `flagOrder()`

After editing, run `npm run gen:commands` to update.

## Example: Generated Command

Here's how `apx generate selector` looks after generation:

```typescript
{
  id: 'apx.generate.selector',
  cliId: 'apx generate selector',
  title: 'SF Apx: Generate Selector',
  group: 'AEP Generation',
  subgroup: 'Pattern Layers',
  flags: [
    {
      name: 'target-org',
      kind: 'org',
      required: true,
      summary: 'Target org username or alias.',
    },
    {
      name: 'sobject',
      kind: 'string',
      required: true,
      summary: 'SObject API name used for generated artifacts.',
    },
    {
      name: 'at4dx',
      kind: 'boolean',
      exclusiveGroup: 'flavor',
      summary: 'Generate AT4DX-flavor artifacts.',
    },
    {
      name: 'fflib',
      kind: 'boolean',
      exclusiveGroup: 'flavor',
      summary: 'Generate fflib-flavor artifacts.',
    },
    {
      name: 'output-path',
      kind: 'outputDir',
      default: 'generated-files',
      summary: 'Output folder relative to the Salesforce project root.',
    },
    {
      name: 'prefix',
      kind: 'string',
      summary: 'Optional namespace-style class prefix.',
    },
    {
      name: 'dry-run',
      kind: 'boolean',
      summary: 'Render and validate generation output without writing files.',
    },
  ],
}
```

When this is executed, the extension:

1. Prompts for each flag in order (org, sobject, flavor choice, output-path, prefix, dry-run)
2. Builds args: `['apx', 'generate', 'selector', '--target-org', 'my-org', '--sobject', 'Account', '--at4dx', ...]`
3. Spawns: `sf apx generate selector --target-org my-org --sobject Account --at4dx`
