import type { NextConfig } from 'next';
const basePath=(process.env.NEXT_PUBLIC_BASE_PATH??'').replace(/\/$/,'');
if(basePath&&!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath))throw new Error('NEXT_PUBLIC_BASE_PATH phải là đường dẫn, không phải hostname.');
const config:NextConfig={output:'export',trailingSlash:true,basePath,images:{unoptimized:true},env:{NEXT_PUBLIC_BASE_PATH:basePath,NEXT_PUBLIC_DATA_SOURCE:process.env.NEXT_PUBLIC_DATA_SOURCE??(process.env.NODE_ENV==='development'?'fixture':'api'),NEXT_PUBLIC_AUTH_ENABLED:process.env.NEXT_PUBLIC_AUTH_ENABLED??'false',NEXT_PUBLIC_MANAGEMENT_ENABLED:process.env.NEXT_PUBLIC_MANAGEMENT_ENABLED??'false',NEXT_PUBLIC_SCHEDULING_ENABLED:process.env.NEXT_PUBLIC_SCHEDULING_ENABLED??'false',NEXT_PUBLIC_QUIZZES_ENABLED:process.env.NEXT_PUBLIC_QUIZZES_ENABLED??'false',NEXT_PUBLIC_COMMUNICATIONS_ENABLED:process.env.NEXT_PUBLIC_COMMUNICATIONS_ENABLED??'false'}};
export default config;
