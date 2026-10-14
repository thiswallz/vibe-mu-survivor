import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ui=path.dirname(fileURLToPath(import.meta.url));
export async function build(){
 const dist=path.join(ui,'dist');
 await rm(dist,{recursive:true,force:true});
 await cp(path.join(ui,'public'),dist,{recursive:true});
 await mkdir(path.join(dist,'shared'),{recursive:true});
 await cp(path.join(ui,'../../packages/game/src'),path.join(dist,'shared'),{recursive:true});
 await cp(path.join(ui,'../../packages/game/src/index.js'),path.join(dist,'shared/game.js'));
 console.log('UI built: apps/ui/dist (assets and shared game logic included)');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
