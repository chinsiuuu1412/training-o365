import {notFound} from 'next/navigation';
import {isRole} from '@/config/navigation';
import {SessionGate} from '@/features/auth/session-gate';
export const dynamicParams=false;
export function generateStaticParams(){return ['admin','manager','student'].map(role=>({role}));}
export default async function RoleLayout({children,params}:{children:React.ReactNode;params:Promise<{role:string}>}){const {role}=await params;if(!isRole(role))notFound();return <SessionGate role={role}>{children}</SessionGate>;}
