'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { Bell, LogOut, MapPin, Menu, User, ChevronDown, Camera } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui/Button';
import { Badge, Modal, Tabs } from './ui';
import { DropdownMenu, type DropdownMenuItem } from './ui/DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { usePhotoUploadModal } from '../contexts/PhotoUploadModalContext';
import { apiClient } from '../lib/api-client';
import { getRoleLabel, t, useLocale } from '@solar/shared';
import { NAV_GROUPS } from '../config/navigation';
import { GlobalQuickSearch } from './GlobalQuickSearch';
import { usePathname } from 'next/navigation';

/** Roles that may attach photos from the global camera button. */
const PHOTO_UPLOAD_ROLES = [
  'admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'worker',
];

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, loading, signOut } = useAuth();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    loading: projectsLoading,
  } = useProject();
  const { locale } = useLocale();
  const pathname = usePathname();
  const activeNavItem = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => item.href !== '/')
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const activeTitle = activeNavItem ? t(activeNavItem.i18nKey, locale) || activeNavItem.label : '';

  const { openPhotoUpload } = usePhotoUploadModal();
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoTab, setPhotoTab] = useState<'tasks' | 'issues' | 'project'>('tasks');
  const [photoTargets, setPhotoTargets] = useState<{ tasks: any[]; issues: any[] }>({ tasks: [], issues: [] });
  const [photoLoading, setPhotoLoading] = useState(false);

  const userRole = user?.role?.toLowerCase();
  const canUploadPhotos = !!userRole && PHOTO_UPLOAD_ROLES.includes(userRole);

  const openPhotoPicker = useCallback(async () => {
    setShowPhotoPicker(true);
    if (!selectedProjectId) {
      setPhotoTab('project');
      setPhotoTargets({ tasks: [], issues: [] });
      return;
    }
    setPhotoTab('tasks');
    setPhotoLoading(true);
    try {
      const [tasksRes, issuesRes] = await Promise.all([
        apiClient.getTasks(selectedProjectId),
        apiClient.getIssues({ projectId: selectedProjectId }),
      ]);
      setPhotoTargets({ tasks: tasksRes.data || [], issues: issuesRes.data || [] });
    } catch {
      setPhotoTargets({ tasks: [], issues: [] });
    } finally {
      setPhotoLoading(false);
    }
  }, [selectedProjectId]);

  const pickPhotoTarget = useCallback(
    (targetType: 'task' | 'issue' | 'project', targetId: string, projectId: string) => {
      setShowPhotoPicker(false);
      openPhotoUpload({ targetType, targetId, projectId });
    },
    [openPhotoUpload],
  );

  const currentUser = loading
    ? t('general.loading', locale)
    : user?.fullName || user?.email || t('header.visitator', locale);

  const userMenuItems: DropdownMenuItem[] = [
    {
      key: 'profile',
      label: t('header.profile', locale),
      onClick: () => window.location.assign('/profil'),
      icon: <User className="w-4 h-4" />,
    },
    {
      key: 'logout',
      label: t('header.logout', locale),
      onClick: () => void signOut(),
      icon: <LogOut className="w-4 h-4" />,
      variant: 'danger',
    },
  ];

  return (
    <header className="h-[var(--hii-header-height)] shrink-0 bg-white border-b border-slate-200 px-2.5 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-header shadow-sm">
      {/* Left section: on phones the project selector gets the remaining width,
          so it can never slide underneath the language/notification controls. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden shrink-0"
          aria-label={t('header.menu', locale)}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <nav
          className="hidden min-w-0 items-center gap-2 text-sm sm:flex"
          aria-label={t('header.breadcrumb', locale)}
        >
          {pathname !== '/' && <span className="text-slate-300" aria-hidden="true">/</span>}
          <span className="max-w-36 truncate font-semibold text-slate-700">
            {pathname === '/' ? t('header.home_title', locale) : activeTitle}
          </span>
        </nav>

        <div className="min-w-0 max-w-[calc(100vw-14rem)] sm:max-w-none flex-1 sm:flex-none flex items-center gap-1.5 sm:gap-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <MapPin className="w-4 h-4 text-hii-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex flex-col">
            <span className="hidden sm:block text-[10px] text-slate-400 font-medium leading-tight">
              {selectedProject
                ? t('header.current_project', locale)
                : t('header.all_projects', locale)}
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'all' ? '' : e.target.value)
              }
              className="block w-full max-w-full bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs sm:-mt-0.5 p-0 truncate"
              disabled={projectsLoading}
              aria-label={t('header.select_project', locale)}
            >
              <option value="all">{t('header.all_sites', locale)}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right section: search is intentionally removed from the phone header;
          the selector, language, bell and avatar retain usable touch targets. */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2.5">
        <div className="hidden sm:block">
          <GlobalQuickSearch />
        </div>
        <LanguageSwitcher />

        {canUploadPhotos && (
          <button
            type="button"
            onClick={() => void openPhotoPicker()}
            aria-label={t('photo_upload.add', locale)}
            className="flex h-10 w-10 items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full shrink-0"
          >
            <Camera className="w-5 h-5" />
          </button>
        )}

        <Link
          href="/notificari"
          aria-label={t('nav.notificari', locale)}
          className="flex h-10 w-10 items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full relative shrink-0"
        >
          <Bell className="w-5 h-5" />
        </Link>

        <div className="hidden sm:block h-6 w-px bg-slate-200" aria-hidden="true" />

        <DropdownMenu
          trigger={
            <div className="flex h-10 w-10 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-2 cursor-pointer hover:bg-slate-50 rounded-lg sm:px-2 sm:py-1.5 transition-colors shrink-0">
              <div className="w-8 h-8 rounded-full bg-hii-600 text-white flex items-center justify-center font-bold text-xs">
                {loading ? '..' : currentUser.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {currentUser}
                </div>
                <div className="text-[11px] text-hii-600 font-medium capitalize">
                  {loading ? '' : getRoleLabel(user?.role, locale)}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" aria-hidden="true" />
            </div>
          }
          items={userMenuItems}
          align="right"
          aria-label={t('header.user_menu', locale)}
        />
      </div>

      {/* Global camera target picker: choose which entity to attach a photo to. */}
      {canUploadPhotos && (
        <Modal
          open={showPhotoPicker}
          onClose={() => setShowPhotoPicker(false)}
          title={t('photo_upload.add', locale)}
          size="md"
        >
          {!selectedProjectId ? (
            <p className="text-sm text-slate-500">{t('header.select_project', locale)}</p>
          ) : (
            <div className="space-y-3">
              <Tabs
                tabs={[
                  { key: 'tasks', label: locale === 'ro' ? 'Task-uri' : 'Tasks' },
                  { key: 'issues', label: locale === 'ro' ? 'Probleme' : 'Issues' },
                  { key: 'project', label: locale === 'ro' ? 'Proiect' : 'Project' },
                ]}
                activeTab={photoTab}
                onTabChange={(key) => setPhotoTab(key as 'tasks' | 'issues' | 'project')}
              />
              {photoTab === 'project' ? (
                <button
                  type="button"
                  onClick={() => pickPhotoTarget('project', selectedProjectId, selectedProjectId)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hii-500"
                >
                  <span className="truncate">{locale === 'ro' ? 'Fotografii șantier' : 'Site photos'}</span>
                  <Badge variant="neutral" size="sm">{selectedProject?.code || ''}</Badge>
                </button>
              ) : photoLoading ? (
                <p className="text-sm text-slate-500">{t('general.loading', locale)}</p>
              ) : photoTab === 'tasks' ? (
                photoTargets.tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">{locale === 'ro' ? 'Niciun task' : 'No tasks'}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {photoTargets.tasks.slice(0, 10).map((task: any) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => pickPhotoTarget('task', task.id, task.project_id || selectedProjectId)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hii-500"
                        >
                          <span className="truncate text-sm text-slate-800">{task.title}</span>
                          <Badge variant="neutral" size="sm">{task.status}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                photoTargets.issues.length === 0 ? (
                  <p className="text-sm text-slate-500">{locale === 'ro' ? 'Nicio problemă' : 'No issues'}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {photoTargets.issues.slice(0, 10).map((issue: any) => (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => pickPhotoTarget('issue', issue.id, issue.project_id || selectedProjectId)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hii-500"
                        >
                          <span className="truncate text-sm text-slate-800">{issue.title}</span>
                          <Badge variant="neutral" size="sm">{issue.status}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          )}
        </Modal>
      )}
    </header>
  );
}
