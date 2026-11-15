import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { PageHeader } from "./page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/types/lms";
export function MilestonePlaceholder({ title, role }: { title: string; role: Role }) {
  return <div className="space-y-6"><PageHeader eyebrow="Lộ trình sản phẩm" title={title} description="Bạn đang xem bản demo giao diện Học Việt." /><Card className="flex min-h-80 flex-col items-center justify-center p-6 text-center"><span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-primary"><Layers3 size={28} /></span><Badge>Chưa triển khai</Badge><h2 className="mt-4 text-xl font-semibold">Không gian này đang được chuẩn bị</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Chưa có thao tác nghiệp vụ tại màn hình này. Các thông tin tài khoản hiện được quản lý trong bản demo bởi Admin.</p><Button asChild variant="outline" className="mt-6"><Link href={`/${role}`}><ArrowLeft />Về tổng quan</Link></Button></Card></div>;
}
