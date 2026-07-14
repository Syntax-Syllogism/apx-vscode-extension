# Testing Guide

This extension uses VS Code's test infrastructure (`@vscode/test-cli`) and Mocha for unit testing.

## Running Tests

### Run All Tests

```bash
npm test
```

This compiles TypeScript tests, runs them with Mocha, and reports results.

### Run Tests in Watch Mode

```bash
npm run watch-tests
```

Tests recompile and re-run on file changes during development.

### Run with Coverage

The test runner is configured in `package.json`. To add coverage:

```bash
npm test -- --reporter json > test-results.json
```

Then analyze with your coverage tool.

## Test Structure

Tests are in `src/test/` and follow the same directory structure as source files:

```
src/
  extension.ts
  input/
    gatherInputs.ts
    filePicker.ts
    orgPicker.ts
  runner/
    commandRunner.ts
    sfProcess.ts
  tree/
    apxCommandsProvider.ts

src/test/
  extension.test.ts        # Main test file
  sfProcess.test.ts        # SF process spawning tests
```

## Key Test Patterns

### Mocking VS Code APIs

Tests stub VS Code interfaces to avoid UI interactions:

```typescript
const mockInputApi = {
  pickOrg: async () => 'my-org',
  pickFile: async () => undefined,     // Retained for future specialized native file prompts; unused today
  pickFolder: async () => undefined,
  pickOutputDirectory: async () => 'generated-files',
  showQuickPick: async (options) => options.items[0],
  showInputBox: async (options) => 'user input',
  showBooleanPick: async (options) => [],
  showWarningMessage: async () => undefined,
  // ...
};
```

### Mocking Child Processes

apx has no destructive commands and only one execution strategy (`StandardCommandStrategy`), so there is no dry-run → confirm → apply test pattern in this repo — that lives only in the sibling `warden-code-ext` extension, for `warden strip`.

The command runner is tested by stubbing `spawnProcess`:

```typescript
const mockSpawnProcess = (file: string, args: string[], options: SpawnOptions) => {
  const mockProcess = new EventEmitter() as ChildProcess;
  mockProcess.stdout = new PassThrough();
  mockProcess.stderr = new PassThrough();
  
  process.nextTick(() => {
    mockProcess.stdout?.emit('data', Buffer.from('command output\n'));
    mockProcess.emit('exit', 0);
  });
  
  return mockProcess;
};
```

### Testing Input Gathering

Test that `gatherInputs()` prompts for each flag and builds correct args:

```typescript
it('should gather inputs and build args', async () => {
  const command = commands[0];  // Get a test command
  const store = createMockStore();
  const inputs = await gatherInputs(command, store, mockInputApi);
  
  expect(inputs.args).toContain('--target-org=my-org');
  expect(inputs.displayArgs).toEqual(inputs.args);  // Non-sensitive args
});
```

### Testing Cancellation

Verify that user cancellation aborts the operation:

```typescript
it('should abort on user cancel', async () => {
  const mockMessages = {
    showInformationMessage: async () => undefined,  // User clicked Cancel
  };
  
  const runner = createCommandRunner({
    ...deps,
    showInformationMessage: mockMessages.showInformationMessage,
  });
  
  await runner.run(command, inputs);
  
  // Verify no spawn occurred
  expect(spawnedCommands).toHaveLength(0);
});
```

## Testing Flag Kinds

Each flag kind has corresponding tests in `extension.test.ts`:

### Org Kind

```typescript
it('should prompt for org with pickOrg', async () => {
  const mockInputApi = {
    pickOrg: async (lastValue) => {
      expect(lastValue).toBe(undefined);  // First time
      return 'my-org';
    },
    // ...
  };
  
  const inputs = await gatherInputs(command, store, mockInputApi);
  expect(inputs.args).toContain('--target-org=my-org');
});
```

### OutputDir Kind

```typescript
it('should prompt for output directory', async () => {
  const mockInputApi = {
    pickOutputDirectory: async (options) => {
      expect(options.default).toBe('generated-files');
      return 'generated-files';
    },
    // ...
  };
  
  const inputs = await gatherInputs(command, store, mockInputApi);
  expect(inputs.args).toContain('--output-path=generated-files');
});
```

### Enum Kind

```typescript
it('should prompt with enum options', async () => {
  const mockInputApi = {
    showQuickPick: async (options) => {
      expect(options.items).toContain('create');
      expect(options.items).toContain('update');
      expect(options.items).toContain('delete');
      return 'create';
    },
    // ...
  };
  
  const inputs = await gatherInputs(command, store, mockInputApi);
  expect(inputs.args).toContain('--trigger-operation=create');
});
```

### Boolean Kind

For boolean/multi-select flags tested separately via `gatherBooleanFlags()`.

## Testing the Tree View

The sidebar tree view is tested for structure and icon assignment:

```typescript
it('should organize commands into groups and subgroups', () => {
  const provider = new ApxCommandsProvider(commands);
  const rootNodes = provider.getChildren();

  const groups = rootNodes.filter((n) => n.type === 'group');
  expect(groups.some((g) => g.label === 'AEP Generation')).toBe(true);
});

it('should assign correct icons', () => {
  const provider = new ApxCommandsProvider(commands);
  const selectorCommand = commands.find((c) => c.cliId === 'apx generate selector');
  const item = provider.getTreeItem({
    type: 'command',
    command: selectorCommand,
  });

  expect(item.iconPath).toBe(new vscode.ThemeIcon('file-code'));  // AEP Generation group
});
```

## Testing Command Registry Generation

The registry generation script (`scripts/gen-commands.ts`) has its own tests:

```typescript
it('should generate valid CommandDef from oclif manifest', () => {
  const manifest = /* load test manifest */;
  const registry = generateRegistry(manifest);
  const commands = eval(registry);  // Parse generated code
  
  expect(commands).toBeDefined();
  expect(commands.length).toBeGreaterThan(0);
  expect(commands[0].id).toMatch(/^apx\./);
});
```

## Test Data

Some tests load a minimal oclif manifest from `vendor/apx.oclif.manifest.json`. This file is auto-generated from the apx plugin. If it's outdated, regenerate it:

```bash
cd ../apx-cli-plugin
npm run oclif-manifest
cp dist/manifest.json ../apx-code-ext/vendor/apx.oclif.manifest.json
```

## Coverage Goals

While full coverage is ideal, focus on:

1. **Critical paths** — Input gathering, command execution, registry generation
2. **Error handling** — SF detection failures, process spawn errors, validation
3. **Edge cases** — Empty inputs, cancellations, exclusive groups
4. **Integration** — End-to-end flows from command prompt to execution

## Common Assertions

```typescript
expect(inputs.args).toContain('--target-org=my-org');  // Arg presence
expect(inputs.args.length).toBe(5);                     // Arg count
expect(outputs.displayArgs).not.toContain('password');  // No sensitive data
expect(runner.run()).rejects.toThrow();                 // Error handling
expect(spawnedProcesses).toHaveLength(2);               // Process count
```

## Debugging Tests

### Run a Specific Test

Use Mocha's `.only()` modifier:

```typescript
it.only('should do something specific', async () => {
  // Only this test runs
});
```

### Add Debug Output

```typescript
console.log('Input API called with:', options);
```

Run tests with:

```bash
npm test 2>&1 | tee test-output.txt
```

### VS Code Test Explorer

If using VS Code's Test Explorer extension, you can run/debug individual tests from the editor.

## Integration Tests

VS Code extension tests run within the Extension Development Host environment, giving access to:

- Real VS Code APIs
- File system (workspace)
- User settings
- Terminal

This is valuable for testing end-to-end workflows, but slower than unit tests. Keep unit tests fast and focused.

## CI/CD Integration

Tests run automatically in CI (GitHub Actions) on each push. See `.github/workflows/ci.yml` for the configuration.

The CI workflow:

1. Installs dependencies
2. Runs `npm run lint` (ESLint)
3. Runs `npm run check-types` (TypeScript)
4. Runs `npm test` (Mocha)
5. Publishes coverage (if configured)

Ensure all tests pass locally before pushing.

## Adding New Tests

When adding a feature:

1. Write a failing test first (TDD)
2. Implement the feature
3. Verify the test passes
4. Run full test suite to catch regressions
5. Commit with test

Template:

```typescript
describe('My Feature', () => {
  it('should do something', async () => {
    const result = await myFeature();
    expect(result).toBe(expected);
  });

  it('should handle edge case', async () => {
    expect(() => myFeature(invalid)).toThrow();
  });
});
```
