import type * as CoreModule from '@syntax-syllogism/apx-core' with { 'resolution-mode': 'import' };
export type ApxCore = typeof CoreModule;
export type SfCore = typeof import('@salesforce/core');

let corePromise: Promise<ApxCore> | undefined;
let sfPromise: Promise<SfCore> | undefined;

function disableSalesforceLogs(): void {
	process.env.SF_DISABLE_LOG_FILE ??= 'true';
	process.env.SFDX_DISABLE_LOG_FILE ??= 'true';
}

export function loadApxCore(): Promise<ApxCore> {
	disableSalesforceLogs();
	return corePromise ??= import('@syntax-syllogism/apx-core');
}

export function loadSfCore(): Promise<SfCore> {
	disableSalesforceLogs();
	return sfPromise ??= import('@salesforce/core');
}
