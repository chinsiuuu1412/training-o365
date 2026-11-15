import type { User, Role } from '../../types/lms.ts';
export type Reader<T>=(value:unknown)=>T;
export type UserId=number&{readonly idKind:'user'};
export type RequestId=number&{readonly idKind:'request'};
export type EnrollmentId=number&{readonly idKind:'enrollment'};
export const userId=(value:unknown)=>positiveId(value) as UserId;
export const requestId=(value:unknown)=>positiveId(value) as RequestId;
export const enrollmentId=(value:unknown)=>positiveId(value) as EnrollmentId;
export function bool(value:unknown){if(typeof value!=='boolean')throw new Error('DTO cần boolean.');return value;}
export function numeric(value:unknown){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('DTO cần số hữu hạn.');return value;}
export function count(value:unknown){const result=numeric(value);if(!Number.isSafeInteger(result)||result<0)throw new Error('Bộ đếm không hợp lệ.');return result;}
export function items<T>(value:unknown,reader:Reader<T>){if(!Array.isArray(value))throw new Error('DTO cần mảng.');return value.map(reader);}
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DTO không phải object.');return value as Record<string,unknown>;}
export const text:Reader<string>=value=>{if(typeof value!=='string')throw new Error('DTO cần chuỗi.');return value;};
export const positiveId:Reader<number>=value=>{if(!Number.isSafeInteger(value)||(value as number)<1)throw new Error('ID không hợp lệ.');return value as number;};
export const flag:Reader<boolean>=value=>{if(value!==0&&value!==1)throw new Error('Cờ phải là 0 hoặc 1.');return value===1;};
export const nullable=<T>(read:Reader<T>):Reader<T|null>=>value=>value===null?null:read(value);
export function pageOf<T>(read:Reader<T>){return (value:unknown)=>{const row=object(value);if(!Array.isArray(row.items))throw new Error('items phải là mảng.');const page=positiveId(row.page),pageSize=positiveId(row.page_size);if(page>1000000||pageSize>100)throw new Error('Phân trang ngoài giới hạn.');return {items:row.items.map(read),page,pageSize,total:count(row.total)};};}
export function userFromDto(value:unknown):User{
 const row=object(value),apiRole=text(row.role);const role:Role=apiRole==='class_manager'?'manager':apiRole==='admin'?'admin':apiRole==='student'?'student':(()=>{throw new Error('Vai trò không hợp lệ.');})();
 if(typeof row.is_active!=='boolean')throw new Error('is_active phải là boolean.');
 const fields=['student_id','school_or_institute','university_class','phone_number','gender'] as const;
 const profile=Object.fromEntries(fields.map(key=>[key,nullable(text)(row[key])]));
 if(role!=='student'&&fields.some(key=>profile[key]!==null))throw new Error('Hồ sơ staff phải null.');
 if(role==='student'&&(!/^[0-9]{9}$/.test(profile.student_id??'')||!/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(profile.phone_number??'')||!profile.school_or_institute?.trim()||!profile.university_class?.trim()||!/@sis\.hust\.edu\.vn$/i.test(text(row.email))))throw new Error('Hồ sơ Student không đúng contract.');
 if(profile.gender!==null&&!['male','female','other'].includes(profile.gender!))throw new Error('Giới tính không hợp lệ.');
 const name=text(row.full_name);
 return {id:String(positiveId(row.id)),role,name,email:text(row.email),initials:name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(-2).join(''),status:row.is_active?'active':'suspended',studentNumber:profile.student_id??undefined,school:profile.school_or_institute??undefined,universityClass:profile.university_class??undefined,phone:profile.phone_number??undefined,gender:profile.gender??undefined};
}
