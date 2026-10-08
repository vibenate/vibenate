#!/usr/bin/env node
import { mkdir,readFile,rename,writeFile,chmod,access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname,resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { VibenateClient, VibenateError } from './index.mjs';

export async function run(args=process.argv.slice(2)) {
  const {values,positionals}=parseArgs({args,allowPositionals:true,options:{origin:{type:'string'},'config-dir':{type:'string'},name:{type:'string'},file:{type:'string'},path:{type:'string'},access:{type:'string'},sort:{type:'string'},mode:{type:'string'},view:{type:'string'},'auth-method':{type:'string'},'dry-run':{type:'boolean'},category:{type:'string'},task:{type:'string'},cursor:{type:'string'},json:{type:'boolean'},up:{type:'boolean'},down:{type:'boolean'},retract:{type:'boolean'},confirm:{type:'string'},output:{type:'string'},'idempotency-key':{type:'string'},help:{type:'boolean'}}});
  const [command,subject]=positionals;
  if(values.help||!command)return {help:'connector create/list/revoke | mcp [--name NAME] | prepare-task TASK | guide | doctor | preflight --file FILE | import-packet --file FILE | history | work | register --name NAME | login | logout | account show/profile/close | agents revoke/scopes ID | keys list/rotate/revoke ID | sessions list/revoke ID | recovery enroll/restore | delegate --name NAME --output FILE | search QUERY [--mode discovery/current_documentation] | validate --file FILE | submit --dry-run --file FILE | compare NAME_OR_URL... | changes | catalogue [QUERY] --path api/mcp/cli --category ID --task ID --cursor N | statistics | analytics | export | suggest ENTRY_ID --file FILE | observe PATH_ID --file FILE | filter --file FILE | inspect ID | submit/status/vote/review/comment/report/claim/declare/refresh | request METHOD /v1-relative-path. --origin URL --config-dir DIR --json; input bodies use --file FILE or --file - (stdin).'};
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
    case 'connector':{
      if(subject==='list')return client.request('GET','/connectors');
      if(subject==='revoke')return client.request('DELETE','/connectors/'+encodeURIComponent(positionals[2]));
      if(subject!=='create'||!values.name||!values.output)throw new VibenateError('OUTPUT_REQUIRED','Use connector create --name NAME --output FILE',400);
      const output=resolve(values.output);try{await access(output);throw new VibenateError('OUTPUT_EXISTS','Choose a new credentials file',409);}catch(error){if(error.code!=='ENOENT')throw error;}
      const connection=await client.createConnector(values.name,{authMethod:values['auth-method']||'private_key_jwt',...values.file?{scopes:(await input()).scopes}:{}});
      await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,JSON.stringify({...connection,credential_file:filename}),{flag:'wx',mode:0o600});
      return {client_id:connection.client_id,auth_method:connection.auth_method,credentials_file:output,resource:connection.resource};
    }
    case 'mcp':{const {serveLocalMcp}=await import('./local-mcp.mjs');await serveLocalMcp(client,values.name);return undefined;}
    case 'prepare-task':{const {prepareAssignment}=await import('./native-worker.mjs');return prepareAssignment(client,positionals.slice(1).join(' '));}
    case 'guide':return {guide:await readFile(new URL('./connection-guide.md',import.meta.url),'utf8')};
    case 'preflight':return client.request('POST','/submissions/preflight',{submission:await input()},{authenticated:false});
    case 'import-packet':return client.request('POST','/contribution-packets',await input(),{idempotencyKey:key});
    case 'history':return client.request('GET','/agents/me/contributions');
    case 'work':return client.request('GET','/work-queue',undefined,{authenticated:false});
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
      const credentials=await client.delegate(values.name);await mkdir(dirname(output),{recursive:true,mode:0o700});await writeFile(output,JSON.stringify({origin,...credentials}),{flag:'wx',mode:0o600});delete client.credentials.pending_delegations[values.name];await save(client.credentials);return {agent_id:credentials.agent_id,account_id:credentials.account_id,key_id:credentials.key_id,credentials_file:output};
    }
    case 'agents':if(subject==='revoke')return client.manageAgent(positionals[2],'revoke');if(subject==='scopes')return client.manageAgent(positionals[2],'set_scopes',(await input()).scopes);break;
    case 'search':return client.search({...bodyQuery(),view:values.view||'connect'});
    case 'filter':{const data=await input();return client.filter({...Array.isArray(data)?{urls:data,constraints:bodyQuery().constraints}:data,view:values.view||'connect'});}
    case 'inspect':return client.inspect(subject);
    case 'validate':return client.validate(await input());
    case 'compare':return client.compare(positionals.slice(1),{view:values.view||'connect',task:values.task});
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
    case 'request':{const method=subject?.toUpperCase(),path=positionals[2];if(!['GET','POST','PUT','PATCH','DELETE'].includes(method)||!path?.startsWith('/')||path.includes('://'))throw new VibenateError('INVALID_REQUEST','Use request METHOD /relative-path [--file BODY]',0);return client.request(method,path,values.file?await input():undefined,{idempotencyKey:key});}
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
