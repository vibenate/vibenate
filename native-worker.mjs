import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PARENT_INSTRUCTION } from './assignment.mjs';
import release from './package.json' with {type:'json'};

/** Host adapter: connect BEFORE model dispatch, then expose only these native tools. */
export async function prepareNativeWorker(client,{task,allowedWrites=[]}={}){
  if(!task?.trim())throw Error('Supply the assigned task');
  const remote=new Client({name:'vibenate-native-worker',version:release.version});
  const fetcher=async(url,init)=>{
    if(new URL(url).origin!==client.origin||new URL(url).pathname!=='/mcp')throw Error('Unexpected MCP endpoint');
    const headers=new Headers(init?.headers);headers.set('x-vibenate-client','mcp');
    if(client.credentials.private_key){if(!client.credentials.access_token||Date.parse(client.credentials.expires_at||'')<=Date.now()+5000)await client.login();headers.set('authorization','Bearer '+client.credentials.access_token);}
    const response=await client.fetcher(url,{...init,headers});
    if(response.status===401&&client.credentials.private_key){await response.body?.cancel();await client.login();headers.set('authorization','Bearer '+client.credentials.access_token);return client.fetcher(url,{...init,headers});}
    return response;
  };
  try{
    await remote.connect(new StreamableHTTPClientTransport(new URL(client.origin+'/mcp'),{fetch:fetcher}));
    const all=await remote.listTools();
    const tools=all.tools.filter(tool=>tool.annotations?.readOnlyHint===true||allowedWrites.includes(tool.name));
    const guide=await remote.callTool({name:'get_participation_guide',arguments:{}});
    return {route:'mcp',task,instructions:PARENT_INSTRUCTION+'\n'+(remote.getInstructions()||''),tools,guide,identity:client.identity(),browser_provisioned:false,
      invoke:async(name,args={})=>{if(!tools.some(tool=>tool.name===name))throw Error('Tool not provisioned for this worker: '+name);return remote.callTool({name,arguments:args});},close:()=>remote.close()};
  }catch(error){await remote.close();throw error;}
}

/** CLI preparation report; host supplies its existing terminal capability as fallback. */
export async function prepareAssignment(client,task){
  try{const worker=await prepareNativeWorker(client,{task});try{return {route:worker.route,task,ready:true,instructions:worker.instructions,tool_names:worker.tools.map(tool=>tool.name),identity:worker.identity,browser_provisioned:false,guide:worker.guide};}finally{await worker.close();}}
  catch(error){
    if(client.credentials.private_key)await client.login(); // Auth failure must never become a guest/new identity.
    const guide=await client.request('GET','/connect',undefined,{authenticated:false});
    return {route:'cli',task,ready:true,instructions:PARENT_INSTRUCTION,identity:client.identity(),browser_provisioned:false,mcp_error:error.code||'MCP_UNAVAILABLE',commands:['vibenate search "YOUR TASK"','vibenate work','vibenate history'],guide};
  }
}
