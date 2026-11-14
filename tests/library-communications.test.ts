import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, isValidState } from "../src/mocks/state.ts";
import { execute } from "../src/mocks/services/management.ts";
import { getLibraryMaterials, getMaterialStatus } from "../src/mocks/services/library.ts";
import { getAudienceRecipients, getDirectRecipients, getRequestItems, getUnreadCounts, isRequestUnread } from "../src/mocks/services/communications.ts";

const now = Date.parse("2026-11-14T02:00:00Z");
const upload = {
  type: "addMaterial" as const, classId: "giai-tich", lessonId: "giai-tich-l1", title: "Bài giảng mới",
  description: "Metadata minh họa", kind: "document" as const, source: "file" as const,
  fileName: "bai-giang.pdf", sizeBytes: 1024, mimeType: "application/pdf",
};

test("material metadata requires assigned Teacher, valid file fields, same-class lesson and future expiration", () => {
  const original = createInitialState();
  const before = JSON.stringify(original);
  for (const actor of ["a1", "s1", "t3"]) assert.throws(() => execute(original, actor, upload, now));
  for (const patch of [{ title: " " }, { sizeBytes: 0 }, { sizeBytes: 1.5 }, { fileName: "" }, { mimeType: "" }, { expiresAt: new Date(now).toISOString() }, { lessonId: "dai-so-l1" }]) {
    assert.throws(() => execute(original, "t1", { ...upload, ...patch }, now));
  }
  assert.equal(JSON.stringify(original), before);
  const state = execute(original, "t1", upload, now);
  const material = state.materials.at(-1)!;
  assert(state.lessons.find(lesson => lesson.id === upload.lessonId)!.materialIds!.includes(material.id));
  assert.equal(getMaterialStatus(state, "s1", material, now), "available");
  assert(isValidState(state));
});

test("all file videos expire, only YouTube videos bypass material expiry, class expiry always applies", () => {
  let state = execute(createInitialState(), "t1", { ...upload, kind: "video", source: "youtube", youtubeUrl: "https://www.youtube.com/watch?v=demo1234567" }, now);
  const youtube = state.materials.at(-1)!;
  youtube.expiresAt = new Date(now - 1).toISOString();
  const video = state.materials.find(material => material.id === "video-giai-tich")!;
  for (const actor of ["a1", "t1", "s1"]) {
    assert.equal(getMaterialStatus(state, actor, video, now), "expired");
    assert.equal(getMaterialStatus(state, actor, youtube, now), "available");
  }
  assert.throws(() => execute(state, "t1", { ...upload, source: "youtube", youtubeUrl: "https://youtu.be/demo" }, now));
  assert.throws(() => execute(state, "t1", { ...upload, kind: "video", source: "youtube", youtubeUrl: "https://youtube.com.evil.example/watch?v=abc" }, now));
  assert.throws(() => execute(state, "t1", { ...upload, kind: "video", source: "youtube", youtubeUrl: "https://youtube.com/" }, now));
  state = structuredClone(state);
  state.classes.find(course => course.id === upload.classId)!.expiresAt = "2026-11-13";
  for (const actor of ["a1", "t1", "s1"]) assert.equal(getMaterialStatus(state, actor, youtube, now), "class-expired");
  assert.throws(() => execute(state, "t1", upload, now));
});

test("removal requires Admin reason, notifies current Teacher and clears current/draft/pending lesson attachments", () => {
  let state = execute(createInitialState(), "t1", upload, now);
  const material = state.materials.at(-1)!;
  const lesson = state.lessons.find(item => item.id === upload.lessonId)!;
  lesson.draft = { title: "Draft", description: "Details", startsAt: new Date(now + 86400000).toISOString(), endsAt: new Date(now + 90000000).toISOString(), attendanceCode: "DEMO", materialIds: [material.id] };
  state.requests[0].proposalMaterialIds = [material.id];
  assert.throws(() => execute(state, "a1", { type: "removeMaterial", materialId: material.id, reason: "" }, now));
  assert.throws(() => execute(state, "t3", { type: "removeMaterial", materialId: material.id, reason: "Wrong teacher" }, now));
  state = execute(state, "a1", { type: "removeMaterial", materialId: material.id, reason: "Nội dung không phù hợp" }, now);
  assert(!getLibraryMaterials(state, "s1").some(item => item.id === material.id));
  assert.equal(getMaterialStatus(state, "t1", state.materials.at(-1)!, now), "removed");
  assert(!state.lessons.find(item => item.id === lesson.id)!.materialIds!.includes(material.id));
  assert(!state.lessons.find(item => item.id === lesson.id)!.draft!.materialIds.includes(material.id));
  assert(!state.requests[0].proposalMaterialIds!.includes(material.id));
  assert(state.notifications.some(item => item.recipientId === "t1" && item.description.includes("Nội dung không phù hợp")));
  assert.throws(() => execute(state, "a1", { type: "removeMaterial", materialId: material.id, reason: "Again" }, now));
});

test("removed enrollments, changed assignment and suspended accounts lose Library access without deleting data", () => {
  const state = createInitialState();
  const material = state.materials.find(item => item.id === "material-giai-tich")!;
  state.enrollments.find(enrollment => enrollment.studentId === "s1" && enrollment.classId === "giai-tich")!.status = "removed";
  assert.equal(getMaterialStatus(state, "s1", material, now), "unavailable");
  state.classes.find(course => course.id === "giai-tich")!.teacherId = "t3";
  assert.equal(getMaterialStatus(state, "t1", material, now), "unavailable");
  assert.equal(getMaterialStatus(state, "t3", material, now), "available");
  state.users.find(user => user.id === "t3")!.status = "suspended";
  assert.equal(getMaterialStatus(state, "t3", material, now), "unavailable");
  assert(state.materials.some(item => item.id === material.id));
});

test("notification direct recipients enforce role and current enrollment, revalidated when sending", () => {
  const state = createInitialState();
  assert(getDirectRecipients(state, "a1").every(user => user.role !== "admin"));
  assert(getDirectRecipients(state, "s1").every(user => user.role === "teacher"));
  assert(!getDirectRecipients(state, "s1").some(user => user.id === "t2"));
  assert(getDirectRecipients(state, "t1").some(user => user.id === "a1"));
  const command = { type: "sendNotification" as const, title: "Thông báo", description: "Nội dung", audience: { type: "people" as const, recipientIds: ["a1"] } };
  assert.throws(() => execute(state, "s1", command, now));
  assert.throws(() => execute(state, "t2", { ...command, audience: { type: "people", recipientIds: ["s1"] } }, now));
  const sent = execute(state, "s1", { ...command, audience: { type: "people", recipientIds: ["t1"] } }, now);
  assert(sent.notifications.some(item => item.senderId === "s1" && item.recipientId === "t1"));
  for (const enrollment of state.enrollments.filter(item => item.studentId === "s1")) enrollment.status = "removed";
  assert.throws(() => execute(state, "s1", { ...command, audience: { type: "people", recipientIds: ["t1"] } }, now));
});

test("class broadcasts allow student selection/exclusion, optional Teachers, and deduplicate across classes", () => {
  const state = createInitialState();
  const audience = { type: "classes" as const, classIds: ["giai-tich", "dai-so"], includeTeachers: true, studentIds: ["s1", "s1"] };
  assert.deepEqual(getAudienceRecipients(state, "a1", audience).sort(), ["s1", "t1"]);
  assert.throws(() => getAudienceRecipients(state, "t1", audience));
  assert.throws(() => getAudienceRecipients(state, "s1", { ...audience, includeTeachers: false }));
  assert.throws(() => getAudienceRecipients(state, "t3", { ...audience, includeTeachers: false }));
  const sent = execute(state, "a1", { type: "sendNotification", title: "Hai lớp", description: "Nội dung", audience }, now);
  const messages = sent.notifications.filter(item => item.title === "Hai lớp");
  assert.equal(messages.length, 2);
  assert.equal(new Set(messages.map(item => item.messageId)).size, 1);
  assert(!messages.some(item => item.recipientId === "s2"));
  assert.throws(() => getAudienceRecipients(state, "a1", { ...audience, studentIds: ["missing"] }));
  assert(isValidState(sent));
});

test("read/unread notification state is recipient-specific and persists while sender records remain unchanged", () => {
  const state = createInitialState();
  const notification = state.notifications.find(item => item.recipientId === "s1")!;
  const before = getUnreadCounts(state, "s1").notifications;
  assert.throws(() => execute(state, "s2", { type: "markNotificationRead", notificationId: notification.id, read: true }, now));
  const read = execute(state, "s1", { type: "markNotificationRead", notificationId: notification.id, read: true }, now);
  assert.equal(getUnreadCounts(read, "s1").notifications, before - 1);
  const unread = execute(read, "s1", { type: "markNotificationRead", notificationId: notification.id, read: false }, now);
  assert.equal(getUnreadCounts(unread, "s1").notifications, before);
  assert.equal(state.notifications.find(item => item.id === notification.id)!.read, undefined);
});

test("general requests allow Student to Teacher and Teacher to Admin, feedback is mandatory and decisions cannot repeat", () => {
  const original = createInitialState();
  const command = { type: "sendGeneralRequest" as const, recipientId: "t1", title: "Xin tư vấn", description: "Em cần hướng dẫn", classId: "giai-tich" };
  let state = execute(original, "s1", command, now);
  const request = state.generalRequests!.at(-1)!;
  assert.equal(getRequestItems(state, "s1").find(item => item.id === request.id)!.status, "waiting");
  assert(getRequestItems(state, "t1").some(item => item.id === request.id));
  assert(!getRequestItems(state, "a1").some(item => item.id === request.id));
  assert.throws(() => execute(state, "s1", { ...command, recipientId: "a1" }, now));
  assert.throws(() => execute(state, "a1", command, now));
  assert.throws(() => execute(state, "t1", { ...command, recipientId: "s1" }, now));
  assert.throws(() => execute(state, "t3", { type: "decideGeneralRequest", requestId: request.id, approved: true, reason: "Yes" }, now));
  assert.throws(() => execute(state, "t1", { type: "decideGeneralRequest", requestId: request.id, approved: false, reason: " " }, now));
  state = execute(state, "t1", { type: "decideGeneralRequest", requestId: request.id, approved: false, reason: "Hẹn buổi khác" }, now + 1);
  assert.equal(state.generalRequests![0].status, "declined");
  assert(state.notifications.some(item => item.recipientId === "s1" && item.description.includes("Hẹn buổi khác")));
  assert.throws(() => execute(state, "t1", { type: "decideGeneralRequest", requestId: request.id, approved: true, reason: "Again" }, now));
  state = execute(state, "t1", { ...command, recipientId: "a1", classId: undefined }, now + 2);
  assert.equal(state.generalRequests!.at(-1)!.recipientId, "a1");
  assert.deepEqual(state.attempts, original.attempts);
  assert(isValidState(state));
});

test("request receipts are scoped per user and revision, including workflow results and manual unread of sent pending requests", () => {
  let state = createInitialState();
  const request = getRequestItems(state, "t1").find(item => item.id === "r6")!;
  assert(isRequestUnread(state, "t1", request));
  state = execute(state, "t1", { type: "markRequestRead", requestId: request.id, source: "workflow", read: true }, now);
  assert(!isRequestUnread(state, "t1", request));
  assert.throws(() => execute(state, "s2", { type: "markRequestRead", requestId: request.id, source: "workflow", read: true }, now));
  assert(!isRequestUnread(state, "s1", request));
  state = execute(state, "s1", { type: "markRequestRead", requestId: request.id, source: "workflow", read: false }, now);
  assert(isRequestUnread(state, "s1", request));
  state = execute(state, "s1", { type: "markRequestRead", requestId: request.id, source: "workflow", read: true }, now);
  state.requests.find(item => item.id === request.id)!.status = "declined";
  assert(isRequestUnread(state, "s1", getRequestItems(state, "s1").find(item => item.id === request.id)!));
  state.classes.find(course => course.id === "giai-tich")!.teacherId = "t3";
  assert(!getRequestItems(state, "t1").some(item => item.id === "r6"));
  assert(getRequestItems(state, "t3").some(item => item.id === "r6"));
});

test("legacy content remains valid and corrupt communication/Library metadata is rejected", () => {
  const state = createInitialState();
  assert(isValidState(state));
  for (const corrupt of [
    { ...state, generalRequests: [{}] }, { ...state, requestReceipts: [{}] },
    { ...state, notifications: [{ ...state.notifications[0], read: "yes" }] },
    { ...state, materials: [{ ...state.materials[0], expiresAt: "not-a-date" }] },
    { ...state, materials: [{ ...state.materials[0], lessonId: "dai-so-l1" }] },
    { ...state, materials: [{ ...state.materials[0], sizeBytes: -1 }] },
  ]) assert(!isValidState(corrupt));
});
