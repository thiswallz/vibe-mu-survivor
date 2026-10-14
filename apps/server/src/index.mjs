import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const production=process.argv.includes('--production');
const root=path.join(app,'apps/ui',production?'dist':'public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
if(!fs.existsSync(path.join(root,'index.html'))){console.error('UI build missing. Run npm start or npm run build first.');process.exit(1);}
const server=http.createServer((req,res)=>{
 let requested;
 try{requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
 if(requested==='/api/health'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,game:'MU Survivor',mode:production?'production':'development'}));return;
 }
 if(requested==='/api/demo'){
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({stage:'Lorencia',durationSeconds:300,characters:3,enemyTypes:5,skillsPerCharacter:2,accounts:false}));return;
 }
 const file=!production&&requested==='/shared/game.js'?path.join(app,'packages/game/src/index.js'):path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
 if(!file.startsWith(root+path.sep)&&file!==path.join(app,'packages/game/src/index.js')){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
  if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
 });
});
const port=Number(process.env.PORT||5173);
server.on('error',error=>{console.error(`Cannot start local server: ${error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`MU Survivor ready at http://localhost:${port}\n${production?'Built':'Development'} UI + local API · Ctrl+C to stop`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
