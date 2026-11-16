"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { MaterialDto, RouteRole } from "@/types/api";
import { materialsApi } from "@/lib/lms-api";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

export function AttachedMaterials({
  role,
  classId,
  sessionId,
}: {
  role: RouteRole;
  classId: number;
  sessionId: number;
}) {
  const [items, setItems] = useState<MaterialDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    materialsApi
      .list(role, classId, { session_id: sessionId, page: 1, page_size: 20 }, controller.signal)
      .then((res) => setItems(res.items))
      .catch(() => {
        // Non-blocking supplemental section.
      })
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, [role, classId, sessionId]);

  if (!loaded || items.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h4 className="text-xs font-semibold text-muted-foreground">Tài liệu gắn buổi học</h4>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{m.title}</span>
              {m.deleted_at && <StatusBadge status="deleted" />}
            </div>
            {!m.deleted_at && (
              <Button asChild variant="outline" size="sm">
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} />
                  Mở liên kết
                </a>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
