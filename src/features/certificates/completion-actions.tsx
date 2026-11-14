"use client";

import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Field } from "@/components/shared/management-ui";

export function CompletionProposal({ role, classId, studentId, kind, certificateId, trigger }: { role: Role; classId: string; studentId: string; kind: "exception" | "revoke"; certificateId?: string; trigger: string }) {
  const { account, run } = useLms();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return <><Button variant="outline" size="sm" onClick={() => { setReason(""); setOpen(true); }}>{trigger}</Button>
    <Dialog open={open} onOpenChange={setOpen} title={kind === "revoke" ? "Đề xuất thu hồi chứng chỉ mock" : "Đề xuất hoàn thành / cấp lại"} description="Teacher đề xuất thì Admin duyệt; Admin đề xuất thì Teacher duyệt.">
      <ActionForm submitLabel="Gửi đề xuất duyệt chéo" onCancel={() => setOpen(false)} onSubmit={async () => {
        await run(account(role).id, { type: "requestCompletion", classId, studentId, kind, certificateId, reason });
        setOpen(false);
      }}>
        {certificateId && <p className="break-all font-mono text-xs text-muted-foreground">Chứng chỉ được đề xuất · {certificateId}</p>}
        <p className="text-sm leading-6">{kind === "revoke" ? "Chứng chỉ chuyển Under review trong khi chờ quyết định. Chỉ thu hồi sau khi đề xuất được chấp thuận." : "Ngoại lệ giữ nguyên điểm thực tế. Việc cấp vẫn chờ lớp kết thúc và chốt hết điểm."}</p>
        <Field label="Lý do đề xuất *"><textarea required maxLength={2000} className="form-control min-h-28" value={reason} onChange={event => setReason(event.target.value)} /></Field>
      </ActionForm>
    </Dialog>
  </>;
}

export function CompletionAppealButton({ classId }: { classId: string }) {
  const { account, run } = useLms();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return <><Button variant="outline" onClick={() => { setReason(""); setOpen(true); }}>Gửi khiếu nại hoàn thành</Button>
    <Dialog open={open} onOpenChange={setOpen} title="Khiếu nại kết quả hoàn thành" description="Giảng viên có thể từ chối kèm phản hồi hoặc tiếp nhận và chuyển đề xuất để Admin duyệt chéo.">
      <ActionForm submitLabel="Gửi khiếu nại" onCancel={() => setOpen(false)} onSubmit={async () => {
        await run(account("student").id, { type: "appealCompletion", classId, reason });
        setOpen(false);
      }}><Field label="Lý do khiếu nại *"><textarea required maxLength={2000} className="form-control min-h-28" value={reason} onChange={event => setReason(event.target.value)} /></Field></ActionForm>
    </Dialog>
  </>;
}
