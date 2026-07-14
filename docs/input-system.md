# Input System

How the extension collects flag values from the user before running an Apx CLI command.

## Overview

`src/input/gatherInputs.ts` is the entry point. `gatherInputs(command, store, inputApi)` iterates over a command's flag definitions and calls `gatherFlag(...)` for each one. The return value is `GatheredInputs` — an `args` array ready to pass to the CLI and a `displayArgs` array for the Output Channel.

`InputApi` is the seam between business logic and VS Code UI. Tests stub it directly; `createVsCodeInputApi()` wires the real pickers for production.

## Flag kinds and their pickers

| `flag.kind` | Picker called | Source file |
|---|---|---|
| `org` | `inputApi.pickOrg(lastValue)` | `src/input/orgPicker.ts` |
| `outputDir` | `inputApi.pickOutputDirectory(options)` | `src/input/outputDirPicker.ts` |
| `enum` | `inputApi.showQuickPick(options)` | inline in `gatherFlag` |
| `string` / `apiVersion` | `inputApi.showInputBox(options)` | inline in `gatherFlag` |
| `boolean` | collected separately via `inputApi.showBooleanPick(...)` | inline in `gatherInputs` |
| `file` | none — see below | n/a |

`file` remains a valid `FlagKind` value (shared with the sibling `warden-code-ext` extension, whose `--users-def`/`--personas-def`/`--snapshot` flags use it), but no apx command currently has a `file`-kind flag, and this repo has no definition-file picker — it only served user-lifecycle commands, which live in `warden-code-ext` now. If a future apx command needs a workspace-file picker, either add an equivalent picker or fall through to `pickFile`/`pickFolder` in `src/input/filePicker.ts`.

Exclusive groups are gathered by `gatherExclusiveGroup(...)` when the first group member is reached in the loop, using `inputApi.showQuickPick`. apx currently has one such group: `flavor` (`--at4dx` / `--fflib`). A flag carrying `dependsOnFlag` would be skipped in the main loop and gathered as a follow-up right after its target flag is selected inside the group — no apx flag uses this today, but the mechanism (shared with `warden-code-ext`, which defers `--external-id` until `--users-def` is chosen) is kept for parity.

## Output directory picker (`outputDir`)

`pickOutputDirectory` in `src/input/outputDirPicker.ts` presents a Quick Pick before falling back to the native OS folder dialog. Candidates are built in this order:

1. **Default** — the flag's `default` value (usually `generated-files`), labelled `Default`.
2. **Last used** — the memento-stored value from the previous run, labelled `Last used`, shown only when it differs from the default.
3. **Package directories** — paths from `sfdx-project.json` `packageDirectories`, with the `default: true` entry first, labelled `Package directory`. Missing or malformed JSON is silently skipped.
4. **Workspace child folders** — direct subdirectories of the workspace root that are not noise dirs (`.git`, `.sf`, `.sfdx`, `node_modules`, `dist`, `out`, `coverage`, `.vscode`), labelled `Workspace folder`.
5. **Choose Different Folder...** — opens the native OS folder picker via `pickFolder(...)` from `src/input/filePicker.ts`, which enforces workspace-relative output and rejects out-of-workspace selections with a warning.

Candidates are deduplicated through `showWorkspaceQuickPick(...)` in `src/input/workspaceQuickPick.ts`; the first label/description wins. On Windows, deduplication is case-insensitive.

The picker returns a **workspace-relative path string** in all cases (or `undefined` on cancel). Candidate directories do not need to exist — the CLI flag allows non-existent output paths.

`pickFolder(...)` in `src/input/filePicker.ts` remains the native folder-dialog helper used only by the output-directory custom fallback. `pickFile(...)` remains available for future specialized file prompts, but is unused by the current apx command set.

## Adding a new flag kind

1. Add the kind string to `FlagKind` in `src/registry/types.ts`.
2. Add a new method to `InputApi` in `src/input/gatherInputs.ts` if the picker logic warrants a testable seam; otherwise call a VS Code API directly in `gatherFlag`.
3. Wire the real implementation in `createVsCodeInputApi()`.
4. Add the dispatch branch in `gatherFlag(...)`.
5. Add the new kind to the `knownKinds` set in `src/test/extension.test.ts` and write targeted tests.

## Last-value persistence

`LastValueStore` (`src/util/memento.ts`) wraps a VS Code `Memento` and keys values by `(commandId, flagName)`, under an `apx:` prefix. `gatherFlag` reads it before prompting and writes it after a successful pick.

For `outputDir` flags, the stored value is the selected workspace-relative directory path.
