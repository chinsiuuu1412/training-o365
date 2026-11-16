import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="tabular-nums text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-sm text-muted-foreground">
        Đường dẫn không tồn tại hoặc không thuộc phạm vi hệ thống.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
