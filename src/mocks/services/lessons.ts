import type { ApprovalRequest, LessonDraft, LmsState } from '../../types/lms.ts';
import { getMaterialStatus } from './library.ts';

export type LessonCommand =
 | ({ type: 'saveLesson'; lessonId: string; classId: string } & LessonDraft)
 | { type: 'submitSchedule' | 'confirmLesson'; lessonId: string }
 | { type: 'decideSchedule' | 'decideAttendanceCorrection'; requestId: string; approved: boolean; reason: string }
 | { type: 'requestMakeup' | 'resolveUnconfirmed'; lessonId: string; startsAt: string; endsAt: string; reason: string }
 | { type: 'enterAttendance'; lessonId: string; code: string }
 | { type: 'manualAttendance' | 'requestAttendanceCorrection' | 'removeAttendance'; lessonId: string; studentId: string; reason: string }
 | { type: 'requestAbsence'; lessonId: string; reason: string };
export const lessonCommandTypes = ['saveLesson','submitSchedule','confirmLesson','decideSchedule','decideAttendanceCorrection','requestMakeup','enterAttendance','manualAttendance','requestAttendanceCorrection','removeAttendance','requestAbsence','resolveUnconfirmed'];
const day = 86400000;
function rule(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const expired = (date: string, now: number) => date < new Date(now + 7*3600000).toISOString().slice(0,10);
export function getLessonStatus(state: LmsState, lessonId: string, now: number): string {
 const lesson=state.lessons.find(l=>l.id===lessonId); if(lesson?.completed) return 'completed';
 const s=state.schedules.find(s=>s.lessonId===lessonId); if(!s) return 'draft';
 if(s.status==='pending') return 'waiting';
 if(s.status==='approved' && now>Date.parse(s.startsAt)-day) return 'late';
 if(s.status==='confirmed') return now>=Date.parse(s.endsAt)?'completed':now>=Date.parse(s.startsAt)?'active':'confirmed';
 return s.status;
}
export function getAttendanceStatus(state: LmsState, lessonId: string, studentId: string, now: number) {
 const rows=state.attendance.filter(a=>a.lessonId===lessonId&&a.studentId===studentId);
 const recorded=rows.some(a=>a.recorded), failures=Math.max(0,...rows.map(a=>a.failures??0)), absence=rows.some(a=>!!a.absenceReason);
 const lesson=state.lessons.find(l=>l.id===lessonId), course=state.classes.find(c=>c.id===lesson?.classId);
 const eligible=!!course&&!expired(course.expiresAt,now)&&state.users.some(u=>u.id===studentId&&u.role==='student'&&u.status!=='suspended')&&state.enrollments.some(e=>e.classId===course.id&&e.studentId===studentId&&e.status==='approved');
 const open=eligible&&getLessonStatus(state,lessonId,now)==='active'&&!recorded&&!absence&&failures<3;
 return {recorded,failures,absence,open,locked:failures>=3,remaining:Math.max(0,3-failures),feedback:recorded?'Đã điểm danh thành công':failures?`Bạn chưa nhập đúng mã, bạn còn ${Math.max(0,3-failures)} lượt nhập`:''};
}
export function executeLesson(original: LmsState, actorId: string, command: LessonCommand, now: number): LmsState {
 const state=structuredClone(original), actor=state.users.find(u=>u.id===actorId);
 rule(actor&&actor.status!=='suspended','Tài khoản đang bị vô hiệu hóa hoặc không tồn tại.');
 const iso=new Date(now).toISOString();
 const id=(prefix:string)=>`${prefix}-${now}-${state.requests.length}-${state.notifications.length}-${state.schedules.length}`;
 const requireReason=(r:string)=>{rule(r.trim(),'Vui lòng nhập lý do.');return r.trim();};
 const admin=()=>rule(actor.role==='admin','Chỉ Admin có quyền duyệt yêu cầu.');
 const lessonFor=(lessonId:string)=>{const l=state.lessons.find(l=>l.id===lessonId);rule(l,'Buổi học không tồn tại.');return l;};
 const courseFor=(classId:string)=>{const c=state.classes.find(c=>c.id===classId);rule(c,'Lớp học không tồn tại.');rule(!expired(c.expiresAt,now),'Lớp đã hết hạn.');return c;};
 const teacher=(classId:string)=>{const c=courseFor(classId);rule(actor.role==='teacher'&&c.teacherId===actor.id,'Bạn không phụ trách lớp học này.');return c;};
 const student=(classId:string,studentId:string)=>{courseFor(classId);rule(state.users.some(u=>u.id===studentId&&u.role==='student'&&u.status!=='suspended')&&state.enrollments.some(e=>e.classId===classId&&e.studentId===studentId&&e.status==='approved'),'Học viên không có quyền truy cập lớp.');};
 const notify=(recipientId:string,classId:string,title:string,description:string)=>state.notifications.unshift({id:id('notice'),recipientId,classId,title,description,createdAt:iso,href:`/${state.users.find(u=>u.id===recipientId)?.role}/classes/${classId}?tab=lessons`});
 const admins=(classId:string,title:string,description:string)=>state.users.filter(u=>u.role==='admin').forEach(u=>notify(u.id,classId,title,description));
 const classNotice=(classId:string,title:string,description:string)=>state.enrollments.filter(e=>e.classId===classId&&e.status==='approved').forEach(e=>notify(e.studentId,classId,title,description));
 const window=(classId:string,start:string,end:string)=>{const c=courseFor(classId);rule(Number.isFinite(Date.parse(start))&&Number.isFinite(Date.parse(end))&&Date.parse(start)>now&&Date.parse(end)>Date.parse(start),'Giờ kết thúc phải sau giờ bắt đầu, lịch học phải ở tương lai.');rule(!expired(c.expiresAt,Date.parse(end)),'Lịch học vượt ngày hết hạn lớp.');};
 const attendance=(lessonId:string,studentId:string)=>{let a=state.attendance.find(a=>a.lessonId===lessonId&&a.studentId===studentId);if(!a){a={lessonId,studentId,recorded:false};state.attendance.push(a);}return a;};
 const remove=(lessonId:string,studentId:string,reason:string)=>{rule(state.attendance.some(a=>a.lessonId===lessonId&&a.studentId===studentId&&a.recorded),'Học viên chưa được điểm danh.');state.attendance.filter(a=>a.lessonId===lessonId&&a.studentId===studentId).forEach(a=>Object.assign(a,{recorded:false,reason}));notify(studentId,lessonFor(lessonId).classId,'Điểm Attendance đã bị xóa',reason);};
 const request=(value:Omit<ApprovalRequest,'id'|'senderId'|'createdAt'|'status'>)=>{const r:ApprovalRequest={...value,id:id('request'),senderId:actor.id,createdAt:iso,status:'waiting'};state.requests.push(r);return r;};
 switch(command.type){
 case 'saveLesson': {
  const l=lessonFor(command.lessonId);teacher(l.classId);rule(l.classId===command.classId&&!['active','completed'].includes(getLessonStatus(state,l.id,now)),'Chọn buổi học chưa hoàn thành trong lớp.');
  rule(!state.requests.some(r=>r.lessonId===l.id&&r.kind==='schedule'&&r.status==='waiting'),'Lịch đang chờ duyệt.');
  rule(command.title.trim()&&command.attendanceCode.trim(),'Nhập tên và mã điểm danh.');window(l.classId,command.startsAt,command.endsAt);
  rule(command.materialIds.every(mid=>state.materials.some(m=>m.id===mid&&m.classId===l.classId&&getMaterialStatus(state,actorId,m,now)==='available')),'Tài liệu không thuộc lớp hoặc đã hết hạn.');
  l.draft={title:command.title.trim(),description:command.description.trim(),startsAt:command.startsAt,endsAt:command.endsAt,materialIds:[...new Set(command.materialIds)],attendanceCode:command.attendanceCode.trim()};
  const s=state.schedules.find(s=>s.lessonId===l.id);
  if(!s)state.schedules.push({id:id('schedule'),lessonId:l.id,startsAt:command.startsAt,endsAt:command.endsAt,status:'draft'});
  else if(['draft','declined','cancelled'].includes(s.status))Object.assign(s,{startsAt:command.startsAt,endsAt:command.endsAt,status:'draft'});
  break;
 }
 case 'submitSchedule': {
  const l=lessonFor(command.lessonId);teacher(l.classId);rule(l.draft&&!['active','completed'].includes(getLessonStatus(state,l.id,now)),'Lưu bản nháp trước khi gửi duyệt.');window(l.classId,l.draft.startsAt,l.draft.endsAt);
  rule(!state.requests.some(r=>r.lessonId===l.id&&r.kind==='schedule'&&r.status==='waiting'),'Lịch đang chờ duyệt.');
  request({kind:'schedule',classId:l.classId,lessonId:l.id,title:`Phê duyệt lịch: ${l.draft.title}`,description:l.draft.description,proposedStartsAt:l.draft.startsAt,proposedEndsAt:l.draft.endsAt,proposalTitle:l.draft.title,proposalDescription:l.draft.description,proposalMaterialIds:l.draft.materialIds,proposalAttendanceCode:l.draft.attendanceCode});
  const s=state.schedules.find(s=>s.lessonId===l.id)!;if(!['approved','confirmed'].includes(s.status))s.status='pending';
  admins(l.classId,'Có lịch học chờ duyệt',l.draft.title);break;
 }
 case 'decideSchedule': {
  admin();const r=state.requests.find(r=>r.id===command.requestId&&['schedule','teacher-leave'].includes(r.kind));rule(r&&r.status==='waiting'&&r.lessonId,'Yêu cầu không còn chờ duyệt.');
  const l=lessonFor(r.lessonId);courseFor(l.classId);const s=state.schedules.find(s=>s.lessonId===l.id);rule(s,'Không có lịch học.');
  if(!command.approved)requireReason(command.reason);
  if(command.approved){
   rule(!['active','completed'].includes(getLessonStatus(state,l.id,now)), 'Buổi học đang diễn ra hoặc đã hoàn thành, không thể đổi lịch.');
   if(r.kind==='teacher-leave'){s.status='cancelled';classNotice(l.classId,'Buổi học được nghỉ',r.description);}
   else {rule(r.proposedStartsAt&&r.proposedEndsAt,'Lịch đề xuất không hợp lệ.');window(l.classId,r.proposedStartsAt,r.proposedEndsAt);if(r.leaveRequestId)rule(state.requests.find(v=>v.id===r.leaveRequestId)?.status==='approved','Duyệt yêu cầu nghỉ trước khi duyệt lịch bù.');Object.assign(s,{startsAt:r.proposedStartsAt,endsAt:r.proposedEndsAt,status:'approved'});Object.assign(l,{name:r.proposalTitle??l.name,description:r.proposalDescription??l.description,materialIds:r.proposalMaterialIds??l.materialIds,attendanceCode:r.proposalAttendanceCode??l.attendanceCode});delete l.draft;classNotice(l.classId,'Lịch học đã được duyệt, chờ xác nhận',`${l.name}: ${s.startsAt}`);}
  }else if(r.kind==='schedule'&&s.status==='pending')s.status='declined';
  if(!command.approved&&r.kind==='teacher-leave')for(const linked of state.requests.filter(v=>v.leaveRequestId===r.id&&v.status==='waiting'))Object.assign(linked,{status:'cancelled',resolvedAt:iso,resolutionReason:command.reason.trim()});
  Object.assign(r,{status:command.approved?'approved':'declined',resolutionReason:command.reason.trim(),resolvedAt:iso});notify(state.classes.find(c=>c.id===l.classId)!.teacherId,l.classId,command.approved?'Yêu cầu đã được duyệt':'Yêu cầu bị từ chối',command.reason.trim()||r.title);break;
 }
 case 'confirmLesson': {
  const l=lessonFor(command.lessonId);teacher(l.classId);const s=state.schedules.find(s=>s.lessonId===l.id);rule(s?.status==='approved'&&!l.completed,'Lịch chưa được duyệt để xác nhận.');rule(now<=Date.parse(s.startsAt)-day,'Đã quá hạn xác nhận trước 24 giờ.');s.status='confirmed';classNotice(l.classId,'Buổi học đã xác nhận',`${l.name}: ${s.startsAt}`);break;
 }
 case 'resolveUnconfirmed': {
  admin(); const l=lessonFor(command.lessonId);courseFor(l.classId);rule(getLessonStatus(state,l.id,now)==='late','Chỉ xử lý lịch đã quá hạn xác nhận.');
  const s=state.schedules.find(s=>s.lessonId===l.id)!; const reason=requireReason(command.reason);window(l.classId,command.startsAt,command.endsAt);rule(Date.parse(command.startsAt)>=now+day,'Lịch bù cần còn ít nhất 24 giờ để giảng viên xác nhận.');
  const missed=Date.parse(s.startsAt)-now<12*3600000;const oldStart=s.startsAt;
  Object.assign(s,{startsAt:command.startsAt,endsAt:command.endsAt,status:'approved'});delete l.draft;
  for(const r of state.requests.filter(r=>r.lessonId===l.id&&r.status==='waiting'&&['schedule','teacher-leave'].includes(r.kind)))Object.assign(r,{status:'cancelled',resolvedAt:iso,resolutionReason:reason});
  const audit=request({kind:'schedule',classId:l.classId,lessonId:l.id,title:`Admin xử lý lịch quá hạn ${l.name}`,description:reason,proposedStartsAt:command.startsAt,proposedEndsAt:command.endsAt});Object.assign(audit,{status:'approved',resolvedAt:iso,resolutionReason:reason});
  const message=`${reason}. Hủy lịch ${oldStart}, lịch bù ${command.startsAt}, chờ giảng viên xác nhận.${missed?' Can thiệp sau hạn thông báo trước 12 giờ.':''}`;
  classNotice(l.classId,'Admin đã đổi lịch buổi học',message);notify(state.classes.find(c=>c.id===l.classId)!.teacherId,l.classId,'Cần xác nhận lịch học bù',message);break;
 }
 case 'requestMakeup': {
  const l=lessonFor(command.lessonId);teacher(l.classId);const s=state.schedules.find(s=>s.lessonId===l.id);rule(s&&['approved','confirmed','cancelled'].includes(s.status)&&!['active','completed'].includes(getLessonStatus(state,l.id,now)),'Lịch chưa được duyệt.');rule(now<=Date.parse(s.startsAt)-day||s.status==='cancelled','Cần xin nghỉ trước ít nhất 24 giờ.');window(l.classId,command.startsAt,command.endsAt);const reason=requireReason(command.reason);
  rule(!state.requests.some(r=>r.lessonId===l.id&&['schedule','teacher-leave'].includes(r.kind)&&r.status==='waiting'),'Đã có yêu cầu đang chờ duyệt.');
  const previousLeave=state.requests.findLast(r=>r.lessonId===l.id&&r.kind==='teacher-leave'&&r.status==='approved');
  const leave=s.status==='cancelled'&&previousLeave?previousLeave:request({kind:'teacher-leave',classId:l.classId,lessonId:l.id,title:`Xin nghỉ ${l.name}`,description:reason});
  request({kind:'schedule',classId:l.classId,lessonId:l.id,title:`Lịch học bù ${l.name}`,description:reason,leaveRequestId:leave.id,proposedStartsAt:command.startsAt,proposedEndsAt:command.endsAt});admins(l.classId,'Yêu cầu nghỉ và lịch học bù',reason);classNotice(l.classId,'Giảng viên đề xuất nghỉ và học bù',reason);break;
 }
 case 'enterAttendance': {
  const l=lessonFor(command.lessonId);rule(actor.role==='student','Chỉ học viên nhập mã điểm danh.');student(l.classId,actor.id);rule(getAttendanceStatus(state,l.id,actor.id,now).open,'Điểm danh chưa mở, đã đóng hoặc đã khóa.');
  const a=attendance(l.id,actor.id);if(command.code===l.attendanceCode&&!!l.attendanceCode){Object.assign(a,{recorded:true,recordedAt:iso,recordedBy:actor.id});notify(actor.id,l.classId,'Đã điểm danh thành công',l.name);}else a.failures=(a.failures??0)+1;break;
 }
 case 'manualAttendance': {
  const l=lessonFor(command.lessonId);teacher(l.classId);student(l.classId,command.studentId);rule(getLessonStatus(state,l.id,now)==='active','Chỉ điểm danh thủ công trong buổi học đã xác nhận.');const reason=requireReason(command.reason);const status=getAttendanceStatus(state,l.id,command.studentId,now);rule(!status.recorded&&!status.absence,'Học viên đã điểm danh hoặc đã xin nghỉ.');Object.assign(attendance(l.id,command.studentId),{recorded:true,recordedAt:iso,recordedBy:actor.id,reason});notify(command.studentId,l.classId,'Đã điểm danh thành công',reason);break;
 }
 case 'requestAbsence': {
  const l=lessonFor(command.lessonId);rule(actor.role==='student','Chỉ học viên xin nghỉ.');student(l.classId,actor.id);const s=state.schedules.find(s=>s.lessonId===l.id);rule(s&&['approved','confirmed'].includes(s.status)&&now<Date.parse(s.endsAt),'Buổi học đã kết thúc hoặc chưa được duyệt.');const status=getAttendanceStatus(state,l.id,actor.id,now);rule(!status.recorded&&!status.absence,'Đã điểm danh hoặc đã xin nghỉ.');const reason=requireReason(command.reason);attendance(l.id,actor.id).absenceReason=reason;const r=request({kind:'absence',classId:l.classId,lessonId:l.id,title:`Xin nghỉ ${l.name}`,description:reason});r.status='approved';r.resolvedAt=iso;notify(state.classes.find(c=>c.id===l.classId)!.teacherId,l.classId,'Học viên xin nghỉ',`${actor.name}: ${reason}`);notify(actor.id,l.classId,'Xin nghỉ đã được chấp thuận','Không tính Attendance cho buổi này.');break;
 }
 case 'requestAttendanceCorrection': {
  const l=lessonFor(command.lessonId);teacher(l.classId);student(l.classId,command.studentId);rule(state.attendance.some(a=>a.lessonId===l.id&&a.studentId===command.studentId&&a.recorded),'Học viên chưa được điểm danh.');const reason=requireReason(command.reason);rule(!state.requests.some(r=>r.kind==='attendance-correction'&&r.lessonId===l.id&&r.studentId===command.studentId&&r.status==='waiting'),'Yêu cầu đang chờ duyệt.');request({kind:'attendance-correction',classId:l.classId,lessonId:l.id,studentId:command.studentId,title:`Xóa Attendance ${l.name}`,description:reason});admins(l.classId,'Yêu cầu xóa Attendance',reason);break;
 }
 case 'decideAttendanceCorrection': {
  admin();const r=state.requests.find(r=>r.id===command.requestId&&r.kind==='attendance-correction');rule(r&&r.status==='waiting'&&r.lessonId&&r.studentId,'Yêu cầu không còn chờ duyệt.');courseFor(r.classId);if(command.approved)remove(r.lessonId,r.studentId,r.description);else requireReason(command.reason);Object.assign(r,{status:command.approved?'approved':'declined',resolvedAt:iso,resolutionReason:command.reason.trim()});notify(state.classes.find(c=>c.id===r.classId)!.teacherId,r.classId,'Đã xử lý yêu cầu Attendance',command.reason.trim()||r.title);break;
 }
 case 'removeAttendance': {admin();const l=lessonFor(command.lessonId);courseFor(l.classId);remove(l.id,command.studentId,requireReason(command.reason));break;}
 }
 state.referenceTime=iso;return state;
}



