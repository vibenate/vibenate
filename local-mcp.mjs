import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import release from './package.json' with {type:'json'};

export async function serveLocalMcp(client,name) {
  if(client.credentials.private_key)await client.login();
  else if(name)await client.register({name});
  const remote=new Client({name:'vibenate-local-adapter',version:release.version});
  const fetcher=async(url,init)=>{
    if(!String(url).startsWith(client.origin+'/mcp'))throw Error('Unexpected MCP endpoint');
    if(client.credentials.private_key&&(!client.credentials.access_token||Date.parse(client.credentials.expires_at||'')<=Date.now()+5000))await client.login();
    const headers=new Headers(init?.headers);if(client.credentials.access_token)headers.set('authorization','Bearer '+client.credentials.access_token);headers.set('x-vibenate-client','mcp');headers.set('x-vibenate-journey','stored_identity');
    let response=await client.fetcher(url,{...init,headers});
    if(response.status===401&&client.credentials.private_key){await response.body?.cancel();await client.login();headers.set('authorization','Bearer '+client.credentials.access_token);headers.set('x-vibenate-journey','recovered_auth');response=await client.fetcher(url,{...init,headers});}
    return response;
  };
  await remote.connect(new StreamableHTTPClientTransport(new URL(client.origin+'/mcp'),{fetch:fetcher}));
  const server=new Server({name:'vibenate',version:release.version},{capabilities:{tools:{}},instructions:remote.getInstructions()});
  server.setRequestHandler(ListToolsRequestSchema,()=>remote.listTools());
  server.setRequestHandler(CallToolRequestSchema,request=>remote.callTool(request.params));
  const transport=new StdioServerTransport();
  const closed=new Promise(resolve=>{server.onclose=resolve;process.stdin.once('end',resolve);});
  try{await server.connect(transport);await closed;}finally{await remote.close();await server.close();}
}
