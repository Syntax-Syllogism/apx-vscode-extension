# Apx Extension Documentation

This directory contains documentation for developers working on the Apx VS Code extension.

## Quick Start

New to the codebase? Start here:

1. **[Architecture Overview](architecture.md)** — High-level design and component overview
2. **[Extending the Extension](extending.md)** — How to add new commands, input kinds, and features
3. **[Development Setup](#development-setup)** — Get your environment ready

## Core Documentation

### User-Facing Features

- **[Input System](input-system.md)** — How the extension collects user input (pickers, input boxes, etc.)
- **[Command Runner](command-runner.md)** — How commands are executed and their output reported

### Developer Reference

- **[Command Registry](command-registry.md)** — How commands and inputs are built from apx-core descriptors
- **[Testing Guide](testing.md)** — How to write and run tests
- **[Extending the Extension](extending.md)** — Detailed guide to adding new commands, inputs, and customizations

## Development Setup

### Prerequisites

- Node.js 22+
- npm 10+
- VS Code 1.125+
- An authorized Salesforce org (for org-backed commands); the Salesforce CLI is only needed to log in (`sf org login web`)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Syntax-Syllogism/apx-code-ext.git
cd apx-code-ext

# Install dependencies
npm install

# Verify setup
npm test
npm run check-types
npm run lint
```

### Common Commands

```bash
# Development
npm run watch              # Watch TypeScript and rebuild on changes
npm run compile            # Build extension
npm test                   # Run test suite
npm run check-types        # Type checking
npm run lint               # Code linting

# Release
npm run package            # Build for distribution
npm run package:vsix       # Create .vsix file for VS Code Marketplace

# Maintenance
npm run sync:contributes   # Rewrite package.json contributes.commands from apx-core descriptors
```

### Debugging

1. Press **F5** to launch the Extension Development Host
2. In the new VS Code window, open a Salesforce project folder
3. Commands appear in the Command Palette (Ctrl+Shift+P) prefixed with "Apx"
4. Use the Apx sidebar (left activity bar) to browse commands
5. Open VS Code's Debug Console (Ctrl+J) to see logs

## Project Structure

```
apx-code-ext/
  src/
    extension.ts                # Extension entry point
    input/                      # Input gathering (pickers, etc.)
      gatherInputs.ts          # Main input orchestrator
      orgPicker.ts             # Org selection picker
      filePicker.ts            # Native file/folder picker helpers
      workspaceQuickPick.ts    # Shared workspace-relative Quick Pick helper
      outputDirPicker.ts       # Directory selection picker
    core/                      # In-process apx-core and @salesforce/core
      load.ts                  # Lazy, memoized dynamic imports
      orgService.ts            # Org listing, connections, auth invalidation
    registry/                  # Command definitions
      types.ts                 # TypeScript interfaces
      commandTable.ts          # Descriptor id → VS Code command id/title/subgroup
      commands.ts              # buildCommands(core): descriptors + uiHints → CommandDef[]
    runner/                    # Command execution
      commandRunner.ts         # Plan/preview/apply and read flows, progress, errors
      render.ts                # Output-channel glue around apx-core renderers
    tree/                      # Sidebar UI
      apxCommandsProvider.ts  # Tree view implementation
    util/
      memento.ts              # Last-value persistence
    test/
      extension.test.ts       # Registry, input and runner tests (core stubbed)
      pickers.test.ts         # Picker and tree view tests
      helpers.ts              # VS Code API stubs and in-memory fakes
  
  scripts/
    sync-contributes.mjs      # Rewrites package.json contributes.commands
  
  docs/                        # This documentation
    README.md                 # Documentation index
    architecture.md           # Design overview
    command-runner.md         # Execution system
    command-registry.md       # Command definitions
    input-system.md           # Input gathering
    extending.md              # Extension guide
    testing.md                # Testing guide
  
  .github/
    workflows/
      ci.yml                  # CI/CD pipeline
  
  media/
    apx.svg                  # Sidebar icon
    apx-logo.png             # Marketplace logo
```

## Key Concepts

### Commands

A **Command** wraps one apx-core use case. Each command has:

- **id** — VS Code command ID (e.g., `apx.generate.selector`)
- **coreId** — apx-core descriptor id (e.g., `generate-selector`)
- **cliId** — the matching CLI command, shown as the tree tooltip
- **title** — Display name in Command Palette
- **inputs** — Prompts to collect, derived from the descriptor's zod options schema and `uiHints`
- **group** — Sidebar category (`AEP Generation` or `Analyze`)
- **subgroup** — Sidebar nesting within AEP Generation (Pattern Layers, Selector Injection (AT4DX), Domain Processes (AT4DX))

### Input Kinds

- **org** — Salesforce org picker (added when the descriptor's `requiresOrg` is `required` or `optional`)
- **folder** — Quick Pick-first directory picker
- **file** — Native file picker
- **string** — Text input box
- **multiString** — Comma-separated text input, split into an array
- **enum** — Quick Pick
- **boolean** — Multi-select checkbox picker

### Workflows

- **Generation (write use cases):** inputs → `plan` → file list in the output channel → Apply / Overwrite all / Skip existing / Cancel modal → `apply` with the same preview.
- **Dead Code (read use case):** inputs → `run` with phase progress → report in the output channel → optional destructive-manifest write after confirmation.

## Common Tasks

### Add a new command

1. Add the use case and descriptor in apx-core and release it
2. Bump the `@syntax-syllogism/apx-core` pin in `package.json`
3. Add an entry to `src/registry/commandTable.ts`
4. Run `npm run sync:contributes`
5. Test with `npm test`

See [Extending the Extension](extending.md#adding-support-for-a-new-command).

### Add a new input kind

1. Add the kind to apx-core's `uiHints` (prompt metadata lives there)
2. Add it to `InputKind` in `src/registry/types.ts`
3. Add UI handling in `gatherOne()` in `src/input/gatherInputs.ts`
4. Add tests

See [Extending the Extension](extending.md#adding-support-for-a-new-input-kind).

### Customize prompts

Labels, summaries, placeholders, exclusive groups and `dependsOn` come from apx-core's `uiHints`, and prompt order follows the options schema. Change them in apx-core, not here.

### Run a command manually

1. Launch Extension Development Host (F5)
2. Open a Salesforce project folder
3. Cmd+Shift+P → "Apx: " → Pick a command
4. Answer prompts
5. See output in Apx Output Channel

### Debug a test failure

Change the failing `test(...)` to `test.only(...)` in `src/test/*.test.ts` and run `npm test` (`xvfb-run -a npm test` on headless Linux).

Or debug from VS Code's Testing view with the Extension Test Runner (set a breakpoint, then **Debug Test**). See [testing.md](testing.md#debugging-tests).

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` (if exists) or release notes
3. Commit: `git commit -m "chore: release v0.x.y"`
4. Tag: `git tag v0.x.y`
5. Build: `npm run package:vsix`
6. Upload to [VS Code Marketplace](https://marketplace.visualstudio.com/)

## Troubleshooting

### Tests fail after bumping apx-core

Resync the contributed commands (and add any new descriptor to `commandTable.ts`):

```bash
npm run sync:contributes
npm test
```

### Extension doesn't load in Extension Development Host

1. Check `npm run compile` succeeds
2. Check no TypeScript errors: `npm run check-types`
3. Check console for errors (F5 → Debug Console)
4. Try `Ctrl+R` to reload the window

### Command hangs or times out

1. Check the progress notification: Dead Code reports each phase, and cancel stops after the current step
2. Check the `Apx` output channel for errors
3. If an org call fails with an expired session, re-authenticate with `sf org login web`

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## Resources

- [Apx CLI Plugin](https://github.com/Syntax-Syllogism/apx)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Salesforce CLI Documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/)

## Questions?

Open an issue on [GitHub](https://github.com/Syntax-Syllogism/apx-code-ext/issues).

---

**Last updated:** 2026-09-30
