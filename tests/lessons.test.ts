import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, isValidState } from '../src/mocks/state.ts';
import { executeLesson, getLessonStatus, getAttendanceStatus, getAttendanceHistory, migrateScheduleAttendance } from '../src/mocks/services/lessons.ts';
import { execute } from '../src/mocks/services/management.ts';
import { getProgressDetails } from '../src/mocks/services/progress.ts';
import { currentCycleId } from '../src/mocks/services/enrollment-cycles.ts';
import { synchronizeMockState } from '../src/mocks/services/synchronization.ts';
import { decodeDemoStore } from '../src/mocks/demo-storage.ts';
import { loginMock, requireMockSession } from '../src/mocks/services/authentication.ts';

const lessonId='giai-tich-l11', now=Date.parse('2026-11-14T02:00:00Z');
const startsAt='2026-11-18T02:00:00Z', endsAt='2026-11-18T04:00:00Z', start=Date.parse(startsAt), end=Date.parse(endsAt);
function draft(){return executeLesson(createInitialState(),'t1',{type:'saveLesson',lessonId,classId:'giai-tich',title:'Buổi thử nghiệm',location:'Phòng demo A',description:'Dữ liệu tổng hợp',startsAt,endsAt,materialIds:['material-giai-tich'],attendanceCode:'O365'},now);}
function approved(){const saved=executeLesson(draft(),'t1',{type:'submitSchedule',lessonId},now);return executeLesson(saved,'a1',{type:'decideSchedule',requestId:saved.requests.at(-1)!.id,approved:true,reason:''},now);}
function override(state:ReturnType<typeof approved>, recorded:boolean,time=start,studentId='s1'){return executeLesson(state,'t1',{type:'overrideAttendance',lessonId,studentId,recorded,reason:'Đã xác minh tham gia'},time);}

test('draft and pending are not effective; approved lessons open without 24h confirmation',()=>{
 let state=draft();assert.equal(getLessonStatus(state,lessonId,start),'draft');
 state=executeLesson(state,'t1',{type:'submitSchedule',lessonId},now);assert.equal(getLessonStatus(state,lessonId,start),'waiting');
 assert.throws(()=>executeLesson(state,'s1',{type:'enterAttendance',lessonId,code:'O365'},start));
 state=executeLesson(state,'a1',{type:'decideSchedule',requestId:state.requests.at(-1)!.id,approved:true,reason:''},now);
 assert.equal(getLessonStatus(state,lessonId,start-1),'approved');assert.equal(getLessonStatus(state,lessonId,start),'active');assert.equal(getLessonStatus(state,lessonId,end),'completed');
 assert(isValidState(state));
});
test('pending/rejected changes retain old approved schedule, title, code and slot; approval commits atomically',()=>{
 const original=approved(),count=original.lessons.length;
 const change={type:'saveLesson' as const,lessonId,classId:'giai-tich',title:'Tên mới',location:'Phòng demo B',description:'Mô tả mới',startsAt:'2026-11-20T02:00:00Z',endsAt:'2026-11-20T04:00:00Z',materialIds:[],attendanceCode:'NEW'};
 let state=executeLesson(original,'t1',change,now);state=executeLesson(state,'t1',{type:'submitSchedule',lessonId},now);
 const requestId=state.requests.at(-1)!.id;
 assert.equal(state.lessons.find(l=>l.id===lessonId)!.location,'Phòng demo A');
 assert.equal(state.requests.at(-1)!.proposalLocation,'Phòng demo B');
 assert.equal(state.schedules.find(s=>s.lessonId===lessonId)!.startsAt,startsAt);assert.equal(state.lessons.find(l=>l.id===lessonId)!.attendanceCode,'O365');
 assert.throws(()=>executeLesson(state,'a1',{type:'decideSchedule',requestId,approved:false,reason:' '},now));
 const rejected=executeLesson(state,'a1',{type:'decideSchedule',requestId,approved:false,reason:'Cần đổi giờ'},now);
 assert.equal(rejected.schedules.find(s=>s.lessonId===lessonId)!.startsAt,startsAt);assert.equal(getLessonStatus(rejected,lessonId,start),'active');assert.equal(rejected.lessons.find(l=>l.id===lessonId)!.location,'Phòng demo A');
 state=executeLesson(rejected,'t1',change,now);state=executeLesson(state,'t1',{type:'submitSchedule',lessonId},now);
 state=executeLesson(state,'a1',{type:'decideSchedule',requestId:state.requests.at(-1)!.id,approved:true,reason:''},now);
 assert.equal(state.schedules.find(s=>s.lessonId===lessonId)!.startsAt,change.startsAt);assert.equal(state.lessons.find(l=>l.id===lessonId)!.name,change.title);assert.equal(state.lessons.length,count);assert.equal(state.lessons.find(l=>l.id===lessonId)!.location,'Phòng demo B');
 assert.deepEqual(original,approved());
});
test('one pending request per lesson; role/scope/expiry guards and live/completed schedules reject edits',()=>{
 const initial=approved();const change={type:'saveLesson' as const,lessonId,classId:'giai-tich',title:'Mới',description:'',startsAt:'2026-11-20T02:00:00Z',endsAt:'2026-11-20T04:00:00Z',materialIds:[],attendanceCode:'NEW'};
 for(const actor of ['s1','t2','a1'])assert.throws(()=>executeLesson(initial,actor,change,now));
 for(const time of [start,end])assert.throws(()=>executeLesson(initial,'t1',change,time));
 let state=executeLesson(initial,'t1',change,now);state=executeLesson(state,'t1',{type:'submitSchedule',lessonId},now);
 assert.throws(()=>executeLesson(state,'t1',{type:'submitSchedule',lessonId},now));
 assert.throws(()=>executeLesson(state,'a1',{type:'decideSchedule',requestId:state.requests.at(-1)!.id,approved:true,reason:''},start));
 const expired=structuredClone(initial);expired.classes[0].expiresAt='2026-11-13';assert.throws(()=>executeLesson(expired,'t1',change,now));
 assert.throws(()=>executeLesson(initial,'t1',{...change,materialIds:['material-dai-so']},now));
});
test('code window is [start,end), failed windows consume no attempts, success retries are idempotent',()=>{
 const initial=approved();
 for(const time of [start-1,end])assert.throws(()=>executeLesson(initial,'s1',{type:'enterAttendance',lessonId,code:'wrong'},time));
 assert.equal(getAttendanceStatus(initial,lessonId,'s1',start).failures,0);
 const state=executeLesson(initial,'s1',{type:'enterAttendance',lessonId,code:'O365'},start);
 const retried=executeLesson(state,'s1',{type:'enterAttendance',lessonId,code:'O365'},start+1);
 assert.deepEqual(retried,state);assert.equal(state.attendance.filter(row=>row.lessonId===lessonId&&row.studentId==='s1').length,1);
 assert.equal(getProgressDetails(state,'giai-tich','s1').attendedSessions,getProgressDetails(initial,'giai-tich','s1').attendedSessions+1);
 assert.throws(()=>executeLesson(state,'s1',{type:'requestAbsence',lessonId,reason:'Xin nghỉ'},start));
});
test('three incorrect attempts survive serialization/reload; Manager can verify after lock',()=>{
 let state=approved();
 for(let i=1;i<=3;i++){state=executeLesson(state,'s1',{type:'enterAttendance',lessonId,code:'wrong'},start);state=JSON.parse(JSON.stringify(state));assert.equal(getAttendanceStatus(state,lessonId,'s1',start).failures,i);}
 assert.throws(()=>executeLesson(state,'s1',{type:'enterAttendance',lessonId,code:'O365'},start));
 state=override(state,true,end+1000);assert(getAttendanceStatus(state,lessonId,'s1',end+1000).recorded);assert(isValidState(state));
});
test('Manager override supports add/remove/restore with actor/time/before-after and blocks code restoration',()=>{
 let state=approved();assert.throws(()=>override(state,true,start-1));
 state=override(state,true);state=override(state,false,start+1000);
 assert(getAttendanceStatus(state,lessonId,'s1',start+1000).revoked);
 assert.throws(()=>executeLesson(state,'s1',{type:'enterAttendance',lessonId,code:'O365'},start+1001));
 state=override(state,true,end+1);
 const history=getAttendanceHistory(state,'t1',lessonId,'s1');
 assert.deepEqual(history.map(event=>[event.before,event.after]),[[false,true],[true,false],[false,true]]);
 assert(history.every(event=>event.actorId==='t1'&&event.reason&&Number.isFinite(Date.parse(event.at))));
 assert.equal(history[2].at,new Date(end+1).toISOString());assert(isValidState(state));
});
test('Admin only reads; unrelated, suspended and reassigned Managers cannot override',()=>{
 const state=approved();
 for(const actor of ['a1','s1','t2'])assert.throws(()=>executeLesson(state,actor,{type:'overrideAttendance',lessonId,studentId:'s1',recorded:true,reason:'Có mặt'},start));
 assert.throws(()=>executeLesson(state,'t1',{type:'overrideAttendance',lessonId,studentId:'s1',recorded:true,reason:' '},start));
 const expired=structuredClone(state);expired.classes[0].expiresAt='2026-11-17';assert.throws(()=>override(expired,true,start));
 const moved=execute(state,'a1',{type:'saveClass',course:{...state.classes[0],managerId:'t2'},reason:'Đổi phụ trách'},now);assert.throws(()=>override(moved,true,start));
 const suspended=execute(state,'a1',{type:'setAccountStatus',userId:'t1',suspended:true,reason:'Tạm khóa'},now);assert.throws(()=>override(suspended,true,start));
 assert.equal(getAttendanceHistory(state,'t2',lessonId,'s1').length,0);
});
test('absence auto-approves, notifies Manager, gives no credit and stays recorded after authorized override',()=>{
 let state=executeLesson(approved(),'s2',{type:'requestAbsence',lessonId,reason:'Xin nghỉ có lý do'},now);
 const request=state.requests.at(-1)!;assert.equal(request.kind,'absence');assert.equal(request.status,'approved');
 assert(state.notifications.some(notification=>notification.recipientId==='t1'&&notification.description.includes('Xin nghỉ có lý do')));
 assert(!getAttendanceStatus(state,lessonId,'s2',start).recorded);assert(getAttendanceStatus(state,lessonId,'s2',start).absence);
 state=override(state,true,start,'s2');assert(getAttendanceStatus(state,lessonId,'s2',start).recorded);assert(getAttendanceStatus(state,lessonId,'s2',start).absence);
 assert.equal(state.requests.find(item=>item.id===request.id)!.status,'approved');
 assert.throws(()=>executeLesson(approved(),'s2',{type:'requestAbsence',lessonId,reason:'Muộn'},end));
});
test('old-cycle records cannot be overwritten by new-cycle check-in or override',()=>{
 let state=executeLesson(approved(),'s1',{type:'enterAttendance',lessonId,code:'O365'},start);
 const oldCycle=currentCycleId(state,'giai-tich','s1')!;const old=structuredClone(state.attendance.find(row=>row.lessonId===lessonId&&row.studentId==='s1')!);
 state=execute(state,'t1',{type:'removeStudent',classId:'giai-tich',studentId:'s1',reason:'Học lại'},start);
 state=execute(state,'s1',{type:'requestEnrollment',classId:'giai-tich',reason:'Lần mới'},start);
 state=execute(state,'t1',{type:'decideEnrollment',requestId:state.requests.at(-1)!.id,decision:'approved',reason:''},start);
 state=override(state,true,start+1000);state=override(state,false,start+2000);
 assert.deepEqual(state.attendance.find(row=>row.lessonId===lessonId&&row.studentId==='s1'&&row.cycleId===oldCycle),old);
 assert(!getAttendanceStatus(state,lessonId,'s1',start+2000).recorded);
 assert.equal(getAttendanceHistory(state,'s1',lessonId,'s1').length,2);
});
test('migration converts confirmation, cancels deferred requests and validates override history',()=>{
 const legacy=approved();delete legacy.lessonWorkflowVersion;legacy.schedules.find(schedule=>schedule.lessonId===lessonId)!.status='confirmed';
 legacy.requests.push({id:'legacy-correction',kind:'attendance-correction',classId:'giai-tich',lessonId,studentId:'s1',senderId:'t1',title:'Cũ',description:'Cũ',createdAt:startsAt,status:'waiting'});
 legacy.notifications.push({id:'unconfirmed-legacy',recipientId:'a1',classId:'giai-tich',title:'Chưa xác nhận',description:'24 giờ',createdAt:startsAt,href:'/admin/schedule-approvals'});
 const migrated=migrateScheduleAttendance(legacy);
 assert.equal(migrated.schedules.find(schedule=>schedule.lessonId===lessonId)!.status,'approved');assert.equal(migrated.requests.at(-1)!.status,'cancelled');assert(!migrated.notifications.some(item=>item.id==='unconfirmed-legacy'));
 assert.equal(migrateScheduleAttendance(migrated),migrated);
 assert.equal(synchronizeMockState(migrated,start-1000).notifications.some(item=>item.id.startsWith('unconfirmed-')),false);
 const state=override(migrated,true);assert(isValidState(state));
 const invalid=structuredClone(state) as unknown as Record<string,unknown>;invalid.attendanceOverrides=[{id:'bad'}];assert(!isValidState(invalid));
});
test('deferred commands are rejected even through direct service calls',()=>{
 const state=approved();
 for(const command of [{type:'confirmLesson',lessonId},{type:'removeAttendance',lessonId,studentId:'s1',reason:'Xóa'},{type:'manualAttendance',lessonId,studentId:'s1',reason:'Cũ'},{type:'requestAttendanceCorrection',lessonId,studentId:'s1',reason:'Cũ'},{type:'requestMakeup',lessonId,startsAt,endsAt,reason:'Cũ'},{type:'resolveUnconfirmed',lessonId,startsAt,endsAt,reason:'Cũ'}] as const)assert.throws(()=>executeLesson(state,'a1',command,now),/MVP/);
});

test('schema 3 migration keeps session, cycles and credits while removing obsolete confirmation notices',()=>{
 const initial=approved();initial.mockGeneration='lesson-migration-dataset';
 const signed=loginMock(initial,initial.users.find(user=>user.id==='a1')!.email!,'O365-DEMO-a1-v1',now,'lesson-migration-session');
 const legacy=structuredClone(signed.state);delete legacy.lessonWorkflowVersion;delete legacy.attendanceOverrides;
 legacy.notifications.push({id:'legacy-approval',recipientId:'s1',classId:'giai-tich',title:'Lịch học đã được duyệt, chờ xác nhận',description:'Lịch cũ',createdAt:startsAt,href:'/student/classes/giai-tich?tab=lessons'});
 const migrated=decodeDemoStore(JSON.stringify({version:3,state:legacy,demoEpoch:now,realEpoch:now}));
 assert.equal(migrated.version,4);assert.match(migrated.migrationNotice!,/schema 4/);
 assert.equal(requireMockSession(migrated.state,signed.session).id,'a1');
 assert.deepEqual(migrated.state.attendance,legacy.attendance);assert.deepEqual(migrated.state.enrollmentCycles,legacy.enrollmentCycles);
 assert.equal(migrated.state.notifications.find(n=>n.id==='legacy-approval')!.title,'Lịch học đã được duyệt');
});
