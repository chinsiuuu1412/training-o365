import type { Class } from '../../types/lms.ts';

const vietnamDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
export function dateInVietnam(now: number) { return vietnamDate.format(new Date(now)); }
export function validClassDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
export function isClassExpired(course: Class, now: number) { return course.expiresAt < dateInVietnam(now); }
