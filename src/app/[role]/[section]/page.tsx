import {notFound} from 'next/navigation';
import {isRole} from '@/config/navigation';
import {RoleWorkspace} from '@/features/routing/role-workspace';
export const dynamicParams=false;
export function generateStaticParams({params}:{params:{role:string}}){const common=['classes','library','notifications','profile','settings'];const sections=params.role==='admin'?[...common,'students','managers','schedule-approvals']:params.role==='student'?[...common,'schedule']:common;return sections.map(section=>({section}));}
export default async function SectionPage({params}:{params:Promise<{role:string;section:string}>}){const {role,section}=await params;if(!isRole(role))notFound();return <RoleWorkspace role={role} section={section}/>;}
