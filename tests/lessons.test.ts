import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, isValidState, migrateLessonState } from '../src/mocks/state.ts';
import { executeLesson, getLessonStatus, getAttendanceStatus } from '../src/mocks/services/lessons.ts';
import { getDashboard } from '../src/mocks/services/dashboard.ts';
const lessonId = 'giai-tich-l11';
const now = Date.parse('2026-11-14T02:00:00Z');
const startsAt = '2026-11-18T02:00:00Z', endsAt = '2026-11-18T04:00:00Z';
function draft() { return executeLesson(createInitialState(), 't1', { type: 'saveLesson', lessonId, classId: 'giai-tich', title: 'Tích phân', description: 'Bài học', startsAt, endsAt, materialIds: ['material-giai-tich'], attendanceCode: '123456' }, now); }
function approved() { const s = executeLesson(draft(), 't1', {type:'submitSchedule',lessonId},now); const r = s.requests.at(-1)!; return executeLesson(s,'a1',{type:'decideSchedule',requestId:r.id,approved:true,reason:''},now); }
function confirmed() { return executeLesson(approved(),'t1',{type:'confirmLesson',lessonId}, Date.parse(startsAt)-86400000); }

test('teaching progress counts a confirmed lesson when simulated time reaches its end',()=>{
 const state=confirmed();state.referenceTime=endsAt;
 // Eight historical lessons, seeded confirmed lesson 9, and the newly confirmed slot.
 assert.equal(getDashboard(state).classes.find(c=>c.id==='giai-tich')!.completedLessons,10);
});
test('draft uses fixed slot, request publishes only after approval and exact 24h confirmation works', () => {
 let s = draft(); assert.equal(s.lessons.length,createInitialState().lessons.length); assert.equal(getLessonStatus(s,lessonId,now),'draft');
 s=approved(); assert.equal(getLessonStatus(s,lessonId,now),'approved');
 assert.throws(()=>executeLesson(s,'t1',{type:'confirmLesson',lessonId},Date.parse(startsAt)-86400000+1));
 assert.equal(getLessonStatus(s,lessonId,Date.parse(startsAt)-86400000+1),'late');
 s=confirmed(); assert.equal(getLessonStatus(s,lessonId,Date.parse(startsAt)),'active'); assert(isValidState(s));
});
test('approved schedule edits remain current until approval, rejection requires reason and immutable errors', () => {
 const initial=confirmed(); const saved=executeLesson(initial,'t1',{type:'saveLesson',lessonId,classId:'giai-tich',title:'Mới',description:'Đổi lịch',startsAt:'2026-11-20T02:00:00Z',endsAt:'2026-11-20T04:00:00Z',materialIds:[],attendanceCode:'ABC'},now);
 assert.equal(saved.schedules.find(s=>s.lessonId===lessonId)!.startsAt,startsAt);
 const submitted=executeLesson(saved,'t1',{type:'submitSchedule',lessonId},now); const r=submitted.requests.at(-1)!;
 assert.throws(()=>executeLesson(submitted,'a1',{type:'decideSchedule',requestId:r.id,approved:false,reason:''},now));
 const accepted=executeLesson(submitted,'a1',{type:'decideSchedule',requestId:r.id,approved:true,reason:''},now);
 assert.equal(accepted.schedules.find(s=>s.lessonId===lessonId)!.status,'approved'); assert.equal(initial.lessons.find(l=>l.id===lessonId)!.name,'Tích phân');
});
test('three wrong attempts persist, manual attendance overrides lock, deduplicates and updates progress', async () => {
 let s=confirmed(); const active=Date.parse(startsAt);
 for(let i=1;i<=3;i++){s=executeLesson(s,'s1',{type:'enterAttendance',lessonId,code:'wrong'},active);assert.equal(getAttendanceStatus(JSON.parse(JSON.stringify(s)),lessonId,'s1',active).failures,i);}
 assert.throws(()=>executeLesson(s,'s1',{type:'enterAttendance',lessonId,code:'123456'},active));
 assert.throws(()=>executeLesson(s,'t2',{type:'manualAttendance',lessonId,studentId:'s1',reason:'Có mặt'},active));
 const {getStudentDashboard}=await import('../src/mocks/services/dashboard.ts'); const before=getStudentDashboard('s1',s).classes[0].progress.attendance;
 s=executeLesson(s,'t1',{type:'manualAttendance',lessonId,studentId:'s1',reason:'Đã xác minh'},active);
 assert(getStudentDashboard('s1',s).classes[0].progress.attendance>before); assert.throws(()=>executeLesson(s,'s1',{type:'requestAbsence',lessonId,reason:'Ốm'},active));
 assert.equal(s.attendance.filter(a=>a.lessonId===lessonId&&a.studentId==='s1').length,1);
 assert.throws(()=>executeLesson(s,'t1',{type:'manualAttendance',lessonId,studentId:'s2',reason:'Có mặt'},Date.parse(endsAt)));
});
test('valid code active window, approved absence grants no credit, correction requires admin approval',()=>{
 let s=confirmed(); const active=Date.parse(startsAt);
 assert.throws(()=>executeLesson(s,'s1',{type:'enterAttendance',lessonId,code:'123456'},active-1));
 s=executeLesson(s,'s2',{type:'requestAbsence',lessonId,reason:'Bị ốm'},now); assert(getAttendanceStatus(s,lessonId,'s2',active).absence); assert(!getAttendanceStatus(s,lessonId,'s2',active).recorded);
 s=executeLesson(s,'s1',{type:'enterAttendance',lessonId,code:'123456'},active); assert(getAttendanceStatus(s,lessonId,'s1',active).recorded);
 s=executeLesson(s,'t1',{type:'requestAttendanceCorrection',lessonId,studentId:'s1',reason:'Không tham gia'},active); assert(getAttendanceStatus(s,lessonId,'s1',active).recorded);
 const r=s.requests.at(-1)!; s=executeLesson(s,'a1',{type:'decideAttendanceCorrection',requestId:r.id,approved:true,reason:''},active); assert(!getAttendanceStatus(s,lessonId,'s1',active).recorded);
});
test('makeup requires reason and 24h, uses same slot and independent leave approval',()=>{
 let s=confirmed(); const count=s.lessons.length;
 s=executeLesson(s,'t1',{type:'requestMakeup',lessonId,startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',reason:'Công tác'},now);
 const leave=s.requests.find(r=>r.kind==='teacher-leave'&&r.lessonId===lessonId)!; const proposal=s.requests.at(-1)!; assert(leave);
 s=executeLesson(s,'a1',{type:'decideSchedule',requestId:leave.id,approved:true,reason:''},now);
 assert.equal(s.schedules.find(v=>v.lessonId===lessonId)!.status,'cancelled');
 s=executeLesson(s,'a1',{type:'decideSchedule',requestId:proposal.id,approved:true,reason:''},now);
 assert.equal(s.lessons.length,count); assert.equal(s.schedules.find(v=>v.lessonId===lessonId)!.status,'approved');
});
test('migration links old requests and validation rejects corrupt persisted lesson fields',()=>{
 const s=migrateLessonState(createInitialState()); assert.equal(s.requests.find(r=>r.id==='r1')!.lessonId,'giai-tich-l10'); assert(isValidState(s));
 const invalid=structuredClone(s); invalid.lessons[0].materialIds=42 as unknown as string[]; assert(!isValidState(invalid));
});
test('authorization, expiry, material ownership and completed slots reject without mutation',()=>{
 const s=createInitialState(); const input={type:'saveLesson' as const,lessonId,classId:'giai-tich',title:'Học',description:'',startsAt,endsAt,materialIds:[],attendanceCode:'CODE'};const before=structuredClone(s);
 assert.throws(()=>executeLesson(s,'s1',input,now)); assert.throws(()=>executeLesson(s,'t2',input,now));
 assert.throws(()=>executeLesson(s,'t1',{...input,lessonId:'giai-tich-l1'},now));
 assert.throws(()=>executeLesson(s,'t1',{...input,materialIds:['material-dai-so']},now)); assert.deepEqual(s,before);
 s.users.find(u=>u.id==='t1')!.status='suspended';assert.throws(()=>executeLesson(s,'t1',input,now));
});

test('Admin resolves late confirmation with same-slot makeup and explicit missed deadline notice',()=>{
 const s=approved(), late=Date.parse(startsAt)-10*3600000;
 assert.throws(()=>executeLesson(s,'t1',{type:'resolveUnconfirmed',lessonId,startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',reason:'Sắp xếp lại'},late));
 const next=executeLesson(s,'a1',{type:'resolveUnconfirmed',lessonId,startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',reason:'Sắp xếp lại'},late);
 assert.equal(next.lessons.length,s.lessons.length);assert.equal(next.schedules.find(v=>v.lessonId===lessonId)!.status,'approved');assert(next.notifications.some(n=>n.description.includes('12 giờ')));
});

test('completed scheduled slots cannot be edited or rescheduled and failed windows do not consume attempts',()=>{
 const s=confirmed(); const ended=Date.parse(endsAt);
 assert.throws(()=>executeLesson(s,'t1',{type:'saveLesson',lessonId,classId:'giai-tich',title:'Đổi',description:'',startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',materialIds:[],attendanceCode:'new'},ended));
 assert.throws(()=>executeLesson(s,'t1',{type:'requestMakeup',lessonId,startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',reason:'Đổi'},ended));
 assert.throws(()=>executeLesson(s,'s1',{type:'enterAttendance',lessonId,code:'wrong'},ended));assert.equal(getAttendanceStatus(s,lessonId,'s1',ended).failures,0);
});
test('makeup cannot replace schedule before leave approved, rejection retains original, and can resubmit',()=>{
 let s=executeLesson(confirmed(),'t1',{type:'requestMakeup',lessonId,startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',reason:'Công tác'},now);
 const leave=s.requests.find(r=>r.kind==='teacher-leave'&&r.lessonId===lessonId)!; const proposed=s.requests.at(-1)!;
 assert.throws(()=>executeLesson(s,'a1',{type:'decideSchedule',requestId:proposed.id,approved:true,reason:''},now));
 s=executeLesson(s,'a1',{type:'decideSchedule',requestId:leave.id,approved:false,reason:'Lịch nghỉ không phù hợp'},now);
 assert.equal(s.schedules.find(v=>v.lessonId===lessonId)!.status,'confirmed');
 assert(!s.requests.some(r=>r.lessonId===lessonId&&r.status==='waiting'));
 s=executeLesson(s,'t1',{type:'requestMakeup',lessonId,startsAt:'2026-11-22T02:00:00Z',endsAt:'2026-11-22T04:00:00Z',reason:'Đề xuất khác'},now);assert(s.requests.at(-1)!.status==='waiting');
});
test('migration safely leaves malformed legacy values for validation and rejects invalid proposals',()=>{
 const bad={...createInitialState(),lessons:[1]} as unknown as ReturnType<typeof createInitialState>;
 assert.doesNotThrow(()=>migrateLessonState(bad));assert(!isValidState(migrateLessonState(bad)));
 const invalid=createInitialState();invalid.requests[0].proposedStartsAt='bad';assert(!isValidState(invalid));
});
test('a pending time edit cannot overwrite a lesson once the current session is active or completed',()=>{
 let s=executeLesson(confirmed(),'t1',{type:'saveLesson',lessonId,classId:'giai-tich',title:'Lịch mới',description:'',startsAt:'2026-11-21T02:00:00Z',endsAt:'2026-11-21T04:00:00Z',materialIds:[],attendanceCode:'CODE'},now);
 s=executeLesson(s,'t1',{type:'submitSchedule',lessonId},now);const requestId=s.requests.at(-1)!.id;
 const snapshot=structuredClone(s);
 for(const clock of [Date.parse(startsAt),Date.parse(endsAt)])assert.throws(()=>executeLesson(s,'a1',{type:'decideSchedule',requestId,approved:true,reason:''},clock));
 assert.deepEqual(s,snapshot);
 const declined=executeLesson(s,'a1',{type:'decideSchedule',requestId,approved:false,reason:'Buổi học đã diễn ra'},Date.parse(endsAt));assert.equal(declined.requests.find(r=>r.id===requestId)!.status,'declined');
});
