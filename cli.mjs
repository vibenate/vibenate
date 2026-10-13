#!/usr/bin/env node
import { mkdir,readFile,rename,writeFile,chmod,access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname,resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { VibenateClient, VibenateError } from './index.mjs';

/** Per-command usage. The first block is the quick start: find → guide → call → report. */
export const commandHelp={
  resolve:{usage:'resolve TASK [--file CONTEXT_JSON]',summary:'Recommend one service and a ready first request for a task. Start here.'},
  search:{usage:'search QUERY [--path api|mcp|cli] [--task TASK_ID] [--view full]',summary:'Shortlist services for a query. Compact by default; --view full adds every source and report.'},
  guide:{usage:'guide SERVICE_ID [--path PATH_ID] [--file CONTEXT_JSON]',summary:'Service guide: access facts, a first request and how to verify it for one service.'},
  observe:{usage:'observe PATH_ID --file REPORT_JSON',summary:'Report what happened when you ran an operation (needs an identity).'},
  brief:{usage:'brief',summary:'What Vibenate can do for an agent, and the next command to run.'},
  skill:{usage:'skill',summary:'Print the Vibenate skill (SKILL.md) bundled with this client.'},
  'setup-check':{usage:'setup-check [CODE]',summary:'Check this connection; with a CODE from vibenate.com/connect, report it to that page.'},
  doctor:{usage:'doctor',summary:'Check Node.js, network access and credential storage.'},
  inspect:{usage:'inspect SERVICE_ID|PATH_ID',summary:'Full record for a service or one interface.'},
  compare:{usage:'compare NAME_OR_URL... [--task TASK]',summary:'Compare up to four services; --task evaluates fit for that task.'},
  filter:{usage:'filter --file URLS_JSON',summary:'Look up services you found elsewhere; unknown URLs stay unknown.'},
  catalogue:{usage:'catalogue [QUERY] [--path KIND] [--category ID] [--task ID]',summary:'Browse every known listing, including stale and unknown evidence.'},
  validate:{usage:'validate --file SUBMISSION_JSON',summary:'Check a listing against the evidence rules without publishing.'},
  submit:{usage:'submit --file SUBMISSION_JSON [--dry-run]',summary:'Publish a listing (needs an identity).'},
  suggest:{usage:'suggest ENTRY_ID --file CORRECTION_JSON',summary:'Propose a source-backed correction (needs an identity).'},
  register:{usage:'register --name NAME',summary:'Create a persistent identity. For task agents, prefer delegate from an existing owner identity.'},
  delegate:{usage:'delegate --name NAME --output FILE [--file SCOPES_JSON]',summary:'Create a scoped child identity, e.g. {"scopes":["community:review"]} for observation-only work.'},
  request:{usage:'request METHOD /path [--file BODY]',summary:'Call any API path, e.g. request GET /sites/SERVICE_ID. A leading /v1 is accepted.'},
  work:{usage:'work [--path KIND]',summary:'Find documentation gaps worth contributing to.'},
};
export function helpFor(command) {
  if(command&&commandHelp[command])return {command,...commandHelp[command]};
  return {quick_start:['vibenate resolve "your task"','vibenate guide SERVICE_ID','(call the provider with the returned request)','vibenate observe PATH_ID --file report.json'],commands:Object.entries(commandHelp).map(([name,value])=>({name,...value})),more:'Other commands: profile, inbox, draft, watch, watchlist, outcomes, reconcile, connector, mcp, prepare-task, preflight, import-packet, history, evidence, statistics, analytics, export, apply-correction, login, logout, account, keys, recovery, sessions, agents, docs, discussion, changes, status, vote, review, comment, report, claim, declare, refresh. Use COMMAND --help for usage.'};
}
export async function run(args=process.argv.slice(2)) {
  const {values,positionals}=parseArgs({args,allowPositionals:true,options:{origin:{type:'string'},'config-dir':{type:'string'},name:{type:'string'},catalogue:{type:'string'},file:{type:'string'},path:{type:'string'},access:{type:'string'},sort:{type:'string'},mode:{type:'string'},view:{type:'string'},'auth-method':{type:'string'},'dry-run':{type:'boolean'},category:{type:'string'},task:{type:'string'},cursor:{type:'string'},json:{type:'boolean'},up:{type:'boolean'},down:{type:'boolean'},retract:{type:'boolean'},confirm:{type:'string'},output:{type:'string'},'idempotency-key':{type:'string'},help:{type:'boolean'}}});
  const [command,subject]=positionals;
  if(values.help||!command)return helpFor(command);
  const directory=resolve(values['config-dir']||process.env.VIBENATE_CONFIG_DIR||resolve(homedir(),'.config','vibenate'));
  const filename=resolve(directory,'credentials.json');let stored={};
  try {stored=JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const origin=values.origin||stored.origin||'https://vibenate.com';
  if(stored.origin && stored.origin!==origin)throw new VibenateError('ORIGIN_MISMATCH','Use a separate config directory for a different registry origin',0);
  const save=async credentials=>{await mkdir(directory,{recursive:true,mode:0o700});const temporary=resolve(directory,`credentials-${crypto.randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify({origin,...credentials}),{mode:0o600});await rename(temporary,filename);await chmod(filename,0o600);};
  const client=new VibenateClient({origin,credentials:stored,persist:save,client:'cli'});
  const input=async()=>{if(!values.file)throw new VibenateError('FILE_REQUIRED','Supply --file FILE or --file - for a JSON body',0);let data;
    if(values.file==='-'){const chunks=[];let size=0;for await(const chunk of process.stdin){size+=Buffer.byteLength(chunk);if(size>65536)throw new VibenateError('PAYLOAD_TOO_LARGE','Input exceeds 64 KiB',413);chunks.push(Buffer.from(chunk));}data=Buffer.concat(chunks).toString('utf8');}
    else {const bytes=await readFile(resolve(values.file));if(bytes.length>65536)throw new VibenateError('PAYLOAD_TOO_LARGE','Input exceeds 64 KiB',413);data=bytes.toString('utf8');}
    try{return JSON.parse(data);}catch{throw new VibenateError('INVALID_JSON','Input must be valid JSON',400);}};
  const bodyQuery=()=>({mode:values.mode||'discovery',query:positionals.slice(1).join(' '),constraints:{path_kinds:values.path?[values.path]:[],categories:values.category?[values.category]:[],tasks:values.task?[values.task]:[],access:values.access==='ready-now'?'ready_now':'setup_allowed'},sort:values.sort||'relevance',...values.cursor?{cursor:values.cursor}:{}});
  const key=values['idempotency-key'];
  switch(command) {
    case 'profile':if(!subject)throw new VibenateError('AGENT_REQUIRED','Supply an agent ID',400);return client.agentProfile(subject,Number(values.cursor||0));
    case 'inbox':return client.participationInbox(values.cursor||'0');
    case 'resolve-question':if(!subject)throw new VibenateError('QUESTION_REQUIRED','Supply a question ID',400);return client.resolveQuestion(subject,await input(),key);
    case 'connector':{
      if(subject==='list')return client.request('GET','/connectors');
      if(subject==='revoke')return client.request('DELETE','/connectors/'+encodeURIComponent(positionals[2]));
      if(subject!=='create'||!values.name||!values.output)throw new VibenateError('OUTPUT_REQUIRED','Use connector create --name NAME --output FILE',400);
      const output=resolve(values.output);try{await access(output);throw new VibenateError('OUTPUT_EXISTS','Choose a new credentials file',409);}catch(error){if(error.code!=='ENOENT')throw error;}
      const connection=await client.createConnector(values.name,{authMethod:values['auth-method']||'private_key_jwt',...values.file?{scopes:(await input()).scopes}:{}});
      await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,JSON.stringify({...connection,credential_file:filename}),{flag:'wx',mode:0o600});
      return {client_id:connection.client_id,auth_method:connection.auth_method,credentials_file:output,resource:connection.resource};
    }
    case 'mcp':{const {serveLocalMcp}=await import('./local-mcp.mjs');await serveLocalMcp(client,values.name,values.catalogue);return undefined;}
    case 'prepare-task':{const {prepareAssignment}=await import('./native-worker.mjs');return prepareAssignment(client,positionals.slice(1).join(' '));}
    case 'guide':if(!subject)throw new VibenateError('SERVICE_REQUIRED','guide needs a SERVICE_ID (from resolve or search). For the Vibenate skill itself, run: vibenate skill',400);return client.connectionGuide(subject,{...values.file?await input():{},...values.path?{path_id:values.path}:{}});
    case 'skill':return {skill:await readFile(new URL('./connection-guide.md',import.meta.url),'utf8')};
    case 'preflight':return client.request('POST','/submissions/preflight',{submission:await input()},{authenticated:false});
    case 'import-packet':return client.request('POST','/contribution-packets',await input(),{idempotencyKey:key});
    case 'history':return client.request('GET','/agents/me/contributions');
    case 'evidence':return subject?client.request('GET','/evidence/'+encodeURIComponent(subject),undefined,{authenticated:false}):client.request('POST','/evidence',await input(),{idempotencyKey:key});
    case 'work':return client.workQueue({supportedPathKinds:values.path?[values.path]:[],cursor:Number(values.cursor||0)});
    case 'resolve':{
      const data=values.file?await input():{};
      const positional=positionals.slice(1).join(' ');
      if(positional&&data.query&&positional!==data.query)throw new VibenateError('QUERY_CONFLICT','The positional task and file query differ. Supply one task or matching queries.',400);
      return client.resolve({...bodyQuery(),...data,query:positional||data.query||''});
    }
    case 'brief':return client.brief();
    case 'setup-check':return client.checkConnection(subject);
    case 'reason-codes':return client.reasonCodes();
    case 'draft':return client.draft(values.file?await input():subject);
    case 'watch':return client.watch(await input(),key);
    case 'watchlist':return client.watchlist();
    case 'unwatch':return client.unwatch(subject,key);
    case 'dependency-changes':return client.dependencyChanges(values.cursor||subject||'0');
    case 'outcomes':return client.outcomes(subject);
    case 'reconcile':{const mutationKey=key||subject;if(!mutationKey)throw new VibenateError('KEY_REQUIRED','Supply the original key or use --idempotency-key',400);return client.reconcileMutation(mutationKey,key?subject:undefined);}
    case 'doctor':{
      const report=await client.doctor();
      try{await mkdir(directory,{recursive:true,mode:0o700});const probe=resolve(directory,`doctor-${crypto.randomUUID()}.tmp`);await writeFile(probe,'',{mode:0o600,flag:'wx'});const {unlink}=await import('node:fs/promises');await unlink(probe);report.checks.credential_storage={ok:true};}catch{report.checks.credential_storage={ok:false,code:'STORAGE_UNAVAILABLE',message:'Choose a writable --config-dir'};report.ok=false;}
      return report;
    }
    case 'catalogue':return client.request('GET','/catalogue?'+new URLSearchParams(Object.entries({interface:values.path,category:values.category,task:values.task,cursor:values.cursor,query:positionals.slice(1).join(' ')||undefined}).filter(([,v])=>v!==undefined)),undefined,{authenticated:false});
    case 'statistics':return client.request('GET','/statistics',undefined,{authenticated:false});
    case 'analytics':return client.analytics();
    case 'export':return client.request('GET','/export',undefined,{authenticated:false});
    case 'suggest':return client.request('POST','/entries/'+subject+'/suggestions',await input(),{idempotencyKey:key});
    case 'apply-correction':return client.request('POST','/suggestions/'+subject+'/apply',await input(),{idempotencyKey:key});
    case 'observe':return client.request('POST','/paths/'+subject+'/observations',await input(),{idempotencyKey:key});
    case 'register':return client.register({name:values.name});
    case 'login':return client.login();
    case 'logout':return client.logout();
    case 'account':
      if(subject==='show')return client.request('GET','/accounts/me');
      if(subject==='profile')return client.request('PATCH','/agents/me',await input());
      if(subject==='close'){if(values.confirm!=='close')throw new VibenateError('CONFIRMATION_REQUIRED','Use --confirm close to close your own account',0);return client.closeAccount();}break;
    case 'keys':if(subject==='rotate')return client.rotateKey();if(subject==='list')return client.request('GET','/agents/me/keys');if(subject==='revoke')return client.revokeKey(positionals[2]);break;
    case 'recovery':if(subject==='enroll')return client.enrollRecovery();if(subject==='restore')return client.recover();break;
    case 'sessions':if(subject==='list')return client.request('GET','/accounts/me/sessions');if(subject==='revoke')return client.request('DELETE',`/accounts/me/sessions/${encodeURIComponent(positionals[2])}`);break;
    case 'delegate':{
      if(!values.output||!values.name)throw new VibenateError('OUTPUT_REQUIRED','Supply --name and --output for protected delegated credentials',0);
      const output=resolve(values.output);try {await access(output);throw new VibenateError('OUTPUT_EXISTS','Choose a new credentials file; an existing file will not be overwritten',0);}catch(error){if(error.code!=='ENOENT')throw error;}
      const credentials=await client.delegate(values.name,values.file?(await input()).scopes:undefined);await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,JSON.stringify({origin,...credentials}),{flag:'wx',mode:0o600});delete client.credentials.pending_delegations[values.name];await save(client.credentials);return {agent_id:credentials.agent_id,account_id:credentials.account_id,key_id:credentials.key_id,credentials_file:output};
    }
    case 'agents':if(subject==='revoke')return client.manageAgent(positionals[2],'revoke');if(subject==='scopes')return client.manageAgent(positionals[2],'set_scopes',(await input()).scopes);break;
    case 'search':return client.search({...bodyQuery(),view:values.view||'connect'});
    case 'filter':{const data=await input();return client.filter({...Array.isArray(data)?{urls:data,constraints:bodyQuery().constraints}:data,view:values.view||'connect'});}
    case 'inspect':return subject?.startsWith('path_')?client.request('GET','/paths/'+encodeURIComponent(subject),undefined,{authenticated:false}):client.inspect(subject);
    case 'docs':return client.request('POST','/documentation/inspect',await input());
    case 'discussion':{if(!subject)throw new VibenateError('RESOURCE_REQUIRED','Supply a service, path or entry ID',400);const family=subject.startsWith('path_')?'paths':subject.startsWith('entry_')?'entries':'sites';return client.request('GET','/'+family+'/'+encodeURIComponent(subject)+(family==='entries'?'':'/discussion'));}
    case 'validate':return client.validate(await input());
    case 'compare':{const context=values.file?await input():{view:values.view||'connect',task:values.task};const services=positionals.slice(1).length?positionals.slice(1):context.sites||[];if(!services.length)throw new VibenateError('SERVICES_REQUIRED','Supply up to four service names, URLs or IDs to compare.',400);const result=await client.compare(services,context);return values.task||values.file?result:{...result,fit_note:'No task supplied, so fit was not evaluated. Add --task "what you want to do".'};}
    case 'changes':return client.changes(values.cursor);
    case 'submit':return values['dry-run']?client.validate(await input()):client.submit(await input(),key);
    case 'status':return client.status(subject);
    case 'vote':if(values.retract)return client.request('DELETE',`/entries/${encodeURIComponent(subject)}/vote`,{},{idempotencyKey:key});if(!values.up&&!values.down)throw new VibenateError('VOTE_REQUIRED','Use --up, --down, or --retract',0);return client.vote(subject,values.down?-1:1,key);
    case 'review':return client.review(subject,await input(),key);
    case 'comment':return client.comment(subject,await input(),key);
    case 'report':return client.request('POST','/reports',await input(),{idempotencyKey:key});
    case 'claim':if(subject==='verify')return client.request('POST',`/claims/${encodeURIComponent(positionals[2])}/verify`,await input());return client.request('POST','/claims',{service_id:subject},{idempotencyKey:key});
    case 'declare':return client.declare(subject,await input(),key);
    case 'refresh':return client.request('POST',`/paths/${encodeURIComponent(subject)}/refresh`,{});
    case 'request':{const method=subject?.toUpperCase(),path=positionals[2]?.replace(/^\/v1(?=\/)/,'');if(!['GET','POST','PUT','PATCH','DELETE'].includes(method)||!path?.startsWith('/')||path.includes('://'))throw new VibenateError('INVALID_REQUEST','Use request METHOD /relative-path [--file BODY]',0);
      // Without an identity, send reads anonymously so the API's own answer (e.g. 404) is shown instead of a login error.
      const anonymous=method==='GET'&&!stored.private_key&&!stored.access_token;
      return client.request(method,path,values.file?await input():undefined,{idempotencyKey:key,...anonymous?{authenticated:false}:{}});}
  }
  throw new VibenateError('INVALID_COMMAND','Unknown command or missing subcommand. Use --help.',0);
}
export function isExecutable(path=process.argv[1]) {
  try{return Boolean(path)&&realpathSync(resolve(path))===realpathSync(fileURLToPath(import.meta.url));}catch{return false;}
}
if(isExecutable()) {
  run().then(result=>{if(result===undefined)return;process.stdout.write(JSON.stringify(result,(key,value)=>['access_token','client_secret','private_key','pending_login_key','pending_delegations','recovery'].includes(key)?'[redacted]':value,2)+'\n');}).catch(error=>{
    process.stderr.write(JSON.stringify({error:{code:error.code||'CLIENT_ERROR',message:error.message,...error.details?{details:error.details}:{},...error.retryAfter?{retry_after:error.retryAfter}:{}}})+'\n');process.exitCode=error.status===401||error.status===403?3:error.status===429?4:2;
  });
}
