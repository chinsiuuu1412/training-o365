import type { LmsState, User } from '../../types/lms.ts';

export type AccountInput = Pick<User, 'name' | 'email' | 'phone' | 'studentNumber' | 'school' | 'universityClass' | 'gender'> & { role: 'student' | 'manager'; userId?: string };

export function validateAccount(state: Pick<LmsState, 'users'>, input: AccountInput) {
  const name = input.name.trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const phone = (input.phone ?? '').trim();
  const studentNumber = input.studentNumber?.trim();
  const school = input.school?.trim();
  const universityClass = input.universityClass?.trim();
  if (!['student', 'manager'].includes(input.role)) throw new Error('Vai trò tài khoản không hợp lệ.');
  if (!name) throw new Error('Họ tên: vui lòng nhập họ tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email: địa chỉ không hợp lệ.');
  if (state.users.some(user => user.id !== input.userId && user.email?.trim().toLowerCase() === email)) throw new Error('Email: tài khoản đã tồn tại.');
  if (input.role === 'student') {
    if (email.split('@')[1] !== 'sis.hust.edu.vn') throw new Error('Email: học viên phải dùng đúng @sis.hust.edu.vn.');
    if (!studentNumber) throw new Error('MSSV: vui lòng nhập mã số sinh viên.');
    if (state.users.some(user => user.id !== input.userId && user.role === 'student' && user.studentNumber === studentNumber)) throw new Error('MSSV: mã số sinh viên đã tồn tại.');
    if (!school) throw new Error('Trường/Viện HUST: vui lòng nhập đơn vị đào tạo.');
    if (!universityClass) throw new Error('Lớp–Khóa đại học: vui lòng nhập thông tin.');
    if (!phone) throw new Error('SĐT: vui lòng nhập số điện thoại.');
  }
  return { name, email, phone, studentNumber: input.role === 'student' ? studentNumber : undefined, school: input.role === 'student' ? school : undefined, universityClass: input.role === 'student' ? universityClass : undefined, gender: input.role === 'student' ? input.gender?.trim() : undefined };
}
