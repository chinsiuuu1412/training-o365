import type { AttendanceOverride, LessonDraft, LmsState } from '../../types/lms.ts';
import { currentCycleId, inEnrollmentCycle } from './enrollment-cycles.ts';
import { isClassExpired } from './class-policy.ts';
import { getMaterialStatus } from './library.ts';

type DeferredLessonCommand = { type: 'confirmLesson'; lessonId: string }
 | { type: 'decideAttendanceCorrection'; requestId: string; approved: boolean; reason: string }
 | { type: 'requestMakeup' | 'resolveUnconfirmed'; lessonId: string; startsAt: string; endsAt: string; reason: string }
 | { type: 'manualAttendance' | 'requestAttendanceCorrection' | 'removeAttendance'; lessonId: string; studentId: string; reason: string };
export type LessonCommand = DeferredLessonCommand
 | ({ type: 'saveLesson'; lessonId: string; classId: string } & LessonDraft)
 | { type: 'submitSchedule'; lessonId: string }
 | { type: 'decideSchedule'; requestId: string; approved: boolean; reason: string }
 | { type: 'enterAttendance'; lessonId: string; code: string }
 | { type: 'overrideAttendance'; lessonId: string; studentId: string; recorded: boolean; reason: string }
 | { type: 'requestAbsence'; lessonId: string; reason: string };
const deferred = ['confirmLesson','decideAttendanceCorrection','requestMakeup','resolveUnconfirmed','manualAttendance','requestAttendanceCorrection','removeAttendance'];
export const lessonCommandTypes = ['saveLesson','submitSchedule','decideSchedule','enterAttendance','overrideAttendance','requestAbsence',...deferred];
function rule(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function effectiveSchedule(state: LmsState, lessonId: string) {
 return state.schedules.find(schedule=>schedule.lessonId===lessonId&&['approved','confirmed'].includes(schedule.status));
}
export function getLessonStatus(state: LmsState, lessonId: string, now: number): string {
 const schedule=effectiveSchedule(state,lessonId);
 if(schedule)return now>=Date.parse(schedule.endsAt)?'completed':now>=Date.parse(schedule.startsAt)?'active':'approved';
 const lesson=state.lessons.find(item=>item.id===lessonId);
 if(lesson?.completed)return 'completed'; // Legacy historical record; not a new approval.
 const pending=state.schedules.find(item=>item.lessonId===lessonId);
 return pending?.status==='pending'?'waiting':pending?.status??'draft';
}
export function getAttendanceStatus(state: LmsState, lessonId: string, studentId: string, now: number) {
 const lesson=state.lessons.find(item=>item.id===lessonId),course=state.classes.find(item=>item.id===lesson?.classId);
 const rows=course?state.attendance.filter(record=>record.lessonId===lessonId&&record.studentId===studentId&&inEnrollmentCycle(state,course.id,studentId,record)):[];
 const recorded=rows.some(record=>record.recorded), failures=Math.max(0,...rows.map(record=>record.failures??0)), absence=rows.some(record=>!!record.absenceReason),revoked=rows.some(record=>record.codeEntryRevoked);
 const eligible=!!course&&!isClassExpired(course,now)&&state.users.some(user=>user.id===studentId&&user.role==='student'&&user.status!=='suspended')&&state.enrollments.some(item=>item.classId===course.id&&item.studentId===studentId&&item.status==='approved');
 return { recorded,failures,absence,revoked,eligible,open:eligible&&!recorded&&!absence&&!revoked&&failures<3&&getLessonStatus(state,lessonId,now)==='active',locked:failures>=3,remaining:Math.max(0,3-failures),feedback:recorded?'Đã điểm danh thành công':failures?'Bạn chưa nhập đúng mã, bạn còn '+Math.max(0,3-failures)+' lượt nhập':'' };
}
export function getAttendanceHistory(state: LmsState, actorId: string, lessonId: string, studentId: string) {
 const actor=state.users.find(user=>user.id===actorId),lesson=state.lessons.find(item=>item.id===lessonId),course=state.classes.find(item=>item.id===lesson?.classId);
 if(!actor||actor.status==='suspended'||!course||!(actor.role==='admin'||actor.role==='manager'&&course.managerId===actorId||actor.role==='student'&&actorId===studentId))return [];
 return (state.attendanceOverrides??[]).filter(event=>event.lessonId===lessonId&&event.studentId===studentId&&inEnrollmentCycle(state,course.id,studentId,event)).map(event=>({...event,actorName:state.users.find(user=>user.id===event.actorId)?.name??'Quản lý lớp'}));
}
export function migrateScheduleAttendance(original: LmsState): LmsState {
 if(original.lessonWorkflowVersion===2)return original;
 const state=structuredClone(original);
 state.lessonWorkflowVersion=2;state.attendanceOverrides??=[];
 for(const schedule of state.schedules)if(schedule.status==='confirmed')schedule.status='approved';
 for(const request of state.requests)if(request.status==='waiting'&&(['manager-leave','attendance-correction'].includes(request.kind)||request.kind==='schedule'&&request.leaveRequestId))Object.assign(request,{status:'cancelled',resolvedAt:state.referenceTime,resolutionReason:'Luồng này đã chuyển sang SAU MVP; không tự phê duyệt hoặc thay đổi Attendance/lịch.'});
 state.notifications=state.notifications.filter(notification=>!notification.id.startsWith('unconfirmed-'));
 for(const notification of state.notifications) {
  notification.title=notification.title.replace('đã xác nhận','đã được duyệt').replace(/, chờ xác nhận/gi,'');
  notification.description=notification.description.replace('sau buổi đã xác nhận','sau buổi đã được duyệt').replace(/Manager cần xác nhận[^.]*\./gi,'Lịch được duyệt có hiệu lực ngay.');
 }
 return state;
}
export function executeLesson(original:LmsState,actorId:string,command:LessonCommand,now:number):LmsState {
 rule(!deferred.includes(command.type),'Thao tác này không thuộc MVP; Admin chỉ xem Attendance, không có bước xác nhận 24 giờ.');
 const state=structuredClone(original),actor=state.users.find(user=>user.id===actorId);
 rule(actor&&actor.status!=='suspended','Tài khoản không hoạt động.');
 state.attendanceOverrides??=[];
 const iso=new Date(now).toISOString();
 const id=(prefix:string)=>prefix+'-'+now+'-'+state.requests.length+'-'+state.notifications.length+'-'+state.schedules.length;
 const explanation=(value:string)=>{rule(value.trim(),'Vui lòng nhập lý do.');return value.trim();};
 const lessonFor=(lessonId:string)=>{const lesson=state.lessons.find(item=>item.id===lessonId);rule(lesson,'Buổi học không tồn tại.');return lesson;};
 const courseFor=(classId:string)=>{const course=state.classes.find(item=>item.id===classId);rule(course&&!isClassExpired(course,now),'Lớp không tồn tại hoặc đã hết hạn.');return course;};
 const manager=(classId:string)=>{const course=courseFor(classId);rule(actor.role==='manager'&&course.managerId===actor.id,'Bạn không phụ trách lớp học này.');return course;};
 const student=(classId:string,studentId:string)=>{courseFor(classId);rule(state.users.some(user=>user.id===studentId&&user.role==='student'&&user.status!=='suspended')&&state.enrollments.some(item=>item.classId===classId&&item.studentId===studentId&&item.status==='approved'),'Học viên không có quyền truy cập lớp.');};
 const notify=(recipientId:string,classId:string,title:string,description:string)=>state.notifications.push({id:id('lesson-notice'),recipientId,classId,title,description,createdAt:iso,href:state.users.find(user=>user.id===recipientId)?.role==='admin'?'/admin/schedule-approvals':'/'+state.users.find(user=>user.id===recipientId)?.role+'/classes/'+classId+'?tab=lessons'});
 const validWindow=(classId:string,start:string,end:string)=>{const course=courseFor(classId);rule(Number.isFinite(Date.parse(start))&&Number.isFinite(Date.parse(end))&&Date.parse(start)>now&&Date.parse(end)>Date.parse(start),'Lịch học phải ở tương lai, giờ kết thúc sau giờ bắt đầu.');rule(!isClassExpired(course,Date.parse(end)-1),'Lịch học vượt ngày hết hạn lớp.');};
 const attendance=(lessonId:string,studentId:string)=>{const classId=lessonFor(lessonId).classId;let row=state.attendance.find(item=>item.lessonId===lessonId&&item.studentId===studentId&&inEnrollmentCycle(state,classId,studentId,item));if(!row){row={lessonId,studentId,cycleId:currentCycleId(state,classId,studentId),recorded:false};state.attendance.push(row);}return row;};
 switch(command.type){
 case 'saveLesson': {
  const lesson=lessonFor(command.lessonId);manager(lesson.classId);rule(lesson.classId===command.classId&&!['active','completed'].includes(getLessonStatus(state,lesson.id,now)),'Không sửa buổi đang diễn ra/đã hoàn thành.');
  rule(!state.requests.some(request=>request.lessonId===lesson.id&&request.kind==='schedule'&&request.status==='waiting'),'Lịch đang chờ duyệt.');
  rule(command.title.trim()&&command.attendanceCode.trim(),'Nhập tiêu đề và mã điểm danh.');validWindow(lesson.classId,command.startsAt,command.endsAt);
  rule(command.materialIds.every(mid=>state.materials.some(material=>material.id===mid&&material.classId===lesson.classId&&getMaterialStatus(state,actorId,material,now)==='available')),'Tài liệu không thuộc lớp hoặc không khả dụng.');
  lesson.draft={location:command.location?.trim()??'',title:command.title.trim(),description:command.description.trim(),startsAt:command.startsAt,endsAt:command.endsAt,materialIds:[...new Set(command.materialIds)],attendanceCode:command.attendanceCode.trim()};
  const schedule=state.schedules.find(item=>item.lessonId===lesson.id);
  if(!schedule)state.schedules.push({id:id('schedule'),lessonId:lesson.id,startsAt:command.startsAt,endsAt:command.endsAt,status:'draft'});
  else if(!effectiveSchedule(state,lesson.id))Object.assign(schedule,{startsAt:command.startsAt,endsAt:command.endsAt,status:'draft'});
  break;
 }
 case 'submitSchedule': {
  const lesson=lessonFor(command.lessonId);manager(lesson.classId);rule(lesson.draft&&!['active','completed'].includes(getLessonStatus(state,lesson.id,now)),'Lưu bản nháp hợp lệ trước khi gửi.');
  validWindow(lesson.classId,lesson.draft.startsAt,lesson.draft.endsAt);rule(!state.requests.some(request=>request.lessonId===lesson.id&&request.kind==='schedule'&&request.status==='waiting'),'Lịch đang chờ duyệt.');
  const draft=lesson.draft;
  state.requests.push({id:id('schedule-request'),classId:lesson.classId,senderId:actor.id,lessonId:lesson.id,kind:'schedule',title:'Phê duyệt lịch: '+draft.title,description:draft.description,createdAt:iso,status:'waiting',proposedStartsAt:draft.startsAt,proposedEndsAt:draft.endsAt,proposalTitle:draft.title,proposalLocation:draft.location,proposalDescription:draft.description,proposalMaterialIds:[...draft.materialIds],proposalAttendanceCode:draft.attendanceCode});
  const schedule=state.schedules.find(item=>item.lessonId===lesson.id)!;if(!effectiveSchedule(state,lesson.id))schedule.status='pending';
  for(const admin of state.users.filter(user=>user.role==='admin'))notify(admin.id,lesson.classId,'Có lịch học chờ duyệt',draft.title);break;
 }
 case 'decideSchedule': {
  rule(actor.role==='admin','Chỉ Admin duyệt lịch.');
  const request=state.requests.find(item=>item.id===command.requestId&&item.kind==='schedule'&&!item.leaveRequestId);
  rule(request&&request.status==='waiting'&&request.lessonId,'Yêu cầu không còn chờ duyệt hoặc thuộc luồng SAU MVP.');
  const lesson=lessonFor(request.lessonId);courseFor(lesson.classId);const schedule=state.schedules.find(item=>item.lessonId===lesson.id);rule(schedule,'Không có lịch học.');
  if(command.approved){
   rule(!['active','completed'].includes(getLessonStatus(state,lesson.id,now)),'Buổi học đang diễn ra hoặc đã hoàn thành, không thể đổi lịch.');
   rule(request.proposedStartsAt&&request.proposedEndsAt,'Đề xuất thiếu thời gian.');validWindow(lesson.classId,request.proposedStartsAt,request.proposedEndsAt);
   Object.assign(schedule,{startsAt:request.proposedStartsAt,endsAt:request.proposedEndsAt,status:'approved'});
   Object.assign(lesson,{location:request.proposalLocation??lesson.location,name:request.proposalTitle??lesson.name,description:request.proposalDescription??lesson.description,materialIds:request.proposalMaterialIds??lesson.materialIds,attendanceCode:request.proposalAttendanceCode??lesson.attendanceCode});delete lesson.draft;
   for(const enrollment of state.enrollments.filter(item=>item.classId===lesson.classId&&item.status==='approved'))notify(enrollment.studentId,lesson.classId,'Lịch học đã được duyệt',lesson.name+': '+schedule.startsAt);
  }else{explanation(command.reason);if(schedule.status==='pending')schedule.status='declined';}
  Object.assign(request,{status:command.approved?'approved':'declined',resolvedAt:iso,resolutionReason:command.reason.trim()});
  notify(state.classes.find(course=>course.id===lesson.classId)!.managerId,lesson.classId,command.approved?'Lịch đã được duyệt':'Lịch bị từ chối',command.reason.trim()||request.title);break;
 }
 case 'enterAttendance': {
  const lesson=lessonFor(command.lessonId);rule(actor.role==='student','Chỉ Student nhập mã.');student(lesson.classId,actor.id);
  const status=getAttendanceStatus(state,lesson.id,actor.id,now);if(status.recorded)return original;
  rule(status.open,'Điểm danh chưa mở, đã đóng hoặc đã khóa.');
  const row=attendance(lesson.id,actor.id);
  if(command.code===lesson.attendanceCode&&!!lesson.attendanceCode){Object.assign(row,{recorded:true,recordedAt:iso,recordedBy:actor.id});notify(actor.id,lesson.classId,'Đã điểm danh thành công',lesson.name);}
  else row.failures=(row.failures??0)+1;break;
 }
 case 'overrideAttendance': {
  const lesson=lessonFor(command.lessonId);manager(lesson.classId);student(lesson.classId,command.studentId);
  const schedule=effectiveSchedule(state,lesson.id);rule(schedule&&now>=Date.parse(schedule.startsAt),'Chỉ override buổi đã duyệt từ giờ bắt đầu trở đi.');
  rule(typeof command.recorded==='boolean','Trạng thái Attendance không hợp lệ.');const reason=explanation(command.reason),row=attendance(lesson.id,command.studentId);
  const before=getAttendanceStatus(state,lesson.id,command.studentId,now).recorded;
  for(const record of state.attendance.filter(item=>item.lessonId===lesson.id&&item.studentId===command.studentId&&inEnrollmentCycle(state,lesson.classId,command.studentId,item)))Object.assign(record,{recorded:command.recorded,codeEntryRevoked:true,recordedBy:actor.id,recordedAt:iso,reason});
  const event:AttendanceOverride={id:'override-'+now+'-'+state.attendanceOverrides.length,lessonId:lesson.id,studentId:command.studentId,cycleId:row.cycleId??currentCycleId(state,lesson.classId,command.studentId)!,actorId:actor.id,at:iso,before,after:command.recorded,reason};
  state.attendanceOverrides.push(event);notify(command.studentId,lesson.classId,'Manager đã cập nhật Attendance',(command.recorded?'Đã ghi nhận tham gia. ':'Không được ghi nhận Attendance. ')+reason);break;
 }
 case 'requestAbsence': {
  const lesson=lessonFor(command.lessonId);rule(actor.role==='student','Chỉ Student gửi xin nghỉ.');student(lesson.classId,actor.id);
  const schedule=effectiveSchedule(state,lesson.id);rule(schedule&&now<Date.parse(schedule.endsAt),'Buổi chưa được duyệt hoặc đã kết thúc.');
  const status=getAttendanceStatus(state,lesson.id,actor.id,now);rule(!status.recorded&&!status.absence,'Đã điểm danh hoặc đã gửi xin nghỉ.');
  const reason=explanation(command.reason);attendance(lesson.id,actor.id).absenceReason=reason;
  state.requests.push({id:id('absence'),classId:lesson.classId,lessonId:lesson.id,cycleId:currentCycleId(state,lesson.classId,actor.id),senderId:actor.id,kind:'absence',title:'Xin nghỉ '+lesson.name,description:reason,createdAt:iso,status:'approved',resolvedAt:iso});
  notify(state.classes.find(course=>course.id===lesson.classId)!.managerId,lesson.classId,'Học viên xin nghỉ',actor.name+': '+reason);notify(actor.id,lesson.classId,'Xin nghỉ đã tự duyệt','Không cấp Attendance; kết quả Quiz tính riêng.');break;
 }
 }
 state.referenceTime=iso;return state;
}



