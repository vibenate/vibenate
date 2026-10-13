export function helpFor(command?: string): any;
export const commandHelp: Record<string, { usage: string; summary: string }>;
export function run(args?: string[]): Promise<unknown>;
export function isExecutable(path?: string): boolean;
