// Glue only: all user-facing text comes from apx-core's renderers.
import * as path from 'path';
import type * as vscode from 'vscode';
import type { GenerationPreview } from '@syntax-syllogism/apx-core' with { 'resolution-mode': 'import' };

export function appendLines(output: Pick<vscode.OutputChannel, 'appendLine'>, lines: readonly string[]): void {
	for (const line of lines) { output.appendLine(line); }
}

/** Modal detail: `N new, M existing files in <baseDir>`, plus any open editors with unsaved changes that would be overwritten. */
export function overwriteDetail(preview: GenerationPreview, dirtyDocuments: readonly string[]): string {
	const existing = preview.files.filter((file) => file.status === 'exists');
	const summary = `${preview.files.length - existing.length} new, ${existing.length} existing files in ${preview.baseDir}`;
	const dirty = new Set(dirtyDocuments.map(normalize));
	const unsaved = existing.filter((file) => dirty.has(normalize(file.absolutePath))).map((file) => file.relativePath);
	return unsaved.length
		? `${summary}\n\nThese files have unsaved changes in open editors and would be overwritten:\n${unsaved.join('\n')}`
		: summary;
}

/** Lines of `after` that follow the part it shares with `before` (both newline-joined). */
export function newTrailingLines(before: string, after: string): string[] {
	const old = before.split('\n');
	const next = after.split('\n');
	let shared = 0;
	while (shared < old.length && shared < next.length && old[shared] === next[shared]) { shared++; }
	return next.slice(shared);
}

function normalize(file: string): string {
	const resolved = path.resolve(file);
	return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
