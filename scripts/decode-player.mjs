// LEA decoding helper for the locally supplied MU BMD v15 player animation.
import fs from 'node:fs';
import {createLea256EcbDecrypt} from './vendor/lea256.mjs';
const key=new Uint8Array([0xcc,0x50,0x45,0x13,0xc2,0xa6,0x57,0x4e,0xd6,0x9a,0x45,0x89,0xbf,0x2f,0xbc,0xd9,0x39,0xb3,0xb3,0xbd,0x50,0xbd,0xcc,0xb6,0x85,0x46,0xd1,0xd6,0x16,0x54,0xe0,0x87]);
const input=fs.readFileSync(process.argv[2]);
if(input.toString('ascii',0,3)!=='BMD'||input[3]!==15)throw new Error('Expected a BMD v15 model');
const size=input.readInt32LE(4);const decrypted=createLea256EcbDecrypt(key)(new Uint8Array(input.subarray(8,8+size)));
fs.writeFileSync(process.argv[3],Buffer.concat([Buffer.from([66,77,68,10]),decrypted]));
