import { test } from "node:test";
import assert from "node:assert/strict";

test("stored snapshot validation rejects missing roles and malformed rows before rendering", async () => {
  const { createInitialState, isValidState } = await import("../src/mocks/state.ts");
  const state = createInitialState();
  assert.equal(typeof isValidState, "function");
  assert(isValidState(state));
  assert(!isValidState({ ...state, users: state.users.filter(u => u.role !== "student") }));
  assert(!isValidState({ ...state, classes: [{ ...state.classes[0], name: null }] }));
  assert(!isValidState({ ...state, users: [null] }));
  assert(!isValidState({ ...state, referenceTime: "invalid" }));
});

test("management service implements enrollment lifecycle and cancellation does not consume declines", async () => {
  const { createInitialState } = await import("../src/mocks/state.ts");
  const { execute, getEnrollmentState } = await import("../src/mocks/services/management.ts");
  let state = createInitialState();
  const now = Date.parse(state.referenceTime);
  state = execute(state, "s3", { type: "cancelEnrollment", classId: "dai-so" }, now);
  for (let i = 0; i < 4; i++) {
    state = execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: "Muốn tham gia học Đại số" }, now);
    assert.equal(getEnrollmentState(state, "dai-so", "s3", now).status, "pending");
    state = execute(state, "s3", { type: "cancelEnrollment", classId: "dai-so" }, now);
  }
  assert.equal(getEnrollmentState(state, "dai-so", "s3", now).declineCount, 0);
  state = execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: "Muốn tham gia học Đại số" }, now);
  const request = state.requests.find(r => r.kind === "enrollment" && r.status === "waiting" && r.senderId === "s3")!;
  assert.throws(() => execute(state, "t3", { type: "decideEnrollment", requestId: request.id, decision: "approved", reason: "" }, now));
  state = execute(state, "t1", { type: "decideEnrollment", requestId: request.id, decision: "approved", reason: "" }, now);
  assert.equal(getEnrollmentState(state, "dai-so", "s3", now).status, "approved");
  const { getStudentDashboard } = await import("../src/mocks/services/dashboard.ts");
  assert.deepEqual(getStudentDashboard("s3", state).classes.find(c => c.id === "dai-so")!.progress, { attendance: 0, quiz: 0 });
});

test("declines require reason, ten minutes, a changed reason and stop at three declines", async () => {
  const { createInitialState } = await import("../src/mocks/state.ts");
  const { execute, getEnrollmentState } = await import("../src/mocks/services/management.ts");
  let state = createInitialState();
  let now = Date.parse(state.referenceTime);
  for (let i = 0; i < 3; i++) {
    const request = state.requests.find(r => r.kind === "enrollment" && r.status === "waiting" && r.senderId === "s3")!;
    assert.throws(() => execute(state, "t1", { type: "decideEnrollment", requestId: request.id, decision: "declined", reason: " " }, now));
    state = execute(state, "t1", { type: "decideEnrollment", requestId: request.id, decision: "declined", reason: "Chưa đủ kiến thức nền" }, now);
    assert.equal(getEnrollmentState(state, "dai-so", "s3", now).declineCount, i + 1);
    assert.throws(() => execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: `Lý do mới ${i}` }, now + 599999));
    now += 600000;
    assert.throws(() => execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: request.description }, now));
    if (i < 2) state = execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: `Đã ôn tập thêm lần ${i + 1}` }, now);
  }
  assert.throws(() => execute(state, "s3", { type: "requestEnrollment", classId: "dai-so", reason: "Xin học lại sau ba lần" }, now));
});

test("full/expired classes and suspended actors cannot enroll or approve", async () => {
  const { createInitialState } = await import("../src/mocks/state.ts");
  const { execute } = await import("../src/mocks/services/management.ts");
  const state = createInitialState();
  const now = Date.parse(state.referenceTime);
  state.classes[1].capacity = 8;
  assert.throws(() => execute(state, "t1", { type: "decideEnrollment", requestId: "r4", decision: "approved", reason: "" }, now));
  state.classes[1].capacity = 25;
  state.classes[1].expiresAt = "2026-11-13";
  assert.throws(() => execute(state, "t1", { type: "decideEnrollment", requestId: "r4", decision: "approved", reason: "" }, now));
  state.classes[1].expiresAt = "2027-02-28";
  const suspended = execute(state, "a1", { type: "setAccountStatus", userId: "t1", suspended: true, reason: "Tạm ngưng công tác" }, now);
  assert.equal(suspended.enrollments.length, state.enrollments.length);
  assert.equal(suspended.classes[1].teacherId, "t1");
  assert.throws(() => execute(suspended, "t1", { type: "decideEnrollment", requestId: "r4", decision: "approved", reason: "" }, now));
});

test("accounts validate duplicate email; reassignment preserves records and transfers queue", async () => {
  const { createInitialState } = await import("../src/mocks/state.ts");
  const { execute } = await import("../src/mocks/services/management.ts");
  const { getTeacherDashboard } = await import("../src/mocks/services/dashboard.ts");
  let state = createInitialState();
  const now = Date.parse(state.referenceTime);
  assert.throws(() => execute(state, "a1", { type: "saveAccount", role: "student", name: "Người trùng", email: state.users[0].email!.toUpperCase(), phone: "" }, now));
  const course = state.classes[1];
  assert.throws(() => execute(state, "a1", { type: "saveClass", course: { ...course, capacity: 1 }, reason: "" }, now));
  assert.throws(() => execute(state, "a1", { type: "saveClass", course: { ...course, teacherId: "t2" }, reason: "" }, now));
  const originalMaterials = state.materials;
  state = execute(state, "a1", { type: "saveClass", course: { ...course, teacherId: "t2" }, reason: "Phân công lại lịch dạy" }, now);
  assert.deepEqual(state.materials, originalMaterials);
  assert.equal(getTeacherDashboard("t1", state).enrollmentRequests.length, 0);
  assert.equal(getTeacherDashboard("t2", state).enrollmentRequests.length, 1);
  assert.throws(() => execute(state, "t1", { type: "decideEnrollment", requestId: "r4", decision: "approved", reason: "" }, now));
});

test("class access follows current assignment/enrollment and expiry without removing accounts", async () => {
  const { createInitialState } = await import("../src/mocks/state.ts");
  const { execute, canAccessClass } = await import("../src/mocks/services/management.ts");
  let state = createInitialState(); const now = Date.parse(state.referenceTime);
  assert(!canAccessClass(state, "s3", "dai-so"));
  assert(!canAccessClass(state, "t2", "dai-so"));
  assert(canAccessClass(state, "a1", "dai-so"));
  state = execute(state, "t1", { type: "decideEnrollment", requestId: "r4", decision: "approved", reason: "" }, now);
  assert(canAccessClass(state, "s3", "dai-so"));
  state = execute(state, "t1", { type: "removeStudent", classId: "dai-so", studentId: "s3", reason: "Vi phạm quy định" }, now);
  assert(!canAccessClass(state, "s3", "dai-so"));
  assert.equal(state.users.find(u => u.id === "s3")!.status, "active");
  state.classes[0].expiresAt = "2026-11-13";
  assert(!canAccessClass(state, "s1", "giai-tich"));
  assert(canAccessClass(state, "t1", "giai-tich"));
});
