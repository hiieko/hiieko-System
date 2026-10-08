\# HIIEKO — Phase 7 Functional

\# Sales Expansion and Operations Handoff



Branch: `functional/phase-7-sales`

Time: 13 to 15 hours (4 to 5 sessions)



\## What this phase does



Phases 0 through 6 built a working construction management system.



Phase 7 adds the front end of the business: sales.



After this phase, HIIEKO covers the full lifecycle:



```

Lead

&#x20; ↓

Qualified

&#x20; ↓

Field Visit

&#x20; ↓

Interested

&#x20; ↓

Negotiation

&#x20; ↓

Contract Accepted

&#x20; ↓

Project Created

&#x20; ↓

Project Management

&#x20; ↓

Construction

&#x20; ↓

Technical Completion

&#x20; ↓

Beneficiary Handover

```



Sales flows into operations without re-entering data.

The project manager receives a structured handover, not a WhatsApp

message.



\## What this phase is not



Phase 7 is not:



\- A replacement for a full CRM

\- A marketing automation system

\- An invoicing or accounting system

\- A redesign of anything already working



Phase 7 is only: the four sales stages plus the handoff to operations.



\## Why this phase matters



Right now, the business likely works like this:



\- A lead arrives on WhatsApp or email

\- Somebody notes it in a spreadsheet

\- A salesperson visits

\- Details are exchanged verbally

\- A contract is signed

\- The project manager is told "we got a new client"

\- The project manager calls the client to ask the same questions again

\- Duplicated effort, lost details, delayed start



Phase 7 replaces that with:



\- Lead captured in HIIEKO with a status

\- Field visit recorded with structured data

\- Negotiation tracked

\- Contract accepted creates a Project with all data already attached

\- Project manager receives a ready-to-start project package

\- Nobody asks the client the same question twice



That is the "information follows the work" principle in action.



\## The four sales stages



\### Stage 1 — Lead intake



Who: salesperson, admin

Purpose: capture incoming leads and qualify them



This is the largest workspace because it is where incoming volume

gets processed.



Data captured:



\- Company name

\- Phone

\- Email

\- Website URL

\- Contact person or administrator

\- Notes

\- Status: Not contacted, In progress, Revisit needed, Completed

\- Source: how did this lead arrive? (Referral, Website, Cold call, Event)

\- Assigned to: which salesperson owns this lead



The salesperson needs to quickly see:



\- Which leads are new and uncontacted

\- Which leads need a follow-up today

\- Which leads have gone cold



This is not a table. It is a work queue.



Design:



\- List view default, sorted by urgency

\- Filter: status, assigned to, source, date range

\- Search by company or contact

\- Each lead card shows: company, contact, status badge, last contact

&#x20; date, next action date, assigned salesperson

\- Click a lead opens the full record with activity history



\### Stage 2 — Field sales



Who: salesperson on site

Purpose: record the physical visit and qualification



Triggered when: a lead moves to Completed in Lead Intake



The company information carries forward automatically. The salesperson

adds only what is new.



Data added at this stage:



\- Location (address, GPS if desired)

\- Company type: Residential, Farm, Retail, Factory, Deposit,

&#x20; Hospitality, Construction, Other

\- Visit date

\- Location details (roof type, available surface, orientation)

\- Status: Visited, Interested, Not interested

\- Photos from the visit

\- Notes



This is a mobile-first screen. A salesperson standing on a roof

should be able to complete it in 2 minutes on a phone.



Design:



\- One question per screen on mobile

\- Big inputs, thumb reachable

\- Photo capture one tap away

\- Progress indicator



\### Stage 3 — Negotiation and contracts



Who: senior salesperson, manager

Purpose: track the commercial negotiation



Triggered when: a field visit marks the company as Interested



Company and site information carries forward. Only new data is added.



Data added:



\- Contract value

\- Currency

\- Proposed capacity in kWp

\- Proposed configuration (link to Solar Design if one exists)

\- Contract document upload

\- Status: Accepted, Not accepted, Pending

\- Decision date

\- Reason for rejection (if rejected)



Design:



\- Detail page with negotiation timeline

\- Ability to attach documents

\- Ability to link to a solar design from the configurator

\- Clear Accept and Reject buttons for the manager



\### Stage 4 — Contract to project handoff



Who: project manager and salesperson

Purpose: turn an accepted contract into a real project



Triggered when: a contract is marked Accepted



This is the most important design decision in Phase 7.



A handoff is NOT automatic. It requires a controlled transition:



```

Contract Accepted

&#x20; ↓

Salesperson submits a Handover Package

&#x20; ↓

Project Manager reviews it

&#x20; ↓

Project Manager confirms project details

&#x20; ↓

Project Manager creates the Project

&#x20; ↓

Project moves to "Ready for execution"

```



The handover package contains everything Operations needs:



Customer:

\- Company name, CUI, address, contact person, phone, email



Commercial:

\- Contract value, currency, signed date

\- Proposed capacity (kWp)

\- Payment terms



Site:

\- Location, GPS, company type

\- Roof type and available surface

\- Photos from field visit



Technical:

\- What was promised (capacity, modules, inverter, mounting)

\- Linked solar design if one exists

\- Any special requirements



Documents:

\- Signed contract

\- Any technical drawings from sales

\- Site photos

\- Beneficiary identification



Handover Notes:

\- What Sales discovered

\- What remains unclear

\- What needs to be confirmed with the customer



The Project Manager then:



\- Reviews each section

\- Flags anything missing

\- Sends back to Sales if incomplete

\- Or approves and creates the Project



When the Project is created:



\- A Project row is created in the existing Project model

\- A Client row is created or linked

\- Documents are linked to the Project

\- The salesperson is notified

\- A project manager is assigned



\## The data model



New Prisma models needed:



\### Lead



\- id

\- organization\_id

\- company\_name

\- cui (nullable)

\- phone

\- email

\- website (nullable)

\- contact\_person

\- contact\_role (nullable)

\- source (enum)

\- status (enum: NOT\_CONTACTED, IN\_PROGRESS, REVISIT, COMPLETED)

\- assigned\_to\_user\_id

\- created\_by\_user\_id

\- notes

\- created\_at

\- updated\_at



\### LeadActivity



\- id

\- lead\_id

\- user\_id

\- activity\_type (enum: CALL, EMAIL, MEETING, NOTE, STATUS\_CHANGE)

\- notes

\- created\_at



\### FieldVisit



\- id

\- lead\_id

\- visited\_by\_user\_id

\- visit\_date

\- location\_address

\- latitude

\- longitude

\- company\_type (enum)

\- roof\_type (nullable)

\- available\_surface\_m2 (nullable)

\- orientation (nullable)

\- status (enum: VISITED, INTERESTED, NOT\_INTERESTED)

\- notes

\- created\_at



\### Negotiation



\- id

\- lead\_id

\- contract\_value

\- currency

\- proposed\_kwp

\- proposed\_configuration (JSON)

\- status (enum: PENDING, ACCEPTED, REJECTED)

\- decision\_date (nullable)

\- rejection\_reason (nullable)

\- created\_at

\- updated\_at



\### HandoverPackage



\- id

\- negotiation\_id

\- submitted\_by\_user\_id

\- submitted\_at

\- reviewed\_by\_user\_id (nullable)

\- reviewed\_at (nullable)

\- status (enum: DRAFT, SUBMITTED, APPROVED, RETURNED)

\- return\_reason (nullable)

\- created\_project\_id (nullable, links to Project once created)

\- notes



Documents and photos attach to Lead, FieldVisit, Negotiation, or

HandoverPackage via the existing Attachment model (target\_type and

target\_id).



All models follow the existing patterns:



\- organization\_id for multi-tenant isolation

\- created\_at and updated\_at timestamps

\- Soft delete via deleted\_at if you adopted that in Phase 6



\## Backend work



New controllers:



\### leads.controller.ts



\- GET /api/leads (list with filters)

\- GET /api/leads/:id (detail with activities)

\- POST /api/leads (create)

\- PATCH /api/leads/:id (update)

\- POST /api/leads/:id/activities (log a call, meeting, or note)

\- DELETE /api/leads/:id (soft delete)



\### field-visits.controller.ts



\- GET /api/field-visits

\- GET /api/field-visits/:id

\- POST /api/field-visits (create from a lead)

\- PATCH /api/field-visits/:id



\### negotiations.controller.ts



\- GET /api/negotiations

\- GET /api/negotiations/:id

\- POST /api/negotiations (create from a field visit)

\- PATCH /api/negotiations/:id

\- POST /api/negotiations/:id/accept

\- POST /api/negotiations/:id/reject



\### handover-packages.controller.ts



\- GET /api/handover-packages

\- GET /api/handover-packages/:id

\- POST /api/handover-packages (submit from accepted negotiation)

\- POST /api/handover-packages/:id/approve

\- POST /api/handover-packages/:id/return



Role additions:



\- Salesperson role

\- Sales manager role

\- Or reuse existing roles with new permissions



Permissions to add:



\- leads:read, leads:create, leads:update, leads:delete

\- field\_visits:read, field\_visits:create, field\_visits:update

\- negotiations:read, negotiations:create, negotiations:update

\- negotiations:accept (manager only)

\- handover:submit (sales)

\- handover:approve (project manager)



All sales endpoints must be scoped by organization\_id and by the

assigned salesperson for the salesperson role.

Managers see all sales in the organization.



\## Frontend work



New pages:



\### 1. /sales



Role: salesperson, sales manager

Purpose: sales dashboard



Sections:



\- My leads (assigned to me, needs action)

\- Team leads (if manager)

\- Pipeline summary (count per stage, value per stage)

\- Recent activity



This is the salesperson's home screen.



\### 2. /sales/leads



List of leads with filters and search

Default sort: urgency (overdue follow-ups first)



\### 3. /sales/leads/\[id]



Lead detail with:



\- Company info

\- Contact

\- Status

\- Activity timeline

\- Actions: log call, log meeting, log note, change status

\- Button: "Schedule field visit"



\### 4. /sales/leads/new



Create lead form



\### 5. /sales/field-visits/\[id]



Field visit form, mobile first



\### 6. /sales/negotiations



List of negotiations with filters



\### 7. /sales/negotiations/\[id]



Negotiation detail

Accept and Reject actions for managers



\### 8. /sales/handovers



List of handover packages

Pending review for project managers



\### 9. /sales/handovers/\[id]



Handover detail with:



\- All sections (customer, commercial, site, technical, docs, notes)

\- Approve button

\- Return with reason button

\- Preview of the project that will be created



Add to navigation:



\- New sidebar group: Sales

\- Visible only to sales and management roles

\- On mobile: part of the More sheet



\## Integration with existing features



Sales must integrate with the rest of HIIEKO, not live in a silo.



When a Handover Package is approved:



1\. Create a Client row

&#x20;  - Copy company name, CUI, address, contact from the lead

&#x20;  - Link to organization



2\. Create a Project row

&#x20;  - Link to the Client

&#x20;  - Copy location, GPS, address

&#x20;  - Set status to "planning" or "ready"

&#x20;  - Set budget\_total from contract value

&#x20;  - Set currency

&#x20;  - Set installed\_capacity\_mwp from proposed\_kwp

&#x20;  - Set target\_end\_date if provided



3\. Link Documents

&#x20;  - Copy all attachments from the handover package

&#x20;  - Attach them to the Project



4\. Link Solar Design

&#x20;  - If the negotiation has a linked design\_id, link it to the project



5\. Assign a Project Manager

&#x20;  - Choose during handover approval

&#x20;  - Creates a ProjectMember row



6\. Notify

&#x20;  - Notify the assigned PM

&#x20;  - Notify the salesperson

&#x20;  - Post to the project's activity feed



7\. Audit

&#x20;  - Log the entire handover as one audit event with all details



\## What Phase 7 changes



Backend:



\- 5 new Prisma models

\- 1 new migration

\- 4 new controllers

\- New permissions

\- Sales role (or reuse existing roles with new permissions)

\- Handover approval logic that creates Client, Project, links



Frontend:



\- 9 new pages under /sales

\- New sidebar group

\- New mobile nav entry

\- Lead cards, activity timeline, handover review UI



Navigation:



\- route-roles.ts additions

\- navigation.ts additions

\- Role-aware visibility



\## What Phase 7 removes



\- Nothing. Phase 7 is purely additive.

\- Do not remove any existing feature.



\## How to test Phase 7



\### Test 1 — Lead capture



\- Log in as salesperson

\- Create a lead with company name, phone, email

\- Expect: lead appears in my list with status "Not contacted"



\### Test 2 — Log activity



\- Open the lead

\- Log a call with notes

\- Expect: activity appears in the timeline

\- Change status to "In progress"

\- Expect: status badge updates



\### Test 3 — Field visit



\- Mark lead as ready for field visit

\- Open the field visit form on mobile

\- Fill location, company type, roof details

\- Attach a photo

\- Mark as "Interested"

\- Expect: lead moves to stage 2 automatically, photo attached



\### Test 4 — Negotiation



\- From the interested lead, start a negotiation

\- Enter contract value, proposed kWp

\- Attach the signed contract

\- Accept as manager

\- Expect: negotiation status becomes "Accepted"



\### Test 5 — Handover submission



\- As salesperson, submit handover package

\- Fill all required sections

\- Include any missing info in notes

\- Submit

\- Expect: handover enters "Submitted" state



\### Test 6 — Handover review



\- Log in as project manager

\- Open the handover

\- Review every section

\- Return it once with a reason

\- Expect: salesperson sees the return

\- Resubmit with the missing info

\- Approve

\- Expect: project is created



\### Test 7 — Project created correctly



\- Open the new project

\- Expect: name matches the company

\- Expect: client linked

\- Expect: location set

\- Expect: budget and capacity set

\- Expect: documents linked

\- Expect: project manager assigned



\### Test 8 — Cross-role consistency



\- Log in as the assigned PM

\- Expect: notification about the new project

\- Expect: project appears in their project list



\### Test 9 — Data does not need re-entry



\- Verify that the PM never had to type the company name, phone,

&#x20; email, address, contract value, or capacity

\- All of it came from sales



\### Test 10 — Audit



\- Open the project's activity tab

\- Expect: a "Project created from sales handover" event

\- Expect: all details in the event



\### Test 11 — Mobile sales



\- Log in as salesperson on phone

\- Open lead list

\- Expect: card layout works at 375px

\- Open a lead and log activity

\- Expect: two taps



\### Test 12 — Permissions



\- Log in as worker

\- Expect: /sales is not in the nav

\- Try to open /sales directly

\- Expect: redirect with "You don't have access"



\## Session execution



Phase 7 is the biggest phase. Do it in 4 to 5 sessions.



Session A — Data model (2 hours):



1\. Add Prisma models

2\. Create migration

3\. Apply to staging

4\. Verify tables exist

5\. Seed one test lead



Session B — Backend controllers (3 hours):



1\. Leads controller

2\. Field visits controller

3\. Negotiations controller

4\. Handover packages controller

5\. Permissions and roles

6\. Test every endpoint with a REST client



Session C — Frontend leads and field visits (3 hours):



1\. /sales dashboard

2\. /sales/leads list

3\. /sales/leads/\[id] detail with activity

4\. /sales/leads/new

5\. /sales/field-visits/\[id]

6\. Test on mobile



Session D — Frontend negotiations and handovers (3 hours):



1\. /sales/negotiations list and detail

2\. /sales/handovers list and detail

3\. Approve and return flows

4\. Project creation on approval

5\. Test end to end



Session E — Integration and polish (2 hours):



1\. Navigation

2\. Role-aware visibility

3\. Mobile nav integration

4\. Full test on 3 roles

5\. Open PR

6\. Test on preview

7\. Merge



\## Do not do in Phase 7



\- Do not build a full CRM

\- Do not add marketing automation

\- Do not add email campaign tools

\- Do not add a customer portal (that is a later phase)

\- Do not redesign existing pages

\- Do not change existing models (only add new ones)

\- Do not touch Phases 0 through 6

\- Do not add features that Bogdan did not ask for



Phase 7 is only: lead, field visit, negotiation, handover.



\## Done criteria



Phase 7 is done when:



\- A lead can be captured, qualified, and tracked

\- Field visits can be logged from mobile

\- Negotiations can be tracked and accepted

\- Accepted contracts produce a handover package

\- Handover packages can be reviewed, returned, and approved

\- Approval creates a real Project with client, budget, capacity,

&#x20; documents, and assigned PM

\- No data is re-entered between sales and operations

\- Sales has its own dashboard and work queue

\- Sales is not visible to roles that should not see it

\- All 12 tests pass

\- Activity log records every sales action

\- Docs describe the sales lifecycle



\## How long Phase 7 takes



Roughly 13 to 15 hours of focused work over 4 to 5 sessions.



This is a new product surface. It is not a fix. Take the time.



\## What comes after Phase 7



After Phase 7, the functional track is complete.



The app covers:



\- Sales

\- Project setup

\- Execution

\- Quality

\- Documents

\- Finance

\- Control Tower

\- Handover to beneficiary



Future phases exist in your original backlog:



\- Beneficiary portal (external access, read-only)

\- Procurement expansion (full purchase-to-delivery workflow)

\- Material traceability (which project consumed which lot)

\- Risk register

\- Readiness gates

\- Technical configuration as living record

\- Lessons learned



None of these are required for the product to work.

They are improvements.



Add them one at a time, only after Phase 7 is done and only if a real

need appears.



\## What to do after the whole plan is done



Once Phase 0 through Phase 7 are complete:



1\. Run the full acceptance test again (Phase 4 flow)

2\. Onboard one real project with one real team

3\. Watch how people actually use it for a week

4\. Fix the top 3 complaints

5\. Onboard a second project

6\. Watch again

7\. Fix

8\. Onboard a third project



Do not add features until at least three projects are running.

The first three projects will tell you more than any planning session.



Everything you planned will need adjustments. That is normal.

The plan gets you to working software.

Real users get you to useful software.

