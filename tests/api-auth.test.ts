import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api/client.ts';
import { AuthService } from '../src/lib/api/auth.ts';
import { createFixtureTransport } from '../src/mocks/api-fixture.ts';

test('three roles pass through wire DTO adapter; staff nullable fields and Student leading zeros survive',async()=>{
 for(const [email,role] of [['admin@example.test','admin'],['manager1@example.test','manager'],['student001@sis.hust.edu.vn','student']] as const){
 const fixture=createFixtureTransport();const auth=new AuthService(new ApiClient(fixture.transport));
 const user=await auth.login(email,'O365-demo-12345');assert.equal(user.role,role);assert.equal((await auth.me()).id,user.id);
 if(role==='student'){assert.equal(user.studentNumber,'000123456');assert.equal(user.phone,'0912345678');}else assert.equal(user.studentNumber,undefined);
 await auth.logout();await assert.rejects(()=>auth.me(),e=>e instanceof ApiError&&e.status===401);
 }
});
test('restore network/5xx failures permit retry without treating the cookie session as lost',async()=>{
 const fixture=createFixtureTransport();let lost=0;const auth=new AuthService(new ApiClient(fixture.transport,()=>lost++));
 await auth.login('admin@example.test','O365-demo-12345');
 for(const failure of ['network','server'] as const){fixture.setRestoreFailure(failure);await assert.rejects(()=>auth.me());assert.equal(lost,0);fixture.setRestoreFailure(null);assert.equal((await auth.me()).role,'admin');}
 fixture.setRestoreFailure('unauthenticated');await assert.rejects(()=>auth.me());assert.equal(lost,1);
});
test('password validates UTF-8 bytes, requires current password, revokes session and CSRF',async()=>{
 const fixture=createFixtureTransport();const auth=new AuthService(new ApiClient(fixture.transport));await auth.login('admin@example.test','O365-demo-12345');
 await assert.rejects(()=>auth.changePassword('wrong','New-demo-password-123'),e=>e instanceof ApiError&&e.code==='invalid_current_password');
 await assert.rejects(()=>auth.changePassword('O365-demo-12345','ắ'.repeat(25)),/12–72/);
 await auth.changePassword('O365-demo-12345','New-demo-password-123');await assert.rejects(()=>auth.me());
 assert.equal((await auth.login('admin@example.test','New-demo-password-123')).role,'admin');
});
