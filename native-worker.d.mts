import type { VibenateClient } from './index.mjs';
import type { Tool,CallToolResult } from '@modelcontextprotocol/sdk/types.js';
export function prepareNativeWorker(client:VibenateClient,options:{task:string;allowedWrites?:string[]}):Promise<{route:'mcp';task:string;instructions:string;tools:Tool[];guide:CallToolResult;connection:Awaited<ReturnType<VibenateClient['checkConnection']>>;identity:ReturnType<VibenateClient['identity']>;browser_provisioned:false;invoke:(name:string,args?:Record<string,unknown>)=>Promise<CallToolResult>;close:()=>Promise<void>}>;
export function prepareAssignment(client:VibenateClient,task:string):Promise<Record<string,unknown>>;
