# Testing Guide

This extension uses VS Code's test infrastructure (`@vscode/test-cli`) and Mocha.

## Running Tests

```bash
npm test                # compiles tests and the extension, lints, then runs in VS Code
xvfb-run -a npm test    # on headless Linux
npm run watch-tests     # recompile tests on change
```

`.vscode-test.mjs` runs `out/test/**/*.test.js`.

## Test Structure

```
src/test/
  extension.test.ts   # registry, gatherInputs and command runner (apx-core stubbed)
  pickers.test.ts     # org/folder/output-directory pickers and the tree view
  helpers.ts          # VS Code API overrides and in-memory fakes
```

## Key Test Patterns

### Loading apx-core

Tests load the real module with `loadApxCore()` and build the registry with `buildCommands(core)`. That keeps registry tests honest against the pinned apx-core.

### Stubbing apx-core

Runner tests spread the real module and replace only what they need:

```typescript
const core = {
  ...real,
  renderGenerationResult: () => ['APPLIED'],
  useCases: {
    ...real.useCases,
    'generate-selector': {
      ...real.useCases['generate-selector'],
      plan: async () => preview,
      apply: async (_conn, plan, ctx) => { applied.push({ plan, overwrite: ctx.overwrite }); return {}; },
    },
  },
} as unknown as ApxCore;
```

The descriptor (and its `optionsSchema`) stays real, so the runner's `safeParse` still runs.

### Stubbing org access and VS Code UI

`RunnerDeps` takes a fake `OrgService` (recording `connect` / `invalidate` calls) and fake `showInformationMessage` / `showWarningMessage` / `showErrorMessage` functions that record their arguments and answer modals. `withProgress` calls the task immediately with a no-op progress and an uncancelled token.

`gatherInputs` tests pass a fake `InputApi` whose input box answers are keyed by input label. `MemoryMemento` backs `LastValueStore`.

Picker tests override `vscode.window.showQuickPick`, `showOpenDialog`, `showWarningMessage` and `vscode.workspace.workspaceFolders` with the helpers in `helpers.ts`, restoring them afterwards.

## What Is Covered

- The registry matches `commandDescriptors` (ids, kinds, org inputs per `requiresOrg`).
- `package.json` `contributes.commands` matches the descriptors and `commandTable`.
- No extension source uses `child_process` or `cross-spawn`; the host runs Node 22+.
- `gatherInputs`: required org cancel, optional org "(none)", no org prompt for org-less commands, schema failure re-prompts, explicit booleans and dependent options, memento key format.
- Runner: Apply modal for new files; Overwrite all / Skip existing pass the matching `overwrite` with the same preview; Cancel writes nothing; manual-steps-only plans show no modal; cancellation is not an error; `describeError` surfacing; auth retry; Dead Code report and manifest written only on Write.
- `overwriteDetail` lists dirty editors; pickers and tree grouping.

## Manual Testing

Some behaviour needs a real org and the Extension Development Host: progress phases on a large org, cancelling Dead Code midway, generated files byte-for-byte against `sf apx generate …`, and running with `sf` removed from `PATH`.

## Debugging Tests

Use `test.only(...)` and run `npm test`, or run the tests from VS Code's Testing view with the Extension Test Runner.
