import { ROUTE_ROLES } from './route-roles';
import { canRoleAccess, MOBILE_DESTINATIONS, NAV_GROUPS } from './navigation';

describe('application navigation contract', () => {
  const groupsByTitle = Object.fromEntries(
    NAV_GROUPS.map((group) => [group.titleKey, group.items.map((item) => item.href)]),
  );

  it('preserves mobile destinations and keeps each desktop route unique and guarded', () => {
    const desktopHrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    const mobileHrefs = Object.keys(MOBILE_DESTINATIONS);

    expect(new Set(desktopHrefs).size).toBe(desktopHrefs.length);
    expect(mobileHrefs.every((href) => desktopHrefs.includes(href))).toBe(true);
    expect(desktopHrefs.every((href) => href in ROUTE_ROLES)).toBe(true);
  });

  it('uses only existing routes in the requested product groups', () => {
    expect(groupsByTitle['nav.group_workspace']).toEqual([
      '/', '/projects', '/tasks', '/control-tower', '/santiere',
    ]);
    expect(groupsByTitle['nav.group_commercial']).toEqual([
      '/furnizori', '/cheltuieli', '/aprobare',
    ]);
    expect(groupsByTitle['nav.group_operations']).toEqual([
      '/planning', '/rapoarte', '/pontaj', '/avize', '/stocuri', '/depozite', '/activity',
    ]);
    expect(groupsByTitle['nav.group_project_control']).toEqual([
      '/documente', '/qa', '/issues', '/solar-configurator',
    ]);
    expect(groupsByTitle['nav.group_people']).toEqual(['/workforce', '/teams']);
    expect(groupsByTitle['nav.admin']).toEqual(['/utilizatori']);
    expect(groupsByTitle['nav.group_account']).toEqual(['/notificari', '/profil']);
  });

  it('keeps route-role restrictions delegated to the canonical RBAC map', () => {
    expect(canRoleAccess('/furnizori', 'procurement')).toBe(true);
    expect(canRoleAccess('/furnizori', 'worker')).toBe(false);
    expect(canRoleAccess('/depozite', 'pm')).toBe(true);
    expect(canRoleAccess('/depozite', 'worker')).toBe(false);
    expect(canRoleAccess('/control-tower', 'viewer')).toBe(true);
    expect(canRoleAccess('/utilizatori', 'manager')).toBe(false);
  });
});
