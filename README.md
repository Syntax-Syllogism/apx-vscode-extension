# Apx

Apx is a VS Code extension for guided Apex Enterprise Pattern (AEP) work without leaving the editor: generating selectors, domains, services, unit-of-work, and AT4DX injection/binding metadata, and finding dead Apex classes in an org. It runs [`@syntax-syllogism/apx-core`](https://github.com/Syntax-Syllogism/apx-core) in process, the same library behind the `sf apx` CLI plugin.

## Features

- Command Palette entries and Apx sidebar actions for every supported command.
- AEP Generation commands:
  - `SF Apx: Generate (Multiple)`
  - `SF Apx: Generate Selector`
  - `SF Apx: Generate Domain`
  - `SF Apx: Generate Service`
  - `SF Apx: Generate Unit of Work`
  - `SF Apx: Selector Method`
  - `SF Apx: Selector Field Injection`
  - `SF Apx: Generate Action`
  - `SF Apx: Generate Criteria`
- Analyze commands:
  - `SF Apx: Find Dead Code` — classifies Apex classes as dead, test-only, test-of-dead, or retained, and can write a destructive-changes manifest after confirmation. Nothing is deployed from VS Code.
- Dedicated Apx activity-bar view, with AEP commands grouped into Pattern Layers, Selector Injection (AT4DX), and Domain Processes (AT4DX), plus an Analyze group.
- Guided native inputs, derived from each apx-core command's options schema:
  - Salesforce org picker (orgs authorized with the Salesforce CLI or any `@salesforce/core` tool) with `apx.defaultTargetOrg` fallback.
  - Quick Pick-first folder picker for the output folder.
  - Quick Pick for enums such as the framework flavor and trigger operation.
  - Multi-select Quick Pick for boolean options.
  - Input boxes for strings and comma-separated lists.
  - Invalid answers are reported and the field is asked again.
- Generation previews: the planned files are listed in the `Apx` output channel (`NEW` or `OVERWRITE`) and a modal asks before anything is written — **Apply**, or **Overwrite all** / **Skip existing** when files already exist. Open editors with unsaved changes to files that would be overwritten are listed in the modal.
- Org-less commands (`Generate Action`, `Generate Criteria`, `Selector Method`, `Selector Field Injection`) never prompt for an org; `Generate Service` offers "(none)".
- Cancellable progress notifications. Long operations stop after the current step.

## Requirements

- VS Code 1.125 or later.
- A folder containing `sfdx-project.json` open in the workspace.
- For org-backed commands, an org authorized on this machine (for example with `sf org login web`). The Salesforce CLI itself is not required to run the extension.

## Extension Settings

- `apx.defaultTargetOrg`: default Salesforce org alias or username for Apx commands.

## Development

### Quick Start

```sh
npm install
npm test
npm run package:vsix
```

See [docs/README.md](docs/README.md) for comprehensive developer documentation, including:

- **[Architecture Overview](docs/architecture.md)** — Design and components
- **[Input System](docs/input-system.md)** — How user input is collected
- **[Command Runner](docs/command-runner.md)** — Command execution
- **[Command Registry](docs/command-registry.md)** — Command definitions and generation
- **[Extending the Extension](docs/extending.md)** — Adding new commands and features
- **[Testing Guide](docs/testing.md)** — Writing and running tests

### Updating Commands

Commands come from `@syntax-syllogism/apx-core`'s `commandDescriptors`. When apx-core adds a use case, bump the pinned version in `package.json`, add an entry to `src/registry/commandTable.ts`, and run:

```sh
npm run sync:contributes
```

This rewrites `contributes.commands` in `package.json`. See [docs/extending.md](docs/extending.md).
