import type {HealthResponse,DemoResponse} from '@mu-survivor/models';
export class ApiError extends Error{constructor(message:string,public readonly status:number){super(message);this.name='ApiError';}}
export interface ApiClientOptions{baseUrl?:string;fetch?:typeof globalThis.fetch;timeoutMs?:number}
export function createMuApiClient({baseUrl='/api',fetch:transport=globalThis.fetch,timeoutMs=5000}:ApiClientOptions={}){
 async function get<T>(path:string,validate:(data:unknown)=>data is T):Promise<T>{
  const response=await transport(baseUrl.replace(/\/$/,'')+path,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json'}});
  if(!response.ok)throw new ApiError('MU API request failed',response.status);
  const data:unknown=await response.json();if(!validate(data))throw new ApiError('MU API returned an invalid response',502);return data;
 }
 return {
  health:()=>get<HealthResponse>('/health',(data):data is HealthResponse=>!!data&&typeof data==='object'&&'ok' in data&&data.ok===true&&'mode' in data&&['production','development'].includes(String(data.mode))&&'game' in data&&typeof data.game==='string'),
  demo:()=>get<DemoResponse>('/demo',(data):data is DemoResponse=>!!data&&typeof data==='object'&&'stage' in data&&typeof data.stage==='string'&&['durationSeconds','characters','enemyTypes','skillsPerCharacter'].every(key=>key in data&&typeof (data as Record<string,unknown>)[key]==='number')&&'accounts' in data&&typeof data.accounts==='boolean')
 };
}
