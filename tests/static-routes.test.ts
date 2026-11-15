import test from 'node:test';
import assert from 'node:assert/strict';
import { detailHref, staticDestination, stripBasePath, validRouteId } from '../src/config/routes.ts';

test('IDs created after build live on the same static query page without an ID allowlist',()=>{
 assert.equal(detailHref('manager','908172'),'/manager/classes/?classId=908172');
 assert.equal(detailHref('student','908172','777777'),'/student/classes/?classId=908172&quizId=777777');
 assert(validRouteId('908172'));assert(!validRouteId('9007199254740992'));assert(!validRouteId('../admin'));assert(validRouteId('giai-tich',true));
});
test('legacy links preserve IDs/tab, reject unsafe URLs and handle a configured Pages base path',()=>{
 assert.equal(staticDestination('/teacher/classes/908172?tab=lessons'),'/manager/classes/?classId=908172&tab=lessons');
 assert.equal(staticDestination('/student/classes/908172/quizzes/777777'),'/student/classes/?classId=908172&quizId=777777');
 assert.equal(staticDestination('/admin/teachers'),'/admin/managers/');
 assert.equal(staticDestination('https://evil.test/teacher'),null);assert.equal(staticDestination('/teacher/classes/%2fadmin'),null);
 assert.equal(stripBasePath('/training-o365/student/classes/','/training-o365'),'/student/classes/');
 assert.equal(stripBasePath('/training-o365-other/student/','/training-o365'),null);
});
