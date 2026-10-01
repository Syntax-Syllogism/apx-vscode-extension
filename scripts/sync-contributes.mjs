// Rewrites package.json contributes.commands from apx-core's descriptors and the id table.
// Run with: npm run sync:contributes
import { readFile, writeFile } from 'node:fs/promises';
import { commandDescriptors } from '@syntax-syllogism/apx-core';
import { commandTable } from '../src/registry/commandTable.ts';

const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await readFile(path, 'utf8'));
pkg.contributes.commands = commandDescriptors.map((descriptor) => {
  const presentation = commandTable[descriptor.id];
  if (!presentation) throw new Error(`No VS Code command id mapped for apx-core descriptor "${descriptor.id}"`);
  return { command: presentation.id, title: presentation.title };
});
await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
