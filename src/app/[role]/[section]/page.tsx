import { notFound } from "next/navigation";
import { isRole, navigation } from "@/config/navigation";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { AccountsList } from "@/features/accounts/accounts-list";
import { ClassesList } from "@/features/classes/classes-list";
import { ScheduleCalendar } from "@/features/schedules/schedule-calendar";
import { ApprovalQueue } from "@/features/schedules/approval-queue";
export default async function SectionPage({ params }: { params: Promise<{ role: string; section: string }> }) {
  const { role, section } = await params;
  if (!isRole(role)) notFound();
  if (section === "classes") return <ClassesList role={role} />;
  if (role === "student" && section === "schedule") return <ScheduleCalendar role={role} />;
  if (role === "admin" && section === "requests") return <ApprovalQueue />;
  if (role === "admin" && (section === "students" || section === "teachers")) return <AccountsList role={section === "students" ? "student" : "teacher"} />;
  const title = navigation[role].find(n => n.path === section)?.label ?? ({ profile: "Hồ sơ cá nhân", settings: "Cài đặt tài khoản" } as Record<string, string>)[section];
  if (!title) notFound();
  return <MilestonePlaceholder title={title} />;
}
