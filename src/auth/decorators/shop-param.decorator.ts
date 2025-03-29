import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ShopParam = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.params[data];
  }
);
