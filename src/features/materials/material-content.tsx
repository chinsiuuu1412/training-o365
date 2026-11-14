import type { Material } from "@/types/lms";

export function MaterialContent({ material }: { material: Material }) {
  return <div className="space-y-4 break-words text-sm leading-6">
    <p className="whitespace-pre-wrap">{material.description || "Chưa có mô tả."}</p>
    <dl className="space-y-3">
      <div><dt className="text-muted-foreground">Nguồn</dt><dd>{material.source === "youtube" ? "Video bài giảng YouTube" : "Tệp minh họa"}</dd></div>
      <div><dt className="text-muted-foreground">Tên tệp / URL metadata</dt><dd className="break-all">{material.source === "youtube" ? material.youtubeUrl : material.fileName ?? "Metadata tệp cũ chưa có tên tệp"}</dd></div>
      {material.sizeBytes && <div><dt className="text-muted-foreground">Kích thước</dt><dd>{material.sizeBytes.toLocaleString("vi-VN")} byte</dd></div>}
      {material.mimeType && <div><dt className="text-muted-foreground">MIME type</dt><dd>{material.mimeType}</dd></div>}
    </dl>
    <p className="rounded-lg bg-slate-50 p-3 text-muted-foreground">Bản demo chỉ lưu metadata. Nội dung tệp, phát video và tải xuống cần kết nối kho lưu trữ.</p>
  </div>;
}
