# HIIEKO — i18n Inventory (Phase A.1)

**Generated:** 2026-10-15
**Method:** static parse of `shared/src/translations.ts` (the sole dictionary) and a full
walk of `web/src`, `Mobile/src` and `shared/src` (excluding `translations.ts`) for
`t('key')` / `t("key")` / `t('prefix' + …)` / `` t(`prefix${…}`) `` / `tPrefix('…')`
references, string literals equal to a defined key (covers indirect use such as
`i18nKey:` in `config/navigation.ts`), and inline `locale === 'en' ? … : …` ternaries.
No source file was modified.

> **Important — this inventory does not match the earlier audit (Section F).** See the
> reconciliation section at the bottom. The earlier audit quoted ~376 keys / ~12 missing /
> ~47 dead / 27 ternaries across ~11 files. The real repository has **1432**
> defined keys, **0** genuinely missing keys, **417** dead keys and **307**
> text-bypass ternaries in the brief's scope. The audit's examples
> (`dashboard.empty.filter`, `form.error.minLength`, `modal.confirm.deleteTitle`,
> `settings.privacy.title`) do not exist anywhere in this repository.

---

## (a) Defined keys — both RO and EN present

Every entry in the dictionary is a single `{ ro, en }` record (or `T(ro, en)`), so **all
1432 keys are guaranteed to have both languages present by construction**.
There are no half-translated keys. The full list follows, grouped by prefix.

### `a11y.*` (3)

```
a11y.skip_to_content
a11y.primary_navigation
a11y.close_drawer
```

### `app_name.*` (1)

```
app_name
```

### `application.*` (11)

```
application.title
application.first_name
application.last_name
application.phone
application.requested_role
application.submit
application.pending
application.approved
application.rejected
application.subtitle
application.accept_terms
```

### `attendance.*` (9)

```
attendance.title
attendance.clock_in
attendance.clock_out
attendance.gps_valid
attendance.gps_invalid
attendance.overtime
attendance.daily
attendance.monthly
attendance.export
```

### `auth.*` (15)

```
auth.login
auth.signup
auth.logout
auth.email
auth.password
auth.login_button
auth.no_account
auth.has_account
auth.request_access
auth.email_placeholder
auth.password_placeholder
auth.logging_in
auth.login_error
auth.access_denied
auth.go_back
```

### `avize.*` (24)

```
avize.action_new
avize.create_title
avize.field_aviz_number
avize.field_aviz_number_placeholder
avize.field_delivery_date
avize.field_supplier
avize.field_supplier_none
avize.field_driver
avize.field_vehicle
avize.field_notes
avize.field_items
avize.field_material
avize.field_quantity
avize.add_item
avize.remove_item
avize.items_hint
avize.submit
avize.submit_creating
avize.toast_success
avize.toast_success_message
avize.toast_error
avize.form_error_required
avize.form_error_no_project
avize.materials_unavailable
```

### `camera.*` (6)

```
camera.tip1
camera.tip2
camera.tip3
camera.tip4
camera.tip5
camera.tip6
```

### `cat.*` (11)

```
cat.fuel
cat.accommodation
cat.food
cat.transport
cat.parking
cat.tolls
cat.materials
cat.tools
cat.equipment
cat.phone_internet
cat.other
```

### `control_tower.*` (129)

```
control_tower.load_error
control_tower.connection_error
control_tower.server_error
control_tower.critical_alert
control_tower.loading
control_tower.loading_detail
control_tower.badge
control_tower.title
control_tower.subtitle
control_tower.role_actions
control_tower.project_filter
control_tower.focus_admin
control_tower.focus_pm
control_tower.focus_manager
control_tower.focus_procurement
control_tower.focus_finance
control_tower.focus_quality
control_tower.focus_logistics
control_tower.focus_maintenance
control_tower.focus_technical
control_tower.focus_viewer
control_tower.last_updated
control_tower.all_active_sites
control_tower.refresh
control_tower.retry
control_tower.active_projects
control_tower.projects_by_stage
control_tower.overdue_projects
control_tower.overdue_projects_label
control_tower.overdue_rule
control_tower.upcoming_deadlines
control_tower.upcoming_deadlines_label
control_tower.upcoming_deadlines_rule
control_tower.workforce
control_tower.scheduled_today
control_tower.valid_attendance
control_tower.missing_attendance
control_tower.missing_attendance_rule
control_tower.missing_label
control_tower.overtime_today
control_tower.overtime_rule
control_tower.overtime_label
control_tower.production
control_tower.actual
control_tower.plan
control_tower.tasks
control_tower.blocked_work
control_tower.blocked_work_rule
control_tower.blocked_work_label
control_tower.planned_tasks
control_tower.planned_tasks_rule
control_tower.planned_production_label
control_tower.materials
control_tower.missing_materials
control_tower.low_stock
control_tower.low_stock_rule
control_tower.low_stock_label
control_tower.items
control_tower.deliveries
control_tower.deliveries_rule
control_tower.pending_deliveries
control_tower.finance
control_tower.actual_cost
control_tower.committed_cost
control_tower.forecast
control_tower.finance_by_project
control_tower.finance_rule
control_tower.budget_details
control_tower.quality
control_tower.failed_inspections
control_tower.active_corrections
control_tower.open_ncr
control_tower.open_ncr_rule
control_tower.open_ncr_label
control_tower.failed_inspections_rule
control_tower.documentation
control_tower.replaced_count
control_tower.missing_documents
control_tower.awaiting_approval
control_tower.replaced_documents
control_tower.replaced_documents_rule
control_tower.replaced_documents_label
control_tower.awaiting_documents
control_tower.awaiting_documents_rule
control_tower.awaiting_label
control_tower.quick_modules
control_tower.quick_modules_detail
control_tower.hours
control_tower.daily_reports
control_tower.delivery_intake
control_tower.stock
control_tower.expenses_ocr
control_tower.drawer.record
control_tower.drawer.records
control_tower.drawer.rule
control_tower.drawer.search
control_tower.drawer.none_title
control_tower.drawer.none_desc
control_tower.drawer.source
control_tower.drawer.close
control_tower.drawer.blocked
control_tower.drawer.blocked_by
control_tower.drawer.responsible
control_tower.drawer.assigned_workers
control_tower.drawer.overdue
control_tower.drawer.original_deadline
control_tower.drawer.deadline_remaining
control_tower.drawer.target_date
control_tower.drawer.role
control_tower.drawer.site
control_tower.drawer.missing_attendance
control_tower.drawer.expected_arrival
control_tower.drawer.reporting_owner
control_tower.drawer.warehouse
control_tower.drawer.overtime_site
control_tower.drawer.deficit
control_tower.drawer.current_stock
control_tower.drawer.min_threshold
control_tower.drawer.received_materials
control_tower.drawer.failed_inspection
control_tower.drawer.below_tolerance
control_tower.drawer.rejected
control_tower.drawer.date
control_tower.drawer.inspector
control_tower.drawer.replaced_note
control_tower.drawer.version
control_tower.drawer.responsible_inline
control_tower.drawer.source_inline
control_tower.drawer.progress
```

### `daily_report.*` (92)

```
daily_report.title_new
daily_report.title_edit
daily_report.create
daily_report.section_work
daily_report.section_ohs
daily_report.section_personnel
daily_report.section_materials
daily_report.section_tasks
daily_report.section_execution
daily_report.section_photos
daily_report.section_review
daily_report.team_leader
daily_report.project
daily_report.report_date
daily_report.start_time
daily_report.end_time
daily_report.proposed_work
daily_report.proposed_work_placeholder
daily_report.ppe
daily_report.adverse_weather
daily_report.procedures
daily_report.electrical
daily_report.tools_machinery
daily_report.fall_height
daily_report.other_risks
daily_report.ohs_confirmed
daily_report.worker_name
daily_report.worker_duties
daily_report.worker_ohs
daily_report.add_worker
daily_report.remove_worker
daily_report.no_workers
daily_report.material
daily_report.quantity
daily_report.remarks
daily_report.add_material
daily_report.remove_material
daily_report.no_materials
daily_report.task
daily_report.quantity_done
daily_report.add_task
daily_report.remove_task
daily_report.no_tasks
daily_report.weather_notes
daily_report.weather_notes_placeholder
daily_report.blockages
daily_report.blockages_placeholder
daily_report.general_notes
daily_report.general_notes_placeholder
daily_report.draft_saved
daily_report.photos_save_first
daily_report.draft_saving
daily_report.save_failed
daily_report.unsaved_changes
daily_report.previous_date_warning
daily_report.select_project
daily_report.select_worker
daily_report.select_material
daily_report.select_task
daily_report.incomplete_section
daily_report.draft
daily_report.back
daily_report.next
daily_report.save_draft
daily_report.review_title
daily_report.ready_to_save
daily_report.submitted
daily_report.submit_report
daily_report.submitting
daily_report.submit_confirm_title
daily_report.submit_confirm_message
daily_report.confirm_submit
daily_report.cancel
daily_report.submit_success
daily_report.submit_failed
daily_report.submitted_locked
daily_report.revision_label
daily_report.submit_warnings_title
daily_report.submit_warning_proposed_work
daily_report.submit_warning_ohs
daily_report.submit_warning_time_range
daily_report.submit_stock_note
daily_report.back_to_list
daily_report.site_fallback
daily_report.notes_empty
daily_report.team_leader_label
daily_report.edit
daily_report.refresh
daily_report.tasks_empty
daily_report.site_observations
daily_report.site_execution_photos
daily_report.photos_unavailable
```

### `dash.*` (5)

```
dash.title
dash.active_workers
dash.overtime
dash.low_stock
dash.active_sites
```

### `depozite.*` (26)

```
depozite.title
depozite.subtitle
depozite.action_new
depozite.create_title
depozite.field_name
depozite.field_name_placeholder
depozite.field_code
depozite.field_code_placeholder
depozite.field_address
depozite.submit
depozite.submit_creating
depozite.toast_success
depozite.toast_success_message
depozite.toast_error
depozite.form_error_required
depozite.load_error
depozite.refresh
depozite.loading
depozite.empty_title
depozite.empty_hint
depozite.search_placeholder
depozite.col_name
depozite.col_code
depozite.col_address
depozite.col_stock
depozite.no_address
```

### `doc.*` (4)

```
doc.bon_fiscal
doc.factura
doc.receipt
doc.other
```

### `empty.*` (5)

```
empty.expenses
empty.approvals
empty.notifications
empty.stock
empty.no_data
```

### `err.*` (9)

```
err.network
err.gps_denied
err.geofence_outside
err.expense_save
err.stock_insufficient
err.upload_failed_preserved
err.scan_failed
err.ocr_failed
err.expense_incomplete
```

### `error.*` (1)

```
error.generic
```

### `expenses.*` (17)

```
expenses.title
expenses.new
expenses.my
expenses.all
expenses.category
expenses.site
expenses.project
expenses.payment
expenses.amount
expenses.reimbursable
expenses.submit
expenses.approve
expenses.reject
expenses.correction
expenses.reject_reason
expenses.mark_reimbursed
expenses.ocr
```

### `general.*` (22)

```
general.save
general.cancel
general.edit
general.search
general.empty
general.success
general.offline
general.view_all
general.filter
general.save_draft
general.error
general.something_wrong
general.retry
general.loading
general.refresh
general.confirm_delete
general.yes
general.no
general.close
general.all
general.saving
general.create
```

### `header.*` (13)

```
header.title
header.menu
header.user_menu
header.profile
header.settings
header.logout
header.current_project
header.all_projects
header.select_project
header.active_site
header.all_sites
header.notifications
header.visitator
```

### `help.*` (16)

```
help.supplier
help.supplier.text
help.cui
help.cui.text
help.total
help.total.text
help.vat
help.vat.text
help.category
help.category.text
help.site
help.site.text
help.purpose
help.purpose.text
help.document
help.document.text
```

### `howItWorks.*` (1)

```
howItWorks
```

### `issues.*` (64)

```
issues.title
issues.subtitle
issues.action_report
issues.loading
issues.select_project_title
issues.select_project_message
issues.summary_active
issues.summary_critical
issues.summary_total
issues.tab_all
issues.tab_active
issues.tab_resolved
issues.tab_closed
issues.search_placeholder
issues.filter_severity
issues.severity_all
issues.severity_LOW
issues.severity_MEDIUM
issues.severity_HIGH
issues.severity_CRITICAL
issues.status_OPEN
issues.status_INVESTIGATING
issues.status_CORRECTIVE_ACTION_PROPOSED
issues.status_RESOLVED
issues.status_CLOSED
issues.card.view_details
issues.card.ncr_count
issues.card.reported
issues.empty_title
issues.empty_message
issues.empty_filtered_title
issues.empty_filtered_message
issues.clear_filters
issues.error_title
issues.error_retry
issues.create_title
issues.field_title
issues.field_title_placeholder
issues.field_description
issues.field_description_placeholder
issues.field_severity
issues.form_error_required
issues.submit
issues.submit_creating
issues.toast_success
issues.toast_success_message
issues.toast_error
issues.detail_title
issues.detail_description
issues.detail_project
issues.detail_status
issues.detail_reported_at
issues.detail_updated_at
issues.detail_ncrs
issues.detail_ncrs_empty
issues.detail_readonly_note
issues.ncr_status_OPEN
issues.ncr_status_DISPOSITION_PROPOSED
issues.ncr_status_UNDER_REVIEW
issues.ncr_status_APPROVED
issues.ncr_status_IMPLEMENTED
issues.ncr_status_VERIFIED_CLOSED
issues.created_success
issues.description_placeholder
```

### `language.*` (1)

```
language
```

### `nav.*` (43)

```
nav.dashboard
nav.attendance
nav.reports
nav.deliveries
nav.stock
nav.sites
nav.expenses
nav.approvals
nav.notifications
nav.users
nav.statistics
nav.profile
nav.operations
nav.management
nav.admin
nav.personal
nav.solar_configurator
nav.tasks
nav.planning
nav.issues
nav.pontaj
nav.rapoarte
nav.avize
nav.furnizori
nav.depozite
nav.stocuri
nav.cheltuieli
nav.santiere
nav.aprobare
nav.statistici
nav.utilizatori
nav.notificari
nav.profil
nav.projects
nav.documente
nav.teams
nav.workforce
nav.control_tower
nav.activity
nav.qa_qc
nav.my_tasks
nav.my_expenses
nav.my_notifications
```

### `notif.*` (4)

```
notif.title
notif.mark_all
notif.empty
notif.unread
```

### `notifications.*` (14)

```
notifications.title
notifications.subtitle
notifications.all
notifications.unread
notifications.urgent
notifications.priority_low
notifications.priority_normal
notifications.priority_high
notifications.refresh
notifications.mark_all_read
notifications.no_notifications
notifications.loading
notifications.load_error
notifications.system_subtitle
```

### `ocr.*` (16)

```
ocr.processing
ocr.not_configured
ocr.no_data
ocr.low_confidence
ocr.review_prompt
ocr.assistant_note
ocr.field.merchant_name
ocr.field.merchant_cui
ocr.field.document_number
ocr.field.document_date
ocr.field.total
ocr.field.vat
ocr.field.subtotal
ocr.field.currency
ocr.field.address
ocr.field.payment_method
```

### `pay.*` (4)

```
pay.personal
pay.company_card
pay.company_cash
pay.other
```

### `planning.*` (180)

```
planning.page_title
planning.page_subtitle
planning.refresh
planning.refreshing
planning.status.draft
planning.status.published
planning.status.completed
planning.status.cancelled
planning.new_plan
planning.create
planning.publish
planning.complete
planning.cancel
planning.expand
planning.collapse
planning.form_date
planning.form_team
planning.form_notes
planning.form_notes_placeholder
planning.form_tasks
planning.form_select_team
planning.form_no_team
planning.today
planning.yesterday
planning.tomorrow
planning.select_date
planning.task_selector_title
planning.task_selector_search
planning.task_selector_clear
planning.task_selector_selected
planning.task_selector_none_selected
planning.task_selector_none_found
planning.task_selector_project_required
planning.task_selector_loading
planning.task_selector_error
planning.task_selector_retry
planning.task_selector_no_project
planning.target_quantity
planning.target_quantity_placeholder
planning.target_required
planning.target_min_error
planning.actual_quantity
planning.quantity_saving
planning.quantity_saved
planning.quantity_save_error
planning.quantity_unchanged
planning.completed
planning.mark_completed
planning.plan_for_date
planning.team
planning.no_team
planning.created_by
planning.task_count
planning.task_count_total
planning.expand_details
planning.collapse_details
planning.confirm_publish_title
planning.confirm_publish_message
planning.confirm_publish_confirm
planning.confirm_publish_dismiss
planning.confirm_complete_title
planning.confirm_complete_message
planning.confirm_complete_confirm
planning.confirm_complete_dismiss
planning.confirm_cancel_title
planning.confirm_cancel_message
planning.confirm_cancel_confirm
planning.confirm_cancel_dismiss
planning.plan_created
planning.plan_published
planning.plan_completed
planning.plan_cancelled
planning.create_error
planning.publish_error
planning.complete_error
planning.cancel_error
planning.loading
planning.load_error
planning.empty_title
planning.empty_message
planning.empty_no_project_title
planning.empty_no_project_message
planning.no_project_selected
planning.retry
planning.next_draft
planning.next_published
planning.status_final
planning.err_tasks_required
planning.err_date_required
planning.err_quantity_invalid
planning.search_placeholder
planning.selected
planning.clear_selected
planning.empty_tasks_title
planning.empty_tasks_message
planning.no_search_results
planning.create_modal_title
planning.field_date
planning.field_team
planning.field_tasks
planning.field_notes
planning.field_notes_placeholder
planning.no_team_option
planning.loading_teams
planning.submit_creating
planning.summary_title
planning.summary_plans
planning.summary_my_plans
planning.summary_tasks
planning.summary_my_tasks
planning.summary_completed
planning.summary_blocked
planning.summary_teams
planning.summary_teams_empty
planning.status_filter_label
planning.status.all
planning.view_toggle_label
planning.view_plans
planning.view_my_work
planning.my_work_hint
planning.my_work_empty_title
planning.my_work_empty_message
planning.empty_no_open_tasks
planning.empty_for_date_message
planning.updated_at
planning.group_pending
planning.group_completed
planning.task_status_label
planning.counters_title
planning.counters_note
planning.counter_assigned
planning.counter_completed
planning.counter_unavailable
planning.counter_planned_hint
planning.counter_assigned_hint
planning.counter_in_progress_hint
planning.counter_completed_hint
planning.counter_blocked_hint
planning.task_filter_label
planning.task_filter_unassigned
planning.task_filter_no_results
planning.task_search_label
planning.task_search_placeholder
planning.task_search_clear
planning.table_title
planning.table_col_planned_start
planning.table_col_task
planning.table_col_area
planning.table_col_responsible
planning.table_col_status
planning.assigned_count
planning.not_recorded
planning.planned_start_hint
planning.plan_group_tasks_shown
planning.expand_task
planning.collapse_task
planning.readiness_title
planning.readiness_subtitle
planning.readiness_attendance_value
planning.readiness_attendance_empty
planning.readiness_materials_value
planning.readiness_materials_empty
planning.readiness_low
planning.readiness_low_stock_hint
planning.readiness_blockers_value
planning.readiness_blockers_empty
planning.readiness_clear
planning.readiness_none
planning.readiness_unavailable
planning.readiness_live_note
planning.attention_title
planning.attention_empty
planning.attention_more
planning.footer_tasks_planned
planning.footer_assigned
planning.footer_blocked
planning.footer_for_date
planning.day_actions_label
planning.publish_plan_day
planning.publish_draft_aria
```

### `profile.*` (12)

```
profile.save
profile.title
profile.subtitle
profile.full_name
profile.email
profile.phone
profile.language
profile.ro
profile.en
profile.edit_disabled
profile.default_user
profile.default_profile
```

### `projects.*` (60)

```
projects.title
projects.new
projects.search
projects.filter_status
projects.filter_phase
projects.clear_filters
projects.no_projects
projects.edit
projects.view
projects.code
projects.name
projects.address
projects.status
projects.phase
projects.manager
projects.start_date
projects.end_date
projects.budget
projects.active
projects.inactive
projects.all_status
projects.all_phases
projects.create_title
projects.edit_title
projects.form_name
projects.form_code
projects.form_address
projects.form_latitude
projects.form_longitude
projects.form_geofence_radius
projects.form_capacity
projects.form_budget
projects.form_currency
projects.form_start_date
projects.form_end_date
projects.saving
projects.save
projects.cancel
projects.create_success
projects.update_success
projects.load_error
projects.detail
projects.overview
projects.members
projects.teams_tab
projects.activity
projects.coming_soon
projects.member_add
projects.member_remove
projects.member_role
projects.select_user
projects.no_members
projects.stage_created
projects.stage_name
projects.stage_placeholder
projects.updated
projects.refresh
projects.adding
projects.add
projects.remove
```

### `qa.*` (32)

```
qa.title
qa.subtitle
qa.action_new
qa.create_title
qa.field_inspector
qa.field_inspector_placeholder
qa.field_template
qa.field_measurements
qa.field_parameter
qa.field_value
qa.field_unit
qa.field_passed
qa.add_measurement
qa.remove_measurement
qa.measurement_hint
qa.status_completed
qa.status_pending
qa.measurements_count
qa.ncrs_count
qa.inspected_at
qa.template_none
qa.submit
qa.submit_creating
qa.toast_success
qa.toast_success_message
qa.toast_error
qa.load_error
qa.empty_title
qa.empty_message
qa.form_error_required
qa.form_error_no_project
qa.loading
```

### `reports.*` (6)

```
reports.title
reports.approve
reports.tasks
reports.materials
reports.team
reports.photos
```

### `role.*` (17)

```
role.admin
role.owner
role.manager
role.pm
role.site_manager
role.team_leader
role.foreman
role.technician
role.procurement
role.finance
role.qa_qc
role.worker
role.viewer
role.site_logistics
role.maintenance_director
role.technical_director
role.who
```

### `scan.*` (14)

```
scan.open
scan.capture
scan.retake
scan.add_page
scan.preview
scan.process
scan.confirm
scan.submit
scan.cancel
scan.flash
scan.rotate
scan.rotated
scan.permission_denied
scan.pageCount
```

### `settings.*` (10)

```
settings.title
settings.section_title
settings.section_subtitle
settings.option.ro.label
settings.option.ro.sub
settings.option.en.label
settings.option.en.sub
settings.saved_hint
settings.ar_label
settings.tab_label
```

### `shell.*` (2)

```
shell.brand_suffix
shell.unread_notifications
```

### `sidebar.*` (4)

```
sidebar.collapse
sidebar.expand
sidebar.close
sidebar.navigation
```

### `sites.*` (2)

```
sites.title
sites.active
```

### `stats.*` (10)

```
stats.title
stats.employees
stats.active_sites
stats.present
stats.overtime
stats.expenses
stats.pending_exp
stats.reports
stats.total_cost
stats.low_stock
```

### `status.*` (11)

```
status.draft
status.submitted
status.under_review
status.approved
status.rejected
status.needs_correction
status.reimbursement_pending
status.reimbursed
status.cancelled
status.pending
status.saved_offline
```

### `stock.*` (9)

```
stock.title
stock.current
stock.audit
stock.low
stock.optimal
stock.audit_immutable_title
stock.audit_immutable_note
stock.movement_type
stock.document_reference
```

### `suppliers.*` (29)

```
suppliers.title
suppliers.subtitle
suppliers.action_new
suppliers.create_title
suppliers.field_name
suppliers.field_name_placeholder
suppliers.field_cui
suppliers.field_address
suppliers.field_contact_person
suppliers.field_contact_email
suppliers.field_contact_phone
suppliers.submit
suppliers.submit_creating
suppliers.toast_success
suppliers.toast_success_message
suppliers.toast_error
suppliers.form_error_required
suppliers.load_error
suppliers.refresh
suppliers.loading
suppliers.empty_title
suppliers.empty_hint
suppliers.search_placeholder
suppliers.col_name
suppliers.col_cui
suppliers.col_contact
suppliers.col_avize
suppliers.col_orders
suppliers.no_contact
```

### `task.*` (107)

```
task.status.planned
task.status.ready
task.status.in_progress
task.status.blocked
task.status.completed
task.status.verified
task.status.cancelled
task.invalid_transition
task.verify_forbidden
task.verified_by
task.verified_at
task.page_title
task.all_projects
task.search_placeholder
task.search_clear
task.only_mine
task.tab_all
task.new
task.loading
task.load_error
task.toggle_details
task.expand_details
task.collapse_details
task.list_updated
task.empty_none
task.empty_mine
task.empty_scope
task.empty_desc_create
task.empty_desc_filtered
task.empty_desc_scope
task.empty_desc_no_tasks
task.planned
task.actual
task.planned_dates
task.actual_dates
task.planned_start
task.planned_end
task.actual_start
task.actual_end
task.quantity_progress
task.no_planned_qty
task.dependencies
task.depends_on
task.blocks
task.update_status
task.final_status
task.change_status_to
task.actual_quantity
task.quantity_save_hint
task.assign_member
task.assigned_count
task.assign
task.assign_as
task.select_member
task.project_member
task.all_members_assigned
task.no_project_members
task.members_loading
task.unassign_unsupported
task.create_title
task.field_title
task.field_code
task.field_code_hint
task.field_description
task.field_work_package
task.field_zone
task.field_planned_qty
task.field_uom
task.none_option
task.creating
task.create
task.cancel
task.select_project_first
task.confirm_cancel_title
task.confirm_cancel_message
task.confirm_cancel_confirm
task.confirm_cancel_dismiss
task.created
task.status_updated
task.quantity_updated
task.assigned
task.generic_error
task.report_blocker
task.blocker_modal_title
task.blocker_reason_label
task.blocker_reason_placeholder
task.blocker_reason_required
task.blocker_submit
task.blocker_cancel
task.blocker_reported
task.blocker_resolved
task.blocker_active
task.blocker_unblock
task.blocker_reported_at
task.err_required
task.err_offline
task.err_timeout
task.err_server
task.err_forbidden
task.err_not_found
task.err_generic
task.summary_total
task.summary_active
task.summary_blocked
task.summary_complete
task.list_heading
task.clear_filters
```

### `teams.*` (28)

```
teams.title
teams.new
teams.search
teams.no_teams
teams.name
teams.code
teams.project
teams.leader
teams.members
teams.member_count
teams.create_title
teams.edit_title
teams.form_name
teams.form_code
teams.form_leader
teams.form_project
teams.select_leader
teams.select_project
teams.saving
teams.save
teams.cancel
teams.create_success
teams.load_error
teams.add_member
teams.remove_member
teams.member_added
teams.select_user
teams.no_members
```

### `theme.*` (1)

```
theme
```

### `tutorial.*` (187)

```
tutorial.dashboard.title
tutorial.dashboard.short
tutorial.dashboard.purpose
tutorial.dashboard.step1
tutorial.dashboard.step2
tutorial.dashboard.step3
tutorial.dashboard.role.worker
tutorial.dashboard.role.manager
tutorial.dashboard.role.admin
tutorial.dashboard.important
tutorial.attendance.title
tutorial.attendance.short
tutorial.attendance.purpose
tutorial.attendance.step1
tutorial.attendance.step2
tutorial.attendance.step3
tutorial.attendance.role.worker
tutorial.attendance.role.manager
tutorial.attendance.important
tutorial.reports.title
tutorial.reports.short
tutorial.reports.purpose
tutorial.reports.step1
tutorial.reports.step2
tutorial.reports.step3
tutorial.reports.role.team_leader
tutorial.reports.role.manager
tutorial.reports.important
tutorial.deliveries.title
tutorial.deliveries.short
tutorial.deliveries.purpose
tutorial.deliveries.step1
tutorial.deliveries.step2
tutorial.deliveries.step3
tutorial.deliveries.role.team_leader
tutorial.deliveries.role.manager
tutorial.deliveries.important
tutorial.stock.title
tutorial.stock.short
tutorial.stock.purpose
tutorial.stock.step1
tutorial.stock.step2
tutorial.stock.step3
tutorial.stock.role.team_leader
tutorial.stock.role.admin
tutorial.stock.important
tutorial.sites.title
tutorial.sites.short
tutorial.sites.purpose
tutorial.sites.step1
tutorial.sites.step2
tutorial.sites.step3
tutorial.sites.role.manager
tutorial.sites.role.admin
tutorial.sites.important
tutorial.expenses.title
tutorial.expenses.short
tutorial.expenses.purpose
tutorial.expenses.step1
tutorial.expenses.step2
tutorial.expenses.step3
tutorial.expenses.step4
tutorial.expenses.role.worker
tutorial.expenses.role.manager
tutorial.expenses.important
tutorial.approvals.title
tutorial.approvals.short
tutorial.approvals.purpose
tutorial.approvals.step1
tutorial.approvals.step2
tutorial.approvals.step3
tutorial.approvals.role.manager
tutorial.approvals.role.admin
tutorial.approvals.important
tutorial.users.title
tutorial.users.short
tutorial.users.purpose
tutorial.users.step1
tutorial.users.step2
tutorial.users.step3
tutorial.users.role.admin
tutorial.users.important
tutorial.statistics.title
tutorial.statistics.short
tutorial.statistics.purpose
tutorial.statistics.step1
tutorial.statistics.step2
tutorial.statistics.step3
tutorial.statistics.role.manager
tutorial.statistics.role.admin
tutorial.statistics.important
tutorial.notifications.title
tutorial.notifications.short
tutorial.notifications.purpose
tutorial.notifications.step1
tutorial.notifications.step2
tutorial.notifications.step3
tutorial.notifications.role.worker
tutorial.notifications.role.manager
tutorial.notifications.important
tutorial.profile.title
tutorial.profile.short
tutorial.profile.purpose
tutorial.profile.step1
tutorial.profile.step2
tutorial.profile.step3
tutorial.profile.role.worker
tutorial.profile.important
tutorial.scan.title
tutorial.scan.short
tutorial.scan.purpose
tutorial.scan.step1
tutorial.scan.step2
tutorial.scan.step3
tutorial.scan.step4
tutorial.scan.step5
tutorial.scan.role.worker
tutorial.scan.important
tutorial.expenseReview.title
tutorial.expenseReview.short
tutorial.expenseReview.purpose
tutorial.expenseReview.step1
tutorial.expenseReview.step2
tutorial.expenseReview.step3
tutorial.expenseReview.role.worker
tutorial.expenseReview.important
tutorial.login.title
tutorial.login.short
tutorial.login.purpose
tutorial.login.step1
tutorial.login.step2
tutorial.login.step3
tutorial.login.important
tutorial.whatFor
tutorial.whatToDo
tutorial.projects.title
tutorial.projects.short
tutorial.projects.purpose
tutorial.projects.step1
tutorial.projects.step2
tutorial.projects.step3
tutorial.projects.role_admin
tutorial.projects.role_manager
tutorial.projects.role_pm
tutorial.projects.role_worker
tutorial.projects.role_viewer
tutorial.projects.important
tutorial.project-detail.title
tutorial.project-detail.short
tutorial.project-detail.purpose
tutorial.project-detail.step1
tutorial.project-detail.step2
tutorial.project-detail.step3
tutorial.project-detail.role_admin
tutorial.project-detail.role_manager
tutorial.project-detail.role_pm
tutorial.project-detail.role_worker
tutorial.project-detail.role_viewer
tutorial.project-detail.important
tutorial.issues.title
tutorial.issues.short
tutorial.issues.purpose
tutorial.issues.step1
tutorial.issues.step2
tutorial.issues.role_foreman
tutorial.issues.role_site_manager
tutorial.planning.title
tutorial.planning.short
tutorial.planning.purpose
tutorial.planning.step1
tutorial.planning.step2
tutorial.planning.role_foreman
tutorial.planning.role_site_manager
tutorial.teams.title
tutorial.teams.short
tutorial.teams.purpose
tutorial.teams.step1
tutorial.teams.step2
tutorial.teams.role_admin
tutorial.teams.role_manager
tutorial.workforce.title
tutorial.workforce.short
tutorial.workforce.purpose
tutorial.workforce.step1
tutorial.workforce.step2
tutorial.workforce.role_admin
tutorial.workforce.role_manager
```

### `users.*` (20)

```
users.pending
users.approve
users.title
users.search
users.employees
users.applications
users.name
users.email
users.role
users.status
users.active
users.inactive
users.detail
users.projects
users.project_role
users.phone
users.no_users
users.edit_role
users.role_updated
users.load_error
```

### `worker.*` (91)

```
worker.my_day.title
worker.my_day.subtitle
worker.my_day.no_project
worker.my_day.attendance_description
worker.my_day.tasks_description
worker.my_day.blockers_description
worker.my_day.notifications_description
worker.greeting
worker.select_project
worker.attendance_today
worker.arrival
worker.departure
worker.hours_worked
worker.overtime
worker.clock_in
worker.clock_out
worker.my_tasks
worker.view_all
worker.no_active_tasks
worker.attendance_title
worker.attendance_subtitle
worker.attendance_gps_note
worker.gps_denied
worker.gps_timeout
worker.gps_unavailable
worker.gps_error
worker.checkin_success
worker.checkout_success
worker.select_project_first
worker.error_generic
worker.my_day.greeting_morning
worker.my_day.greeting_afternoon
worker.my_day.greeting_evening
worker.my_day.tasks_progress
worker.my_day.completion_hint
worker.my_day.progress_title
worker.my_day.progress_label
worker.my_day.progress_empty
worker.my_day.volume_title
worker.my_day.volume_line
worker.my_day.volume_no_unit
worker.my_day.volume_mixed
worker.my_day.actions_title
worker.my_day.actions_none_title
worker.my_day.actions_none_desc
worker.my_day.actions_unavailable
worker.my_day.action_open_tasks
worker.my_day.action_blocked_tasks
worker.my_day.action_report_label
worker.my_day.action_report_sent
worker.my_day.action_report_draft
worker.my_day.action_report_missing
worker.my_day.action_open
worker.my_day.blockers_title
worker.my_day.blockers_count
worker.my_day.blockers_none_title
worker.my_day.blockers_none_desc
worker.my_day.blockers_no_access
worker.my_day.blockers_error
worker.clock_in_hint
worker.shift_completed
worker.new_shift
worker.status_checked_in
worker.status_not_checked_in
worker.elapsed
worker.location_label
worker.gps_label
worker.gps_state_idle
worker.gps_state_active
worker.gps_state_accuracy
worker.gps_state_denied
worker.gps_state_unavailable
worker.distance_label
worker.geofence_inside
worker.geofence_outside
worker.meters
worker.blockers.active_count
worker.blockers.total
worker.blockers.none_title
worker.blockers.none_desc
worker.notifications.unread_count
worker.notifications.total
worker.notifications.none
worker.notifications.time_days
worker.notifications.time_hours
worker.notifications.time_minutes
worker.notifications.time_now
worker.refresh
worker.site_picker_hint
worker.assigned_work_site
worker.elapsed_since_checkin
```

### `workforce.*` (34)

```
workforce.title
workforce.search
workforce.new
workforce.no_employees
workforce.name
workforce.role
workforce.position
workforce.email
workforce.phone
workforce.project
workforce.team
workforce.status
workforce.active
workforce.inactive
workforce.detail
workforce.first_name
workforce.last_name
workforce.cnp
workforce.hourly_rate
workforce.user_account
workforce.create_title
workforce.saving
workforce.save
workforce.cancel
workforce.create_success
workforce.load_error
workforce.filter_project
workforce.filter_team
workforce.filter_role
workforce.all_projects
workforce.all_teams
workforce.all_roles
workforce.search_placeholder
workforce.no_account
```

## (b) `t(...)` keys referenced but NOT defined

**None.** Every static key argument passed to `t(...)` in `web/src` exists in the dictionary.

The only non-literal references are three dynamic constructions, all of which resolve to
existing keys:

| File:line | Construction | Resolves to |
|-----------|--------------|-------------|
| `web/src/app/cheltuieli/page.tsx:381` | `t('status.' + s, locale)` | `status.*` (defined) |
| `web/src/app/cheltuieli/page.tsx:399` | `t('status.' + s, locale)` | `status.*` (defined) |
| `web/src/features/planning/components/PlanTaskRow.tsx:112` | `` t(`task.status.${taskStatus.toLowerCase()}`) `` | `task.status.*` (defined) |

No runtime key leakage was found for `t(...)` call sites.

## (c) Defined keys never referenced

A key is treated as **used** if its exact string literal appears anywhere in `web/src`,
`Mobile/src` or `shared/src` (other than `translations.ts`), or falls under a dynamic
prefix (`status.`, `task.status.`, `role.`), or is built by `shared/src/tutorials.ts`.

**Total dead keys: 417**

### `a11y.*` (1)

```
a11y.primary_navigation
```

### `app_name.*` (1)

```
app_name
```

### `application.*` (11)

```
application.title
application.first_name
application.last_name
application.phone
application.requested_role
application.submit
application.pending
application.approved
application.rejected
application.subtitle
application.accept_terms
```

### `attendance.*` (8)

```
attendance.clock_in
attendance.clock_out
attendance.gps_valid
attendance.gps_invalid
attendance.overtime
attendance.daily
attendance.monthly
attendance.export
```

### `auth.*` (13)

```
auth.login
auth.signup
auth.logout
auth.email
auth.password
auth.login_button
auth.no_account
auth.has_account
auth.request_access
auth.email_placeholder
auth.password_placeholder
auth.logging_in
auth.login_error
```

### `avize.*` (1)

```
avize.action_new
```

### `cat.*` (11)

```
cat.fuel
cat.accommodation
cat.food
cat.transport
cat.parking
cat.tolls
cat.materials
cat.tools
cat.equipment
cat.phone_internet
cat.other
```

### `control_tower.*` (3)

```
control_tower.drawer.overtime_site
control_tower.drawer.deficit
control_tower.drawer.inspector
```

### `daily_report.*` (20)

```
daily_report.create
daily_report.worker_name
daily_report.worker_ohs
daily_report.remove_worker
daily_report.material
daily_report.remove_material
daily_report.task
daily_report.remove_task
daily_report.draft_saving
daily_report.unsaved_changes
daily_report.incomplete_section
daily_report.site_fallback
daily_report.notes_empty
daily_report.team_leader_label
daily_report.edit
daily_report.refresh
daily_report.tasks_empty
daily_report.site_observations
daily_report.site_execution_photos
daily_report.photos_unavailable
```

### `dash.*` (5)

```
dash.title
dash.active_workers
dash.overtime
dash.low_stock
dash.active_sites
```

### `depozite.*` (1)

```
depozite.loading
```

### `doc.*` (4)

```
doc.bon_fiscal
doc.factura
doc.receipt
doc.other
```

### `empty.*` (4)

```
empty.approvals
empty.notifications
empty.stock
empty.no_data
```

### `err.*` (5)

```
err.network
err.gps_denied
err.geofence_outside
err.expense_save
err.stock_insufficient
```

### `error.*` (1)

```
error.generic
```

### `expenses.*` (11)

```
expenses.my
expenses.site
expenses.amount
expenses.reimbursable
expenses.submit
expenses.approve
expenses.reject
expenses.correction
expenses.reject_reason
expenses.mark_reimbursed
expenses.ocr
```

### `general.*` (11)

```
general.empty
general.offline
general.view_all
general.filter
general.save_draft
general.confirm_delete
general.yes
general.no
general.all
general.saving
general.create
```

### `header.*` (4)

```
header.title
header.settings
header.active_site
header.notifications
```

### `help.*` (8)

```
help.supplier.text
help.cui.text
help.total.text
help.vat.text
help.category.text
help.site.text
help.purpose.text
help.document.text
```

### `issues.*` (24)

```
issues.title
issues.subtitle
issues.action_report
issues.loading
issues.select_project_title
issues.select_project_message
issues.summary_active
issues.summary_critical
issues.summary_total
issues.tab_all
issues.tab_resolved
issues.tab_closed
issues.search_placeholder
issues.filter_severity
issues.severity_all
issues.empty_title
issues.empty_message
issues.empty_filtered_title
issues.empty_filtered_message
issues.clear_filters
issues.error_title
issues.error_retry
issues.created_success
issues.description_placeholder
```

### `nav.*` (11)

```
nav.reports
nav.deliveries
nav.stock
nav.sites
nav.expenses
nav.approvals
nav.notifications
nav.users
nav.statistics
nav.profile
nav.statistici
```

### `notif.*` (4)

```
notif.title
notif.mark_all
notif.empty
notif.unread
```

### `notifications.*` (3)

```
notifications.subtitle
notifications.no_notifications
notifications.loading
```

### `ocr.*` (5)

```
ocr.no_data
ocr.assistant_note
ocr.field.subtotal
ocr.field.address
ocr.field.payment_method
```

### `pay.*` (4)

```
pay.personal
pay.company_card
pay.company_cash
pay.other
```

### `planning.*` (28)

```
planning.page_subtitle
planning.refreshing
planning.form_date
planning.form_team
planning.form_notes
planning.form_notes_placeholder
planning.form_select_team
planning.form_no_team
planning.task_selector_title
planning.task_selector_search
planning.task_selector_clear
planning.task_selector_selected
planning.task_selector_none_found
planning.task_selector_project_required
planning.task_selector_loading
planning.task_selector_error
planning.task_selector_retry
planning.task_selector_no_project
planning.target_quantity
planning.target_quantity_placeholder
planning.target_required
planning.quantity_unchanged
planning.plan_for_date
planning.no_team
planning.expand_details
planning.collapse_details
planning.loading
planning.status_final
```

### `profile.*` (12)

```
profile.save
profile.title
profile.subtitle
profile.full_name
profile.email
profile.phone
profile.language
profile.ro
profile.en
profile.edit_disabled
profile.default_user
profile.default_profile
```

### `projects.*` (55)

```
projects.title
projects.new
projects.search
projects.filter_status
projects.filter_phase
projects.clear_filters
projects.no_projects
projects.edit
projects.view
projects.code
projects.name
projects.address
projects.status
projects.phase
projects.manager
projects.end_date
projects.budget
projects.active
projects.inactive
projects.all_status
projects.all_phases
projects.create_title
projects.edit_title
projects.form_name
projects.form_code
projects.form_address
projects.form_latitude
projects.form_longitude
projects.form_geofence_radius
projects.form_capacity
projects.form_budget
projects.form_currency
projects.form_start_date
projects.form_end_date
projects.saving
projects.save
projects.cancel
projects.create_success
projects.update_success
projects.load_error
projects.detail
projects.overview
projects.members
projects.teams_tab
projects.activity
projects.coming_soon
projects.member_add
projects.member_remove
projects.member_role
projects.select_user
projects.no_members
projects.refresh
projects.adding
projects.add
projects.remove
```

### `qa.*` (1)

```
qa.field_template
```

### `reports.*` (6)

```
reports.title
reports.approve
reports.tasks
reports.materials
reports.team
reports.photos
```

### `scan.*` (1)

```
scan.confirm
```

### `settings.*` (2)

```
settings.title
settings.tab_label
```

### `sidebar.*` (2)

```
sidebar.collapse
sidebar.expand
```

### `sites.*` (2)

```
sites.title
sites.active
```

### `stats.*` (10)

```
stats.title
stats.employees
stats.active_sites
stats.present
stats.overtime
stats.expenses
stats.pending_exp
stats.reports
stats.total_cost
stats.low_stock
```

### `stock.*` (9)

```
stock.title
stock.current
stock.audit
stock.low
stock.optimal
stock.audit_immutable_title
stock.audit_immutable_note
stock.movement_type
stock.document_reference
```

### `suppliers.*` (1)

```
suppliers.loading
```

### `task.*` (26)

```
task.verified_at
task.loading
task.load_error
task.toggle_details
task.list_updated
task.empty_scope
task.planned_dates
task.actual_dates
task.planned_start
task.planned_end
task.actual_start
task.actual_end
task.dependencies
task.change_status_to
task.assign_as
task.select_member
task.project_member
task.members_loading
task.unassign_unsupported
task.creating
task.blocker_reason_required
task.err_offline
task.err_timeout
task.err_server
task.err_forbidden
task.err_not_found
```

### `teams.*` (28)

```
teams.title
teams.new
teams.search
teams.no_teams
teams.name
teams.code
teams.project
teams.leader
teams.members
teams.member_count
teams.create_title
teams.edit_title
teams.form_name
teams.form_code
teams.form_leader
teams.form_project
teams.select_leader
teams.select_project
teams.saving
teams.save
teams.cancel
teams.create_success
teams.load_error
teams.add_member
teams.remove_member
teams.member_added
teams.select_user
teams.no_members
```

### `users.*` (19)

```
users.pending
users.approve
users.search
users.employees
users.applications
users.name
users.email
users.role
users.status
users.active
users.inactive
users.detail
users.projects
users.project_role
users.phone
users.no_users
users.edit_role
users.role_updated
users.load_error
```

### `worker.*` (7)

```
worker.my_day.title
worker.my_day.no_project
worker.my_day.attendance_description
worker.my_day.tasks_description
worker.my_day.blockers_description
worker.my_day.notifications_description
worker.greeting
```

### `workforce.*` (34)

```
workforce.title
workforce.search
workforce.new
workforce.no_employees
workforce.name
workforce.role
workforce.position
workforce.email
workforce.phone
workforce.project
workforce.team
workforce.status
workforce.active
workforce.inactive
workforce.detail
workforce.first_name
workforce.last_name
workforce.cnp
workforce.hourly_rate
workforce.user_account
workforce.create_title
workforce.saving
workforce.save
workforce.cancel
workforce.create_success
workforce.load_error
workforce.filter_project
workforce.filter_team
workforce.filter_role
workforce.all_projects
workforce.all_teams
workforce.all_roles
workforce.search_placeholder
workforce.no_account
```

## (d) Inline `locale === 'en' ? … : …` ternaries

Scope: `web/src/app/**`, `web/src/features/**`, `web/src/components/**` (the brief's scope).

- **Text-bypass ternaries (the actual bug): 307** across 33 files.
- Locale-code ternaries (benign — select a BCP-47 code for `Intl`/formatters, not user text): 9.

The 323 figure for the whole `web/src` tree also includes `design-review/`, `lib/` and
`hooks/`; only the brief's `app`/`features`/`components` scope is tabulated here. Across all
of `web/src` + `Mobile/src` there are 337 text ternaries (Mobile contributes 14).

### `web/src/app/activity/page.tsx` (37)

| Line | Source |
|------|--------|
| 131 | `if (key === dayKey(today.toISOString())) return locale === 'ro' ? 'Astăzi' : 'Today';` |
| 132 | `if (key === dayKey(yesterday.toISOString())) return locale === 'ro' ? 'Ieri' : 'Yesterday';` |
| 173 | `(locale === 'ro' ? 'a înregistrat o acțiune' : 'performed an action');` |
| 257 | `const actorName = event.actor?.name \|\| (locale === 'ro' ? 'Sistem' : 'System');` |
| 295 | `{locale === 'ro' ? 'Autor' : 'Actor'}` |
| 317 | `{locale === 'ro' ? 'Ce s-a schimbat' : 'What changed'}` |
| 335 | `{locale === 'ro' ? 'Obiect' : 'Subject'}` |
| 345 | `{locale === 'ro' ? 'Vezi' : 'View'}` |
| 355 | `{locale === 'ro' ? 'Motiv blocaj' : 'Blocker reason'}` |
| 366 | `{locale === 'ro' ? 'Fotografie' : 'Photo'}` |
| 371 | `alt={locale === 'ro' ? 'Fotografie atașată' : 'Attached photo'}` |
| 393 | `? locale === 'ro'` |
| 396 | `: locale === 'ro'` |
| 558 | `label: `${locale === 'ro' ? 'Căutare' : 'Search'}: "${qParam}"`,` |
| 566 | `label: opt ? (locale === 'ro' ? opt.ro : opt.en) : actionParam,` |
| 573 | `? locale === 'ro'` |
| 587 | `label: opt ? (locale === 'ro' ? opt.ro : opt.en) : dateRangeParam,` |
| 601 | `title={locale === 'ro' ? 'Activitate' : 'Activity'}` |
| 603 | `locale === 'ro'` |
| 615 | `{locale === 'ro' ? 'Reîmprospătează' : 'Refresh'}` |
| 625 | `label={locale === 'ro' ? 'Caută' : 'Search'}` |
| 629 | `locale === 'ro'` |
| 638 | `{locale === 'ro' ? 'Tip' : 'Type'}` |
| 648 | `{locale === 'ro' ? opt.ro : opt.en}` |
| 655 | `{locale === 'ro' ? 'Utilizator' : 'Actor'}` |
| 663 | `<option value="">{locale === 'ro' ? 'Oricine' : 'Anyone'}</option>` |
| 665 | `<option value={user.id}>{locale === 'ro' ? 'Doar eu' : 'Only me'}</option>` |
| 689 | `{locale === 'ro' ? opt.ro : opt.en}` |
| 694 | `{locale === 'ro' ? 'Toate' : 'All'}` |
| 708 | `aria-label={`${locale === 'ro' ? 'Șterge filtrul' : 'Clear filter'}: ${chip.label}`}` |
| 720 | `{locale === 'ro' ? 'Șterge toate' : 'Clear all'}` |
| 728 | `title={locale === 'ro' ? 'Eroare la încărcarea activității' : 'Failed to load activity'}` |
| 746 | `locale === 'ro'` |
| 751 | `locale === 'ro'` |
| 756 | `label: locale === 'ro' ? 'Șterge filtrele' : 'Clear filters',` |
| 763 | `title={locale === 'ro' ? 'Nicio activitate încă' : 'No activity yet'}` |
| 765 | `locale === 'ro'` |

### `web/src/app/aprobare/page.tsx` (1)

| Line | Source |
|------|--------|
| 198 | `{new Date(exp.submitted_at \|\| exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}` |

### `web/src/app/cheltuieli/page.tsx` (40)

| Line | Source |
|------|--------|
| 205 | `locale === 'ro' ? 'Cheltuială aprobată' : 'Expense approved',` |
| 211 | `locale === 'ro' ? 'Aprobare eșuată' : 'Approval failed',` |
| 264 | `title={locale === 'ro' ? 'Cheltuiala nouă' : 'New Expense'}` |
| 269 | `{locale === 'ro' ? 'Anulează' : 'Cancel'}` |
| 273 | `{submitting ? (locale === 'ro' ? 'Se trimite...' : 'Submitting...') : (locale === 'ro' ? 'Trimite spre aprobare' : 'Submit for approval')}` |
| 278 | `<p className="text-xs text-slate-500 mb-4">{locale === 'ro' ? 'Completeaza detaliile și trimite spre aprobare.' : 'Fill in the details and s` |
| 283 | `<p className="text-xs font-semibold text-slate-600 mb-2">{locale === 'ro' ? 'Scanare document (opțională)' : 'Document scan (optional)'}</p>` |
| 286 | `<span className="text-sm font-semibold text-slate-800">{receipt ? receipt.name : (locale === 'ro' ? 'Încarcă bonul fiscal sau factura' : 'Up` |
| 291 | `{receipt && !ocrResult && <p className="text-xs text-success-foreground mt-2">{locale === 'ro' ? 'Document selectat. Apasă "Procesează docum` |
| 294 | `{processing ? (locale === 'ro' ? 'Se procesează...' : 'Processing...') : (locale === 'ro' ? 'Procesează documentul' : 'Process document')}` |
| 300 | `<p className="font-semibold text-success-foreground text-xs">{locale === 'ro' ? 'Date extrase — verifică înainte de trimitere' : 'Extracted ` |
| 303 | `[locale === 'ro' ? 'Furnizor' : 'Merchant', ocrResult.merchant_name],` |
| 305 | `[locale === 'ro' ? 'Nr. document' : 'Doc. no.', ocrResult.document_number],` |
| 306 | `[locale === 'ro' ? 'Data' : 'Date', ocrResult.document_date],` |
| 307 | `[locale === 'ro' ? 'Subtotal' : 'Subtotal', ocrResult.subtotal],` |
| 309 | `[locale === 'ro' ? 'Total' : 'Total', ocrResult.total],` |
| 310 | `[locale === 'ro' ? 'Moneda' : 'Currency', ocrResult.currency],` |
| 321 | `<label className="hii-label">{locale === 'ro' ? 'Categorie' : 'Category'}</label>` |
| 329 | `<label className="hii-label">{locale === 'ro' ? 'Metoda plata' : 'Payment'}</label>` |
| 331 | `<option value="COMPANY_CARD">{locale === 'ro' ? 'Card companie' : 'Company card'}</option>` |
| 332 | `<option value="PERSONAL">{locale === 'ro' ? 'Personal' : 'Personal'}</option>` |
| 333 | `<option value="COMPANY_CASH">{locale === 'ro' ? 'Cash avans' : 'Company cash'}</option>` |
| 334 | `<option value="OTHER">{locale === 'ro' ? 'Alta' : 'Other'}</option>` |
| 338 | `<label className="hii-label">{locale === 'ro' ? 'Suma' : 'Amount'}</label>` |
| 343 | `<label className="hii-label">{locale === 'ro' ? 'Moneda' : 'Currency'}</label>` |
| 351 | `<label className="hii-label">{locale === 'ro' ? 'Data' : 'Date'}</label>` |
| 355 | `<label className="hii-label">{locale === 'ro' ? 'Furnizor' : 'Merchant'}</label>` |
| 357 | `className="hii-input" placeholder={locale === 'ro' ? 'Nume furnizor' : 'Merchant name'} />` |
| 361 | `<label className="hii-label">{locale === 'ro' ? 'Descriere' : 'Description'}</label>` |
| 364 | `placeholder={locale === 'ro' ? 'Descrie cheltuiala...' : 'Describe the expense...'} />` |
| 376 | `{locale === 'ro' ? 'Filtre' : 'Filters'}` |
| 381 | `{s === 'all' ? (locale === 'ro' ? 'Toate' : 'All') : t('status.' + s, locale)}` |
| 389 | `<div role="dialog" aria-modal="true" aria-label={locale === 'ro' ? 'Filtre' : 'Filters'} className="w-full max-h-[70vh] rounded-t-2xl bg-whi` |
| 391 | `<span className="text-lg font-bold text-slate-900">{locale === 'ro' ? 'Filtre' : 'Filters'}</span>` |
| 399 | `<span>{s === 'all' ? (locale === 'ro' ? 'Toate' : 'All') : t('status.' + s, locale)}</span>` |
| 425 | `{canApprove && <th className="text-center">{locale === 'ro' ? 'Acțiuni' : 'Actions'}</th>}` |
| 430 | `<td className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</td>` |
| 440 | `{locale === 'ro' ? 'Aprobă' : 'Approve'}` |
| 457 | `<span className="text-xs text-slate-600">{new Date(exp.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</span>` |
| 468 | `{locale === 'ro' ? 'Aprobă cheltuiala' : 'Approve expense'}` |

### `web/src/app/documente/page.tsx` (2)

| Line | Source |
|------|--------|
| 292 | `{' · '}{doc.updated_at ? new Date(doc.updated_at).toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB') : '—'}` |
| 323 | `{v.created_at ? new Date(v.created_at).toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB') : '—'}` |

### `web/src/app/issues/page.tsx` (2)

| Line | Source |
|------|--------|
| 270 | `<span><Calendar className="w-3 h-3 inline mr-1" />{new Date(issue.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ro-RO')}</span` |
| 284 | `{locale === 'en' ? 'Photos' : 'Fotografii'}` |

### `web/src/app/notificari/page.tsx` (6)

| Line | Source |
|------|--------|
| 74 | `label = locale === 'ro' ? 'Astăzi' : 'Today';` |
| 77 | `label = locale === 'ro' ? 'Ieri' : 'Yesterday';` |
| 80 | `label = new Date(n.created_at).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });` |
| 103 | `toastSuccess(locale === 'ro' ? 'Notificări marcate ca citite' : 'All notifications marked as read');` |
| 202 | `<h4 className="text-sm font-semibold text-slate-900">{locale === 'ro' ? n.title_ro : (n.title_en \|\| n.title_ro)}</h4>` |
| 206 | `<p className="text-xs text-slate-600 mt-0.5">{locale === 'ro' ? n.message_ro : (n.message_en \|\| n.message_ro)}</p>` |

### `web/src/app/pontaj/page.tsx` (45)

| Line | Source |
|------|--------|
| 136 | `setError(err instanceof Error ? err.message : (locale === 'en' ? 'Failed to correct attendance' : 'Corecția pontajului a eșuat'));` |
| 149 | `log.check_in_time ? new Date(log.check_in_time).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO') : '',` |
| 150 | `log.check_out_time ? new Date(log.check_out_time).toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO') : '',` |
| 192 | `locale === 'en'` |
| 221 | `{ key: 'daily', label: locale === 'en' ? 'Daily Attendance' : 'Prezență Zilnică', icon: Calendar },` |
| 222 | `{ key: 'monthly', label: locale === 'en' ? 'Monthly Matrix' : 'Pontaj Lunar' },` |
| 236 | `<div className="text-xs font-medium text-slate-400 uppercase">{locale === 'en' ? 'Active now' : 'Pe șantier acum'}</div>` |
| 242 | `<div className="text-xs text-slate-400 mt-1">{locale === 'en' ? 'workers currently on site' : 'de muncitori pe șantier'}</div>` |
| 246 | `<div className="text-xs font-medium text-slate-400 uppercase">{locale === 'en' ? 'Completed today' : 'Finalizati azi'}</div>` |
| 252 | `<div className="text-xs text-slate-400 mt-1">{locale === 'en' ? 'shifts with check-out' : 'turnee cu ieșire înregistrată'}</div>` |
| 256 | `<div className="text-xs font-medium text-slate-400 uppercase">{locale === 'en' ? 'Workers today' : 'Muncitori azi'}</div>` |
| 262 | `<div className="text-xs text-slate-400 mt-1">{locale === 'en' ? 'attendance records today' : 'inregistrari de pontaj azi'}</div>` |
| 266 | `<div className="text-xs font-medium text-slate-400 uppercase">{locale === 'en' ? 'Overtime today' : 'Ore suplim. azi'}</div>` |
| 275 | `<div className="text-xs text-slate-400 mt-1">{locale === 'en' ? 'overtime accumulated' : 'ore suplimentare acumulate'}</div>` |
| 285 | `<h3 className="text-sm font-bold text-slate-900">{locale === 'en' ? 'On Site Now' : 'Pe Șantier Acum'}</h3>` |
| 286 | `<span className="text-xs text-slate-400">{activeOnSite.length} {locale === 'en' ? 'active' : 'activi'}</span>` |
| 293 | `title={locale === 'en' ? 'No active shifts right now.' : 'Nicio tura activa acum.'}` |
| 305 | `{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })` |
| 324 | `<h3 className="text-sm font-bold text-slate-900">{locale === 'en' ? 'Missing Attendance' : 'Lipsa Pontaj'}</h3>` |
| 325 | `{canReadUsers && <span className="text-xs text-warning">{missingWorkers.length} {locale === 'en' ? 'missing' : 'lipsa'}</span>}` |
| 332 | `{locale === 'en'` |
| 339 | `{locale === 'en' ? 'Everyone checked in today.' : 'Toti s-au pontat azi.'}` |
| 354 | `{locale === 'en' ? 'No check-in' : 'Fără pontaj'}` |
| 368 | `{locale === 'en'` |
| 382 | `<span>{locale === 'en' ? 'Daily Attendance Register' : 'Registru Prezență'}</span>` |
| 392 | `{locale === 'en' ? 'Standard shift: 09:00 - 18:00 (1h break)' : 'Program standard: 09:00 - 18:00 (1h pauza)'}` |
| 401 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Worker / Team Leader' : 'Muncitor / Șef de Echipă'}</th>` |
| 402 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Site' : 'Șantier'}</th>` |
| 403 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Check-in' : 'AM VENIT'}</th>` |
| 404 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Check-out' : 'AM PLECAT'}</th>` |
| 405 | `<th className="py-3.5 px-4">{locale === 'en' ? 'GPS' : 'Verificare GPS'}</th>` |
| 406 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Regular hours' : 'Ore Normale'}</th>` |
| 407 | `<th className="py-3.5 px-4">{locale === 'en' ? 'Overtime' : 'Ore Suplimentare'}</th>` |
| 408 | `<th className="py-3.5 px-4 text-right">{locale === 'en' ? 'Status' : 'Stare'}</th>\n                  {canCorrectAttendance && <th className` |
| 426 | `title={locale === 'en' ? 'Failed to load attendance' : 'Eroare la incarcarea pontajului'}` |
| 486 | `{locale === 'en' ? 'Completed' : 'Finalizat'}` |
| 491 | `{locale === 'en' ? 'On site' : 'Pe șantier'}` |
| 498 | `{locale === 'en' ? 'Correct' : 'Corectează'}` |
| 516 | `<span>{locale === 'en' ? 'Monthly Attendance Matrix' : 'Matrice Pontaj Lunar'}</span>` |
| 526 | `{locale === 'en' ? 'Legend: 8 = regular hours, +1 = overtime' : 'Legenda: 8 = ore normale, +1 = ore suplimentare'}` |
| 535 | `<th className="py-3 px-4 text-left min-w-[200px]">{locale === 'en' ? 'Name' : 'Nume & Prenume'}</th>` |
| 542 | `<th className="py-3 px-3 bg-warning-soft text-warning-foreground font-bold min-w-[90px]">{locale === 'en' ? 'Total Hours' : 'Total Ore'}</th` |
| 543 | `<th className="py-3 px-3 bg-warning-soft text-warning-foreground font-extrabold min-w-[100px]">{locale === 'en' ? 'OVERTIME' : 'ORE SUPLIM.'` |
| 550 | `{locale === 'en'` |
| 562 | `title={locale === 'en' ? 'No workers in the directory yet.' : 'Niciun muncitor in director inca.'}` |

### `web/src/app/profil/page.tsx` (2)

| Line | Source |
|------|--------|
| 99 | `title={locale === 'en' ? 'Could not load profile' : 'Profilul nu a putut fi încărcat'}` |
| 100 | `message={locale === 'en' ? 'Check your connection and try again.' : 'Verifică conexiunea și încearcă din nou.'}` |

### `web/src/app/projects/[id]/ProjectSettingsPanel.tsx` (8)

| Line | Source |
|------|--------|
| 65 | `{locale === 'en' ? 'Project Settings' : 'Setări Proiect'}` |
| 69 | `<label className={labelCls}>{locale === 'en' ? 'Status' : 'Stare'}</label>` |
| 73 | `{locale === 'en' ? opt.labelEn : opt.labelRo}` |
| 84 | `<label className={labelCls}>{locale === 'en' ? 'Target End Date' : 'Data Tinta'}</label>` |
| 90 | `<label className={labelCls}>{locale === 'en' ? 'Budget' : 'Buget'}</label>` |
| 94 | `<label className={labelCls}>{locale === 'en' ? 'Currency' : 'Moneda'}</label>` |
| 104 | `<label htmlFor="isActive" className="text-sm text-slate-700">{locale === 'en' ? 'Active' : 'Activ'}</label>` |
| 113 | `{saving ? (locale === 'en' ? 'Saving...' : 'Se salvează...') : (locale === 'en' ? 'Save Settings' : 'Salvează setări')}` |

### `web/src/app/projects/[id]/ProjectStagesPanel.tsx` (7)

| Line | Source |
|------|--------|
| 95 | `{locale === 'en' ? 'Project Stages' : 'Etape Proiect'}` |
| 99 | `{locale === 'en' ? 'Add Stage' : 'Adaugă etapă'}` |
| 112 | `<label className={labelCls}>{locale === 'en' ? 'Start Date' : 'Data început'}</label>` |
| 116 | `<label className={labelCls}>{locale === 'en' ? 'End Date' : 'Data sfârșit'}</label>` |
| 122 | `{locale === 'en' ? 'Cancel' : 'Anulează'}` |
| 125 | `{locale === 'en' ? 'Create' : 'Creează'}` |
| 135 | `{locale === 'en' ? 'No stages defined yet' : 'Nicio etapa definita inca'}` |

### `web/src/app/projects/page.tsx` (48)

| Line | Source |
|------|--------|
| 99 | `return locale === 'en'` |
| 139 | `setWizardError(locale === 'en' ? 'Project name is required' : 'Numele proiectului este obligatoriu');` |
| 143 | `setWizardError(locale === 'en' ? 'Project code is required' : 'Codul proiectului este obligatoriu');` |
| 187 | `success(locale === 'en' ? 'Project created successfully' : 'Proiect creat cu succes');` |
| 220 | `<label className={labelCls}>{locale === 'en' ? 'Project Name *' : 'Nume Proiect *'}</label>` |
| 221 | `<input className={inputCls} placeholder={locale === 'en' ? 'e.g. Solar Park Bihor' : 'ex. Parc Fotovoltaic Bihor'} value={form.name} onChang` |
| 224 | `<label className={labelCls}>{locale === 'en' ? 'Project Code *' : 'Cod Proiect *'}</label>` |
| 228 | `<label className={labelCls}>{locale === 'en' ? 'Client ID' : 'ID Client'}</label>` |
| 229 | `<input className={inputCls} placeholder={locale === 'en' ? 'Client catalog not available' : 'Catalog clienti indisponibil'} value={form.clie` |
| 230 | `<p className="text-xs text-slate-400 mt-1">{locale === 'en' ? '(Backend gap: no client catalog endpoint)' : '(Gap backend: endpoint catalog ` |
| 239 | `<label className={labelCls}>{locale === 'en' ? 'Address' : 'Adresa'}</label>` |
| 240 | `<input className={inputCls} placeholder={locale === 'en' ? 'Project address' : 'Adresa proiectului'} value={form.address} onChange={e => upd` |
| 244 | `<label className={labelCls}>{locale === 'en' ? 'Latitude' : 'Latitudine'}</label>` |
| 248 | `<label className={labelCls}>{locale === 'en' ? 'Longitude' : 'Longitudine'}</label>` |
| 253 | `<label className={labelCls}>{locale === 'en' ? 'Geofence Radius (m)' : 'Raza Geofence (m)'}</label>` |
| 263 | `<label className={labelCls}>{locale === 'en' ? 'Installed Capacity (MWp)' : 'Capacitate Instalata (MWp)'}</label>` |
| 274 | `<label className={labelCls}>{locale === 'en' ? 'Start Date' : 'Data început'}</label>` |
| 278 | `<label className={labelCls}>{locale === 'en' ? 'Target End Date' : 'Data finalizare țintă'}</label>` |
| 290 | `<label className={labelCls}>{locale === 'en' ? 'Total Budget' : 'Buget Total'}</label>` |
| 294 | `<label className={labelCls}>{locale === 'en' ? 'Currency' : 'Moneda'}</label>` |
| 309 | `{locale === 'en'` |
| 315 | `<label className={labelCls}>{locale === 'en' ? 'User ID' : 'ID Utilizator'}</label>` |
| 319 | `<label className={labelCls}>{locale === 'en' ? 'Role' : 'Rol'}</label>` |
| 331 | `{locale === 'en' ? 'Add' : 'Adaugă'}` |
| 351 | `{locale === 'en' ? 'No members added. Creator auto-added as PM.' : 'Niciun membru adaugat. Creatorul adaugat automat ca PM.'}` |
| 361 | `<div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Name' : 'Nume'}</span><span className="font-mediu` |
| 362 | `<div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Code' : 'Cod'}</span><span className="font-medium` |
| 363 | `{form.address && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Address' : 'Adresa'}</span><span` |
| 364 | `{form.budgetTotal && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Budget' : 'Buget'}</span><sp` |
| 365 | `{form.startDate && <div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Start' : 'Început'}</span><spa` |
| 367 | `<div className="flex justify-between"><span className="text-slate-500">{locale === 'en' ? 'Members' : 'Membri'}</span><span className="font-` |
| 405 | `title={locale === 'en' ? 'Projects' : 'Proiecte'}` |
| 406 | `subtitle={locale === 'en' ? 'Manage your construction projects' : 'Gestionează proiectele de construcție'}` |
| 410 | `{locale === 'en' ? 'New Project' : 'Proiect Nou'}` |
| 422 | `placeholder={locale === 'en' ? 'Search projects...' : 'Caută proiecte...'}` |
| 437 | `<option value="">{locale === 'en' ? 'All Statuses' : 'Toate Stările'}</option>` |
| 439 | `<option key={opt.value} value={opt.value}>{locale === 'en' ? opt.labelEn : opt.labelRo}</option>` |
| 443 | `{locale === 'en' ? 'Refresh' : 'Reîmprospătează'}` |
| 451 | `title={locale === 'en' ? 'No projects found' : 'Niciun proiect găsit'}` |
| 454 | `? (locale === 'en' ? 'Try different search terms' : 'Încearcă alți termeni de căutare')` |
| 455 | `: (locale === 'en' ? 'Create your first project to get started' : 'Creează primul proiect pentru a începe')` |
| 459 | `{locale === 'en' ? 'New Project' : 'Proiect Nou'}` |
| 519 | `{locale === 'en' ? 'Create New Project' : 'Creaza Proiect Nou'}` |
| 532 | `{locale === 'en' ? 'Step' : 'Pasul'} {wizardStep + 1} / {WIZARD_STEPS.length}` |
| 546 | `{locale === 'en' ? 'Back' : 'Inapoi'}` |
| 554 | `{locale === 'en' ? 'Next' : 'Următorul'}` |
| 559 | `? (locale === 'en' ? 'Creating...' : 'Se creează...')` |
| 560 | `: (locale === 'en' ? 'Create Project' : 'Creează Proiect')}` |

### `web/src/app/rapoarte/page.tsx` (4)

| Line | Source |
|------|--------|
| 199 | `placeholder={locale === 'en' ? 'Search site, team leader, notes, tasks, materials…' : 'Caută șantier, șef de echipă, observații, task-uri, m` |
| 201 | `aria-label={locale === 'en' ? 'Search daily reports' : 'Caută rapoarte zilnice'}` |
| 205 | `{statusOptions.map(status => <option key={status} value={status}>{status === 'ALL' ? (locale === 'en' ? 'All statuses' : 'Toate stările') : ` |
| 209 | `{locale === 'en' ? 'Clear filters' : 'Șterge filtrele'}` |

### `web/src/app/stocuri/page.tsx` (36)

| Line | Source |
|------|--------|
| 85 | `setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : (locale === 'en' ? 'Failed to load stock data.' : 'Nu ` |
| 126 | `setFormError(locale === 'en' ? 'Select a material and enter a quantity greater than 0.' : 'Selectează materialul și introdu o cantitate mai ` |
| 133 | `if (!selectedProjectId) throw new Error(locale === 'en' ? 'Select a project before receiving stock.' : 'Selectează un proiect înainte de rec` |
| 136 | `if (!selectedProjectId) throw new Error(locale === 'en' ? 'Select a project before consuming stock.' : 'Selectează un proiect înainte de con` |
| 140 | `throw new Error(locale === 'en' ? 'Select a different target project.' : 'Selectează un proiect țintă diferit.');` |
| 147 | `setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : (locale === 'en' ? 'Stock operation failed.' : 'Op` |
| 152 | `? (locale === 'en' ? 'Receive stock' : 'Recepționează stoc')` |
| 154 | `? (locale === 'en' ? 'Consume stock' : 'Consumă stoc')` |
| 155 | `: (locale === 'en' ? 'Transfer stock' : 'Transferă stoc');` |
| 162 | `eyebrow={locale === 'en' ? 'Inventory' : 'Gestiune stocuri'}` |
| 163 | `title={locale === 'en' ? 'Stock & Material Movements' : 'Stocuri și mișcări materiale'}` |
| 164 | `subtitle={locale === 'en' ? 'Current balances and the immutable movement ledger, scoped to your project access.' : 'Soldurile curente și jur` |
| 167 | `{MUTATION_ROLES.receive.includes(userRole as never) && selectedProjectId && <Button type="button" variant="primary" onClick={() => openActio` |
| 168 | `{MUTATION_ROLES.consume.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAct` |
| 169 | `{MUTATION_ROLES.transfer.includes(userRole as never) && selectedProjectId && <Button type="button" variant="secondary" onClick={() => openAc` |
| 171 | `{locale === 'en' ? 'Refresh' : 'Reîmprospătează'}` |
| 178 | `<Summary label={locale === 'en' ? 'Materials in stock' : 'Materiale cu stoc'} value={balances.length} />` |
| 179 | `<Summary label={locale === 'en' ? 'Critical' : 'Critice'} value={criticalCount} attention={criticalCount > 0} />` |
| 180 | `<Summary label={locale === 'en' ? 'Movement entries' : 'Mișcări'} value={movements.length} />` |
| 181 | `<Summary label={locale === 'en' ? 'Visible materials' : 'Materiale disponibile'} value={materials.length} />` |
| 186 | `title={locale === 'en' ? 'Could not load stock' : 'Nu s-au putut încărca stocurile'}` |
| 200 | `<div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Boxes className="w-4 h-4 text-warning" />{locale === 'en' ? 'Curr` |
| 204 | `<input value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'en' ? 'Search material…' : 'Caută material…'} class` |
| 242 | `<td className="py-3.5 px-4 font-mono font-bold">{material?.code \|\| '—'}</td><td className="py-3.5 px-4 font-medium">{material?.name \|\| '` |
| 252 | `<div className="flex items-center gap-2 text-sm font-bold text-slate-800"><History className="w-4 h-4 text-warning" />{locale === 'en' ? 'Im` |
| 254 | `<option value="ALL">{locale === 'en' ? 'All movement types' : 'Toate tipurile'}</option>` |
| 283 | `const label = type === 'RECEIPT' ? (locale === 'en' ? 'Receipt' : 'Recepție') : type === 'CONSUMPTION' ? (locale === 'en' ? 'Consumption' : ` |
| 285 | `return <tr key={mv.id} className="hover:bg-slate-50"><td className="py-3 px-4 font-mono text-slate-600">{new Date(mv.created_at).toLocaleStr` |
| 304 | `{saving ? (locale === 'en' ? 'Saving…' : 'Se salvează…') : actionLabel}` |
| 310 | `{locale === 'en' ? 'This operation is persisted through the inventory API and immutable ledger.' : 'Operațiunea este salvată prin API-ul de ` |
| 314 | `<label className="hii-label">{locale === 'en' ? 'Material' : 'Material'}</label>` |
| 316 | `<option value="">{locale === 'en' ? 'Select material' : 'Selectează materialul'}</option>` |
| 321 | `<label className="hii-label">{locale === 'en' ? 'Quantity' : 'Cantitate'}</label>` |
| 326 | `<label className="hii-label">{locale === 'en' ? 'Target project' : 'Proiect țintă'}</label>` |
| 328 | `<option value="">{locale === 'en' ? 'Select target project' : 'Selectează proiectul țintă'}</option>` |
| 334 | `<label className="hii-label">{locale === 'en' ? 'Notes' : 'Observații'}</label>` |

### `web/src/app/utilizatori/page.tsx` (15)

| Line | Source |
|------|--------|
| 45 | `if (locale === 'en') {` |
| 145 | `subtitle={locale === 'en' ? 'Manage organization users, roles, status, and permissions.' : 'Gestionează utilizatorii organizației, rolurile,` |
| 155 | `title={locale === 'en' ? 'Could not load users and roles' : 'Nu s-au putut încărca utilizatorii și rolurile'}` |
| 163 | `{ key: 'users', label: `${locale === 'en' ? 'Users' : 'Utilizatori'} (${users.length})` },` |
| 164 | `{ key: 'roles', label: `${locale === 'en' ? 'Roles & permissions' : 'Roluri și permisiuni'} (${roles.length})` },` |
| 176 | `placeholder={locale === 'en' ? 'Search name or email' : 'Caută nume sau email'}` |
| 180 | `<option value="ALL">{locale === 'en' ? 'All roles' : 'Toate rolurile'}</option>` |
| 184 | `<option value="ALL">{locale === 'en' ? 'All statuses' : 'Toate statusurile'}</option>` |
| 197 | `title={locale === 'en' ? 'No users found' : 'Nu există utilizatori'}` |
| 205 | `<th>{locale === 'en' ? 'User' : 'Utilizator'}</th>` |
| 206 | `<th>{locale === 'en' ? 'Role' : 'Rol'}</th>` |
| 207 | `<th>{locale === 'en' ? 'Status' : 'Status'}</th>` |
| 208 | `<th>{locale === 'en' ? 'Projects' : 'Proiecte'}</th>` |
| 249 | `{item.project_members?.length \|\| 0}{isSelf && <span className="ml-2 text-slate-400">({locale === 'en' ? 'you' : 'tu'})</span>}` |
| 270 | `title={locale === 'en' ? 'No roles returned by the API' : 'API-ul nu a returnat roluri'}` |

### `web/src/components/ControlTowerDrilldownDrawer.tsx` (3)

| Line | Source |
|------|--------|
| 102 | `{locale === 'ro' ? 'Eroare la încărcare' : 'Failed to load'}` |
| 110 | `{locale === 'ro' ? 'Reîncearcă' : 'Retry'}` |
| 136 | `` · ${locale === 'ro' ? 'Sunt disponibile mai multe rezultate' : 'More results available'}`}` |

### `web/src/components/ControlTowerSurface.tsx` (11)

| Line | Source |
|------|--------|
| 395 | `return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {` |
| 439 | `{t('control_tower.last_updated', locale)}: {lastUpdated.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO')}` |
| 518 | `locale === 'ro'` |
| 1065 | `{locale === 'ro' ? 'Activitate de ieri' : 'Activity since yesterday'}` |
| 1068 | `{locale === 'ro'` |
| 1077 | `{locale === 'ro' ? 'Vezi tot' : 'View all'}` |
| 1085 | `locale === 'ro'` |
| 1102 | `title={locale === 'ro' ? 'Nicio activitate recentă' : 'No recent activity'}` |
| 1104 | `locale === 'ro'` |
| 1115 | `{locale === 'ro' ? group.ro : group.en}` |
| 1122 | `event.actor?.name \|\| (locale === 'ro' ? 'Sistem' : 'System');` |

### `web/src/components/GlobalQuickSearch.tsx` (9)

| Line | Source |
|------|--------|
| 54 | `aria-label={locale === 'en' ? 'Search pages' : 'Caută pagini'}` |
| 58 | `<span className="hidden xl:inline">{locale === 'en' ? 'Quick search' : 'Căutare rapidă'}</span>` |
| 67 | `title={locale === 'en' ? 'Search the workspace' : 'Caută în aplicație'}` |
| 74 | `<span className="sr-only">{locale === 'en' ? 'Search pages' : 'Caută pagini'}</span>` |
| 80 | `placeholder={locale === 'en' ? 'Search projects, planning, reports…' : 'Caută proiecte, planificare, rapoarte…'}` |
| 85 | `<div className="max-h-[min(55vh,420px)] overflow-y-auto p-2" role="listbox" aria-label={locale === 'en' ? 'Pages' : 'Pagini'}>` |
| 102 | `{active ? <span className="text-xs text-hii-700">{locale === 'en' ? 'Current' : 'Curent'}</span> : <ArrowRight className="h-4 w-4 text-slate` |
| 107 | `{locale === 'en' ? 'No matching pages.' : 'Nu există pagini potrivite.'}` |
| 112 | `<span>{locale === 'en' ? 'Navigation only — access follows your role.' : 'Navigare în pagini — accesul respectă rolul tău.'}</span>` |

### `web/src/components/Header.tsx` (2)

| Line | Source |
|------|--------|
| 74 | `aria-label={locale === 'en' ? 'Breadcrumb' : 'Navigare'}` |
| 78 | `{pathname === '/' ? (locale === 'en' ? 'Operations' : 'Operațiuni') : activeTitle}` |

### `web/src/components/MobilePrimaryNav.tsx` (2)

| Line | Source |
|------|--------|
| 47 | `<nav className="mobile-primary-nav fixed inset-x-0 bottom-0 z-sidebar border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset` |
| 51 | `const label = locale === 'en' ? 'More' : 'Mai multe';` |

### `web/src/components/MoreSheet.tsx` (1)

| Line | Source |
|------|--------|
| 47 | `title={locale === 'en' ? 'More' : 'Mai multe'}` |

### `web/src/components/WorkerAttendanceView.tsx` (4)

| Line | Source |
|------|--------|
| 176 | `{locale === 'en' ? 'Active shift' : 'Tura activa'}` |
| 244 | `{locale === 'en' ? 'New Shift' : 'Tura Noua'}` |
| 268 | `<p className="text-xs text-slate-400">{locale === 'en' ? 'Work assigned to you on this site' : t('worker.assigned_work_site', locale)}</p>` |
| 287 | `{locale === 'en'` |

### `web/src/components/WorkerDashboard.tsx` (4)

| Line | Source |
|------|--------|
| 145 | `? new Date(attendance.check_in_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })` |
| 148 | `? new Date(attendance.check_out_time).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })` |
| 175 | `{geoStatus.state === 'granted' ? (locale === 'en' ? 'GPS location: ' : 'Locație GPS: ') + geoStatus.location.latitude.toFixed(4) + ', ' + ge` |
| 223 | `<button onClick={loadAttendance} disabled={attLoading} aria-label={locale === 'en' ? 'Refresh attendance' : 'Reîmprospătează pontajul'} clas` |

### `web/src/components/WorkerDayHeader.tsx` (1)

| Line | Source |
|------|--------|
| 21 | `const localeCode = locale === 'ro' ? 'ro-RO' : 'en-GB';` |

### `web/src/components/WorkerNotifications.tsx` (2)

| Line | Source |
|------|--------|
| 44 | `if (locale === 'en' && notif.title_en) {` |
| 51 | `if (locale === 'en' && notif.message_en) {` |

### `web/src/features/attendance/components/AttendanceCorrectionDialog.tsx` (1)

| Line | Source |
|------|--------|
| 52 | `const en = locale === 'en';` |

### `web/src/features/daily-reports/DailyReportForm.tsx` (1)

| Line | Source |
|------|--------|
| 42 | `{draftSavedAt && <div className="flex items-center gap-1.5 mt-1 text-xs text-success"><Clock className="w-3 h-3" /><span>{t('daily_report.dr` |

### `web/src/features/daily-reports/DailyReportOhsSection.tsx` (1)

| Line | Source |
|------|--------|
| 63 | `placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}` |

### `web/src/features/daily-reports/DailyReportReviewSection.tsx` (2)

| Line | Source |
|------|--------|
| 58 | `<p className="text-xs text-slate-600">{ohsChecked}/{form.ohsRisks.length} {locale === 'ro' ? 'riscuri verificate' : 'risks checked'}</p>` |
| 123 | `<p className="text-xs text-slate-400 italic">{locale === 'ro' ? 'Fără observații' : 'No notes'}</p>` |

### `web/src/features/daily-reports/DailyReportTasksSection.tsx` (2)

| Line | Source |
|------|--------|
| 66 | `placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}` |
| 88 | `placeholder={locale === 'ro' ? 'Observații...' : 'Notes...'}` |

### `web/src/features/planning/summary.ts` (1)

| Line | Source |
|------|--------|
| 76 | `return locale === 'ro' ? 'ro-RO' : 'en-US';` |

### `web/src/features/qa-qc/components/InspectionCard.tsx` (2)

| Line | Source |
|------|--------|
| 40 | `: inspectedAt.toLocaleString(locale === 'en' ? 'en-GB' : 'ro-RO', {` |
| 123 | `{locale === 'en' ? 'Photos' : 'Fotografii'}` |

### `web/src/features/tasks/components/TaskCard.tsx` (3)

| Line | Source |
|------|--------|
| 80 | `locale === 'ro' ? 'ro-RO' : 'en-GB'` |
| 383 | `? locale === 'ro'` |
| 386 | `: locale === 'ro'` |

### `web/src/features/tasks/components/TaskProgressBar.tsx` (2)

| Line | Source |
|------|--------|
| 34 | `return num.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-US');` |
| 36 | `return num.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-US', {` |

### Benign locale-code ternaries (not bugs)

| File:line | Source |
|-----------|--------|
| `web/src/app/activity/page.tsx:107` | `const rtf = new Intl.RelativeTimeFormat(locale === 'ro' ? 'ro' : 'en', { numeric: 'auto' });` |
| `web/src/app/activity/page.tsx:133` | `return formatDate(iso, locale === 'ro' ? 'ro' : 'en');` |
| `web/src/app/activity/page.tsx:170` | `const known = meta ? meta[locale === 'ro' ? 'ro' : 'en'] : null;` |
| `web/src/app/activity/page.tsx:280` | `{relativeTime(event.createdAt, locale)} · {formatDateTime(event.createdAt, locale === 'ro' ? 'ro' : 'en')}` |
| `web/src/app/activity/page.tsx:379` | `<span>{formatDateTime(event.createdAt, locale === 'ro' ? 'ro' : 'en')}</span>` |
| `web/src/components/ControlTowerSurface.tsx:89` | `const rtf = new Intl.RelativeTimeFormat(locale === 'ro' ? 'ro' : 'en', { numeric: 'auto' });` |
| `web/src/components/ControlTowerSurface.tsx:137` | `const text = meta ? meta[locale === 'ro' ? 'ro' : 'en'] : locale === 'ro' ? 'a înregistrat o acțiune' : 'performed an ac` |
| `web/src/components/ui/PhotoUpload.tsx:82` | `const l = I18N[locale === 'ro' ? 'ro' : 'en'];` |
| `web/src/components/WorkerDashboard.tsx:48` | `const copy = roleHome[locale === 'en' ? 'en' : 'ro'];` |

## (e) Hardcoded user-facing strings — `Sidebar.tsx` and `Header.tsx`

### `web/src/components/Sidebar.tsx`

**No hardcoded user-facing strings.** Every visible label goes through `t(...)`:
`t(item.i18nKey, locale)`, `t(group.titleKey, locale)`, `t('header.visitator')`,
`t('nav.profil')`, `t('sidebar.navigation')`, `t('sidebar.close')`, `t('header.logout')`.
Roles are localised via `getRoleLabel(user?.role, locale)`.

### `web/src/components/Header.tsx`

| Line | Kind | String |
|------|------|--------|
| 39 | hardcoded fallback | `'Vizitator'` (user name fallback) |
| 44 | hardcoded fallback | `t('header.profile') \|\| 'Profilul meu'` |
| 50 | hardcoded fallback | `t('header.logout') \|\| 'Deconectare'` |
| 67 | hardcoded fallback | `t('header.menu') \|\| 'Deschide meniul'` |
| 74 | inline ternary | `locale === 'en' ? 'Breadcrumb' : 'Navigare'` |
| 78 | inline ternary | `locale === 'en' ? 'Operations' : 'Operațiuni'` |
| 87-88 | hardcoded fallback | `t('header.current_project') \|\| 'Proiect curent'` / `t('header.all_projects') \|\| 'Toate proiectele'` |
| 97 | hardcoded fallback | `t('header.select_project') \|\| 'Selectează proiect'` |
| 120 | hardcoded fallback | `t('nav.notificari') \|\| 'Notificări'` |
| 139 | untranslated | raw `(user?.role \|\| '').toLowerCase()` rendered instead of `getRoleLabel` |
| 147 | hardcoded fallback | `t('header.user_menu') \|\| 'Meniul utilizator'` |

Additionally, `web/src/config/navigation.ts` carries RO-only `label`/`title` fallbacks
(e.g. `label: 'Turn de Control'`, `title: 'Operațiuni'`) that are shown only when the
`i18nKey` lookup returns an empty string; they are the same strings already present as
`nav.*` keys, so they are not a separate defect, but they are not language-aware.

## Reported counts

| Metric | Value |
|--------|-------|
| Defined keys (all have RO + EN) | 1432 |
| Keys referenced via `t(...)` in `web/src` but undefined | 0 |
| Keys defined but never referenced (dead) | 417 |
| Inline text-bypass ternaries (app/features/components) | 307 |
| Inline text-bypass ternaries (all of web/src) | 323 |
| Files with text-bypass ternaries (app/features/components) | 33 |
| Hardcoded user-facing strings in Sidebar.tsx | 0 |
| Hardcoded user-facing strings in Header.tsx | 11 |

## Reconciliation with `docs/audit/functional-audit.md` §F

| Audit claim | Reality in this repo |
|-------------|----------------------|
| ~376 leaf keys defined | 1432 keys (`shared/src/translations.ts`) |
| ~12 keys used with `t()` but not defined | 0 (examples cite keys that do not exist here) |
| ~47 keys defined but never used | 417 |
| 27 inline `locale === 'en'` ternaries across ~11 files | 307 text ternaries across 33 files (app/features/components) |
| Sidebar + Header render many labels as literals | Sidebar: 0 (fully via `t()`); Header: fallbacks + 2 ternaries + raw role |
| System: `useTranslations()` over `LanguageContext` | Actual API: `import { t, useLocale } from '@solar/shared'`; no `useTranslations` hook exists |

## Phase A remediation status (targeted in-scope subset)

Scope: replace inline text-bypass ternaries in the effective target list only
(`web/src/app/**`, `web/src/components/Header.tsx`, `shared/src/translations.ts`).
Ternary-only scope for pages: hardcoded (non-ternary) strings in pages were **not**
in scope. Reused existing keys where exact; otherwise added new `*.` keys (RO + EN).

### Files fixed

| File | Commit | Notes |
|------|--------|-------|
| `web/src/app/cheltuieli/page.tsx` | `9a77b00` | 38 ternaries → `expenses.*` (34 new keys); reused `general.cancel`, `expenses.category`, `expenses.amount`, `expenses.all` |
| `web/src/app/issues/page.tsx` | `1b34194`, `70c8ad8` | "Photos/Fotografii" reused `reports.photos`; follow-up commit added the missing `t` import |
| `web/src/app/rapoarte/page.tsx` | `db2b550` | search placeholder/aria + "All statuses"; reused `projects.clear_filters`; 3 new `reports.*` keys |
| `web/src/app/stocuri/page.tsx` | `5d2f3e3` | 36 ternaries → `stocuri.*`; reused `general.refresh`, `issues.summary_critical` |
| `web/src/app/pontaj/page.tsx` | `c60ad53` | 42 ternaries → `pontaj.*`; reused `general.refresh`, `attendance.overtime`; helper typed as `Locale` |
| `web/src/app/notificari/page.tsx` | `2b3df62` | today + mark-read; reused `planning.yesterday`; 2 new `notifications.*` keys |
| `web/src/app/utilizatori/page.tsx` | `83dd3e6` | 14 ternaries → `users.*`; reused `nav.users`, `users.role`, `users.projects` |
| `web/src/app/profil/page.tsx` | `8227b81` | 2 ternaries → `profile.load_error_*` |
| `web/src/app/activity/page.tsx` | `3a43244` | 27 ternaries → `activity.*`; reused `notifications.today`, `planning.yesterday`, `general.refresh`, `projects.clear_filters` |
| `web/src/components/Header.tsx` | `e689464` | removed RO fallbacks, 2 ternaries → `header.breadcrumb`/`header.home_title`; raw role → `getRoleLabel(...)` |

### No-op (already fully localised)

- `web/src/components/Sidebar.tsx` — 0 hardcoded, already `getRoleLabel`/`t()`-driven.
- `web/src/app/documente/page.tsx` — its 2 `locale ===` matches are benign
  `toLocaleString` locale-code ternaries, not text.

### Intentionally left (not defects / out of ternary scope)

- Benign locale-code ternaries (`Intl.*`, `toLocale*`) across all touched files.
- Stored content-field selection (e.g. `notificari` `n.title_ro`/`n.title_en`; `activity`
  `opt.ro`/`opt.en` option arrays) — data, not UI labels.
- `utilizatori` `statusLabel()` — non-ternary bilingual helper mapping the status enum;
  already handles both locales. Kept per DB-enum handling rule.
- Hardcoded **non-ternary** strings inside pages (table headers, empty states, CSV
  export header, `Cancel` in `stocuri`, raw status enum `<option>` values in `rapoarte`)
  — pre-existing gaps, outside the agreed ternary scope.
- Non-scope components with remaining ternaries (`GlobalQuickSearch`, `MobilePrimaryNav`,
  `MoreSheet`, `ControlTowerSurface`, `ControlTowerDrilldownDrawer`, `WorkerAttendanceView`,
  `WorkerDashboard`, `PhotoUpload`) — outside the authorised file set.

### Dead keys

All **417** dead keys were left in place. Removal is deferred to a dedicated session
with full-page test coverage.

