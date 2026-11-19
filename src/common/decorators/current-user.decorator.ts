import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  firstName?: string | null;
  lastName?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.session?.user;
    if (!user) return null;
    return data ? user[data] : user;
  },
);
