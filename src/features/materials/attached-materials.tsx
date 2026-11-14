"use client";

import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getLibraryMaterials, getMaterialStatus } from "@/mocks/services/library";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MaterialContent } from "./material-content";

const statusLabels = { available: "Có thể truy cập", expired: "Tài liệu hết hạn", "class-expired": "Lớp hết hạn", removed: "Đã gỡ", unavailable: "Không có quyền truy cập" };

export function AttachedMaterials({ role, classId, lessonId, materialIds }: { role: Role; classId: string; lessonId: string; materialIds: string[] }) {
  const { state, now, account } = useLms();
  const actor = account(role);
  const [detailId, setDetail] = useState<string | null>(null);
  const materials = getLibraryMaterials(state, actor.id).filter(material => !material.removedAt && material.classId === classId && (material.lessonId === lessonId || materialIds.includes(material.id)));
  const detail = materials.find(material => material.id === detailId);
  const status = detail ? getMaterialStatus(state, actor.id, detail, now) : "unavailable";

  return <div className="space-y-3 border-t border-border pt-4">
    <h4 className="text-sm font-semibold">Tài liệu đính kèm</h4>
    {materials.map(material => {
      const materialStatus = getMaterialStatus(state, actor.id, material, now);
      return <div key={material.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="min-w-0 break-words">{material.title} · {statusLabels[materialStatus]}</p>
        <Button variant="outline" size="sm" disabled={materialStatus !== "available"} onClick={() => setDetail(material.id)}>Xem metadata</Button>
      </div>;
    })}
    {!materials.length && <p className="text-sm text-muted-foreground">Chưa có tài liệu đính kèm khả dụng.</p>}
    <Dialog open={detailId !== null} onOpenChange={open => { if (!open) setDetail(null); }} title={detail?.title ?? "Tài liệu không khả dụng"} description="Tài liệu đính kèm buổi học.">
      {detail && status === "available" ? <MaterialContent material={detail} /> : <p role="alert" className="text-sm">{statusLabels[status]}</p>}
    </Dialog>
  </div>;
}
