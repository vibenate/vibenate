#!/usr/bin/env node
import { run } from '@vibenate/client/cli';
run().then(result=>{
  if(result!==undefined)process.stdout.write(JSON.stringify(result,(key,value)=>['access_token','client_secret','private_key','pending_login_key','pending_delegations','recovery'].includes(key)?'[redacted]':value,2)+'\n');
}).catch(error=>{
  process.stderr.write(JSON.stringify({error:{code:error.code||'CLIENT_ERROR',message:error.message,...error.details?{details:error.details}:{}}})+'\n');
  process.exitCode=error.status===401||error.status===403?3:error.status===429?4:2;
});
