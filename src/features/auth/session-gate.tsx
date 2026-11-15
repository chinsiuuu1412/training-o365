"use client";
import {useEffect,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {Role} from '@/types/lms';
import {useAuth} from '@/state/auth-provider';
import {LoadingState} from '@/components/shared/states';
import {Feedback} from '@/components/shared/management-ui';
import {Button} from '@/components/ui/button';
export function SessionGate({role,children}:{role:Role;children:ReactNode}){
 const {user,status,error,anonymousReason,restore}=useAuth(),router=useRouter();
 useEffect(()=>{if(status==='anonymous')router.replace(anonymousReason==='logout'?'/login/':'/login/?reason='+anonymousReason);},[status,anonymousReason,router]);
 if(status==='restoring')return <main className="p-6"><LoadingState/></main>;
 if(status==='error')return <main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-semibold">Chưa khôi phục được phiên</h1><Feedback message={error} error/><p>Chưa xác định phiên đã hết hiệu lực. Thử lại khi kết nối ổn định.</p><Button onClick={()=>void restore()}>Thử khôi phục lại</Button></main>;
 if(!user)return <main className="p-6"><p>Vui lòng đăng nhập.</p><Link href="/login/">Đăng nhập</Link></main>;
 if(user.role!==role)return <main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-semibold">Bạn không có quyền truy cập vai trò này</h1><Button asChild><Link href={'/'+user.role+'/'}>Về không gian của bạn</Link></Button></main>;
 return children;
}
