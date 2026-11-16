"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/state/auth-provider";
import { assertValidPasswordBytes, PASSWORD_POLICY_HINT } from "@/lib/password";
import { PageHeader } from "@/components/shared/page-header";
import { ActionForm, Feedback, Field } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";

export function SettingsView() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const [doneMessage, setDoneMessage] = useState("");

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Đổi mật khẩu"
        description="Sau khi đổi mật khẩu thành công, phiên đăng nhập hiện tại sẽ kết thúc và bạn cần đăng nhập lại bằng mật khẩu mới."
      />

      <Card className="max-w-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold">Cập nhật mật khẩu tài khoản</h2>
            <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
          </div>
        </div>

        <ActionForm
          submitLabel="Đổi mật khẩu"
          onSubmit={async (data) => {
            const currentPassword = String(data.get("current_password") ?? "");
            const newPassword = String(data.get("new_password") ?? "");
            const confirmPassword = String(data.get("confirm_password") ?? "");
            assertValidPasswordBytes(newPassword, "Mật khẩu mới");
            if (newPassword !== confirmPassword) {
              throw new Error("Xác nhận mật khẩu mới không khớp.");
            }
            await changePassword(currentPassword, newPassword);
            setDoneMessage("Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập…");
            router.replace("/login");
          }}
        >
          <Field label="Mật khẩu hiện tại *">
            <input
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              className="form-control"
            />
          </Field>
          <Field label="Mật khẩu mới *" hint={PASSWORD_POLICY_HINT}>
            <input
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              className="form-control"
            />
          </Field>
          <Field label="Xác nhận mật khẩu mới *">
            <input
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              className="form-control"
            />
          </Field>
        </ActionForm>
        {doneMessage && (
          <div className="mt-4">
            <Feedback message={doneMessage} />
          </div>
        )}
      </Card>
    </div>
  );
}