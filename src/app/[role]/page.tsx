import {notFound} from 'next/navigation';
import {isRole} from '@/config/navigation';
import {RoleWorkspace} from '@/features/routing/role-workspace';
export default async function RoleHome({params}:{params:Promise<{role:string}>}){const {role}=await params;if(!isRole(role))notFound();return <RoleWorkspace role={role}/>;}
