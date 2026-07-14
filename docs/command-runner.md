# Command Runner

The Command Runner is responsible for executing Apx CLI commands, managing their lifecycle, and communicating results to the user.

## Overview

`src/runner/commandRunner.ts` exports `createCommandRunner(deps)` which returns a `CommandRunner` interface with a single method:

```typescript
run(command: CommandDef, inputs: GatheredInputs): Promise<void>
```

## Execution Flow

apx has no destructive commands, so `strategyFor()` always returns the single `StandardCommandStrategy` — there is no `DestructiveCommandStrategy` in this repo (that dry-run → confirm → apply flow lives only in the sibling `warden-code-ext` extension, for `warden strip`).

1. **Build arguments** — Combine command ID, user inputs, and internal flags via `buildCliArgs()`
2. **Display command** — Show the full `sf apx ...` command in the Output Channel
3. **Spawn process** — Use `spawnSf(args)` to start the CLI as a child process
4. **Stream output** — Pipe stdout/stderr to the Output Channel in real-time
5. **Wait for exit** — Track the process exit code and handle completion

## Confirmation Dialogs

`requiresRunConfirmation()` only prompts before running when a command sets `supportsNoPrompt: true`. No apx command does today, so no apx command shows a pre-run confirmation dialog — the infrastructure exists (shared with the sibling extensions) but is currently dormant here:

```
[Run sf apx ...]
[Don't run]  [Run]
```

## Progress Management

While a command runs, the extension shows a progress notification:

```
Running sf apx <command>...
[Cancel button]
```

If the user clicks Cancel, the child process is killed. The cancellation is detected via `cancelled` flag in the `RunResult`.

## Output Channel

All command activity is logged to the "Apx" Output Channel:

```
$ sf apx generate selector --target-org my-org --sobject Account --at4dx
[detailed command output with colors]
```

The Output Channel is automatically shown if:

- A command starts (via `output.show(true)`)
- An error occurs

## Internal Flags

Some flags are added automatically and not prompted for:

- `--no-prompt` — Would be added for commands that support it (`supportsNoPrompt: true`); no apx command sets this today, so `internalFlags()` is currently a no-op for every apx command
- `--json` — Never added; the extension reads human-readable output by default
- `--flags-dir` — Not supported by the extension

The `internalFlags(command)` function handles this logic.

## Process Spawning

### `spawnSf(args)`

Spawns `sf <args>` as a child process:

```typescript
const child = spawnSf(['apx', 'generate', 'selector', '--target-org=my-org', '--sobject=Account']);
child.stdout.on('data', (data) => { /* handle output */ });
child.stderr.on('data', (data) => { /* handle output */ });
child.on('exit', (code) => { /* handle exit */ });
```

**Environment**: The process inherits the parent's environment. The working directory defaults to the workspace folder if available.

### Error Handling

- **Plugin not found** — Caught by `SfDetector` pre-flight check before `CommandRunner` is called
- **Process spawn failure** — Rejected promise; user sees an error message
- **Process exit with non-zero code** — Treated as failure; Output Channel is shown

## Dependencies (`RunnerDeps`)

The Command Runner is dependency-injected to enable testing:

```typescript
interface RunnerDeps {
  output: vscode.OutputChannel;              // Where to log
  spawnProcess: SpawnProcess;                // Process spawner (for testing)
  withProgress: typeof vscode.window.withProgress;
  showInformationMessage: typeof vscode.window.showInformationMessage;
  showWarningMessage: typeof vscode.window.showWarningMessage;
  showErrorMessage: typeof vscode.window.showErrorMessage;
  executeCommand?: typeof vscode.commands.executeCommand;
  workspaceFolder?: string;
}
```

In production, `createCommandRunner()` is called with real VS Code APIs. In tests, these are stubbed.

## Result Tracking

Internal `RunResult` interface tracks command completion:

```typescript
interface RunResult {
  code: number | null;      // Exit code (null = terminated)
  stdout: string;           // Combined stdout
  stderr: string;           // Combined stderr
  cancelled: boolean;       // User clicked Cancel
}
```

Success is determined from the parsed Salesforce CLI JSON envelope's `status` field when present, falling back to the process exit code.

## Example: Running a Command

```typescript
const command = {
  id: 'apx.generate.selector',
  cliId: 'apx generate selector',
  title: 'SF Apx: Generate Selector',
  flags: [/* ... */],
};

const inputs = {
  args: ['--target-org', 'my-org', '--sobject', 'Account', '--at4dx'],
  displayArgs: ['--target-org', 'my-org', '--sobject', 'Account', '--at4dx'],
};

await runner.run(command, inputs);
// → Spawns: sf apx generate selector --target-org my-org --sobject Account --at4dx
// → Streams output to Output Channel
// → Shows success/error notification, with an "Open Folder" action when the command
//   wrote to an outputDir-kind flag (e.g. --output-path)
```

## Testing

Tests for the Command Runner are in `src/test/extension.test.ts`. Key test patterns:

- Stub `spawnProcess` to return a mock child process
- Mock VS Code message dialogs to avoid interactive prompts
- Verify that the correct arguments are built
- Verify cancellation is handled correctly
- Verify ANSI stripping and JSON-envelope parsing (success/failure/malformed)
