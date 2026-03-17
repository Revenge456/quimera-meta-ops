import { UnauthorizedException } from '@nestjs/common';

import type { AuthUser } from '../types/auth-user.type';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const makeContext = (user?: AuthUser) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it('allows admins on admin-only routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };

    const guard = new RolesGuard(reflector as never);

    const allowed = guard.canActivate(
      makeContext({
        sub: 'admin-1',
        email: 'admin@quimera.local',
        nombre: 'Admin',
        role: 'admin',
      }),
    );

    expect(allowed).toBe(true);
  });

  it('denies commercial managers on admin-only routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };

    const guard = new RolesGuard(reflector as never);

    const allowed = guard.canActivate(
      makeContext({
        sub: 'manager-1',
        email: 'manager@quimera.local',
        nombre: 'Manager',
        role: 'commercial_manager',
      }),
    );

    expect(allowed).toBe(false);
  });

  it('throws when a protected route has no authenticated user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    };

    const guard = new RolesGuard(reflector as never);

    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
  });
});
