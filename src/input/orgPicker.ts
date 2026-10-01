import * as vscode from 'vscode';
import type { OrgChoice, OrgService } from '../core/orgService';

/** Returned by {@link pickOrg} when the user explicitly chooses to run without an org. */
export const NO_ORG = '';

interface OrgPickItem extends vscode.QuickPickItem {
	value: string;
}

export async function pickOrg(orgs: OrgService, lastValue: string | undefined, optional: boolean): Promise<string | undefined> {
	const choices: OrgPickItem[] = prioritizeOrgChoices(await orgs.listOrgs(), lastValue);
	if (optional) {
		choices.push({ label: '(none)', description: 'Run without a Salesforce org', value: NO_ORG });
	}
	const picked = await vscode.window.showQuickPick(choices, {
		ignoreFocusOut: true,
		placeHolder: optional ? 'Select a Salesforce org (optional)' : 'Select a Salesforce org',
		matchOnDescription: true,
	});

	return picked?.value;
}

export function prioritizeOrgChoices(choices: readonly OrgChoice[], lastValue?: string): OrgChoice[] {
	if (!lastValue) {
		return [...choices];
	}

	return [...choices].sort((left, right) => Number(right.value === lastValue) - Number(left.value === lastValue));
}
