# Extending the Extension

Commands, inputs and validation come from `@syntax-syllogism/apx-core`. Most changes start there; the extension only owns presentation and VS Code glue.

## Adding Support for a New Command

### 1. Add the use case in apx-core

Add the use case, its descriptor (`id`, `cliId`, `title`, `group`, `requiresOrg`, `optionsSchema`) and its `uiHints` in apx-core, and release a new version. Write use cases must provide `plan` and `apply`; read use cases provide `run`.

### 2. Bump the pin

Update the exact `@syntax-syllogism/apx-core` version in `package.json` and run `npm install`.

### 3. Add a presentation entry

Add the descriptor id to `src/registry/commandTable.ts`:

```typescript
'generate-thing': { id: 'apx.generate.thing', title: 'SF Apx: Generate Thing', subgroup: 'Pattern Layers' },
```

`subgroup` is only used inside the AEP Generation group. A new descriptor `group` also needs a label in `groupLabels` (and an icon in `groupIcon()` in `src/tree/apxCommandsProvider.ts` if the default is wrong).

### 4. Sync the contributed commands

```bash
npm run sync:contributes
```

This rewrites `contributes.commands` in `package.json` from the descriptors and the table.

### 5. Handle a new result type (read use cases only)

The runner's read path renders Dead Code results with `renderDeadCodeReport`. A new read use case needs its own renderer from apx-core wired into `runRead()` in `src/runner/commandRunner.ts`.

### 6. Test

```bash
npm test
```

The registry and contributes-sync tests in `src/test/extension.test.ts` list the expected command ids; update them.

## Adding Support for a New Input Kind

### 1. Define the kind

Add it to apx-core's `uiHints` and to `InputKind` in `src/registry/types.ts`.

### 2. Create the input method

If the picker deserves a testable seam, add a method to `InputApi` in `src/input/gatherInputs.ts` and wire it in `createVsCodeInputApi()`.

### 3. Dispatch it

Add a `case` in `gatherOne()`. Return `false` only when gathering should stop (a required value was cancelled); set `gathered.options[input.key]` and push a `display` line on success.

### 4. Add tests

Add the kind to `knownKinds` in `src/test/extension.test.ts` and add a `gatherInputs` test with a stubbed `InputApi`.

## Customizing Prompts

Labels, summaries, placeholders, exclusive groups and `dependsOn` come from `uiHints`; prompt order follows the zod schema shape; defaults, required-ness and enum values come from the schema. Change them in apx-core so the CLI and the extension stay consistent.

## Modifying the Sidebar Tree View

`src/tree/apxCommandsProvider.ts` groups commands by `group`, then by `subgroup`. Order follows `commandDescriptors` (first insertion wins); there is no separate ordering list.

## Modifying Output

All preview, result and report text comes from apx-core's renderers (`renderGenerationPlan`, `renderGenerationResult`, `renderDeadCodeReport`). `src/runner/render.ts` only appends lines, builds the overwrite-modal detail, and diffs reports. Change wording in apx-core.

## Testing Your Changes

### Unit tests

```bash
npm test
```

See [testing.md](testing.md).

### Manual testing

1. Run `npm run watch`, then press F5 to launch the Extension Development Host.
2. Open a folder containing `sfdx-project.json`.
3. Run the command from the Command Palette or sidebar.
4. Verify the prompts, the preview in the `Apx` output channel, the modal, and the written files.

## Development Workflow

1. Make the change (in apx-core first, if it affects commands or inputs).
2. If descriptors changed: bump the pin and run `npm run sync:contributes`.
3. `npm run check-types`
4. `npm run lint`
5. `npm test`
6. Test in the Extension Development Host (F5).

## Troubleshooting

### New command doesn't appear

1. Check the apx-core pin includes the descriptor.
2. Check `commandTable.ts` has an entry (activation logs `No VS Code command id mapped for apx-core descriptor` to the `Apx` channel otherwise).
3. Check `npm run sync:contributes` updated `package.json`.
4. Restart the Extension Development Host.

### Picker doesn't show

1. Check the option has a `uiHints` entry in apx-core.
2. Check `InputKind` and `gatherOne()` handle the kind.

## Resources

- [Architecture Overview](architecture.md)
- [Input System](input-system.md)
- [Command Runner](command-runner.md)
- [Command Registry](command-registry.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [apx](https://github.com/Syntax-Syllogism/apx) / [apx-core](https://github.com/Syntax-Syllogism/apx-core)
