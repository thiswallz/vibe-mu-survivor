import fs from 'node:fs';
import {configuration,createServer} from './http-server.js';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
try{
 const config=configuration();
 const production=process.argv.includes('--production')||process.env.NODE_ENV==='production';
 const server=createServer({...config,production});
 server.on('error',error=>{console.error(`Cannot start server: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1;});
 server.listen(config.port,config.host,()=>console.log(`MU Survivor listening on ${config.host}:${config.port}\n${production?'Production':'Development'} · ${config.serveUI?'UI + API':'API only'}${config.upstream?' (private API proxy)':''}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  server.close(()=>process.exit(0));
  setTimeout(()=>{server.closeAllConnections();process.exit(0);},10000).unref();
 });
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
