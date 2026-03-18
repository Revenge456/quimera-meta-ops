import 'reflect-metadata';

import { ROLES_KEY } from '../../shared/decorators/roles.decorator';
import { MetaConnectionsController } from './meta-connections.controller';

describe('MetaConnectionsController', () => {
  it('requires admin role for credential mutation endpoints', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.create),
    ).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.validate),
    ).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.discover),
    ).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.attach),
    ).toEqual(['admin']);
  });

  it('allows read-only connection visibility to admins and commercial managers', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.list),
    ).toEqual(['admin', 'commercial_manager']);
    expect(
      Reflect.getMetadata(ROLES_KEY, MetaConnectionsController.prototype.detail),
    ).toEqual(['admin', 'commercial_manager']);
  });
});
