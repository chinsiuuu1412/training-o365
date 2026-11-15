"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {basePath,staticDestination,stripBasePath} from '@/config/routes';
import {Button} from '@/components/ui/button';
export default function NotFound(){const [redirecting,setRedirecting]=useState(false);
 useEffect(()=>{const path=stripBasePath(window.location.pathname);const target=path===null?null:staticDestination(path+window.location.search);if(target&&basePath+target!==window.location.pathname+window.location.search){queueMicrotask(()=>setRedirecting(true));window.location.replace(basePath+target);}},[]);
 return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"><p className="font-semibold text-primary">404</p><h1 className="text-2xl font-semibold">{redirecting?'Đang chuyển đường dẫn cũ':'Không tìm thấy trang'}</h1><p className="text-sm leading-6">Đường dẫn hợp lệ được chuyển về trang tĩnh tương đương và kiểm tra lại phiên, vai trò.</p><Button asChild><Link href="/">Về trang chủ</Link></Button></main>;
}
