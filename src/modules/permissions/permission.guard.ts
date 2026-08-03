import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionRequirement } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new UnauthorizedException();

    const role: string = user.Role ?? user.role ?? '';
    if (!role) throw new ForbiddenException('No role assigned');

    const allowed = await this.permissions.isAllowed(role, requirement.resource, requirement.action);
    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
