import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { isValid, parse } from '@tma.js/init-data-node'
import type { Request } from 'express'
import { type AppConfig, CONFIG } from '../config'
import type { User } from '../users/users.repository'
import { UsersService } from '../users/users.service'

type AuthedRequest = Request & { user?: User }

const ONE_DAY_SECONDS = 24 * 60 * 60

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const [scheme, initData] = (req.headers.authorization ?? '').split(' ')
    if (scheme !== 'tma' || !initData) throw new UnauthorizedException()
    if (!isValid(initData, this.config.botToken, { expiresIn: ONE_DAY_SECONDS })) {
      throw new UnauthorizedException()
    }
    const tgUser = parse(initData).user
    if (!tgUser) throw new UnauthorizedException()
    req.user = await this.users.signIn({
      id: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
    })
    return true
  }
}

@Injectable()
export class CoachGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    if (req.user?.role !== 'COACH') throw new ForbiddenException()
    return true
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user
  if (!user) throw new UnauthorizedException()
  return user
})
