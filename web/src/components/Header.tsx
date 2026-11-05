'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { Bell, LogOut, MapPin, Menu, User, ChevronDown, Camera, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui/Button';
import { Badge, Modal, Tabs } from './ui';
import { DropdownMenu, type DropdownMenuItem } from './ui/DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { usePhotoUploadModal } from '../contexts/PhotoUploadModalContext';
import { apiClient } from '../lib/api-client';
import { getRoleLabel, t, useLocale } from '@solar/shared';
import { GlobalQuickSearch } from './GlobalQuickSearch';
import { ShellBrand } from './shell';

/** Roles that may attach photos from the global camera button. */
const PHOTO_UPLOAD_ROLES = [
  'admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'worker',
];

interface HeaderProps {
  onMenuClick?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

interface ProjectPickerProps {
  projects: ReturnType<typeof useProject>['projects'];
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  selectedProject: ReturnType<typeof useProject>['selectedProject'];
  loading: boolean;
  locale: ReturnType<typeof useLocale>['locale'];
  className?: string;
}

function ProjectPicker({
  projects,
  selectedProjectId,
  setSelectedProjectId,
  selectedProject,
  loading,
  locale,
  className,
}: ProjectPickerProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm ${className ?? ''}`}>
      <MapPin className="h-4 w-4 shrink-0 text-hii-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="hidden text-[10px] font-medium leading-tight text-slate-500 sm:block">
          {selectedProject ? t('header.current_project', locale) : t('header.all_projects', locale)}
        </span>
        <select
          value={selectedProjectId || 'all'}
          onChange={(event) => setSelectedProjectId(event.target.value === 'all' ? '' : event.target.value)}
          className="block w-full min-w-0 max-w-full cursor-pointer truncate bg-transparent p-0 text-xs font-semibold text-slate-800 focus:outline-none"
          disabled={loading}
          aria-label={t('header.select_project', locale)}
        >
          <option value="all">{t('header.all_sites', locale)}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}{project.code ? ` (${project.code})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function Header({ onMenuClick, onToggleSidebar, sidebarCollapsed = false }: HeaderProps) {
  const { user, loading, signOut } = useAuth();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    loading: projectsLoading,
  } = useProject();
  const { locale } = useLocale();

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
    <header className="relative z-header flex min-h-[var(--hii-header-height)] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-2.5 py-2 shadow-sm sm:px-4 lg:px-6 lg:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-9 w-9 shrink-0 lg:hidden"
          aria-label={t('header.menu', locale)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hidden h-9 w-9 shrink-0 lg:inline-flex"
          aria-label={t(sidebarCollapsed ? 'sidebar.expand' : 'sidebar.collapse', locale)}
          aria-expanded={!sidebarCollapsed}
          aria-controls="app-sidebar"
          title={t(sidebarCollapsed ? 'sidebar.expand' : 'sidebar.collapse', locale)}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
        </Button>
        <ShellBrand size="compact" tone="light" />
        <ProjectPicker
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          selectedProject={selectedProject}
          loading={projectsLoading}
          locale={locale}
          className="hidden min-w-0 flex-1 md:flex md:max-w-[240px] lg:ml-3"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5 lg:gap-2">
        <GlobalQuickSearch />
        <LanguageSwitcher />
        {canUploadPhotos && (
          <button
            type="button"
            onClick={() => void openPhotoPicker()}
            aria-label={t('photo_upload.add', locale)}
            title={t('photo_upload.add', locale)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500"
          >
            <Camera className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        )}
        <Link
          href="/notificari"
          aria-label={t('nav.notificari', locale)}
          title={t('nav.notificari', locale)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <DropdownMenu
          trigger={
            <div className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg transition-colors hover:bg-slate-50 sm:h-auto sm:w-auto sm:justify-start sm:px-2 sm:py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hii-600 text-xs font-bold text-white">
                {loading ? '..' : currentUser.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden max-w-44 text-left sm:block">
                <div className="truncate text-sm font-semibold leading-tight text-slate-800">{currentUser}</div>
                <div className="text-[11px] font-medium capitalize text-hii-700">{loading ? '' : getRoleLabel(user?.role, locale)}</div>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
            </div>
          }
          items={userMenuItems}
          align="right"
          aria-label={t('header.user_menu', locale)}
        />
      </div>

      <div className="w-full md:hidden">
        <ProjectPicker
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          selectedProject={selectedProject}
          loading={projectsLoading}
          locale={locale}
          className="w-full"
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
