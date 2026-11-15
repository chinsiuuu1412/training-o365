import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { flag, nullable, pageOf, positiveId, text } from '../src/lib/api/dto.ts';

test('client uses same-origin API, cookies and in-memory CSRF; writes have JSON bodies',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const client=new ApiClient(async(url,init)=>{calls.push({url,init});return Response.json({data:{},error:null});});
 client.setCsrf('synthetic-csrf');await client.request('/auth/logout',{method:'POST'});
 assert.equal(calls[0].url,'/api/v1/auth/logout');assert.equal(calls[0].init.credentials,'include');
 assert.equal(calls[0].init.body,'{}');assert.equal(new Headers(calls[0].init.headers).get('X-CSRF-Token'),'synthetic-csrf');
 client.setCsrf(null);await client.request('/auth/login',{method:'POST',body:{email:'sample@example.test',password:'synthetic'},public:true});
 assert.equal(new Headers(calls[1].init.headers).get('X-CSRF-Token'),null);
 await assert.rejects(()=>client.request('https://other.example/api'),/Đường dẫn/);
});
test('envelope errors preserve details and Retry-After; only confirmed 401 ends session',async()=>{
 let lost=0;
 const client=new ApiClient(async()=>Response.json({data:null,error:{code:'wrong_attendance_code',message:'Mã sai',details:{remaining_attempts:2}}},{status:422,headers:{'Retry-After':'12'}}),()=>lost++);
 await assert.rejects(()=>client.request('/test'),e=>e instanceof ApiError&&e.status===422&&e.details?.remaining_attempts===2&&e.retryAfter===12);assert.equal(lost,0);
 const unauthorized=new ApiClient(async()=>Response.json({data:null,error:{code:'unauthenticated',message:'Đăng nhập lại',details:null}},{status:401}),()=>lost++);
 await assert.rejects(()=>unauthorized.request('/auth/me'));assert.equal(lost,1);
 const broken=new ApiClient(async()=>new Response('<html>proxy</html>',{status:401}),()=>lost++);
 await assert.rejects(()=>broken.request('/auth/me'),e=>e instanceof ApiError&&e.kind==='protocol');assert.equal(lost,1);
 const offline=new ApiClient(async()=>{throw new TypeError('offline');});await assert.rejects(()=>offline.request('/auth/me'),e=>e instanceof ApiError&&e.kind==='network');
});
test('DTO readers preserve null, text leading zeros, numeric flags and page metadata',()=>{
 assert.equal(nullable(text)(null),null);assert.equal(text('000123456'),'000123456');assert.equal(flag(0),false);assert.equal(flag(1),true);
 for(const invalid of [null,2,'0',false])assert.throws(()=>flag(invalid));
 assert.equal(positiveId(9007199254740991),9007199254740991);assert.throws(()=>positiveId(9007199254740992));
 const page=pageOf(text)({items:[],page:2,page_size:20,total:21});assert.deepEqual(page,{items:[],page:2,pageSize:20,total:21});
 assert.throws(()=>pageOf(text)({items:null,page:1,page_size:20,total:0}));
});
test('a stale 401 from an older session cannot revoke a newer CSRF session',async()=>{
 let lost=0,finish:(response:Response)=>void=()=>{};
 const client=new ApiClient(()=>new Promise<Response>(resolve=>{finish=resolve;}),()=>lost++);
 client.setCsrf('old');const pending=client.request('/auth/me');client.setCsrf('new');
 finish(Response.json({data:null,error:{code:'unauthenticated',message:'Old session',details:null}},{status:401}));
 await assert.rejects(()=>pending);assert.equal(lost,0);
});
