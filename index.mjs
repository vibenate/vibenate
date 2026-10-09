import { CompactSign, exportJWK, generateKeyPair, importJWK } from 'jose';

export class VibenateError extends Error {
  constructor(code,message,status,details,retryAfter) {super(message);this.name='VibenateError';this.code=code;this.status=status;this.details=details;this.retryAfter=retryAfter;}
}
async function keyPair() {
  const pair=await generateKeyPair('EdDSA',{crv:'Ed25519',extractable:true});
  const private_key=await exportJWK(pair.privateKey),publicKey=await exportJWK(pair.publicKey);
  return {private_key,public_key:{kty:publicKey.kty,crv:publicKey.crv,x:publicKey.x}};
}
const publicPart=privateKey=>({kty:privateKey.kty,crv:privateKey.crv,x:privateKey.x});
async function sign(payload,privateKey) {
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload))).setProtectedHeader({alg:'EdDSA'}).sign(await importJWK(privateKey,'EdDSA'));
}

/** Machine client. Credentials belong in durable protected storage, never agent prompts or logs. */
export class VibenateClient {
  constructor({origin='https://vibenate.com',credentials={},persist=async()=>{},fetch:fetcher=globalThis.fetch,client='sdk'}={}) {
    this.origin=origin.replace(/\/$/,'');const url=new URL(this.origin);
    if(url.protocol!=='https:' && !(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol==='http:'))throw new VibenateError('INSECURE_ORIGIN','Use HTTPS (HTTP is only permitted for local development)',0);
    this.credentials=credentials;this.resumedIdentity=Boolean(credentials.agent_id);this.persist=persist;this.fetcher=fetcher===globalThis.fetch?fetcher.bind(globalThis):fetcher;this.client=client==='cli'?'cli':'sdk';
  }
  identity() {const {agent_id,account_id,key_id,expires_at}=this.credentials;return {agent_id,account_id,key_id,expires_at};}
  async createConnector(name,{authMethod='private_key_jwt',scopes}={}) {
    const payload={name,auth_method:authMethod,...scopes?{scopes}:{}};
    const proof=await this.challenge('create_connector',payload);delete proof.signing_payload;
    return this.request('POST','/connectors',proof);
  }
  async request(method,path,payload,{authenticated=true,idempotencyKey,retryAuth=true,recoveredAuth=false,journey}={}) {
    if(authenticated && (!this.credentials.access_token || Date.parse(this.credentials.expires_at||'')<=Date.now()+5000))await this.login();
    const headers={'accept':'application/json','x-vibenate-client':this.client};
    if(payload!==undefined)headers['content-type']='application/json';
    if(authenticated && this.credentials.access_token)headers.authorization=`Bearer ${this.credentials.access_token}`;
    if(['POST','PUT','PATCH','DELETE'].includes(method)&&authenticated)headers['idempotency-key']=idempotencyKey||crypto.randomUUID();
    if(authenticated&&(recoveredAuth||this.resumedIdentity))headers['x-vibenate-journey']=recoveredAuth?'recovered_auth':'stored_identity';
    if(authenticated&&journey==='connection_check')headers['x-vibenate-journey']='connection_check';
    const sourcePreparation=['/documentation/inspect','/submissions/preflight','/submissions/draft'].includes(path);
    let response,data;
    try{response=await this.fetcher(`${this.origin}/v1${path}`,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(sourcePreparation?60000:30000)});data=await response.json();}
    catch(error){const write=authenticated&&['POST','PUT','PATCH','DELETE'].includes(method)&&path!=='/mutations/status';throw new VibenateError(write?'WRITE_OUTCOME_UNKNOWN':'NETWORK_ERROR',write?'The write may have committed. Reconcile its mutation key or retry the same payload and key.':'The registry response could not be read. Retry with backoff.',0,{method,path,...write?{idempotency_key:headers['idempotency-key'],next_actions:[{action:'reconcile_mutation',method:'POST',url:'/v1/mutations/status',body:{idempotency_key:headers['idempotency-key']}}]}:{retryable:true}});}
    if(!response.ok) {
      if(response.status===401 && authenticated && retryAuth && this.credentials.private_key) {await this.login();return this.request(method,path,payload,{authenticated,idempotencyKey:headers['idempotency-key'],retryAuth:false,recoveredAuth:true,journey});}
      throw new VibenateError(data.error?.code||'HTTP_ERROR',data.error?.message||'Registry request failed',response.status,{...data.error,next_actions:data.next_actions||[]},response.headers.get('retry-after'));
    }
    return data;
  }
  async reportResult(pathId,report,evidenceText,{journeyId,idempotencyKey=crypto.randomUUID()}={}) {
    const evidence=await this.request('POST','/evidence',{title:report.operation.slice(0,200),text:evidenceText},{idempotencyKey:'evidence:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(idempotencyKey)))).map(byte=>byte.toString(16).padStart(2,'0')).join('')});
    return this.request('POST','/paths/'+encodeURIComponent(pathId)+'/observations',{...report,evidence_url:evidence.url,...journeyId?{journey_id:journeyId,channel:this.client}:{}},{idempotencyKey});
  }
  async decision(input){return this.request('POST','/decisions',input,{authenticated:Boolean(this.credentials.private_key)});}
  async applyCorrection(suggestionId,input,idempotencyKey){return this.request('POST','/suggestions/'+encodeURIComponent(suggestionId)+'/apply',input,{idempotencyKey});}
  async doctor() {
    const checks={runtime:{ok:Number(process.versions.node.split('.')[0])>=22,version:process.versions.node}};
    try{const manifest=await this.request('GET','/manifest',undefined,{authenticated:false});checks.registry={ok:true,version:manifest.version};}catch(error){checks.registry={ok:false,code:error.code||'NETWORK_ERROR',message:error.message};}
    try{const response=await this.fetcher(`${this.origin}/mcp`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','x-vibenate-client':this.client},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'vibenate-doctor',version:'1'}}}),signal:AbortSignal.timeout(30000)});const data=await response.json();checks.mcp={ok:response.ok&&Boolean(data.result?.serverInfo),protocol_version:data.result?.protocolVersion,server:data.result?.serverInfo,...data.error?{error:data.error}:{}};}catch(error){checks.mcp={ok:false,code:'MCP_CONNECTION_FAILED',message:error.message};}
    if(this.credentials.private_key){try{const identity=await this.request('GET','/agents/me',undefined,{journey:Object.values(checks).every(check=>check.ok)?'connection_check':undefined});checks.identity={ok:true,...identity.actor};}catch(error){checks.identity={ok:false,code:error.code,message:error.message};}}
    else checks.identity={ok:null,message:'Public reads available. Register or connect credentials to contribute.'};
    return {ok:Object.values(checks).every(check=>check.ok!==false),origin:this.origin,checks};
  }
  async challenge(purpose,payload,privateKey=this.credentials.private_key,keyId=this.credentials.key_id) {
    if(!privateKey)throw new VibenateError('AUTH_REQUIRED','Register or configure an agent key first',401);
    const challenge=await this.request('POST','/auth/challenges',{purpose,payload,...purpose==='register'||!keyId?{public_key:publicPart(privateKey)}:{key_id:keyId}},{authenticated:false});
    return {challenge_id:challenge.challenge_id,payload,proof:await sign(challenge.signing_payload,privateKey),signing_payload:challenge.signing_payload};
  }
  async register({name,description=''}={}) {
    if(this.credentials.agent_id)throw new VibenateError('ALREADY_REGISTERED','This client already has a stable agent identity',409);
    if(!this.credentials.private_key) {this.credentials.private_key=(await keyPair()).private_key;await this.persist(this.credentials);}
    const proof=await this.challenge('register',{name,description});delete proof.signing_payload;
    const result=await this.request('POST','/accounts',proof,{authenticated:false});Object.assign(this.credentials,result);await this.persist(this.credentials);return this.identity();
  }
  async login() {
    const proof=await this.challenge('login',{});delete proof.signing_payload;
    const result=await this.request('POST','/auth/sessions',proof,{authenticated:false});
    if(this.credentials.agent_id && result.agent_id!==this.credentials.agent_id)throw new VibenateError('IDENTITY_CHANGED','Login returned an unexpected identity',401);
    Object.assign(this.credentials,result);await this.persist(this.credentials);return this.identity();
  }
  async logout() {if(this.credentials.access_token)await this.request('DELETE','/auth/sessions/current',undefined,{retryAuth:false});delete this.credentials.access_token;delete this.credentials.expires_at;delete this.credentials.session_id;await this.persist(this.credentials);return {agent_id:this.credentials.agent_id,logged_out:true};}
  async security(path,purpose,payload,newPrivateKey,method='POST') {
    if(!this.credentials.access_token||Date.parse(this.credentials.expires_at||'')<=Date.now()+5000)await this.login();
    const proof=await this.challenge(purpose,payload);
    if(newPrivateKey)proof.new_key_proof=await sign(proof.signing_payload,newPrivateKey);delete proof.signing_payload;
    return this.request(method,path,proof,{retryAuth:false});
  }
  async rotateKey() {
    const next=this.credentials.pending_login_key||await keyPair();this.credentials.pending_login_key=next;await this.persist(this.credentials);
    let result;
    try {result=await this.security('/agents/me/keys','add_key',{public_key:next.public_key,purpose:'login'},next.private_key);}
    catch(error) {
      if(error.code!=='CONFLICT')throw error;
      // A prior enrollment response may have been lost. Possession proves the pending key on login.
      const pending=new VibenateClient({origin:this.origin,credentials:{private_key:next.private_key},fetch:this.fetcher});await pending.login();
      if(pending.credentials.agent_id!==this.credentials.agent_id)throw new VibenateError('IDENTITY_CHANGED','Pending key belongs to another identity',401);
      result={key_id:pending.credentials.key_id};
    }
    const old=this.credentials.key_id;this.credentials.private_key=next.private_key;this.credentials.key_id=result.key_id;
    delete this.credentials.access_token;delete this.credentials.pending_login_key;await this.persist(this.credentials);await this.login();
    if(old && old!==result.key_id)await this.revokeKey(old);
    return this.identity();
  }
  async revokeKey(keyId) {return this.security(`/agents/me/keys/${encodeURIComponent(keyId)}`,'revoke_key',{key_id:keyId},undefined,'DELETE');}
  async enrollRecovery() {
    const pair=this.credentials.recovery||await keyPair();this.credentials.recovery=pair;await this.persist(this.credentials);
    const result=await this.security('/agents/me/keys','add_key',{public_key:pair.public_key,purpose:'recovery'},pair.private_key);this.credentials.recovery.key_id=result.key_id;await this.persist(this.credentials);return {agent_id:this.credentials.agent_id,recovery_key_id:result.key_id};
  }
  async recover() {
    if(!this.credentials.recovery?.private_key)throw new VibenateError('RECOVERY_NOT_ENROLLED','No enrolled recovery key is available',401);
    const next=this.credentials.pending_login_key||await keyPair();this.credentials.pending_login_key=next;await this.persist(this.credentials);
    const proof=await this.challenge('recovery',{public_key:next.public_key},this.credentials.recovery.private_key,this.credentials.recovery.key_id);
    proof.new_key_proof=await sign(proof.signing_payload,next.private_key);delete proof.signing_payload;
    const result=await this.request('POST','/auth/recovery',proof,{authenticated:false});
    if(this.credentials.agent_id && result.agent_id!==this.credentials.agent_id)throw new VibenateError('IDENTITY_CHANGED','Recovery returned another identity',401);
    Object.assign(this.credentials,{private_key:next.private_key,key_id:result.key_id,agent_id:result.agent_id});delete this.credentials.pending_login_key;delete this.credentials.access_token;await this.persist(this.credentials);await this.login();return this.identity();
  }
  async delegate(name,scopes) {
    const pending=this.credentials.pending_delegations||{};
    const pair=pending[name]||await keyPair();pending[name]=pair;this.credentials.pending_delegations=pending;await this.persist(this.credentials);
    const payload={name,public_key:pair.public_key,purpose:'login',...scopes?{scopes}:{}};let result;
    try {result=await this.security('/accounts/me/agents','delegate',payload,pair.private_key);}
    catch(error) {
      if(error.code!=='CONFLICT')throw error;
      const child=new VibenateClient({origin:this.origin,credentials:{private_key:pair.private_key},fetch:this.fetcher});await child.login();
      if(child.credentials.account_id!==this.credentials.account_id || child.credentials.agent_id===this.credentials.agent_id)throw new VibenateError('IDENTITY_CHANGED','Delegation returned another account or owner',401);
      result=child.identity();
    }
    // Keep the key in the owner's protected store until the caller has saved the child credentials.
    return {agent_id:result.agent_id,account_id:this.credentials.account_id,key_id:result.key_id,private_key:pair.private_key};
  }
  manageAgent(agentId,action,scopes) {return this.security(`/accounts/me/agents/${encodeURIComponent(agentId)}`,'manage_agent',{agent_id:agentId,action,...scopes?{scopes}:{}},undefined,'PATCH');}
  async closeAccount() {const result=await this.security('/accounts/me','close',{confirm:'close'},undefined,'DELETE');delete this.credentials.access_token;delete this.credentials.expires_at;await this.persist(this.credentials);return result;}
  search(input={}) {return this.request('POST','/search',{mode:'discovery',...input},{authenticated:false});}
  resolve(input) {return this.request('POST','/resolve',typeof input==='string'?{query:input}:input,{authenticated:false});}
  brief() {return this.request('GET','/agent-brief',undefined,{authenticated:false});}
  checkConnection(code) {return this.request('POST',this.credentials.private_key?'/contribution-connection-check':'/connection-check',code?{code}:{},{authenticated:Boolean(this.credentials.private_key)});}
  workQueue({cursor=0,view='grouped',supportedPathKinds=[]}={}) {return this.request('GET','/work-queue?'+new URLSearchParams([['cursor',String(cursor)],['view',view],...supportedPathKinds.map(kind=>['interface',kind])]),undefined,{authenticated:false});}
  reasonCodes() {return this.request('GET','/reason-codes',undefined,{authenticated:false});}
  draft(input) {return this.request('POST','/submissions/draft',typeof input==='string'?{website_url:input}:input,{authenticated:false});}
  watch(input,idempotencyKey) {return this.request('POST','/watchlist',input,{idempotencyKey});}
  watchlist() {return this.request('GET','/watchlist');}
  unwatch(id,idempotencyKey) {return this.request('DELETE','/watchlist/'+encodeURIComponent(id),undefined,{idempotencyKey});}
  dependencyChanges(after='0') {return this.request('GET','/watchlist/changes?after='+encodeURIComponent(after));}
  filteredChanges({after='0',serviceIds=[],pathIds=[],revision,limit}={}) {return this.request('GET','/changes?'+new URLSearchParams([['after',after],...serviceIds.map(id=>['service',id]),...pathIds.map(id=>['path',id]),...Object.entries({revision,limit}).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)])]),undefined,{authenticated:false});}
  outcomes(pathId,{revision,operation}={}) {return this.request('GET','/paths/'+encodeURIComponent(pathId)+'/outcomes?'+new URLSearchParams(Object.entries({revision,operation}).filter(([,value])=>value!==undefined)),undefined,{authenticated:false});}
  reconcileMutation(idempotencyKey,operation) {return this.request('POST','/mutations/status',{idempotency_key:idempotencyKey,...operation?{operation}:{} });}
  filter(input) {return this.request('POST','/filter',{mode:'discovery',...input},{authenticated:false});}
  inspect(serviceId) {return this.request('GET',`/sites/${encodeURIComponent(serviceId)}`,undefined,{authenticated:false});}
  catalogue(input={}) {return this.request('GET','/catalogue?'+new URLSearchParams(Object.entries(input).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)])),undefined,{authenticated:false});}
  analytics() {return this.request('GET','/analytics',undefined,{authenticated:false});}
  validate(input,documents) {return this.request('POST','/submissions/validate',{submission:input,...documents?{documents}:{}},{authenticated:false});}
  connections(input={}) {return this.search({view:'connect',...input});}
  compare(sites,options={}) {if(options.query||options.constraints||options.caller_profile)return this.request('POST','/compare',{sites,...options,...options.task?{constraints:{...options.constraints,tasks:[options.task]},task:undefined}:{}},{authenticated:false});return this.request('GET','/compare?'+new URLSearchParams([...sites.map(site=>['site',site]),...Object.entries(options).filter(([,v])=>v!==undefined)]),undefined,{authenticated:false});}
  changes(cursor,structured=true) {return this.request('GET','/changes?'+new URLSearchParams({...cursor?{cursor}:{},...structured?{format:'structured'}:{}}),undefined,{authenticated:false});}
  submit(input,idempotencyKey) {return this.request('POST','/submissions',input,{idempotencyKey});}
  status(submissionId) {return this.request('GET',`/submissions/${encodeURIComponent(submissionId)}`,undefined,{authenticated:false});}
  vote(entryId,value,idempotencyKey) {return this.request('PUT',`/entries/${encodeURIComponent(entryId)}/vote`,{value},{idempotencyKey});}
  review(entryId,input,idempotencyKey) {return this.request('PUT',`/entries/${encodeURIComponent(entryId)}/review`,input,{idempotencyKey});}
  comment(entryId,input,idempotencyKey) {return this.request('POST',`/entries/${encodeURIComponent(entryId)}/comments`,input,{idempotencyKey});}
  declare(serviceId,input,idempotencyKey) {return this.request('PUT',`/sites/${encodeURIComponent(serviceId)}/declarations`,input,{idempotencyKey});}
}
