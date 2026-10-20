import { UserRoleEnum } from '@prisma/client';
import {
  ROLES_KEY,
  REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';
import { IssuesController } from '../src/modules/issues/issues.controller';
import {
  ISSUE_TRIAGE_ROLES,
  ISSUE_REOPEN_ROLES,
} from '../src/modules/issues/issues.service';

describe('IssuesController updateStatus authorization metadata', () => {
  it('PATCH :id/status is restricted to the issue triage roles', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      (IssuesController.prototype as any).updateStatus,
    );

    expect(roles).toEqual([...ISSUE_TRIAGE_ROLES]);
    expect(roles).not.toContain(UserRoleEnum.WORKER);
    expect(roles).not.toContain(UserRoleEnum.TEAM_LEADER);
    expect(roles).not.toContain(UserRoleEnum.FOREMAN);
    expect(roles).not.toContain(UserRoleEnum.TECHNICIAN);
  });

  it('PATCH :id/status resolves project access from the issue entity via the id param', () => {
    const meta = Reflect.getMetadata(
      REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
      (IssuesController.prototype as any).updateStatus,
    );

    expect(meta).toEqual({ model: 'issue', param: 'id' });
  });

  it('reopen roles are a strict subset of triage roles (consistent UI/server expectations)', () => {
    for (const role of ISSUE_REOPEN_ROLES) {
      expect(ISSUE_TRIAGE_ROLES).toContain(role);
    }
  });
});
