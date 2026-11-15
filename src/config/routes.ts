import type { Role } from '../types/lms.ts';
import { legacyDestination } from './legacy-routes.ts';
export const basePath=(process.env.NEXT_PUBLIC_BASE_PATH??'').replace(/\/$/,'');
export function stripBasePath(path:string,base=basePath){return !base?path:path===base?'/':path.startsWith(base+'/')?path.slice(base.length):null;}
export function validRouteId(value:string,fixture=false){return /^\d+$/.test(value)?Number.isSafeInteger(Number(value))&&Number(value)>0:fixture&&/^[a-zA-Z0-9_-]{1,120}$/.test(value);}
export function deferredMvpLocation(section:string,query:URLSearchParams){
 if(['requests','certificates','sent','uploads'].includes(section))return true;
 if(['sent','certificates','appeals','retakes','grade-corrections','upload'].includes(query.get('tab')??''))return true;
 if(section==='notifications'&&(['sent','requests'].includes(query.get('folder')??'')||query.get('tab')==='requests'||['sent','request','requests'].includes(query.get('view')??'')||query.get('compose')==='request'||query.get('request')==='true'))return true;
 return ['library','classes'].includes(section)&&(query.has('upload')||query.get('source')==='file'||query.get('mode')==='upload'||query.get('view')==='upload');
}
export function detailHref(role:Role,classId:string,quizId?:string,tab?:string){const query=new URLSearchParams({classId});if(quizId)query.set('quizId',quizId);if(tab)query.set('tab',tab);return '/'+role+'/classes/?'+query;}
export function staticDestination(href:string):string|null{
 if(!href.startsWith('/')||href.startsWith('//')||href.includes('\\')||href.includes('%')||href.includes('..'))return null;
 const [originalPath,originalQuery='']=href.split('?');if(deferredMvpLocation(originalPath.split('/').filter(Boolean)[1]??'',new URLSearchParams(originalQuery)))return null;
 const [path,query='']=href.split('?');const clean=path.replace(/\/$/,'');const mapped=legacyDestination(clean,query);const target=mapped??href;const [pathname,search='']=target.split('?');const parts=pathname.split('/').filter(Boolean);const supplied=new URLSearchParams(search);
 if(!['admin','manager','student'].includes(parts[0]))return null;
 if(deferredMvpLocation(parts[1]??'',supplied))return null;
 if(parts[1]==='classes'&&(parts.length===3||parts.length===5&&parts[3]==='quizzes')){if(!parts.slice(2).every(part=>/^[a-zA-Z0-9_-]+$/.test(part)))return null;return detailHref(parts[0] as Role,parts[2],parts[4],supplied.get('tab')??undefined);}
 if(mapped){const suffix=pathname.endsWith('/')?pathname:pathname+'/';return suffix+(search?'?'+search:'');}
 return null;
}
