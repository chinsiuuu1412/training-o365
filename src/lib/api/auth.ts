import type { User } from '../../types/lms.ts';
import { ApiClient, ApiError } from './client.ts';
import { object, text, userFromDto } from './dto.ts';
export class AuthService{
 private client:ApiClient;
 constructor(client:ApiClient){this.client=client;}
 private readSession(value:unknown):User{try{const dto=object(value),user=userFromDto(dto.user),csrf=text(dto.csrf_token);if(!csrf||user.status!=='active')throw new Error();this.client.setCsrf(csrf);return user;}catch{throw new ApiError('Dữ liệu phiên không đúng contract.',{code:'invalid_response',kind:'protocol'});}}
 async login(email:string,password:string){return this.readSession(await this.client.request('/auth/login',{method:'POST',public:true,body:{email:email.trim(),password}}));}
 async me(){return this.readSession(await this.client.request('/auth/me'));}
 async logout(){await this.client.request('/auth/logout',{method:'POST'});this.client.setCsrf(null);}
 async changePassword(currentPassword:string,newPassword:string){const size=new TextEncoder().encode(newPassword).length;if(size<12||size>72)throw new Error('Mật khẩu mới phải dài 12–72 byte UTF-8.');await this.client.request('/auth/change-password',{method:'POST',body:{current_password:currentPassword,new_password:newPassword}});this.client.setCsrf(null);}
}
