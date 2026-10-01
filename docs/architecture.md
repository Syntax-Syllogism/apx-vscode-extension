# Architecture Overview

Apx is a VS Code extension that runs [`@syntax-syllogism/apx-core`](https://github.com/Syntax-Syllogism/apx-core) use cases in process: Apex Enterprise Pattern generation and dead-code analysis. apx-core is the same library the `sf apx` CLI plugin uses, so the extension and the CLI produce the same files and reports. The extension never spawns `sf`.

## High-Level Flow

When a user executes an Apx command from the Command Palette or sidebar:

1. **Activation** — `activate()` creates the output channel, the org service, and the tree view. apx-core and `@salesforce/core` are loaded lazily; the tree fills in once apx-core resolves.
2. **Project root** — The workspace folder containing `sfdx-project.json` is used (with a picker when there are several). Without one, the command stops with an error before any prompting.
3. **Input gathering** — Inputs are derived from the use case's zod options schema and `uiHints`, collected through VS Code pickers, and validated with `safeParse` (invalid fields are asked again).
4. **Execution** — The runner calls the use case directly with a `@salesforce/core` `Connection`, an `AbortSignal`, and a progress callback.
5. **Feedback** — Write use cases show a file preview and an Apply / Overwrite modal before writing. Read use cases write their report to the `Apx` output channel.

## Components

### Extension Entry Point (`src/extension.ts`)

- Registers one VS Code command per entry in `commandTable`.
- Finds the sfdx project root (`findProjectRoots`).
- For commands whose org is `required`, checks that at least one org is authorized and otherwise offers a terminal running `sf org login web`. This is the only place `sf` is mentioned.
- Wires `gatherInputs` → `CommandRunner.run`.

### Core Loading (`src/core/load.ts`, `src/core/orgService.ts`)

- `loadApxCore()` and `loadSfCore()` are memoized dynamic `import()`s of the ESM packages, so activation stays cheap and no command pays the load cost more than once.
- `OrgService` lists authorized orgs (`authorizationChoices` marks the default and expired orgs), caches connections per alias or username, resolves usernames, and `invalidate()`s a cached connection after an auth failure.

### Command Registry (`src/registry/`)

- `commandTable.ts` maps apx-core descriptor ids to VS Code command ids, titles and sidebar subgroups. It is pure data so `scripts/sync-contributes.mjs` can load it.
- `commands.ts` builds `CommandDef[]` from `core.commandDescriptors` and `core.uiHints(schema)`.

See [command-registry.md](command-registry.md).

### Input System (`src/input/`)

- `gatherInputs` walks a command's inputs, dispatching each kind (org, folder, file, enum, string, multiString, boolean) to a picker behind the `InputApi` seam.
- Last-value persistence via `LastValueStore` allows quick re-runs.

See [input-system.md](input-system.md).

### Command Runner (`src/runner/commandRunner.ts`, `src/runner/render.ts`)

- Write use cases: `plan` → preview → modal → `apply` with the same preview.
- Read use cases (Dead Code): `run` → report → optional destructive manifest after confirmation.
- Progress, cancellation, a single auth retry, and error reporting through apx-core's `describeError`.
- All user-facing text for previews, results and reports comes from apx-core's renderers; `render.ts` is glue only.

See [command-runner.md](command-runner.md).

### Sidebar Tree View (`src/tree/apxCommandsProvider.ts`)

- Implements `TreeDataProvider<ApxNode>`; `refresh(commands)` fills it once apx-core has loaded.
- Groups follow the descriptor `group` (`AEP Generation`, `Analyze`); AEP commands are nested by subgroup (Pattern Layers, Selector Injection (AT4DX), Domain Processes (AT4DX)).
- Order follows `commandDescriptors` — there is no separately maintained ordering list.

### Last-Value Persistence (`src/util/memento.ts`)

- `LastValueStore` wraps VS Code's workspace Memento.
- Keys are `apx.last.<descriptorId>.<optionKey>` (for example `apx.last.generate-selector.sobject`). Values stored by 0.1.x under flag names are no longer read.

## Data Flow

```
User triggers command
         ↓
  pickProjectRoot()            (folder with sfdx-project.json)
         ↓
  gatherInputs(command, store, api, projectRoot)
    (pickers + optionsSchema.safeParse re-prompts)
         ↓
  CommandRunner.run(command, inputs, projectRoot)
    ├─ orgs.connect(org)        (when an org was chosen)
    ├─ write: plan → renderGenerationPlan → modal → apply → renderGenerationResult
    └─ read:  run → renderDeadCodeReport → [Write manifest?] → writeDeadCodeManifest
```

## Extension Lifecycle

### Activation Events

The extension activates when:

- The workspace contains `sfdx-project.json`
- The workspace contains `.sf/config.json`
- The user opens the Apx commands sidebar view

### Subscription Management

All event listeners and resources are registered into `context.subscriptions`, so VS Code cleans them up on deactivation.

## Key Design Decisions

### In-Process Core

Running apx-core in the extension host removes the `sf` process startup cost from every command, lets the extension preview files before writing them, and gives structured errors and progress instead of parsed CLI output. The extension requires VS Code 1.125 or later (Node 22 in the extension host).

### Descriptors as the Source of Truth

Commands, input kinds, labels and validation come from apx-core. The extension only owns presentation (command ids, titles, subgroups) in `commandTable.ts`, and `npm run sync:contributes` keeps `package.json` in step. A test fails if they drift.

### Input API Abstraction

The `InputApi` interface decouples input logic from VS Code UI, so tests can stub it directly.

### Confirm Before Writing

Generation always previews first. The exact preview the user approved is passed to `apply` — the runner never re-plans. Dead Code writes a destructive manifest only after confirmation and never deploys it.
