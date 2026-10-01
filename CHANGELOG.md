# Change Log

All notable changes to the "apx-ext" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0] - 2026-10-01

### Changed

- Commands now run [`@syntax-syllogism/apx-core`](https://github.com/Syntax-Syllogism/apx-core) in process instead of spawning `sf apx`. The Salesforce CLI and the apx plugin are no longer required; orgs are read through `@salesforce/core` (log in once with `sf org login web` or any Salesforce tool).
- Generation previews the planned files in the `Apx` output channel and asks before writing: **Apply**, or **Overwrite all** / **Skip existing** when files already exist. Unsaved open editors that would be overwritten are listed in the prompt.
- Inputs come from apx-core's option schemas and are validated before running; an invalid answer is reported and asked again.
- Cancellable progress notifications report each step; an expired org session is refreshed and retried once.
- Minimum VS Code version raised to 1.125 (Node 22 extension host).
- Remembered prompt values are now keyed `apx.last.<descriptorId>.<optionKey>`, so values remembered by 0.1.x are not reused.

### Added

- `SF Apx: Find Dead Code` (`apx.dead`) in a new Analyze group: classifies Apex classes as dead, test-only, test-of-dead or retained, and writes a destructive-changes manifest only after confirmation. Nothing is deployed from VS Code.

### Removed

- The `sf` process runner, CLI detection, vendored oclif manifest and `gen:commands` codegen. `npm run sync:contributes` keeps `package.json` in sync with apx-core.

### Notes

- The in-process speedup over 0.1.0 has not been measured yet (needs a scratch org).

## [0.1.0] - 2026-07-13

### Fixed

- Make sidebar and marketplace icons legible

## [0.1.0]

### Added

- Initial release — extracted from jawn-code-ext v0.1.6. Ships the AEP Generation half of jawn-code-ext's command set as a standalone extension targeting the `@syntax-syllogism/apx` Salesforce CLI plugin: `SF Apx: Generate (Multiple)`, `Generate Selector`, `Generate Domain`, `Generate Service`, `Generate Unit of Work`, `Selector Method`, `Selector Field Injection`, `Generate Action`, and `Generate Criteria`.
