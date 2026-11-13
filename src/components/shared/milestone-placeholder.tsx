import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { PageHeader } from "./page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export function MilestonePlaceholder({ title }: { title: string }) {
  return <div className="space-y-6"><PageHeader eyebrow="Lộ trình sản phẩm" title={title} description="Bạn đang xem bản demo giao diện Học Việt." /><Card className="flex min-h-80 flex-col items-center justify-center p-6 text-center"><span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-primary"><Layers3 size={28} /></span><Badge>Màn hình thuộc milestone tiếp theo</Badge><h2 className="mt-4 text-xl font-semibold">Không gian này đang được chuẩn bị</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Milestone hiện tại tập trung vào hệ thống thiết kế, khung ứng dụng và tổng quan quản trị. Chưa có thao tác nghiệp vụ tại màn hình này.</p><Button asChild variant="outline" className="mt-6"><Link href="/admin"><ArrowLeft />Về tổng quan quản trị</Link></Button></Card></div>;
}
