  import { notFound, redirect } from "next/navigation";
  import { isRouteRole } from "@/config/navigation";
import { AccountsList } from "@/features/accounts/accounts-list";
import { ClassesList } from "@/features/classes/classes-list";
import { ScheduleCalendar } from "@/features/schedules/schedule-calendar";
import { ApprovalQueue } from "@/features/schedules/approval-queue";
import { LibraryWorkspace } from "@/features/materials/library-workspace";
import { NotificationInbox } from "@/features/notifications/notification-inbox";
  import { ProfileView } from "@/features/profile/profile-view";
  import { SettingsView } from "@/features/profile/settings-view";

  export default async function SectionPage({
    params,
  }: {
    params: Promise<{ role: string; section: string }>;
  }) {
    const { role, section } = await params;

    if (role === "teacher") {
      const mapped = section === "teachers" ? "managers" : section;
      redirect(`/manager/${mapped}`);
    }

    if (!isRouteRole(role)) notFound();

    if (section === "profile") return <ProfileView />;
    if (section === "settings") return <SettingsView />;
    if (section === "classes") return <ClassesList role={role} />;
    if (section === "library") return <LibraryWorkspace role={role} />;
    if (section === "notifications") return <NotificationInbox role={role} />;

    if (role === "student" && section === "schedule") return <ScheduleCalendar />;

    if (role === "admin") {
      if (section === "students") return <AccountsList roleFilter="student" />;
      if (section === "managers") return <AccountsList roleFilter="class_manager" />;
      if (section === "schedule-proposals") return <ApprovalQueue />;
    }

    notFound();
}
