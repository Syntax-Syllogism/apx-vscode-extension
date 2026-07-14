# Architecture Overview

Apx is a VS Code extension that provides a guided UI for running Salesforce CLI commands from the `@syntax-syllogism/apx` plugin. This document describes the extension's architecture and key components.

## High-Level Flow

When a user executes an Apx command from the Command Palette or sidebar:

1. **Activation** — The extension's `activate()` function initializes core services and registers command handlers.
2. **Input Gathering** — The user is prompted for required flag values through VS Code pickers and input boxes.
3. **Execution** — The command is built and spawned as a child process, with output streamed to the Apx output channel.
4. **Feedback** — Progress notifications, error messages, and ANSI-colored output guide the user through the operation.

## Components

### Extension Entry Point (`src/extension.ts`)

- Initializes VS Code services: Output Channel, Workspace State (memento), command registry.
- Creates the SF detector (checks for Salesforce CLI + apx plugin).
- Registers command handlers that wire together input gathering → command execution.
- Registers the sidebar tree view (`ApxCommandsProvider`).

### Command Registry (`src/registry/types.ts`, `src/registry/commands.generated.ts`)

- `CommandDef` interface defines a command's metadata: name, title, flags, groups, and execution options.
- `FlagDef` interface describes individual flags: kind, prompt type, validation, and UI presentation.
- `commands.generated.ts` is auto-generated from the apx oclif manifest via `scripts/gen-commands.ts`.

See [command-registry.md](command-registry.md) for details.

### Input System (`src/input/gatherInputs.ts`, `src/input/*Picker.ts`)

- Collects user inputs for all flags required by a command.
- Uses strategy pattern: each flag kind (org, outputDir, enum, string, boolean) has a dedicated picker.
- Pickers are abstracted behind `InputApi` interface for testability.
- Last-value persistence via `LastValueStore` allows quick re-runs.

See [input-system.md](input-system.md) for details.

### Command Runner (`src/runner/commandRunner.ts`, `src/runner/sfProcess.ts`)

- Builds CLI arguments and spawns the `sf apx ...` process.
- Streams stdout/stderr to the Output Channel.
- Manages progress notifications and cancellation. apx has no destructive commands, so every command uses the same standard run strategy.

See [command-runner.md](command-runner.md) for details.

### SF Detection (`src/runner/sfDetect.ts`, `src/runner/sfProcess.ts`)

- Pre-flight checks: verifies `sf --version` and `sf apx --help` work.
- Offers an install action if the apx plugin is missing.
- Lazy checks on first command only; result is cached.

### Sidebar Tree View (`src/tree/apxCommandsProvider.ts`)

- Implements VS Code's `TreeDataProvider<ApxNode>` interface.
- Organizes commands into a single collapsible top-level group: AEP Generation.
- Commands are further nested by subgroup: Pattern Layers, Selector Injection (AT4DX), Domain Processes (AT4DX).
- Group, subgroup, and command order are derived from the registry order (the single source of truth, driven by the allow-list in `scripts/gen-commands.ts`) — there is no separately maintained ordering list.
- Each command node has a clickable handler that triggers the command.

### ANSI Output Handler (`src/runner/ansi.ts`)

- Strips ANSI escape codes from streamed command output before it is buffered for JSON-envelope detection.

### Last-Value Persistence (`src/util/memento.ts`)

- `LastValueStore` wraps VS Code's Memento API.
- Stores the last value for each (commandId, flagName) pair, keyed under an `apx:` prefix.
- For `outputDir`-kind flags, stores the workspace-relative directory path so future Quick Picks can surface the exact last-used output folder.

## Data Flow Diagram

```
User triggers command
         ↓
  SfDetector.ensureReady()
    (check for SF CLI + apx)
         ↓
  gatherInputs(command, store)
    (collect flags via pickers)
         ↓
  CommandRunner.run(command, inputs)
    ├─ Build apx args
    ├─ spawnSf(args) → child process
    ├─ Stream stdout/stderr to Output Channel
    ├─ Wait for process exit
    └─ Show result message
         ↓
   Last-value store updated
```

## Extension Lifecycle

### Activation Events

The extension activates when any of these conditions are met:

- Workspace contains `sfdx-project.json`
- Workspace contains `.sf/config.json`
- User interacts with the Apx commands sidebar view

### Subscription Management

All event listeners and resources are registered into `context.subscriptions`, ensuring VS Code cleans them up on deactivation.

## Key Design Decisions

### Input API Abstraction

The `InputApi` interface decouples business logic from VS Code UI, enabling:

- Easy testing with stub implementations
- Potential future support for other UI frameworks
- Clear separation of concerns

### Generated Command Registry

Commands are auto-generated from the apx oclif manifest (JSON), not hand-coded. This ensures:

- The extension always stays in sync with the CLI plugin
- Flag additions/removals are automatic
- UI metadata (titles, groups) is centralized in `scripts/gen-commands.ts`

### Lazy Dependency Detection

The SF detector only runs once, on first command. This avoids repeated shell calls during extension startup.

### No Destructive-Operation Workflow

Unlike the sibling `warden-code-ext` extension (which has `warden strip`'s dry-run → confirm → apply flow), no apx command mutates org data destructively — every apx command only generates local Apex/metadata files, optionally previewed with its own `--dry-run` flag. `CommandDef.destructive` and the standard/destructive strategy split from the original unified codebase were kept only as the single `StandardCommandStrategy` here; the destructive strategy was deleted as dead code.
