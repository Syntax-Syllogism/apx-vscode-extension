# Command Runner

The Command Runner calls apx-core use cases in process, manages progress and cancellation, and reports results to the user.

## Overview

`src/runner/commandRunner.ts` exports `createCommandRunner(deps)`, which returns a `CommandRunner` with a single method:

```typescript
run(command: CommandDef, inputs: GatheredInputs, projectRoot: string): Promise<void>
```

`run` re-validates `inputs.options` with the use case's `optionsSchema.safeParse`, connects to `inputs.org` through `OrgService` when one was chosen, and dispatches on the use case's `kind`.

## Generation (write use cases)

1. **Plan** — `useCase.plan(conn, options, ctx)` returns a `GenerationPreview` (`baseDir`, `files` marked `new` or `exists`, optional `manualSteps`). Nothing is written yet.
2. **Preview** — `renderGenerationPlan(preview)` is written to the `Apx` output channel (`NEW  path` / `OVERWRITE  path`, plus manual steps).
3. **Nothing to write** — when `files` is empty (for example fflib unit-of-work, which is manual steps only), an information message points to the output channel and no modal is shown.
4. **Confirm** — a modal:
   - no existing files: **Apply** / Cancel;
   - some files exist: **Overwrite all** / **Skip existing** / Cancel.

   The modal detail is `N new, M existing files in <baseDir>`, followed by any existing files that are open in an editor with unsaved changes (`overwriteDetail` in `render.ts`).
5. **Apply** — `useCase.apply(conn, preview, { ...ctx, overwrite })` with the same preview object the user approved (`overwrite` is `'skip'` for Skip existing, otherwise `'overwrite'`). The runner never re-plans.
6. **Result** — `renderGenerationResult(outcome, { commandId })` is written to the output channel, and a message offers **Reveal in Explorer** for `preview.baseDir`.

Cancel at the modal writes nothing and shows "No files written."

## Dead Code (read use case)

1. **Run** — `useCases.dead.run(conn, options, ctx)` reports phases (inventory, bindings, dependencies, classify, manifest) through the progress notification.
2. **Report** — `renderDeadCodeReport(result, { includeSuppressed, deadOnly, username })` is written to the output channel.
3. **Manifest** — when `destructiveManifest` was selected and the result has a manifest, a modal asks "Write destructive manifest to `<outputBase>/dead-code`?" (`outputBase` from `resolveOutputBase(outputPath, projectRoot)`). Only **Write** calls `writeDeadCodeManifest(result, outputBase)`. The lines the report adds once a manifest exists (the written path and the `sf project deploy start` command to run next) are appended to the output channel. Nothing is deployed from VS Code.

## Progress and Cancellation

Each `plan`, `apply` and `run` call is wrapped in a cancellable `withProgress` notification. Progress events are shown as `message (done/total)`; no increments are reported, because phase totals are not known up front.

Cancel aborts an `AbortController` whose signal is passed to the use case. Use cases check the signal between phases and queries, so the notification changes to "Cancelling after current step…". A cancelled run (`ApxError` with code `cancelled`, or an `AbortError`) is logged to the output channel and shown as a status-bar message, not as an error.

## Errors

- **Expired session** — when a call fails with `INVALID_SESSION_ID` or `RefreshTokenAuthError` and an org was chosen, the runner calls `orgs.invalidate(org)`, reconnects, and retries once.
- **Everything else** — `describeError(error)` provides the title and detail, shown in an error message and the output channel. Auth errors add the hint "Re-authenticate with `sf org login web`, then try again." Stacks are logged for non-`ApxError` failures.

## Dependencies (`RunnerDeps`)

```typescript
interface RunnerDeps {
  core: () => Promise<ApxCore>;              // loadApxCore in production, a stub in tests
  orgs: OrgService;
  output: vscode.OutputChannel;
  withProgress: typeof vscode.window.withProgress;
  showInformationMessage: typeof vscode.window.showInformationMessage;
  showWarningMessage: typeof vscode.window.showWarningMessage;
  showErrorMessage: typeof vscode.window.showErrorMessage;
  setStatusBarMessage?: (text: string, hideAfterTimeout: number) => unknown;
  executeCommand?: typeof vscode.commands.executeCommand;
  dirtyDocuments?: () => readonly string[];  // absolute paths of unsaved open editors
}
```

## Testing

Runner tests in `src/test/extension.test.ts` spread the real apx-core module and replace `useCases[id].plan/apply/run`, the renderers and `writeDeadCodeManifest` with stubs. `OrgService` and the VS Code message functions are fakes that record their calls. See [testing.md](testing.md).
