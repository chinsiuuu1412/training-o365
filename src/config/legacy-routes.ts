const managerSections = new Set(['classes', 'library', 'notifications', 'profile', 'settings']);
export function legacyDestination(pathname: string, query = ''): string | null {
  let destination: string;
  if (pathname === '/admin/teachers') destination = '/admin/managers';
  else if (pathname === '/teacher' || pathname === '/teacher/') destination = '/manager';
  else {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'teacher' || !managerSections.has(segments[1])) return null;
    if (!segments.every(part => /^[a-zA-Z0-9_-]+$/.test(part))) return null;
    if (segments.length > 2 && !(segments[1] === 'classes' && (segments.length === 3 || (segments.length === 5 && segments[3] === 'quizzes')))) return null;
    destination = '/manager/' + segments.slice(1).join('/');
  }
  const allowed = new URLSearchParams();
  const supplied = new URLSearchParams(query);
  for (const key of ['tab', 'classId']) { const value = supplied.get(key); if (value && /^[a-zA-Z0-9_-]+$/.test(value)) allowed.set(key, value); }
  return destination + (allowed.size ? '?' + allowed.toString() : '');
}
