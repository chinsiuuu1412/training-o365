"use client";
import {useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/state/auth-provider';
import {PublicFrame} from './public-journey';
import {ActionForm,Field,Feedback} from '@/components/shared/management-ui';
import {LoadingState} from '@/components/shared/states';
import {Button} from '@/components/ui/button';
const FixtureLoginChoices=process.env.NEXT_PUBLIC_DATA_SOURCE==='fixture'||process.env.NODE_ENV==='development'&&process.env.NEXT_PUBLIC_DATA_SOURCE!=='api'?dynamic(()=>import('@/features/routing/fixture-workspace').then(module=>module.FixtureLoginChoices)):null;
export function LoginScreen(){
 const {user,status,error,restore,login,fixtureMode,enabled}=useAuth(),router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 return <PublicFrame><section className="mx-auto max-w-lg space-y-5 rounded-2xl bg-white p-6 text-foreground sm:p-8"><h1 className="text-3xl font-semibold">Đăng nhập</h1><p className="text-sm leading-6">CLB o365 HUST - Khóa học Kĩ năng mềm</p>{fixtureMode&&<p className="text-sm leading-6 text-teal-800">Chế độ mô phỏng · Chỉ dùng tài khoản tổng hợp. Cookie fixture công khai không có bảo đảm bảo mật; không nhập mật khẩu thật.</p>}
 {status==='restoring'?<LoadingState/>:status==='error'?<><Feedback message={error} error/><p>Chưa xác định phiên đã hết hiệu lực.</p><Button onClick={()=>void restore()}>Thử khôi phục lại</Button></>:!enabled?<p role="status" className="text-sm leading-7">Đăng nhập chưa được mở trên bản triển khai này. Cần kiểm chứng cookie, CSRF và phiên với backend trước khi bật.</p>:<ActionForm submitLabel={fixtureMode?'Đăng nhập mô phỏng':'Đăng nhập'} onSubmit={async()=>{const role=await login(email,password);setPassword('');router.replace('/'+role+'/');}}><Field label="Email *"><input className="form-control" type="email" required autoComplete={fixtureMode?'off':'username'} value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Mật khẩu *"><input className="form-control" type="password" required autoComplete={fixtureMode?'off':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></Field></ActionForm>}
 {FixtureLoginChoices&&status!=='restoring'&&<FixtureLoginChoices onChoose={(email,password)=>{setEmail(email);setPassword(password);}}/>}
 <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Quên mật khẩu?</summary><p className="mt-3 text-sm leading-7">Liên hệ Admin của CLB để được cấp/reset; người phụ trách gửi thông tin qua email theo cách thủ công. Không có khôi phục qua email tự động.</p></details>{user&&<Button asChild variant="outline"><Link href={'/'+user.role+'/'}>Về không gian đang đăng nhập</Link></Button>}</section></PublicFrame>;
}
