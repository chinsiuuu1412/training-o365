import { notFound } from "next/navigation";
import { isRole, navigation } from "@/config/navigation";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
export default async function SectionPage({ params }: { params: Promise<{ role: string; section: string }> }) {
  const { role, section } = await params;
  if (!isRole(role)) notFound();
  const title = navigation[role].find(n => n.path === section)?.label ?? ({ profile: "Hồ sơ cá nhân", settings: "Cài đặt tài khoản" } as Record<string, string>)[section];
  if (!title) notFound();
  return <MilestonePlaceholder title={title} />;
}
