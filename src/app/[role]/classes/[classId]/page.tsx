import { notFound } from "next/navigation";
import { isRole } from "@/config/navigation";
import { ClassDetail } from "@/features/classes/class-detail";

export default async function ClassPage({ params, searchParams }: { params: Promise<{ role: string; classId: string }>; searchParams: Promise<{tab?:string}> }) {
  const { role, classId } = await params;
  if (!isRole(role)) notFound();
  const {tab}=await searchParams;
  return <ClassDetail key={`${classId}-${tab??"overview"}`} role={role} classId={classId} initialTab={tab} />;
}
