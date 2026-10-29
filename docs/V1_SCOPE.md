HIIEKO V1 — Scope and Acceptance Criteria
Status: Proposed baseline for approval
Release target: Internal pilot
Purpose
Define the intended HIIEKO V1 scope and the evidence required for acceptance. This document does not certify that features are implemented, tested, or ready for release.
Product goal: Deliver a reliable, secure, usable internal platform for HIIEKO's project operations, field teams, documents, inventory, expenses, sales leads and document processing.
1. V1 scope
HIIEKO V1 includes the core platform and all six business areas below. Each area must meet its minimum acceptance criteria; a module is not considered complete merely because its screen exists.
1.1 Core platform and access control
In scope
- Authentication, session handling and user management.
- User roles and organization/project membership.
- Project and team setup.
- Task assignment and daily operational workflows.
- A management overview based on real application data.
Acceptance criteria
- Authorized users can sign in, sign out and use supported session-renewal flows.
- Users can access only the organizations, projects, records and actions permitted by their roles.
- Project membership and role restrictions are enforced by the backend, not only by the UI.
- Managers can access the operational information appropriate to their permissions.
- Errors, empty states and loading states are understandable and do not silently hide failures.
1.2 Mobile and offline field operations
In scope
- Mobile access to assigned tasks for reference.
- Offline capture of attendance and daily reports.
- Synchronization when connectivity returns.
- GPS for attendance where required and supported by device permissions.
Acceptance criteria
- Users can view the agreed assigned-task information when offline.
- Users can record attendance and daily reports while offline.
- Locally captured records survive an application restart.
- Pending changes synchronize after reconnection and provide a visible success or failure state.
- Retrying synchronization does not silently create duplicate records.
- Permission denial, GPS unavailability, synchronization errors and conflicting changes are handled visibly.
- Offline scope is limited to field essentials; the entire application does not need to operate offline.
1.3 Documents and persistent storage
In scope
- Access to existing project documents.
- Uploading new documents.
- Listing, viewing and downloading authorized files.
- Persistent storage and project-level access control.
- OCR processing for supported documents, as specified in section 1.7.
Acceptance criteria
- Existing project files remain accessible after the release and any approved storage transition.
- New files can be uploaded, retrieved and downloaded by authorized users.
- Files persist across application and service restarts.
- Unauthorized users cannot read or download protected documents by manipulating URLs or API requests.
- File metadata, storage references and access permissions remain consistent.
- Existing storage locations, file references and migration requirements are inventoried before any storage cutover.
- Migration procedures include verification, recovery and rollback steps; existing files must not be deleted or abandoned during migration.
Release blocker: Existing files must be accounted for and the chosen storage configuration must be verified before internal release. A successful upload of a new file alone is insufficient.
1.4 Inventory, materials and deliveries
In scope
- Stock quantities by the relevant warehouse or storage location.
- Stock movements, including receiving and issuing materials.
- Delivery records and delivery-status tracking.
- Association with the appropriate project or warehouse.
Acceptance criteria
- Authorized users can view the relevant stock quantities.
- Receiving and issuing materials update quantities consistently.
- Invalid quantities and unsupported stock operations are rejected.
- Delivery records can be created and their statuses updated.
- Each stock movement records sufficient information to identify the item, quantity, time and responsible user.
- Movement history allows users with the appropriate permissions to understand how stock changed.
- Failed or repeated operations do not silently double-count movements.
Out of scope: Full procurement management, purchase-order workflows and advanced supplier management unless separately approved.
1.5 Project expenses
In scope
- Creating and submitting expense records.
- Expense amount, date, category, description and project association.
- Supporting documents where needed.
- Review and approval or rejection by authorized users.
- Project-level expense totals.
Acceptance criteria
- Authorized users can create and submit an expense for the appropriate project.
- Submitted expenses can be reviewed by users with the necessary permissions.
- Reviewers can approve or reject expenses, with the decision and relevant history recorded.
- Approval permissions and self-approval rules must be explicitly defined and enforced. Proposed default: users cannot approve their own expenses; any exception requires an explicit, documented business rule. This default remains subject to business approval.
- Expense totals reflect the underlying records and their defined statuses.
- Invalid amounts and incomplete mandatory fields are rejected.
- Repeated submissions do not silently create duplicate expenses.
Out of scope: Full accounting, tax filing, payroll, bank reconciliation and replacement of an accounting system.
1.6 Sales and lead pipeline
In scope
- Importing and searching company leads.
- Company identifiers, including CUI where available.
- Recording company information and contact history.
- Assigning lead ownership.
- Updating lead status and recording follow-up actions.
- Filtering and prioritizing leads.
Acceptance criteria
- Users can import leads from the agreed input format.
- Invalid rows and duplicate candidates are reported rather than silently discarded.
- Users can search and filter by the agreed fields, including CUI where present.
- Authorized users can assign leads and update statuses.
- Contact attempts and follow-up information can be recorded and retrieved.
- Imported data can be traced to its source where that information is available.
- Large imports and searches do not cause the interface to fail under the agreed pilot dataset size.
Out of scope: Full CRM, quotations, customer contracts, sales forecasting and broad sales automation. External ANAF/ListăFirme enrichment is not a release blocker for this V1.
1.7 OCR and document automation
In scope
- Processing explicitly supported document types.
- Extracting text and agreed fields.
- Showing extracted values for human review and correction.
- Saving the data only after explicit user approval.
Acceptance criteria
- Supported documents can be submitted for processing.
- The user can inspect extracted values before they become accepted application data.
- The user can correct extracted values and approve or reject the result.
- Unapproved extraction results are not silently treated as verified data.
- Unreadable files, unsupported types and processing failures produce understandable outcomes.
- Approved values are associated with the correct project or business record.
- Processing errors do not corrupt the original uploaded document.
- Tests cover successful extraction, poor-quality documents, missing fields and user corrections.
Out of scope: Fully automatic approval or saving of OCR results without human review.

The precise document types and fields supported by V1 must be agreed before the OCR feature can be considered complete.

2. Cross-cutting requirements
These requirements apply across all V1 modules.
Security and permissions
- Backend authorization must enforce role and project boundaries.
- Sensitive file access and business-record mutations must be protected.
- Relevant actions must be auditable, especially approvals and stock movements.
- No known release-blocking access-control defects may remain.
Reliability and data integrity
- Important user-entered data must not disappear silently.
- Repeated requests, retries and synchronization must be tested for duplicate effects.
- Database migrations must be reviewed and tested against the intended release state.
- Backup and recovery procedures must be documented and checked.
- Existing user data and documents must be preserved.
Usability
- Core workflows must be usable without relying on developer tools or database access.
- Pages must provide clear loading, empty, success and error states.
- Key workflows must be tested at the screen sizes and devices agreed for the internal pilot.
- The management overview must use actual application data, not hardcoded demonstration values.
Verification
- Tests must run against the current proposed release code, including relevant uncommitted changes.
- Results must identify the code version, environment, test performed and outcome.
- Unit tests alone do not establish end-to-end readiness.
- Browser testing and mobile/offline acceptance testing are required where applicable.

3. Explicitly outside V1
Unless separately approved, these are not release requirements:
- Advanced finance and full accounting.
- Public customer access or a customer-facing portal.
- Full CRM capabilities beyond the lead pipeline.
- Fully offline operation of all modules.
- Automatic approval of OCR results.
- Full procurement and purchase-order management.
- Unrelated future modules or redesigns that do not support an agreed acceptance criterion.
Existing code for these areas should not be deleted just because it is outside V1. Exclusion means it is not a V1 blocker, not that it must be removed.
4. Internal release acceptance checklist
The internal pilot is ready only when all required gates have evidence.
Gate	Required evidence
Core platform	Login, sessions, role enforcement and project isolation tested
Field operations	Offline attendance and reports survive restart and synchronize correctly
Documents	Existing files preserved; new uploads, retrieval and permissions verified
Inventory	Stock receipt, issue, quantities, movement history and delivery tracking tested
Expenses	Submission, review, approval/rejection and totals verified
Sales	Import, duplicate handling, search, assignment and follow-up tested
OCR	Supported documents extracted, reviewed, corrected and explicitly approved
Database	Migration state verified; backup and recovery procedures checked
Deployment	Internal environment and configuration verified without risking production data
Overall release	No unresolved release-blocking defects; known limitations documented

A failed gate must be recorded as a blocker, an explicitly accepted limitation, or an approved deferral. It must not be labelled “complete” merely because implementation has started.
5. Unresolved questions
These do not invalidate the scope baseline, but they must be settled before implementation of the affected feature or release sign-off.
Question	Why it matters	Proposed default
Which roles may approve expenses?	Determines approval permissions and separation of duties.	Managers or project managers with explicit permission; no implicit global access.
What are the exact expense statuses and rejection rules?	Needed for workflow, totals and audit history.	Draft → Submitted → Approved/Rejected, with documented resubmission rules.
Which stock locations and movement types are supported?	Defines the inventory data model and validation.	Warehouse/project locations; receiving, issuing and controlled adjustments.
Which delivery statuses and exception cases, such as cancellation, partial delivery, or failed delivery, are required?	Defines the delivery workflow.	Draft/Planned → In Transit → Delivered, with cancellation or exception handling if needed.
Which documents and fields does OCR support?	OCR cannot be accepted without a finite test set.	Select a small set of high-value document types first.
What happens when offline data conflicts with server data?	Prevents silent overwrites or lost field reports.	Preserve the field submission, report the conflict and require a defined resolution when needed.
What is the internal pilot environment?	Needed for safe end-to-end tests.	A separate non-production environment with test accounts and representative data.
What is the pilot size and target date?	Needed for performance thresholds and scheduling.	Decide after the current repository and deployment state are verified.
What file storage is currently used in production, if any?	Existing-file preservation and migration safety depend on it.	Do not cut over until configuration and existing-file inventory are confirmed.


6. Definition of done
A V1 feature is done when:
1. Its agreed behavior is implemented.
2. Relevant tests pass on the current release code.
3. Authorization and data-integrity cases are checked.
4. Its acceptance criteria are demonstrated in the appropriate environment.
5. Known limitations and any follow-up work are documented.
6. There is no unresolved release-blocking defect for that feature.
The V1 release is done when all required modules pass their acceptance gates, the internal environment is verified, existing data and files are protected, and the pilot limitations are documented.
7. Proposed project-management rule
To keep HIIEKO moving toward completion:
- Agree on this scope as the baseline before creating another implementation plan.
- Reconcile the existing Markdown documents rather than creating multiple competing status files.
- Implement one bounded task at a time.
- Review proposed changes before modifying repository files.
- Verify each task with evidence before calling it complete.
- Require explicit approval for scope expansion.
Current status: Proposed baseline for approval. This document defines intended scope; it does not certify implementation, testing, or release readiness.
