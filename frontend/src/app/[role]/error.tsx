"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export default function ErrorPage({ reset }: { reset: () => void }) { return <Card className="p-8 text-center" role="alert"><h1 className="text-xl font-semibold">Chưa thể tải nội dung</h1><p className="mt-3 text-sm text-muted-foreground">Vui lòng thử lại để tiếp tục xem dữ liệu.</p><Button className="mt-5" onClick={reset}>Thử lại</Button></Card>; }
