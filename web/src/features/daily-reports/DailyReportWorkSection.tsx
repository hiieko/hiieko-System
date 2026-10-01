'use client';
import React, { useState, useEffect } from 'react';
import { t, useLocale } from '@solar/shared';
import { Calendar, Clock, User, Briefcase } from 'lucide-react';
import type { DailyReportFormState } from './types';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { todayCompanyIso } from '../../lib/company-time';

interface Props { form: DailyReportFormState; onChange: (patch: Partial<DailyReportFormState>) => void; }

export function DailyReportWorkSection({ form, onChange }: Props) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const { selectedProject, selectedProjectId } = useProject();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    apiClient.getProjects().then(r => setProjects((r.data || []) as any[])).catch(() => {});
  }, []);

  const today = todayCompanyIso();
  const isPrevious = form.reportDate < today;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">{t('daily_report.section_work', locale)}</h3>

      {/* Team Leader — read-only */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><User className="w-3.5 h-3.5" />{t('daily_report.team_leader', locale)}</label>
        <input readOnly value={form.teamLeaderName} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-slate-700 cursor-default" />
      </div>

      {/* Project */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><Briefcase className="w-3.5 h-3.5" />{t('daily_report.project', locale)}</label>
        <select value={form.projectId} onChange={e => onChange({ projectId: e.target.value })}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500">
          <option value="">{t('daily_report.select_project', locale)}</option>
          {(selectedProject ? [selectedProject] : projects).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name || p.code}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><Calendar className="w-3.5 h-3.5" />{t('daily_report.report_date', locale)}</label>
        <input type="date" value={form.reportDate} onChange={e => onChange({ reportDate: e.target.value })}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500" />
        {isPrevious && (
          <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
            <span>⚠️</span> {t('daily_report.previous_date_warning', locale)}
          </p>
        )}
      </div>

      {/* Start/End Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><Clock className="w-3.5 h-3.5" />{t('daily_report.start_time', locale)}</label>
          <input type="time" value={form.startTime} onChange={e => onChange({ startTime: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500" />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1"><Clock className="w-3.5 h-3.5" />{t('daily_report.end_time', locale)}</label>
          <input type="time" value={form.endTime} onChange={e => onChange({ endTime: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500" />
        </div>
      </div>

      {/* Proposed Work */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">{t('daily_report.proposed_work', locale)}</label>
        <textarea value={form.proposedWork} onChange={e => onChange({ proposedWork: e.target.value })} rows={4}
          placeholder={t('daily_report.proposed_work_placeholder', locale)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500 resize-none" />
      </div>
    </div>
  );
}
