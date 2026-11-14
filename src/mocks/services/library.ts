import type { LmsState, Material } from "../../types/lms.ts";
import { isExpired } from "./management.ts";

export type LibraryCommand =
  | { type: "addMaterial"; classId: string; lessonId?: string; title: string; description: string; kind: Material["kind"]; source: "file" | "youtube"; fileName: string; sizeBytes: number; mimeType: string; youtubeUrl?: string; expiresAt?: string }
  | { type: "removeMaterial"; materialId: string; reason: string };

export const libraryCommandTypes = ["addMaterial", "removeMaterial"];

function requireRule(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export function isYoutubeUrl(value: string) {
  try {
    const url = new URL(value);
    const shortHost = ["youtu.be", "www.youtu.be"].includes(url.hostname);
    const fullHost = ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname);
    if (url.protocol !== "https:" || (!shortHost && !fullHost) || url.username || url.password) return false;
    if (shortHost) return /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
    return (url.pathname === "/watch" && /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") ?? ""))
      || /^\/(embed|shorts|live)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function getLibraryMaterials(state: LmsState, actorId: string) {
  const actor = state.users.find(user => user.id === actorId);
  if (!actor || actor.status === "suspended") return [];
  return state.materials.filter(material => {
    const course = state.classes.find(item => item.id === material.classId);
    if (!course) return false;
    if (actor.role === "admin") return true;
    if (actor.role === "teacher") return course.teacherId === actorId;
    return !material.removedAt && state.enrollments.some(enrollment => enrollment.classId === course.id && enrollment.studentId === actorId && enrollment.status === "approved");
  });
}

export function getMaterialStatus(state: LmsState, actorId: string, material: Material, now: number) {
  const course = state.classes.find(item => item.id === material.classId);
  if (!course || !getLibraryMaterials(state, actorId).some(item => item.id === material.id)) return "unavailable";
  if (material.removedAt) return "removed";
  if (isExpired(course, now)) return "class-expired";
  const youtube = material.kind === "video" && material.source === "youtube" && isYoutubeUrl(material.youtubeUrl ?? "");
  if (!youtube && material.expiresAt && Date.parse(material.expiresAt) <= now) return "expired";
  return "available";
}

export function getMaterialLessons(state: LmsState, material: Material) {
  return state.lessons.filter(lesson => lesson.classId === material.classId && (lesson.id === material.lessonId || lesson.materialIds?.includes(material.id)));
}

export function executeLibrary(original: LmsState, actorId: string, command: LibraryCommand, now: number): LmsState {
  const state = structuredClone(original);
  const actor = state.users.find(user => user.id === actorId);
  requireRule(actor && actor.status !== "suspended", "Tài khoản không khả dụng.");
  const createdAt = new Date(now).toISOString();
  if (command.type === "addMaterial") {
    const course = state.classes.find(item => item.id === command.classId);
    requireRule(actor.role === "teacher" && course?.teacherId === actorId && !isExpired(course, now), "Chỉ giảng viên phụ trách lớp còn hạn được thêm tài liệu.");
    requireRule(command.title.trim() && command.title.trim().length <= 150, "Tên tài liệu bắt buộc và tối đa 150 ký tự.");
    requireRule(command.description.length <= 2000, "Mô tả tối đa 2000 ký tự.");
    requireRule(["document", "video"].includes(command.kind) && ["file", "youtube"].includes(command.source), "Loại tài liệu không hợp lệ.");
    const lesson = state.lessons.find(item => item.id === command.lessonId && item.classId === course.id);
    requireRule(!command.lessonId || lesson, "Buổi học phải thuộc cùng lớp.");
    requireRule(!command.expiresAt || (Number.isFinite(Date.parse(command.expiresAt)) && Date.parse(command.expiresAt) > now), "Hạn truy cập phải trong tương lai.");
    if (command.source === "youtube") {
      requireRule(command.kind === "video" && isYoutubeUrl(command.youtubeUrl ?? ""), "Nhập URL HTTPS của YouTube hợp lệ.");
    } else {
      requireRule(command.fileName.trim() && command.fileName.length <= 200, "Nhập tên tệp minh họa.");
      requireRule(Number.isSafeInteger(command.sizeBytes) && command.sizeBytes > 0, "Kích thước tệp phải là số byte nguyên dương.");
      requireRule(command.mimeType.trim().length > 0 && command.mimeType.length <= 100, "Nhập MIME type của tệp.");
    }
    const material: Material = {
      id: `material-${now}-${state.materials.length}`, classId: course.id, lessonId: lesson?.id,
      title: command.title.trim(), description: command.description.trim(), kind: command.kind, source: command.source,
      fileName: command.source === "file" ? command.fileName.trim() : undefined,
      sizeBytes: command.source === "file" ? command.sizeBytes : undefined,
      mimeType: command.source === "file" ? command.mimeType.trim() : undefined,
      youtubeUrl: command.source === "youtube" ? command.youtubeUrl?.trim() : undefined,
      expiresAt: command.expiresAt, uploadedBy: actorId, createdAt,
    };
    state.materials.push(material);
    if (lesson) lesson.materialIds = [...new Set([...(lesson.materialIds ?? []), material.id])];
  } else {
    const material = state.materials.find(item => item.id === command.materialId);
    const course = state.classes.find(item => item.id === material?.classId);
    requireRule(material && course && !material.removedAt, "Tài liệu không tồn tại hoặc đã được gỡ.");
    requireRule(actor.role === "admin" || (actor.role === "teacher" && course.teacherId === actorId && !isExpired(course, now)), "Bạn không có quyền gỡ tài liệu này.");
    requireRule(actor.role !== "admin" || command.reason.trim(), "Admin phải nêu lý do gỡ tài liệu.");
    requireRule(command.reason.length <= 1000, "Lý do tối đa 1000 ký tự.");
    Object.assign(material, { removedAt: createdAt, removedBy: actorId, removalReason: command.reason.trim() });
    for (const lesson of state.lessons) {
      lesson.materialIds = lesson.materialIds?.filter(id => id !== material.id);
      if (lesson.draft) lesson.draft.materialIds = lesson.draft.materialIds.filter(id => id !== material.id);
    }
    for (const request of state.requests) request.proposalMaterialIds = request.proposalMaterialIds?.filter(id => id !== material.id);
    if (actor.role === "admin") state.notifications.push({
      id: `material-removal-${now}-${state.notifications.length}`, recipientId: course.teacherId, senderId: actorId,
      classId: course.id, title: "Admin đã gỡ tài liệu", description: `${material.title} · ${command.reason.trim()}`,
      createdAt, href: `/teacher/classes/${course.id}?tab=materials`,
    });
  }
  return state;
}
