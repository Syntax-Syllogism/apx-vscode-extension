# Input System

How the extension collects option values from the user before running an apx-core use case.

## Overview

`src/input/gatherInputs.ts` is the entry point. `gatherInputs(command, store, inputApi, projectRoot)` walks the command's `inputs` (built from the descriptor's options schema and `uiHints`, see [command-registry.md](command-registry.md)) and returns `GatheredInputs`:

```typescript
interface GatheredInputs {
  org?: string;                        // alias or username; undefined when none
  options: Record<string, unknown>;    // passed to the use case after safeParse
  display: string[];                   // "Label: value" lines for the output channel
}
```

`InputApi` is the seam between input logic and VS Code UI. Tests stub it directly; `createVsCodeInputApi(orgs)` wires the real pickers.

## Input kinds and their pickers

| `input.kind` | Picker called | Source file |
|---|---|---|
| `org` | `inputApi.pickOrg(lastValue, optional)` | `src/input/orgPicker.ts` |
| `folder` | `inputApi.pickOutputDirectory(options)` | `src/input/outputDirPicker.ts` |
| `file` | `inputApi.pickFile(label, projectRoot)` | `src/input/filePicker.ts` |
| `enum` | `inputApi.showQuickPick(items)` (last or default value first) | inline in `gatherOne` |
| `string` | `inputApi.showInputBox(options)` | inline in `gatherOne` |
| `multiString` | `inputApi.showInputBox(options)`, split on commas into an array | inline in `gatherOne` |
| `boolean` | collected together via `inputApi.showBooleanPick(...)` | `gatherBooleans` |

### Org

The org input is added by the registry only when the descriptor's `requiresOrg` is `required` or `optional`. The picker lists orgs from `OrgService.listOrgs()` (expired orgs are marked), with the last-used org or the `apx.defaultTargetOrg` setting first. For optional orgs (for example Generate Service) a "(none)" item returns `NO_ORG`, and the command runs without a connection.

### Booleans

All top-level booleans are shown in one multi-select Quick Pick, pre-selected from the last value or the schema default. Every boolean is set explicitly to `true` or `false`. Inputs with `dependsOn` (for example Dead Code's `deadOnly`, which depends on `destructiveManifest`) are asked only after the option they depend on is enabled.

### Exclusive groups

Inputs that share an `exclusiveGroup` hint are offered as one Quick Pick ("Choose <group>"), and only the chosen member is gathered.

## Validation

After gathering, the options are checked with `command.optionsSchema.safeParse`. On failure the first issue is shown as `<Label>: <message>` and that field is asked again, up to five attempts. If the issue does not map to a promptable input, gathering stops with the warning. The runner runs `safeParse` again before calling the use case.

Cancelling a required prompt stops gathering (`undefined`). Cancelling or leaving an optional prompt empty leaves the option unset so the schema default applies.

## Output directory picker (`folder`)

`pickOutputDirectory` in `src/input/outputDirPicker.ts` presents a Quick Pick before falling back to the native folder dialog. Candidates, relative to the project root:

1. **Default** — the schema default (usually `generated-files`), labelled `Default`.
2. **Last used** — the stored value from the previous run, when it differs from the default.
3. **Package directories** — from `sfdx-project.json` `packageDirectories`, the `default: true` entry first. Missing or malformed JSON is skipped.
4. **Workspace child folders** — direct subdirectories that are not noise dirs (`.git`, `.sf`, `.sfdx`, `node_modules`, `dist`, `out`, `coverage`, `.vscode`).
5. **Choose Different Folder...** — `pickFolder(...)` in `src/input/filePicker.ts`, which rejects folders outside the project with a warning.

Candidates are deduplicated through `showWorkspaceQuickPick(...)`. The picker returns a relative path string (or `undefined` on cancel); the directory does not need to exist.

## Adding a new input kind

1. Add the kind to apx-core's `uiHints`.
2. Add it to `InputKind` in `src/registry/types.ts`.
3. Add a method to `InputApi` if the picker deserves a testable seam, and wire it in `createVsCodeInputApi()`.
4. Add the branch in `gatherOne(...)`.
5. Add the kind to the `knownKinds` set in `src/test/extension.test.ts` and write targeted tests.

## Last-value persistence

`LastValueStore` (`src/util/memento.ts`) wraps the workspace `Memento` and keys values as `apx.last.<descriptorId>.<optionKey>`. `gatherOne` reads the value before prompting and writes it after a successful pick; booleans are stored as `'true'` / `'false'`.
