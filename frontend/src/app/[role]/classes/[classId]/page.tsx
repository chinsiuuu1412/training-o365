import { notFound, redirect } from "next/navigation";
import { isRouteRole } from "@/config/navigation";
import { ClassDetail } from "@/features/classes/class-detail";

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string; classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { role, classId } = await params;
  if (role === "teacher") redirect(`/manager/classes/${classId}`);
  if (!isRouteRole(role)) notFound();
  const parsedClassId = Number(classId);
  if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) notFound();
  const { tab } = await searchParams;
  return (
    <ClassDetail
      key={`${parsedClassId}-${tab ?? "overview"}`}
      role={role}
      classId={parsedClassId}
      initialTab={tab}
    />
  );
}
