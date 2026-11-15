export type Transport=(url:string,init:RequestInit)=>Promise<Response>;
export class ApiError extends Error{
 status:number;code:string;details:Record<string,unknown>|null;kind:'http'|'network'|'protocol';retryAfter:number|null;
 constructor(message:string,options:{status?:number;code?:string;details?:Record<string,unknown>|null;kind?:'http'|'network'|'protocol';retryAfter?:number|null}={}){super(message);this.name='ApiError';this.status=options.status??0;this.code=options.code??'network_error';this.details=options.details??null;this.kind=options.kind??'http';this.retryAfter=options.retryAfter??null;}
}
export class ApiClient{
 private csrf:string|null=null;private transport:Transport;private unauthorized:()=>void;private serverOffset=0;
 constructor(transport:Transport=(url,init)=>fetch(url,init),unauthorized:()=>void=()=>{}){this.transport=transport;this.unauthorized=unauthorized;}
 setCsrf(value:string|null){this.csrf=value;}
 serverNow(){return Date.now()+this.serverOffset;}
 async request(path:string,options:{method?:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';body?:Record<string,unknown>;public?:boolean;signal?:AbortSignal;idempotencyKey?:string}={}):Promise<unknown>{
  if(!/^\/[a-z0-9/-]+(?:\?[^#]*)?$/i.test(path)||path.startsWith('//')||path.includes('..')||path.includes('\\'))throw new Error('Đường dẫn API không hợp lệ.');
  const requestCsrf=this.csrf,method=options.method??'GET',headers=new Headers({Accept:'application/json'});if(method!=='GET'){headers.set('Content-Type','application/json');if(!options.public&&this.csrf)headers.set('X-CSRF-Token',this.csrf);}
  if(options.idempotencyKey!==undefined){if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(options.idempotencyKey))throw new Error('Idempotency-Key phải là UUID.');headers.set('Idempotency-Key',options.idempotencyKey);}
  let response:Response;try{response=await this.transport('/api/v1'+path,{method,headers,credentials:'include',cache:'no-store',...(method!=='GET'?{body:JSON.stringify(options.body??{})}:{}),signal:options.signal});}catch{throw new ApiError('Không thể kết nối. Kiểm tra mạng rồi thử lại.',{kind:'network'});}
  const serverDate=response.headers.get('Date');if(serverDate&&Number.isFinite(Date.parse(serverDate)))this.serverOffset=Date.parse(serverDate)-Date.now();
  let envelope:Record<string,unknown>;
  try{const raw:unknown=await response.json();if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();envelope=raw as Record<string,unknown>;if(!('data'in envelope)||!('error'in envelope))throw new Error();}catch{throw new ApiError('Phản hồi máy chủ không đúng định dạng. Vui lòng thử lại.',{status:response.status,code:'invalid_response',kind:'protocol'});}
  if(response.ok&&envelope.error===null&&envelope.data!==null)return envelope.data;
  const error=envelope.error;
  if(envelope.data!==null||!error||typeof error!=='object'||Array.isArray(error)||typeof (error as Record<string,unknown>).code!=='string'||typeof (error as Record<string,unknown>).message!=='string'||!('details'in error)||((error as Record<string,unknown>).details!==null&&(typeof (error as Record<string,unknown>).details!=='object'||Array.isArray((error as Record<string,unknown>).details))))throw new ApiError('Phản hồi lỗi không đúng định dạng.',{status:response.status,kind:'protocol',code:'invalid_response'});
  const detail=error as {code:string;message:string;details:Record<string,unknown>|null};
  if(response.status===401&&!options.public&&this.csrf===requestCsrf){this.csrf=null;this.unauthorized();}
  const retry=response.headers.get('Retry-After');
  throw new ApiError(detail.message,{status:response.status,code:detail.code,details:detail.details,retryAfter:retry&&/^\d+$/.test(retry)?Number(retry):null});
 }
}
