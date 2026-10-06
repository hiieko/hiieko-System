'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowDown, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Camera,
  Check, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, CloudSun, FileCheck2, FileText, FolderKanban, HardHat, Headphones, PackageCheck,
  LayoutDashboard, ListTodo, LogOut, Mail, MapPin, Menu, MoreHorizontal, Paperclip,
  PanelLeftClose, PanelLeftOpen, Search, Send, Settings, ShieldCheck, ShieldEllipsis,
  Sun, Moon, Monitor, UserRound, Users, X, Eye, EyeOff, LockKeyhole, Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

type Locale = 'ro' | 'en';
type Theme = 'light' | 'dark' | 'system';
type View = 'overview' | 'profile' | 'notifications' | 'support' | 'report' | 'login' | 'signup' | 'forgot' | 'users';
type CopyKey = keyof typeof copy;
type Translate = (key: CopyKey) => string;

const copy = {
  prototype: ['Prototype · local data only', 'Prototip · doar date locale'],
  reviewTools: ['Global experience preview', 'Previzualizare experiență globală'],
  previewMode: ['Preview viewport', 'Previzualizare viewport'],
  reportSentDescription: ['This report is a local design simulation. No service received it.', 'Acest raport este o simulare locală de design. Nu a fost trimis către niciun serviciu.'],
  loginMode: ['Local prototype · no authentication request is sent.', 'Prototip local · nu este trimisă nicio cerere de autentificare.'],
  signinPage: ['Sign in to your HIIEKO workspace', 'Autentifică-te în spațiul de lucru HIIEKO'],
  addPersonnelRole: ['Add a site team member to this project workspace.', 'Adaugă un membru al echipei în spațiul acestui proiect.'],
  overview: ['Overview', 'Prezentare'],
  profile: ['My profile', 'Profilul meu'],
  notifications: ['Notifications', 'Notificări'],
  support: ['Help & support', 'Ajutor și suport'],
  report: ['Report a problem', 'Raportează o problemă'],
  login: ['Sign in', 'Autentificare'],
  signup: ['Create account', 'Creează cont'],
  forgot: ['Forgot password', 'Ai uitat parola?'],
  users: ['User administration', 'Administrare utilizatori'],
  shell: ['Application shell', 'Shell aplicație'],
  switchView: ['Preview a global experience', 'Previzualizează o experiență globală'],
  backReview: ['Back to design review', 'Înapoi la Design Review'],
  project: ['Project / site', 'Proiect / șantier'],
  allProjects: ['All projects', 'Toate proiectele'],
  projectCurrent: ['CURRENT PROJECT', 'PROIECT CURENT'],
  overviewGreeting: ['Good morning, Daniel', 'Bună dimineața, Daniel'],
  overviewDescription: ['A clear view of today’s site operations.', 'O imagine clară a operațiunilor de astăzi din șantier.'],
  today: ['TUESDAY · 27 OCTOBER 2026', 'MARȚI · 27 OCTOMBRIE 2026'],
  siteStatus: ['SITE STATUS', 'STAREA ȘANTIERULUI'],
  onSchedule: ['On schedule', 'În grafic'],
  tasksInProgress: ['Tasks in progress', 'Sarcini în desfășurare'],
  crewPresent: ['Crew present today', 'Echipă prezentă astăzi'],
  openBlockers: ['Open blockers', 'Blocaje deschise'],
  priorityQueue: ['Requires attention', 'Necesită atenție'],
  viewQueue: ['View work queue', 'Deschide lista de lucru'],
  reviewReports: ['Daily reports awaiting review', 'Rapoarte zilnice care așteaptă revizuirea'],
  reviewDescription: ['Three reports are ready for a first review.', 'Trei rapoarte sunt pregătite pentru prima revizuire.'],
  projectProgress: ['Project progress', 'Progres proiect'],
  projectMilestone: ['Mounting · Zone B', 'Montaj · Zona B'],
  progressDetail: ['68% complete · 18 of 24 rows', '68% finalizat · 18 din 24 de rânduri'],
  recentActivity: ['Recent activity', 'Activitate recentă'],
  activityTask: ['Task PV-1842 assigned to Andrei Popescu', 'Sarcina PV-1842 atribuită lui Andrei Popescu'],
  activityPlan: ['Daily plan updated · Zone B · 08:42', 'Plan zilnic actualizat · Zona B · 08:42'],
  activityReport: ['Daily report DR-2026-104 submitted', 'Raportul zilnic DR-2026-104 a fost trimis'],
  inProgress: ['In progress', 'În desfășurare'],
  activeCrewCount: ['34 active', '34 deschise'],
  escalatedBlockers: ['1 escalated', '1 escalat'],
  projectRegion: ['Dolj, Romania', 'Dolj, România'],
  dailyPlanDetail: ['Daily plan · Zone B', 'Plan zilnic · Zona B'],
  issuesDetail: ['Issues · Zone B', 'Probleme · Zona B'],
  ohsPlanDetail: ['OHS plan · revision C', 'Plan SSM · revizia C'],
  maintenanceNoticeDetail: ['HIIEKO · scheduled maintenance', 'HIIEKO · mentenanță programată'],
  currentPageValue: ['Global experience design review', 'Design Review · experiență globală'],
  addSiteInvite: ['Add site personnel', 'Adaugă personal în șantier'],
  todayDay: ['Today', 'Astăzi'],
  tasks: ['Tasks', 'Sarcini'],
  planning: ['Planning', 'Planificare'],
  attendance: ['Attendance', 'Pontaj'],
  reports: ['Daily reports', 'Rapoarte zilnice'],
  materials: ['Materials', 'Materiale'],
  quality: ['QA/QC', 'QA/QC'],
  documents: ['Documents', 'Documente'],
  workspace: ['WORKSPACE', 'SPAȚIU DE LUCRU'],
  operations: ['Operations', 'Operațiuni'],
  manager: ['Project manager', 'Manager de proiect'],
  currentSite: ['Valea Mare · Dolj', 'Valea Mare · Dolj'],
  search: ['Search this project', 'Caută în acest proiect'],
  help: ['Help', 'Ajutor'],
  language: ['Language', 'Limbă'],
  theme: ['Theme', 'Temă'],
  light: ['Light', 'Luminoasă'],
  dark: ['Dark', 'Întunecată'],
  system: ['System', 'Sistem'],
  collapse: ['Collapse sidebar', 'Restrânge meniul lateral'],
  expand: ['Expand sidebar', 'Extinde meniul lateral'],
  openMenu: ['Open menu', 'Deschide meniul'],
  closeMenu: ['Close menu', 'Închide meniul'],
  switchProject: ['Switch project', 'Schimbă proiectul'],
  menu: ['More', 'Mai multe'],
  siteSelector: ['Select a project or site', 'Selectează un proiect sau șantier'],
  accountMenu: ['Account menu', 'Meniu cont'],
  viewProfile: ['View profile', 'Vezi profilul'],
  accountSettings: ['Account settings', 'Setări cont'],
  signOut: ['Sign out', 'Deconectare'],
  profileIntro: ['Personal details and workspace preferences.', 'Date personale și preferințe pentru spațiul de lucru.'],
  fullName: ['Full name', 'Nume complet'],
  email: ['Email address', 'Adresă de e-mail'],
  phone: ['Phone', 'Telefon'],
  organization: ['Organization', 'Organizație'],
  siteAssignment: ['Current project / site', 'Proiectul / șantierul curent'],
  role: ['Role', 'Rol'],
  preferences: ['Preferences', 'Preferințe'],
  languagePreference: ['Display language', 'Limba interfeței'],
  themePreference: ['Appearance', 'Aspect'],
  notificationPreferences: ['Email notifications', 'Notificări prin e-mail'],
  savePreferences: ['Save preferences', 'Salvează preferințele'],
  localSaved: ['Saved in this preview only.', 'Salvat doar în această previzualizare.'],
  notificationIntro: ['Updates for your projects and assigned work.', 'Actualizări pentru proiectele și sarcinile tale.'],
  all: ['All', 'Toate'],
  unread: ['Unread', 'Necitite'],
  markAllRead: ['Mark all as read', 'Marchează toate ca citite'],
  noNotifications: ['You’re all caught up.', 'Nu ai notificări noi.'],
  loading: ['Loading notifications…', 'Se încarcă notificările…'],
  notificationError: ['Notifications could not be loaded. Try again.', 'Notificările nu au putut fi încărcate. Încearcă din nou.'],
  show: ['Show', 'Afișează'],
  loaded: ['Loaded', 'Încărcate'],
  empty: ['Empty', 'Goale'],
  error: ['Error', 'Eroare'],
  taskAssigned: ['A task was assigned to you', 'Ți-a fost atribuită o sarcină'],
  planChanged: ['The daily plan was updated', 'Planul zilnic a fost actualizat'],
  attendanceCorrection: ['Attendance correction needs review', 'Corecția de pontaj necesită revizuire'],
  reportReview: ['A daily report is ready to review', 'Un raport zilnic este pregătit pentru revizuire'],
  blockerEscalation: ['A blocker was escalated in Zone B', 'Un blocaj din Zona B a fost escaladat'],
  documentUpdate: ['A project document was updated', 'Un document al proiectului a fost actualizat'],
  systemNotice: ['Scheduled maintenance notice', 'Notificare privind mentenanța programată'],
  supportIntro: ['Find an answer or get help from the HIIEKO team.', 'Găsește un răspuns sau contactează echipa HIIEKO.'],
  searchHelp: ['Search help topics', 'Caută în articolele de ajutor'],
  noHelpResults: ['No help topics match that search.', 'Nu există articole de ajutor pentru această căutare.'],
  markRead: ['Mark as read', 'Marchează ca citită'],
  showTutorialAgain: ['Show page tutorial again', 'Afișează din nou ghidul paginii'],
  signinPending: ['Signing in…', 'Se autentifică…'],
  registrationProcessing: ['Creating account…', 'Se creează contul…'],
  requestProcessing: ['Sending request…', 'Se trimite solicitarea…'],
  contactSupport: ['Contact HIIEKO support', 'Contactează suportul HIIEKO'],
  faqs: ['Frequently asked questions', 'Întrebări frecvente'],
  faqOne: ['How do I switch projects?', 'Cum schimb proiectul?'],
  faqOneAnswer: ['Use the project selector in the application header.', 'Folosește selectorul de proiect din antetul aplicației.'],
  faqTwo: ['Where can I find my assigned work?', 'Unde găsesc sarcinile care mi-au fost atribuite?'],
  faqTwoAnswer: ['Open Tasks in the workspace navigation.', 'Deschide Sarcini din meniul spațiului de lucru.'],
  faqThree: ['How do I report a site issue?', 'Cum raportez o problemă din șantier?'],
  faqThreeAnswer: ['Use Report a problem and include the project and page context.', 'Folosește Raportează o problemă și include contextul proiectului și al paginii.'],
  systemInformation: ['Version & system information', 'Versiune și informații despre sistem'],
  version: ['Application version', 'Versiunea aplicației'],
  environment: ['Environment', 'Mediu'],
  demoEnvironment: ['Design preview · local', 'Previzualizare design · local'],
  responseHours: ['Mon–Fri · 08:00–17:00 EET', 'Luni–vineri · 08:00–17:00 EET'],
  reportIntro: ['Tell us what happened. This form is a local design prototype.', 'Descrie ce s-a întâmplat. Formularul este un prototip local de design.'],
  category: ['Category', 'Categorie'],
  categoryUi: ['Interface', 'Interfață'],
  categorySite: ['Site operations', 'Operațiuni de șantier'],
  categoryData: ['Data / document', 'Date / document'],
  categoryAccess: ['Access', 'Acces'],
  subject: ['Subject', 'Subiect'],
  description: ['Description', 'Descriere'],
  severity: ['Severity', 'Severitate'],
  normal: ['Normal', 'Normală'],
  high: ['High', 'Ridicată'],
  critical: ['Critical', 'Critică'],
  currentPage: ['Current page', 'Pagina curentă'],
  attachment: ['Screenshot or attachment (optional)', 'Captură de ecran sau fișier (opțional)'],
  chooseFile: ['Choose a file', 'Alege un fișier'],
  noFile: ['No file selected', 'Niciun fișier selectat'],
  contactDetails: ['Contact information', 'Date de contact'],
  cancel: ['Cancel', 'Anulează'],
  sendReport: ['Send report', 'Trimite raportul'],
  reported: ['Problem reported', 'Problema a fost raportată'],
  reportFailed: ['Could not send report — try again.', 'Raportul nu a putut fi trimis — încearcă din nou.'],
  showError: ['Preview sending error', 'Previzualizează eroarea de trimitere'],
  loginIntro: ['Sign in to your HIIEKO workspace', 'Autentifică-te în spațiul de lucru HIIEKO'],
  emailOrUsername: ['Email or username', 'E-mail sau nume de utilizator'],
  password: ['Password', 'Parolă'],
  showPassword: ['Show password', 'Afișează parola'],
  hidePassword: ['Hide password', 'Ascunde parola'],
  remember: ['Remember me on this device', 'Ține-mă minte pe acest dispozitiv'],
  continue: ['Continue', 'Continuă'],
  invalidCredentials: ['The email or password is incorrect. Try again.', 'E-mailul sau parola nu sunt corecte. Încearcă din nou.'],
  authPrototype: ['Authentication is not connected in this design preview.', 'Autentificarea nu este conectată în această previzualizare.'],
  haveAccount: ['Already have an account?', 'Ai deja un cont?'],
  noAccount: ['New to HIIEKO?', 'Ești nou în HIIEKO?'],
  createAccount: ['Create account', 'Creează cont'],
  confirmPassword: ['Confirm password', 'Confirmă parola'],
  confirmConsent: ['I agree to the terms and privacy notice.', 'Sunt de acord cu termenii și nota de confidențialitate.'],
  passwordRequirements: ['Use at least 10 characters, including a number and a symbol.', 'Folosește cel puțin 10 caractere, cu un număr și un simbol.'],
  passwordsMatch: ['Passwords match', 'Parolele coincid'],
  passwordsNoMatch: ['Passwords do not match.', 'Parolele nu coincid.'],
  consentRequired: ['Accept the terms to continue.', 'Acceptă termenii pentru a continua.'],
  accountCreated: ['Account created', 'Cont creat'],
  pendingActivation: ['Your account is awaiting activation.', 'Contul tău așteaptă activarea.'],
  pendingDescription: ['An organization administrator will review your request. You will not be signed in automatically.', 'Un administrator al organizației îți va revizui solicitarea. Nu vei fi autentificat automat.'],
  resetIntro: ['Enter your work email and we’ll send a password reset link.', 'Introdu e-mailul de serviciu și îți vom trimite un link pentru resetarea parolei.'],
  sendReset: ['Send reset link', 'Trimite linkul de resetare'],
  resetSent: ['Check your inbox', 'Verifică mesajele primite'],
  resetSuccess: ['If an account exists for this address, you’ll receive reset instructions.', 'Dacă există un cont pentru această adresă, vei primi instrucțiuni de resetare.'],
  expiredReset: ['This reset link is invalid or has expired.', 'Acest link de resetare nu este valid sau a expirat.'],
  previewExpired: ['Preview expired link state', 'Previzualizează linkul expirat'],
  backToLogin: ['Back to sign in', 'Înapoi la autentificare'],
  teamUsers: ['Organization users', 'Utilizatorii organizației'],
  addSitePersonnel: ['Add site personnel', 'Adaugă personal în șantier'],
  userManagementIntro: ['Illustrative user directory and invitation flow.', 'Director ilustrativ de utilizatori și flux de invitație.'],
  createUser: ['Create user', 'Creează utilizator'],
  inviteUser: ['Invite user', 'Invită utilizatorul'],
  user: ['User', 'Utilizator'],
  status: ['Status', 'Stare'],
  site: ['Project / site', 'Proiect / șantier'],
  lastActivity: ['Last activity', 'Ultima activitate'],
  active: ['Active', 'Activ'],
  pending: ['Pending', 'În așteptare'],
  suspended: ['Suspended', 'Suspendat'],
  productionPermissions: ['Production permissions follow backend policy.', 'Permisiunile din producție urmează politica backend.'],
  inviteLocal: ['Invitation preview only. No account was created.', 'Doar previzualizare invitație. Nu a fost creat niciun cont.'],
  createSitePersonnel: ['Add a site team member to this project workspace.', 'Adaugă un membru al echipei în spațiul acestui proiect.'],
  siteManagerConcept: ['Site Manager concept', 'Concept pentru Manager de șantier'],
  noRoleChanges: ['No new backend role is introduced by this concept.', 'Acest concept nu introduce roluri backend noi.'],
  introduction: ['A practical overview for your project workspace.', 'O prezentare practică a spațiului de lucru al proiectului.'],
  whatFor: ['What this page is for', 'Scopul acestei pagini'],
  whatCanDo: ['What you can do here', 'Ce poți face aici'],
  tutorialActions: ['Review today’s work, track site status, and follow items that need attention.', 'Revizuiește lucrările de astăzi, urmărește starea șantierului și elementele care necesită atenție.'],
  tutorialRole: ['For project managers: review work queues and escalate blockers.', 'Pentru managerii de proiect: revizuiește listele de lucru și escaladează blocajele.'],
  firstUse: ['First-use tip: confirm the selected project before taking action.', 'Sfat la prima utilizare: verifică proiectul selectat înainte de a acționa.'],
  dontShow: ['Don’t show again in this preview', 'Nu mai afișa în această previzualizare'],
  dismiss: ['Close help', 'Închide ajutorul'],
  accessibilityLabel: ['HIIEKO global experience design preview', 'Previzualizare design pentru experiența globală HIIEKO'],
  opened: ['Opened just now', 'Deschisă chiar acum'],
  minsAgo: ['12 minutes ago', 'acum 12 minute'],
  hoursAgo: ['1 hour ago', 'acum o oră'],
  yesterday: ['Yesterday', 'Ieri'],
  notificationsUnread: ['unread notifications', 'notificări necitite'],
  unreadMessage: ['Unread', 'Necitită'],
  readMessage: ['Read', 'Citită'],
  back: ['Back', 'Înapoi'],
  unknownPage: ['Project overview', 'Prezentare proiect'],
  supportTopic: ['Account and workspace support', 'Suport pentru cont și spațiul de lucru'],
  supportEmail: ['support@hiieko.ro', 'support@hiieko.ro'],
  securityFooter: ['Secure project workspace', 'Spațiu de lucru securizat'],
  usersRole1: ['Site manager', 'Manager de șantier'],
  usersRole2: ['Team leader', 'Șef de echipă'],
  usersRole3: ['Worker', 'Lucrător'],
  usersRole4: ['Project manager', 'Manager de proiect'],
  optional: ['Optional', 'Opțional'],
  invitationQueued: ['Invitation preview prepared.', 'Previzualizarea invitației este pregătită.'],
  close: ['Close', 'Închide'],
  clearSearch: ['Clear search', 'Șterge căutarea'],
  allCaughtUp: ['No unread notifications', 'Nu există notificări necitite'],
  chooseState: ['Choose notification state', 'Alege starea notificărilor'],
  currentWorkspace: ['Current project workspace', 'Spațiul proiectului curent'],
  siteOffice: ['SITE OFFICE · OPERATIONS', 'BIROU DE ȘANTIER · OPERAȚIUNI'],
  productionShell: ['Production shell concept', 'Concept de shell de producție'],
  desktop: ['Desktop', 'Desktop'],
  tablet: ['Tablet', 'Tabletă'],
  mobile: ['Mobile', 'Mobil'],
  designOnly: ['Design only', 'Doar design'],
  existingComponent: ['Existing production component', 'Componentă de producție existentă'],
  backendDependency: ['Backend dependency', 'Dependență de backend'],
  localNotice: ['Preview only · no data saved', 'Doar previzualizare · datele nu se salvează'],
  workAhead: ['3 items need review', '3 elemente necesită revizuire'],
  viewAll: ['View all', 'Vezi toate'],
  fieldOps: ['FIELD OPERATIONS', 'OPERAȚIUNI ÎN TEREN'],
  submit: ['Submit', 'Trimite'],
  sent: ['Sent', 'Trimis'],
  readMore: ['Read more', 'Citește mai mult'],
  profileInitials: ['DG', 'DG'],
  confirm: ['Confirm', 'Confirmă'],
  sitePersonnelContext: ['Site Manager-facing flow · mock concept only', 'Flux pentru Manager de șantier · concept demonstrativ'],
  viewTitle: ['Experience', 'Experiență'],
  siteOfficeNote: ['Field-ready tools for the site office', 'Instrumente pentru biroul de șantier'],
  preferencesChanged: ['Changes apply to this preview only.', 'Modificările se aplică doar acestei previzualizări.'],
  pageDetails: ['Project: RO-VM-042 · HIIEKO workspace', 'Proiect: RO-VM-042 · spațiu de lucru HIIEKO'],
  accountContact: ['Contact HIIEKO support', 'Contactează suportul HIIEKO'],
  systemStatus: ['All systems operational', 'Toate sistemele sunt funcționale'],
} as const satisfies Record<string, readonly [string, string]>;

const notificationSeed = [
  { id: 'n1', icon: ListTodo, title: 'taskAssigned' as const, detailKey: 'activityTask' as const, detail: 'PV-1842 · Parc Solar Valea Mare', time: 'opened' as const, unread: true },
  { id: 'n2', icon: CalendarDays, title: 'planChanged' as const, detailKey: 'dailyPlanDetail' as const, detail: '', time: 'minsAgo' as const, unread: true },
  { id: 'n3', icon: Clock3, title: 'attendanceCorrection' as const, detailKey: 'attendance' as const, detail: 'AT-091 · Valea Mare', time: 'hoursAgo' as const, unread: true },
  { id: 'n4', icon: FileCheck2, title: 'reportReview' as const, detailKey: 'reports' as const, detail: 'DR-2026-104 · Andrei Popescu', time: 'hoursAgo' as const, unread: true },
  { id: 'n5', icon: AlertCircle, title: 'blockerEscalation' as const, detailKey: 'issuesDetail' as const, detail: '', time: 'yesterday' as const, unread: false },
  { id: 'n6', icon: FileText, title: 'documentUpdate' as const, detailKey: 'ohsPlanDetail' as const, detail: '', time: 'yesterday' as const, unread: false },
  { id: 'n7', icon: ShieldCheck, title: 'systemNotice' as const, detailKey: 'maintenanceNoticeDetail' as const, detail: '', time: 'yesterday' as const, unread: false },
];

type MockUser = { initials: string; name: string; email: string; role: 'usersRole1' | 'usersRole2' | 'usersRole3' | 'usersRole4'; status: 'active' | 'pending' | 'suspended'; site: string; activity: string };

const userSeed: MockUser[] = [
  { initials: 'AP', name: 'Andrei Popescu', email: 'andrei.popescu@hiieko.ro', role: 'usersRole3' as const, status: 'active' as const, site: 'Valea Mare', activity: '08:42' },
  { initials: 'MI', name: 'Mara Ionescu', email: 'mara.ionescu@hiieko.ro', role: 'usersRole1' as const, status: 'active' as const, site: 'Valea Mare', activity: '08:35' },
  { initials: 'RM', name: 'Radu Marin', email: 'radu.marin@hiieko.ro', role: 'usersRole2' as const, status: 'pending' as const, site: 'Centrala Sud', activity: 'Ieri' },
  { initials: 'DS', name: 'Diana Stan', email: 'diana.stan@hiieko.ro', role: 'usersRole4' as const, status: 'suspended' as const, site: '—', activity: '21 oct' },
];

function Avatar({ initials = 'DG', size = 'normal', className = '' }: { initials?: string; size?: 'normal' | 'large'; className?: string }) {
  return <span className={`g-avatar ${size === 'large' ? 'g-avatar-large' : ''} ${className}`} aria-hidden="true">{initials}</span>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`g-field ${className}`}><span>{label}</span>{children}</label>;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="g-section-title">{eyebrow && <p className="g-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="g-subtitle">{description}</p>}</div>;
}

function StatusPill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' }) {
  return <span className={`g-status g-status-${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function GlobalExperienceWorkspace() {
  const [locale, setLocale] = useState<Locale>('ro');
  const [theme, setTheme] = useState<Theme>('light');
  const [view, setView] = useState<View>('overview');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [project, setProject] = useState('Parc Solar Valea Mare');
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const [notifMode, setNotifMode] = useState<'all' | 'unread'>('all');
  const [notifState, setNotifState] = useState<'populated' | 'loading' | 'empty' | 'error'>('populated');
  const [notifications, setNotifications] = useState(notificationSeed);
  const [faqQuery, setFaqQuery] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reportFile, setReportFile] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'invalid' | 'mismatch' | 'created' | 'sent' | 'expired'>('idle');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [registrationConsent, setRegistrationConsent] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [sitePersonnelMode, setSitePersonnelMode] = useState(false);
  const [activeShellPage, setActiveShellPage] = useState<CopyKey>('overview');
  const [inviteNotice, setInviteNotice] = useState(false);
  const [profileName, setProfileName] = useState('Daniel Georgescu');
  const [profileEmail, setProfileEmail] = useState('daniel.georgescu@hiieko.ro');
  const [profilePhone, setProfilePhone] = useState('+40 722 555 018');
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [userDraft, setUserDraft] = useState({ name: '', email: '', role: 'usersRole3' as CopyKey, project: 'Parc Solar Valea Mare', status: 'pending' });
  const [showCreateUser, setShowCreateUser] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const translate: Translate = (key) => copy[key][locale === 'ro' ? 1 : 0];
  const unreadCount = notifications.filter((item) => item.unread).length;
  const selectedTitle = translate(view === 'overview' ? activeShellPage : view);
  const filteredFaqs = useMemo(() => [
    { question: translate('faqOne'), answer: translate('faqOneAnswer') },
    { question: translate('faqTwo'), answer: translate('faqTwoAnswer') },
    { question: translate('faqThree'), answer: translate('faqThreeAnswer') },
  ].filter((faq) => `${faq.question} ${faq.answer}`.toLocaleLowerCase().includes(faqQuery.toLocaleLowerCase())), [faqQuery, locale]);
  const [users, setUsers] = useState<MockUser[]>(userSeed);
  const visibleUsers = users.filter((user) => userStatusFilter === 'all' || user.status === userStatusFilter);

  useFocusTrap(dialogRef, helpOpen || showCreateUser);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!helpOpen && !showCreateUser && !mobileMenuOpen && !profileMenuOpen && !projectMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpOpen(false);
        setShowCreateUser(false);
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        setProjectMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, showCreateUser, mobileMenuOpen, profileMenuOpen, projectMenuOpen]);

  const markAllRead = () => setNotifications((current) => current.map((notification) => ({ ...notification, unread: false })));
  const markRead = (id: string) => setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, unread: false } : notification));
  const resetAuth = (nextView: View) => { setView(nextView); setAuthStatus('idle'); setPasswordVisible(false); };
  const simulateAuth = (event: FormEvent<HTMLFormElement>, result: 'invalid' | 'created' | 'sent') => {
    event.preventDefault();
    if (result === 'created') {
      const formData = new FormData(event.currentTarget);
      if (formData.get('password') !== formData.get('confirmPassword')) {
        setAuthStatus('mismatch');
        return;
      }
    }
    setAuthStatus('loading');
    window.setTimeout(() => setAuthStatus(result), 450);
  };
  const submitReport = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setReportStatus('success'); };
  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userDraft.name.trim() || !userDraft.email.trim()) return;
    const name = userDraft.name.trim();
    setUsers((current) => [{ initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), name, email: userDraft.email.trim(), role: userDraft.role as MockUser['role'], status: userDraft.status as MockUser['status'], site: sitePersonnelMode ? project.replace('Parc Solar ', '') : userDraft.project.replace('Parc Solar ', ''), activity: translate('pending') }, ...current]);
    setShowCreateUser(false);
    setInviteNotice(true);
  };

  const setActiveView = (next: View) => {
    setView(next);
    setProfileMenuOpen(false);
    setProjectMenuOpen(false);
    setMobileMenuOpen(false);
    if (next === 'report') setReportStatus('idle');
    if (next === 'users') setInviteNotice(false);
  };

  const navItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'overview' as const },
    { id: 'tasks', icon: ListTodo, label: 'tasks' as const },
    { id: 'planning', icon: Activity, label: 'planning' as const },
    { id: 'attendance', icon: Clock3, label: 'attendance' as const },
    { id: 'reports', icon: FileCheck2, label: 'reports' as const },
    { id: 'materials', icon: BriefcaseBusiness, label: 'materials' as const },
    { id: 'quality', icon: ClipboardCheck, label: 'quality' as const },
    { id: 'documents', icon: FileText, label: 'documents' as const },
  ];
  const experienceViews: { id: View; icon: typeof UserRound; label: CopyKey }[] = [
    { id: 'overview', icon: LayoutDashboard, label: 'shell' },
    { id: 'profile', icon: UserRound, label: 'profile' },
    { id: 'notifications', icon: Bell, label: 'notifications' },
    { id: 'support', icon: Headphones, label: 'support' },
    { id: 'report', icon: AlertCircle, label: 'report' },
    { id: 'login', icon: LockKeyhole, label: 'login' },
    { id: 'signup', icon: Users, label: 'signup' },
    { id: 'forgot', icon: ShieldEllipsis, label: 'forgot' },
    { id: 'users', icon: Building2, label: 'users' },
  ];

  const renderOverview = () => <>
    <div className="g-welcome-row"><div><p className="g-eyebrow">{translate('today')} <span>·</span> {translate('siteOffice')}</p><h1>{translate('overviewGreeting')}</h1><p className="g-subtitle">{translate('overviewDescription')}</p></div><div className="g-weather"><CloudSun size={19} /><span><b>18°</b><small>Dolj · senin</small></span></div></div>
    <div className="g-project-banner"><span className="g-project-marker"><HardHat size={18} /></span><span className="g-project-copy"><small>{translate('projectCurrent')}</small><b>{project}</b><em>RO-VM-042 · {translate('projectRegion')}</em></span><StatusPill>{translate('onSchedule')}</StatusPill><span className="g-banner-detail"><span>{translate('projectProgress')}</span><b>68%</b></span></div>
    <div className="g-metrics"><MetricCard icon={ListTodo} value="12" label={translate('tasksInProgress')} note={translate('activeCrewCount')} /><MetricCard icon={Users} value="42 / 46" label={translate('crewPresent')} note={translate('currentSite')} tone="blue" /><MetricCard icon={AlertCircle} value="03" label={translate('openBlockers')} note={translate('escalatedBlockers')} tone="amber" /></div>
    <div className="g-overview-grid"><section className="g-card g-queue-card"><CardHeading icon={ListTodo} title={translate('priorityQueue')} action={translate('viewAll')} onClick={() => setActiveView('notifications')} /><article className="g-queue-item"><span className="g-queue-number">01</span><div className="g-queue-content"><span className="g-chip g-chip-blue">{translate('inProgress')}</span><small>PV-1842 · 10:30</small><b>Montare structură zona B-04</b><p>Valea Mare · Andrei Popescu</p><div className="g-progress"><i style={{ width: '62%' }} /></div><small>62% complet · 18 din 29 structuri</small></div><ChevronRight size={16} /></article><article className="g-queue-item"><span className="g-queue-number">02</span><div className="g-queue-content"><span className="g-chip g-chip-amber">{translate('pending')}</span><small>DR-2026-104 · 09:18</small><b>{translate('reviewReports')}</b><p>{translate('reviewDescription')}</p></div><ChevronRight size={16} /></article><button className="g-link-button" type="button" onClick={() => setActiveView('notifications')}>{translate('viewAll')} <ArrowRight size={14} /></button></section>
      <section className="g-card g-activity-card"><CardHeading icon={Activity} title={translate('recentActivity')} action={translate('viewAll')} onClick={() => setActiveView('notifications')} /><ActivityRow icon={ListTodo} title={translate('activityTask')} meta="09:18 · Valea Mare" tone="green" /><ActivityRow icon={CalendarDays} title={translate('activityPlan')} meta="08:42 · Daniel Georgescu" tone="blue" /><ActivityRow icon={FileCheck2} title={translate('activityReport')} meta="08:16 · Andrei Popescu" tone="amber" /><div className="g-system-status"><span><i />{translate('systemStatus')}</span><span>v1.4.0 · Prototype</span></div></section></div>
    <ProjectOverviewData locale={locale} />
  </>;

  const renderProfile = () => <>
    <SectionTitle eyebrow={translate('workspace')} title={translate('profile')} description={translate('profileIntro')} />
    <div className="g-card g-profile-card"><div className="g-profile-head"><Avatar size="large" /><div><h2>{profileName}</h2><p>{translate('manager')} · {profileEmail}</p><span className="g-profile-context"><MapPin size={13} />{project} · RO-VM-042</span></div><StatusPill>{translate('active')}</StatusPill></div>
      <div className="g-form-grid"><Field label={translate('fullName')}><input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></Field><Field label={translate('email')}><input type="email" value={profileEmail} readOnly /></Field><Field label={translate('phone')}><input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} /></Field><Field label={translate('organization')}><input value="HIIEKO Romania SRL" readOnly /></Field></div>
    </div>
    <section className="g-card g-preferences"><div className="g-card-heading"><div><span className="g-eyebrow">{translate('preferences')}</span><h2>{translate('preferences')}</h2></div><Settings size={17} /></div><div className="g-preference-row"><div><b>{translate('languagePreference')}</b><small>RO / EN</small></div><LanguageControl locale={locale} setLocale={setLocale} t={translate} /></div><div className="g-preference-row"><div><b>{translate('themePreference')}</b><small>{translate('light')} / {translate('dark')} / {translate('system')}</small></div><ThemeControl theme={theme} setTheme={setTheme} t={translate} /></div><div className="g-preference-row"><div><b>{translate('notificationPreferences')}</b><small>{profileEmail}</small></div><button type="button" className={`g-switch ${emailNotifications ? 'is-on' : ''}`} role="switch" aria-checked={emailNotifications} aria-label={translate('notificationPreferences')} onClick={() => setEmailNotifications((value) => !value)}><i /></button></div><div className="g-card-actions"><span>{profileSaved ? translate('localSaved') : translate('preferencesChanged')}</span><button className="g-button g-button-primary" type="button" onClick={() => { setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 2600); }}><Check size={15} />{translate('savePreferences')}</button></div></section>
  </>;

  const renderNotifications = () => {
    const visibleNotifications = notifState === 'populated' ? notifications.filter((item) => notifMode === 'all' || item.unread) : [];
    return <><div className="g-view-heading"><SectionTitle eyebrow={translate('workspace')} title={translate('notifications')} description={translate('notificationIntro')} /><span className="g-notification-count">{unreadCount} {translate('notificationsUnread')}</span></div>
      <section className="g-card g-notifications-card"><div className="g-notifications-controls"><div className="g-segmented"><button type="button" aria-pressed={notifMode === 'all'} className={notifMode === 'all' ? 'active' : ''} onClick={() => setNotifMode('all')}>{translate('all')} <span>{notifications.length}</span></button><button type="button" aria-pressed={notifMode === 'unread'} className={notifMode === 'unread' ? 'active' : ''} onClick={() => setNotifMode('unread')}>{translate('unread')} <span>{unreadCount}</span></button></div><div className="g-inline-actions"><label className="g-demo-select"><span>{translate('chooseState')}</span><select value={notifState} onChange={(event) => setNotifState(event.target.value as typeof notifState)}><option value="populated">{translate('loaded')}</option><option value="loading">{translate('loading')}</option><option value="empty">{translate('empty')}</option><option value="error">{translate('error')}</option></select></label><button className="g-button g-button-quiet" type="button" onClick={markAllRead}><CheckCheck size={15} />{translate('markAllRead')}</button></div></div>
        {notifState === 'loading' ? <div className="g-empty-state"><span className="g-spinner" /><b>{translate('loading')}</b></div> : notifState === 'error' ? <div className="g-inline-alert g-inline-alert-error"><AlertCircle size={17} /><span>{translate('notificationError')}</span><button type="button" onClick={() => setNotifState('populated')}>{translate('continue')}</button></div> : visibleNotifications.length === 0 ? <div className="g-empty-state"><span className="g-empty-icon"><Bell size={20} /></span><b>{notifMode === 'unread' ? translate('allCaughtUp') : translate('noNotifications')}</b><p>{translate('notificationIntro')}</p></div> : <div className="g-notification-list">{visibleNotifications.map((item) => { const Icon = item.icon; return <article key={item.id} className={`g-notification-row ${item.unread ? 'is-unread' : ''}`}><span className="g-notification-icon"><Icon size={17} /></span><div className="g-notification-copy"><div className="g-notification-heading"><b>{translate(item.title)}</b>{item.unread && <span className="g-unread-dot" aria-label={translate('unreadMessage')} />}</div><p>{translate(item.detailKey)}</p><small>{translate(item.time)} · {item.unread ? translate('unreadMessage') : translate('readMessage')}</small></div>{item.unread && <button className="g-icon-button" type="button" onClick={() => markRead(item.id)} aria-label={`${translate('markRead')}: ${translate(item.title)}`}><Check size={15} /></button>}</article>; })}</div>}
      </section></>;
  };

  const renderSupport = () => <><SectionTitle eyebrow={translate('workspace')} title={translate('support')} description={translate('supportIntro')} /><div className="g-support-hero"><span><Headphones size={21} /></span><div><b>{translate('contactSupport')}</b><p>{translate('supportTopic')}</p><a href="mailto:support@hiieko.ro">{translate('supportEmail')}</a><small>{translate('responseHours')}</small></div><button type="button" className="g-button g-button-primary" onClick={() => setActiveView('report')}><Send size={15} />{translate('report')}</button></div>
    <div className="g-support-grid"><section className="g-card g-support-search"><CardHeading icon={Search} title={translate('searchHelp')} /><div className="g-search-field"><Search size={16} /><input value={faqQuery} onChange={(event) => setFaqQuery(event.target.value)} aria-label={translate('searchHelp')} placeholder={translate('searchHelp')} />{faqQuery && <button type="button" onClick={() => setFaqQuery('')} aria-label={translate('clearSearch')}><X size={14} /></button>}</div><div className="g-faq-list"><h3>{translate('faqs')}</h3>{filteredFaqs.length ? filteredFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown size={15} /></summary><p>{faq.answer}</p></details>) : <p className="g-muted">{translate('noHelpResults')}</p>}</div></section>
      <section className="g-card g-system-card"><CardHeading icon={ShieldCheck} title={translate('systemInformation')} /><dl><div><dt>{translate('version')}</dt><dd>HIIEKO Web · 1.4.0</dd></div><div><dt>{translate('environment')}</dt><dd>{translate('demoEnvironment')}</dd></div><div><dt>{translate('currentPage')}</dt><dd>/{view === 'support' ? 'design-review/global' : view}</dd></div></dl><span className="g-system-status"><i />{translate('systemStatus')}</span></section></div>
  </>;

  const renderReport = () => <><SectionTitle eyebrow={translate('workspace')} title={translate('report')} description={translate('reportIntro')} />{reportStatus === 'success' ? <div className="g-card g-report-success" role="status"><span><CheckCircle2 size={23} /></span><h2>{translate('reported')}</h2><p>{translate('reportSentDescription')}</p><button className="g-button g-button-primary" type="button" onClick={() => setActiveView('overview')}>{translate('back')}</button></div> : <form className="g-card g-report-form" onSubmit={submitReport}><div className="g-form-grid"><Field label={translate('category')}><select defaultValue="ui"><option value="ui">{translate('categoryUi')}</option><option value="site">{translate('categorySite')}</option><option value="data">{translate('categoryData')}</option><option value="access">{translate('categoryAccess')}</option></select></Field><Field label={translate('severity')}><select defaultValue="normal"><option value="normal">{translate('normal')}</option><option value="high">{translate('high')}</option><option value="critical">{translate('critical')}</option></select></Field><Field label={translate('subject')} className="g-field-wide"><input required maxLength={120} placeholder={translate('subject')} /></Field><Field label={translate('description')} className="g-field-wide"><textarea required rows={4} maxLength={1400} placeholder={translate('description')} /></Field><Field label={translate('currentPage')}><input readOnly value={translate('currentPageValue')} /></Field><Field label={translate('siteAssignment')}><input readOnly value={`${project} · RO-VM-042`} /></Field><Field label={translate('contactDetails')}><input required type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} /></Field><Field label={translate('attachment')} className="g-field-wide"><span className="g-upload-field"><Paperclip size={16} /><span>{reportFile || translate('noFile')}</span><span className="g-button g-button-quiet">{translate('chooseFile')}<input type="file" accept="image/*,.pdf" onChange={(event) => setReportFile(event.target.files?.[0]?.name || '')} /></span></span></Field></div>{reportStatus === 'error' && <div className="g-inline-alert g-inline-alert-error" role="alert"><AlertCircle size={17} />{translate('reportFailed')}</div>}<div className="g-form-footer"><span className="g-local-disclaimer"><ShieldCheck size={14} />{translate('localNotice')}</span><div><button type="button" className="g-button g-button-quiet" onClick={() => setActiveView('support')}>{translate('cancel')}</button><button type="button" className="g-button g-button-quiet" onClick={() => setReportStatus('error')}>{translate('showError')}</button><button type="submit" className="g-button g-button-primary"><Send size={15} />{translate('sendReport')}</button></div></div></form>}</>;

  const renderUsers = () => <><div className="g-view-heading"><SectionTitle eyebrow={translate('workspace')} title={sitePersonnelMode ? translate('addSitePersonnel') : translate('users')} description={translate('userManagementIntro')} /><button type="button" className="g-button g-button-primary" onClick={() => { setUserDraft({ name: '', email: '', role: 'usersRole3', project, status: 'pending' }); setShowCreateUser(true); }}><Users size={15} />{translate('createUser')}</button></div><div className="g-concept-banner"><ShieldCheck size={16} /><span><b>{translate('productionPermissions')}</b><small>{translate('noRoleChanges')}</small></span><StatusPill tone="blue">{translate('designOnly')}</StatusPill></div><section className="g-card g-users-card"><div className="g-users-toolbar"><div className="g-segmented"><button type="button" className={!sitePersonnelMode ? 'active' : ''} aria-pressed={!sitePersonnelMode} onClick={() => setSitePersonnelMode(false)}>{translate('teamUsers')}</button><button type="button" className={sitePersonnelMode ? 'active' : ''} aria-pressed={sitePersonnelMode} onClick={() => setSitePersonnelMode(true)}>{translate('addSitePersonnel')}</button></div><label className="g-demo-select"><span>{translate('status')}</span><select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}><option value="all">{translate('all')}</option><option value="active">{translate('active')}</option><option value="pending">{translate('pending')}</option><option value="suspended">{translate('suspended')}</option></select></label></div>{sitePersonnelMode && <p className="g-site-personnel-note"><MapPin size={14} />{translate('sitePersonnelContext')} · {project}</p>}<div className="g-table-wrap"><table className="g-table"><thead><tr><th>{translate('user')}</th><th>{translate('role')}</th><th>{translate('status')}</th><th>{translate('site')}</th><th>{translate('lastActivity')}</th><th><span className="g-sr-only">{translate('viewTitle')}</span></th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.email}><td><div className="g-table-user"><Avatar initials={user.initials} /><span><b>{user.name}</b><small>{user.email}</small></span></div></td><td>{translate(user.role)}</td><td><StatusPill tone={user.status === 'active' ? 'green' : user.status === 'pending' ? 'amber' : 'slate'}>{translate(user.status)}</StatusPill></td><td>{user.site}</td><td>{user.activity === 'Ieri' ? translate('yesterday') : user.activity}</td><td><button type="button" className="g-icon-button" aria-label={`${translate('viewTitle')}: ${user.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div><p className="g-mobile-table-note">{translate('productionPermissions')}</p></section>{inviteNotice && <div className="g-inline-alert g-inline-alert-success" role="status"><CheckCircle2 size={17} />{translate('inviteLocal')}</div>}</>;

  const renderAuth = () => {
    const isLogin = view === 'login';
    const isSignup = view === 'signup';
    const isForgot = view === 'forgot';
    const authTitle = isLogin ? translate('login') : isSignup ? translate('signup') : translate('forgot');
    return <div className="g-auth-page"><div className="g-auth-brand"><span className="g-brand-mark">H</span><span><b>HIIEKO</b><small>ROMANIA · EPC</small></span></div><section className="g-auth-card"><div className="g-auth-card-top"><span className="g-eyebrow">{translate('fieldOps')}</span><div className="g-auth-controls"><LanguageControl locale={locale} setLocale={setLocale} t={translate} /><StatusPill tone="slate">{translate('designOnly')}</StatusPill></div></div><div className="g-auth-heading"><span className="g-auth-icon">{isLogin ? <LockKeyhole size={20} /> : isSignup ? <Users size={20} /> : <Mail size={20} />}</span><h1>{authTitle}</h1><p>{isLogin ? translate('loginIntro') : isSignup ? translate('userManagementIntro') : translate('resetIntro')}</p></div>
      {isSignup && authStatus === 'created' ? <div className="g-pending-state" role="status"><span><Clock3 size={22} /></span><h2>{translate('accountCreated')}</h2><b>{translate('pendingActivation')}</b><p>{translate('pendingDescription')}</p><button className="g-button g-button-primary" type="button" onClick={() => resetAuth('login')}>{translate('backToLogin')}</button></div> : isForgot && authStatus === 'sent' ? <div className="g-pending-state" role="status"><span><Mail size={22} /></span><h2>{translate('resetSent')}</h2><p>{translate('resetSuccess')}</p><button className="g-button g-button-primary" type="button" onClick={() => resetAuth('login')}>{translate('backToLogin')}</button></div> : isForgot && authStatus === 'expired' ? <div className="g-pending-state g-expired-state" role="alert"><span><AlertCircle size={22} /></span><h2>{translate('expiredReset')}</h2><button className="g-button g-button-primary" type="button" onClick={() => resetAuth('forgot')}>{translate('sendReset')}</button><button className="g-text-link" type="button" onClick={() => resetAuth('login')}>{translate('backToLogin')}</button></div> : <form className="g-auth-form" onSubmit={(event) => simulateAuth(event, isLogin ? 'invalid' : isSignup ? 'created' : 'sent')}>
        {isSignup && <><Field label={translate('fullName')}><input required autoComplete="name" placeholder="Andrei Popescu" /></Field><Field label={translate('phone')}><input type="tel" autoComplete="tel" placeholder="+40 7xx xxx xxx" /></Field></>}
        <Field label={isLogin ? translate('emailOrUsername') : translate('email')}><input name="email" required type={isLogin ? 'text' : 'email'} autoComplete="email" placeholder={locale === 'ro' ? 'nume@companie.ro' : 'name@company.com'} /></Field>
        {!isForgot && <Field label={translate('password')}><span className="g-password-input"><input name="password" required type={passwordVisible ? 'text' : 'password'} minLength={isSignup ? 10 : 1} pattern={isSignup ? '(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}' : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'} /><button type="button" aria-label={passwordVisible ? translate('hidePassword') : translate('showPassword')} onClick={() => setPasswordVisible((value) => !value)}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>{isSignup && <small className="g-field-hint">{translate('passwordRequirements')}</small>}</Field>}
        {isSignup && <Field label={translate('confirmPassword')}><input name="confirmPassword" required type={passwordVisible ? 'text' : 'password'} minLength={10} autoComplete="new-password" /></Field>}
        {isLogin && <div className="g-auth-options"><label className="g-checkbox"><input type="checkbox" /><span>{translate('remember')}</span></label><button className="g-text-link" type="button" onClick={() => resetAuth('forgot')}>{translate('forgot')}</button></div>}
        {isSignup && <label className="g-checkbox g-consent"><input type="checkbox" checked={registrationConsent} onChange={(event) => setRegistrationConsent(event.target.checked)} required /><span>{translate('confirmConsent')}</span></label>}
        {authStatus === 'invalid' && isLogin && <div className="g-inline-alert g-inline-alert-error" role="alert"><AlertCircle size={16} />{translate('invalidCredentials')}</div>}
        {authStatus === 'mismatch' && isSignup && <div className="g-inline-alert g-inline-alert-error" role="alert"><AlertCircle size={16} />{translate('passwordsNoMatch')}</div>}
        {authStatus === 'loading' && <div className="g-auth-loading" role="status"><span className="g-spinner" />{translate(isLogin ? 'signinPending' : isSignup ? 'registrationProcessing' : 'requestProcessing')}</div>}
        <button className="g-button g-button-primary g-auth-submit" type="submit" disabled={authStatus === 'loading' || (isSignup && !registrationConsent)}>{isLogin ? translate('login') : isSignup ? translate('createAccount') : translate('sendReset')}<ArrowRight size={16} /></button>
        <p className="g-auth-note"><ShieldCheck size={14} />{translate('loginMode')}</p>
      </form>}
      {!isForgot && <p className="g-auth-switch">{isLogin ? translate('noAccount') : translate('haveAccount')} <button type="button" className="g-text-link" onClick={() => resetAuth(isLogin ? 'signup' : 'login')}>{isLogin ? translate('createAccount') : translate('login')}</button></p>}
      {isForgot && authStatus === 'idle' && <button className="g-text-link g-expired-preview" type="button" onClick={() => setAuthStatus('expired')}>{translate('previewExpired')}</button>}
    </section><div className="g-auth-footer"><button type="button" onClick={() => setActiveView('support')}><CircleHelp size={15} />{translate('support')}</button><span>© 2026 HIIEKO Romania SRL</span></div></div>;
  };

    return <div className="global-review" data-theme={theme} data-preview-viewport={viewport}>
    <style jsx global>{`
      .global-review{--g-bg:#f3f6f4;--g-surface:#fff;--g-surface-muted:#f8faf9;--g-sidebar:#14221b;--g-sidebar-border:#27392f;--g-sidebar-text:#d3ddd6;--g-ink:#17231d;--g-secondary:#59675f;--g-muted:#78867e;--g-border:#e3eae5;--g-border-strong:#d4ded7;--g-brand:#188c51;--g-brand-dark:#116c3d;--g-brand-soft:#e8f5ed;--g-green:#177448;--g-green-bg:#eaf6ee;--g-blue:#235fa4;--g-blue-bg:#edf4fc;--g-amber:#94610a;--g-amber-bg:#fff6df;--g-red:#aa3d35;--g-red-bg:#fff0ee;--g-shadow:0 1px 3px #19241b0d,0 5px 14px #19241b08;background:var(--g-bg);color:var(--g-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;font-size:13px}.global-review *{box-sizing:border-box}.global-review button,.global-review input,.global-review select,.global-review textarea{font:inherit}.global-review button{cursor:pointer}.global-review :focus-visible{outline:2px solid #188c51;outline-offset:2px}.global-review[data-theme=dark]{--g-bg:#101713;--g-surface:#18211c;--g-surface-muted:#1c2721;--g-sidebar:#0d1410;--g-sidebar-border:#24342a;--g-sidebar-text:#d5ded8;--g-ink:#edf2ee;--g-secondary:#c0cbc3;--g-muted:#98a69c;--g-border:#2b3930;--g-border-strong:#3a4a3e;--g-brand:#38ad70;--g-brand-dark:#64c18a;--g-brand-soft:#203b2b;--g-green:#88d5a7;--g-green-bg:#1e3928;--g-blue:#a6c7f2;--g-blue-bg:#203149;--g-amber:#efd28a;--g-amber-bg:#3a301d;--g-red:#f1a29c;--g-red-bg:#422723;--g-shadow:0 2px 12px #0004}.g-review-top{min-height:56px;padding:0 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--g-surface);border-bottom:1px solid var(--g-border)}.g-review-brand{display:flex;align-items:center;gap:10px;color:var(--g-ink);text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.07em}.g-brand-mark{display:grid;place-items:center;width:29px;height:29px;border-radius:8px;background:var(--g-brand);color:white;font-size:16px;font-weight:800}.g-review-tools{display:flex;align-items:center;gap:8px}.g-review-tools>span{font-size:11px;color:var(--g-muted);margin-right:3px}.g-preview-modes,.g-locale-control,.g-theme-control,.g-experience-nav,.g-segmented{display:flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--g-border);background:var(--g-surface-muted);border-radius:9px}.g-preview-modes button,.g-locale-control button,.g-theme-control button,.g-segmented button{min-height:29px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--g-secondary);font-size:11px;font-weight:600}.g-preview-modes button[aria-pressed=true],.g-locale-control button[aria-pressed=true],.g-theme-control button[aria-pressed=true],.g-segmented button.active{background:var(--g-surface);color:var(--g-ink);box-shadow:0 1px 3px #101a1317}.g-locale-control button{min-width:36px;padding:0 7px;font-weight:700}.g-theme-control button{display:flex;align-items:center;gap:4px}.g-review-back{color:var(--g-secondary);font-size:11px;text-decoration:none}.g-review-main{max-width:1450px;margin:0 auto;padding:16px 22px 26px}.g-experience-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.g-experience-bar>span{font-size:11px;font-weight:700;color:var(--g-secondary)}.g-experience-nav{overflow:auto;max-width:calc(100% - 155px);scrollbar-width:thin}.g-experience-nav button{display:flex;align-items:center;gap:5px;white-space:nowrap;min-height:29px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--g-secondary);font-size:10px;font-weight:600}.g-experience-nav button[aria-current=page]{background:var(--g-surface);color:var(--g-brand);box-shadow:0 1px 3px #101a1317}.g-preview-frame{max-width:100%;margin:0 auto;border:1px solid var(--g-border-strong);border-radius:13px;overflow:hidden;background:var(--g-surface);box-shadow:var(--g-shadow);container-type:inline-size;transition:max-width .2s ease}.global-review[data-preview-viewport=tablet] .g-preview-frame{max-width:960px}.global-review[data-preview-viewport=mobile] .g-preview-frame{max-width:390px}.g-app-shell{display:flex;min-height:690px;background:var(--g-bg)}.g-sidebar{display:flex;flex-direction:column;flex:0 0 226px;width:226px;transition:width .2s,flex-basis .2s;background:var(--g-sidebar);color:var(--g-sidebar-text)}.g-sidebar.is-collapsed{flex-basis:67px;width:67px}.g-sidebar-brand{height:61px;display:flex;align-items:center;gap:10px;padding:0 17px;border-bottom:1px solid var(--g-sidebar-border);color:#fff;text-decoration:none}.g-sidebar-brand .g-brand-mark{width:31px;height:31px;flex:none}.g-sidebar-brand-text{display:flex;flex-direction:column;gap:2px;white-space:nowrap}.g-sidebar-brand-text b{font-size:12px;letter-spacing:.12em}.g-sidebar-brand-text small{font-size:8px;color:#9eb8a6;letter-spacing:.13em}.g-project-switch-wrap{position:relative;padding:11px 11px 9px}.g-project-select{width:100%;display:flex;align-items:center;gap:9px;min-height:46px;padding:7px 8px;border:1px solid #ffffff20;border-radius:8px;background:#ffffff09;color:#fff;text-align:left}.g-project-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#52c27a;box-shadow:0 0 0 3px #52c27a25}.g-project-select-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}.g-project-select-copy small{font-size:8px;color:#9eb8a6;text-transform:uppercase;letter-spacing:.08em}.g-project-select-copy b{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.g-project-select svg{color:#9eb8a6}.g-project-dropdown,.g-account-menu{position:absolute;z-index:40;top:calc(100% - 2px);left:11px;right:11px;padding:5px;border:1px solid var(--g-border);border-radius:9px;background:var(--g-surface);box-shadow:var(--g-shadow)}.g-project-dropdown button{width:100%;padding:9px;border:0;border-radius:6px;background:transparent;color:var(--g-ink);text-align:left;font-size:11px}.g-project-dropdown button:hover,.g-account-menu button:hover{background:var(--g-surface-muted)}.g-sidebar-label{margin:12px 15px 7px;color:#8da397;font-size:9px;font-weight:700;letter-spacing:.12em}.g-sidebar-nav{display:grid;gap:3px;padding:0 9px}.g-sidebar-nav button{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:36px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:#c2d0c6;text-align:left;font-size:10px;font-weight:500;white-space:nowrap}.g-sidebar-nav button:hover{background:#ffffff10;color:#fff}.g-sidebar-nav button.active{background:#188c51;color:#fff;font-weight:650}.g-sidebar-nav button>svg{width:16px;height:16px;flex:none}.g-nav-count{margin-left:auto;padding:2px 5px;border-radius:99px;background:#ffffff20;color:white;font-size:9px}.g-sidebar-footer{margin-top:auto;padding:10px;border-top:1px solid var(--g-sidebar-border)}.g-sidebar-footer button{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;min-height:33px;border:1px solid #ffffff16;border-radius:7px;background:#ffffff08;color:#bdcbbf;font-size:9px}.g-app-main{display:flex;min-width:0;flex:1;flex-direction:column}.g-app-header{height:60px;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;border-bottom:1px solid var(--g-border);background:var(--g-surface)}.g-header-leading,.g-header-actions{display:flex;align-items:center;gap:10px;min-width:0}.g-menu-trigger,.g-project-mobile,.g-icon-button{display:grid;place-items:center;flex:none;width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:var(--g-secondary)}.g-menu-trigger:hover,.g-icon-button:hover{background:var(--g-surface-muted);color:var(--g-ink)}.g-breadcrumb{display:flex;align-items:center;gap:6px;min-width:0;color:var(--g-muted);font-size:10px;white-space:nowrap}.g-breadcrumb b{max-width:160px;overflow:hidden;color:var(--g-ink);text-overflow:ellipsis}.g-header-project{position:relative}.g-header-project>button{display:flex;align-items:center;gap:7px;min-height:34px;padding:5px 9px;border:1px solid var(--g-border);border-radius:7px;background:var(--g-surface);color:var(--g-ink);font-size:10px;font-weight:600;white-space:nowrap}.g-header-project>button svg:first-child{color:var(--g-brand)}.g-header-actions{gap:5px}.g-header-actions>.g-locale-control{margin:0 3px}.g-header-actions .g-locale-control button{min-height:27px}.g-notification-trigger{position:relative}.g-notification-trigger .g-unread-count{position:absolute;top:-3px;right:-1px;min-width:16px;height:16px;padding:0 4px;display:grid;place-items:center;border:2px solid var(--g-surface);border-radius:99px;background:#c4473e;color:#fff;font-size:8px;font-weight:700}.g-help-trigger{display:flex;align-items:center;gap:5px;min-height:33px;padding:0 8px;border:1px solid var(--g-border);border-radius:7px;background:var(--g-surface);color:var(--g-secondary);font-size:10px;font-weight:600}.g-profile-trigger{display:flex;align-items:center;gap:7px;min-height:37px;padding:3px;border:0;border-radius:9px;background:transparent;color:var(--g-ink);text-align:left}.g-profile-trigger:hover{background:var(--g-surface-muted)}.g-profile-trigger-copy{display:flex;flex-direction:column;gap:2px}.g-profile-trigger-copy b{font-size:10px}.g-profile-trigger-copy small{font-size:8px;color:var(--g-muted)}.g-avatar{width:29px;height:29px;display:grid;place-items:center;flex:none;border:1px solid #cae2d1;border-radius:50%;background:#e6f3e9;color:#286443;font-size:9px;font-weight:750;letter-spacing:.02em}.g-avatar-large{width:54px;height:54px;font-size:15px}.g-account-menu{top:calc(100% + 5px);right:0;left:auto;width:242px;padding:7px}.g-account-menu-head{display:flex;align-items:center;gap:9px;padding:7px 6px 10px;border-bottom:1px solid var(--g-border)}.g-account-menu-head>span:last-child{display:grid;gap:3px}.g-account-menu-head b{color:var(--g-ink);font-size:11px}.g-account-menu-head small{color:var(--g-muted);font-size:9px}.g-account-menu button{width:100%;display:flex;align-items:center;gap:8px;min-height:33px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--g-secondary);text-align:left;font-size:10px}.g-account-menu .g-menu-setting-label{padding:9px 8px 4px;color:var(--g-muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.g-account-menu .g-locale-control,.g-account-menu .g-theme-control{margin:2px 6px 6px}.g-account-menu .g-theme-control{width:calc(100% - 12px)}.g-account-menu .g-account-signout{color:#b4403b}.g-shell-content{width:100%;max-width:1180px;margin:0 auto;padding:23px 24px 26px}.g-welcome-row,.g-view-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.g-welcome-row h1,.g-section-title h1{margin:4px 0 5px;font-size:21px;line-height:1.25;letter-spacing:-.035em;font-weight:700;color:var(--g-ink)}.g-eyebrow{margin:0;color:var(--g-muted);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.g-eyebrow span{padding:0 3px;color:var(--g-brand)}.g-subtitle{margin:0;color:var(--g-secondary);font-size:11px;line-height:1.5}.g-weather{display:flex;align-items:center;gap:7px;min-width:90px;padding:8px 10px;border:1px solid var(--g-border);border-radius:9px;background:var(--g-surface);color:#b17413}.g-weather>span{display:grid;gap:1px}.g-weather b{color:var(--g-ink);font-size:14px}.g-weather small{color:var(--g-muted);font-size:8px}.g-project-banner{display:flex;align-items:center;gap:11px;margin-top:17px;padding:12px 14px;border:1px solid var(--g-border);border-left:3px solid var(--g-brand);border-radius:9px;background:var(--g-surface)}.g-project-marker,.g-card-heading>svg,.g-project-marker svg{color:var(--g-brand)}.g-project-marker{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--g-brand-soft)}.g-project-copy{display:grid;flex:1;min-width:0;gap:2px}.g-project-copy small{color:var(--g-muted);font-size:8px;text-transform:uppercase;letter-spacing:.07em}.g-project-copy b{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.g-project-copy em{font-size:9px;font-style:normal;color:var(--g-secondary)}.g-status{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border:1px solid transparent;border-radius:99px;font-size:9px;font-weight:650;white-space:nowrap;background:var(--g-green-bg);color:var(--g-green)}.g-status>i,.g-system-status>span>i,.g-system-status>i{width:6px;height:6px;border-radius:50%;background:currentColor}.g-status-amber{background:var(--g-amber-bg);color:var(--g-amber)}.g-status-red{background:var(--g-red-bg);color:var(--g-red)}.g-status-blue{background:var(--g-blue-bg);color:var(--g-blue)}.g-status-slate{background:var(--g-surface-muted);border-color:var(--g-border);color:var(--g-secondary)}.g-banner-detail{display:grid;gap:3px;margin-left:10px;padding-left:15px;border-left:1px solid var(--g-border);color:var(--g-secondary);font-size:9px}.g-banner-detail b{font-size:13px;color:var(--g-ink)}.g-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.g-metric-card{display:flex;align-items:center;gap:10px;min-width:0;padding:12px;border:1px solid var(--g-border);border-radius:9px;background:var(--g-surface)}.g-metric-icon{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:8px;background:var(--g-green-bg);color:var(--g-green)}.g-metric-icon.tone-blue{background:var(--g-blue-bg);color:var(--g-blue)}.g-metric-icon.tone-amber{background:var(--g-amber-bg);color:var(--g-amber)}.g-metric-copy{display:grid;min-width:0;gap:3px}.g-metric-copy strong{font-size:15px;line-height:1.1}.g-metric-copy span{overflow:hidden;color:var(--g-secondary);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.g-metric-copy small{color:var(--g-muted);font-size:8px}.g-overview-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.85fr);gap:12px;margin-top:13px}.g-card{min-width:0;padding:15px;border:1px solid var(--g-border);border-radius:10px;background:var(--g-surface);box-shadow:0 1px 2px #16251a08}.g-card-heading{display:flex;align-items:center;gap:8px}.g-card-heading>span{display:flex;flex:1;align-items:center;gap:8px;min-width:0}.g-card-heading h2{margin:0;font-size:12px;font-weight:650;letter-spacing:-.01em}.g-card-heading>button,.g-link-button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--g-brand);font-size:9px;font-weight:650;white-space:nowrap}.g-queue-item{display:flex;align-items:flex-start;gap:10px;margin-top:13px;padding:10px 0;border-bottom:1px solid var(--g-border)}.g-queue-number{display:grid;place-items:center;width:24px;height:24px;flex:none;border-radius:7px;background:var(--g-surface-muted);color:var(--g-muted);font-size:9px;font-weight:700}.g-queue-content{display:grid;flex:1;min-width:0;gap:4px}.g-queue-content>small{color:var(--g-muted);font-size:8px}.g-queue-content>b{font-size:10px;line-height:1.45}.g-queue-content>p{margin:0;color:var(--g-secondary);font-size:9px}.g-chip{width:max-content;padding:3px 6px;border-radius:5px;font-size:8px;font-weight:650}.g-chip-blue{background:var(--g-blue-bg);color:var(--g-blue)}.g-chip-amber{background:var(--g-amber-bg);color:var(--g-amber)}.g-progress{height:4px;overflow:hidden;border-radius:99px;background:var(--g-border)}.g-progress i{display:block;height:100%;border-radius:inherit;background:var(--g-brand)}.g-link-button{margin-top:8px;padding:4px 0}.g-activity-card .g-card-heading{margin-bottom:10px}.g-activity-row{display:flex;align-items:flex-start;gap:8px;padding:10px 0;border-bottom:1px solid var(--g-border)}.g-activity-row>span{display:grid;place-items:center;width:26px;height:26px;flex:none;border-radius:7px;background:var(--g-green-bg);color:var(--g-green)}.g-activity-row>span.tone-blue{background:var(--g-blue-bg);color:var(--g-blue)}.g-activity-row>span.tone-amber{background:var(--g-amber-bg);color:var(--g-amber)}.g-activity-row>div{display:grid;gap:4px}.g-activity-row b{font-size:9px;line-height:1.4}.g-activity-row small{font-size:8px;color:var(--g-muted)}.g-system-status{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:11px;color:var(--g-secondary);font-size:8px}.g-system-status>span:first-child{display:flex;align-items:center;gap:5px}.g-system-status>span>i,.g-system-status>i{color:var(--g-green);background:currentColor}.g-section-title{min-width:0;margin-bottom:15px}.g-section-title h1{font-size:19px}.g-profile-card{padding:18px}.g-profile-head{display:flex;align-items:center;gap:12px;padding-bottom:15px;border-bottom:1px solid var(--g-border)}.g-profile-head>div{flex:1;min-width:0}.g-profile-head h2{margin:0 0 4px;font-size:14px}.g-profile-head p{margin:0;color:var(--g-secondary);font-size:10px}.g-profile-context{display:flex;align-items:center;gap:4px;margin-top:5px;color:var(--g-muted);font-size:9px}.g-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px}.g-field{display:grid;gap:5px;min-width:0;color:var(--g-secondary);font-size:9px;font-weight:600}.g-field input,.g-field select,.g-field textarea,.g-search-field input{width:100%;min-width:0;min-height:36px;padding:8px 10px;border:1px solid var(--g-border-strong);border-radius:7px;background:var(--g-surface);color:var(--g-ink);font-size:10px}.g-field input::placeholder,.g-field textarea::placeholder{color:var(--g-muted)}.g-field input[readonly]{background:var(--g-surface-muted);color:var(--g-secondary)}.g-field textarea{min-height:88px;resize:vertical}.g-field-wide{grid-column:1/-1}.g-preferences{margin-top:12px}.g-card-heading h2{margin:0;font-size:12px}.g-preference-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--g-border)}.g-preference-row>div{display:grid;gap:4px}.g-preference-row b{font-size:10px}.g-preference-row small{color:var(--g-muted);font-size:9px}.g-card-actions,.g-form-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px}.g-card-actions>span{color:var(--g-muted);font-size:9px}.g-switch{position:relative;width:36px;height:21px;border:0;border-radius:99px;background:var(--g-border-strong);transition:background .15s}.g-switch i{position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}.g-switch.is-on{background:var(--g-brand)}.g-switch.is-on i{transform:translateX(15px)}.g-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 11px;border:1px solid var(--g-border);border-radius:7px;background:var(--g-surface);color:var(--g-secondary);font-size:10px;font-weight:650;white-space:nowrap}.g-button:hover{border-color:var(--g-border-strong);background:var(--g-surface-muted)}.g-button-primary{border-color:var(--g-brand);background:var(--g-brand);color:#fff}.g-button-primary:hover{border-color:var(--g-brand-dark);background:var(--g-brand-dark);color:#fff}.g-button-quiet{border-color:transparent;background:transparent;color:var(--g-secondary)}.g-button:disabled{opacity:.6;cursor:not-allowed}.g-view-heading{align-items:flex-end;margin-bottom:14px}.g-view-heading .g-section-title{margin:0}.g-notification-count{margin-bottom:17px;color:var(--g-secondary);font-size:9px;white-space:nowrap}.g-notifications-controls,.g-users-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--g-border)}.g-inline-actions{display:flex;align-items:center;gap:8px}.g-demo-select{display:flex;align-items:center;gap:6px;color:var(--g-muted);font-size:9px}.g-demo-select>span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.g-demo-select select{min-height:30px;max-width:175px;padding:4px 8px;border:1px solid var(--g-border);border-radius:7px;background:var(--g-surface);color:var(--g-secondary);font-size:9px}.g-segmented button span{margin-left:3px;color:var(--g-muted);font-size:8px}.g-notification-list{display:grid}.g-notification-row{display:flex;align-items:flex-start;gap:10px;padding:13px 5px;border-bottom:1px solid var(--g-border)}.g-notification-row.is-unread{background:color-mix(in srgb,var(--g-brand-soft) 35%,transparent)}.g-notification-icon{display:grid;place-items:center;width:31px;height:31px;flex:none;border:1px solid var(--g-border);border-radius:8px;background:var(--g-surface);color:var(--g-brand)}.g-notification-copy{flex:1;min-width:0}.g-notification-heading{display:flex;align-items:center;gap:7px}.g-notification-heading b{font-size:10px;line-height:1.4}.g-notification-copy p{margin:3px 0;color:var(--g-secondary);font-size:9px}.g-notification-copy small{color:var(--g-muted);font-size:8px}.g-unread-dot{width:6px;height:6px;border-radius:50%;background:var(--g-brand)}.g-empty-state{display:grid;justify-items:center;gap:8px;padding:42px 12px;text-align:center;color:var(--g-secondary)}.g-empty-state b{color:var(--g-ink);font-size:11px}.g-empty-state p{margin:0;font-size:9px}.g-empty-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--g-brand-soft);color:var(--g-brand)}.g-spinner{width:17px;height:17px;border:2px solid var(--g-border);border-top-color:var(--g-brand);border-radius:50%;animation:g-spin .75s linear infinite}@keyframes g-spin{to{transform:rotate(360deg)}}.g-inline-alert{display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 11px;border:1px solid var(--g-border);border-radius:8px;font-size:10px}.g-inline-alert-error{border-color:color-mix(in srgb,var(--g-red) 30%,var(--g-border));background:var(--g-red-bg);color:var(--g-red)}.g-inline-alert-success{border-color:color-mix(in srgb,var(--g-green) 35%,var(--g-border));background:var(--g-green-bg);color:var(--g-green)}.g-inline-alert button{margin-left:auto;border:0;background:transparent;color:inherit;text-decoration:underline;font-size:9px}.g-support-hero{display:flex;align-items:center;gap:13px;margin-bottom:12px;padding:16px;border:1px solid var(--g-border);border-left:3px solid var(--g-brand);border-radius:10px;background:var(--g-surface)}.g-support-hero>span{display:grid;place-items:center;width:39px;height:39px;flex:none;border-radius:9px;background:var(--g-brand-soft);color:var(--g-brand)}.g-support-hero>div{display:grid;flex:1;gap:4px}.g-support-hero b{font-size:11px}.g-support-hero p,.g-support-hero small{margin:0;color:var(--g-secondary);font-size:9px}.g-support-hero a{color:var(--g-brand);font-size:10px;text-decoration:none}.g-support-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(220px,.8fr);gap:12px}.g-search-field{display:flex;align-items:center;gap:7px;margin-top:13px;padding-left:10px;border:1px solid var(--g-border-strong);border-radius:7px;color:var(--g-muted)}.g-search-field input{min-height:34px;border:0;padding-left:0;outline:none}.g-search-field button{display:grid;place-items:center;width:28px;height:28px;border:0;background:transparent;color:var(--g-muted)}.g-faq-list{margin-top:15px}.g-faq-list h3{margin:0 0 7px;font-size:10px}.g-faq-list details{border-top:1px solid var(--g-border)}.g-faq-list summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;cursor:pointer;list-style:none;font-size:9px;font-weight:600}.g-faq-list summary::-webkit-details-marker{display:none}.g-faq-list details[open] summary svg{transform:rotate(180deg)}.g-faq-list details p{margin:0;padding:0 0 11px;color:var(--g-secondary);font-size:9px;line-height:1.55}.g-muted{color:var(--g-muted);font-size:9px}.g-system-card dl{margin:12px 0;display:grid;gap:10px}.g-system-card dl>div{display:flex;justify-content:space-between;gap:8px}.g-system-card dt{color:var(--g-secondary);font-size:9px}.g-system-card dd{margin:0;color:var(--g-ink);font-size:9px;text-align:right}.g-system-card .g-system-status{justify-content:flex-start;margin-top:13px;padding-top:11px;border-top:1px solid var(--g-border)}.g-report-form{padding:17px}.g-report-form .g-form-grid{margin-top:0}.g-upload-field{display:flex;align-items:center;gap:8px;min-height:41px;padding:4px 7px;border:1px dashed var(--g-border-strong);border-radius:7px;color:var(--g-secondary)}.g-upload-field>span{flex:1;overflow:hidden;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.g-upload-field label{position:relative}.g-upload-field input[type=file]{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}.g-form-footer{padding-top:12px;border-top:1px solid var(--g-border)}.g-form-footer>div{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}.g-local-disclaimer{display:flex;align-items:center;gap:5px;color:var(--g-muted);font-size:9px}.g-report-success{display:grid;justify-items:center;gap:9px;padding:40px 16px;text-align:center}.g-report-success>span{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--g-green-bg);color:var(--g-green)}.g-report-success h2{margin:0;font-size:15px}.g-report-success p{max-width:340px;color:var(--g-secondary);font-size:10px}.g-concept-banner{display:flex;align-items:center;gap:9px;margin:-3px 0 12px;padding:10px 12px;border:1px solid var(--g-border);border-radius:8px;background:var(--g-surface-muted);color:var(--g-brand)}.g-concept-banner>span{display:grid;flex:1;gap:3px}.g-concept-banner b{font-size:9px;color:var(--g-ink)}.g-concept-banner small{font-size:8px;color:var(--g-secondary)}.g-users-toolbar{border-bottom:0;padding-bottom:11px}.g-site-personnel-note{display:flex;align-items:center;gap:5px;margin:0 0 10px;color:var(--g-secondary);font-size:9px}.g-table-wrap{overflow:auto;border:1px solid var(--g-border);border-radius:8px}.g-table{width:100%;min-width:700px;border-collapse:collapse;text-align:left;font-size:9px}.g-table th{padding:10px 9px;background:var(--g-surface-muted);color:var(--g-muted);font-size:8px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}.g-table td{padding:10px 9px;border-top:1px solid var(--g-border);color:var(--g-secondary)}.g-table-user{display:flex;align-items:center;gap:8px;min-width:185px}.g-table-user>span:last-child{display:grid;gap:3px}.g-table-user b{color:var(--g-ink);font-size:9px}.g-table-user small{color:var(--g-muted);font-size:8px}.g-mobile-table-note{display:none;color:var(--g-muted);font-size:8px}.g-auth-page{position:relative;display:grid;place-items:center;min-height:690px;padding:30px;background:var(--g-bg)}.g-auth-brand{position:absolute;top:21px;left:23px;display:flex;align-items:center;gap:8px;color:var(--g-ink)}.g-auth-brand>span:last-child{display:grid;gap:2px}.g-auth-brand b{font-size:11px;letter-spacing:.12em}.g-auth-brand small{font-size:7px;color:var(--g-muted);letter-spacing:.12em}.g-auth-card{width:min(100%,400px);padding:25px;border:1px solid var(--g-border);border-radius:12px;background:var(--g-surface);box-shadow:var(--g-shadow)}.g-auth-card-top{display:flex;align-items:center;justify-content:space-between}.g-auth-controls{display:flex;align-items:center;gap:8px}.g-auth-heading{margin:17px 0 18px}.g-auth-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:9px;background:var(--g-brand-soft);color:var(--g-brand)}.g-auth-heading h1{margin:11px 0 5px;font-size:20px;letter-spacing:-.03em}.g-auth-heading p{margin:0;color:var(--g-secondary);font-size:10px;line-height:1.55}.g-auth-form{display:grid;gap:12px}.g-password-input{position:relative;display:block}.g-password-input input{padding-right:39px}.g-password-input button{position:absolute;top:3px;right:4px;display:grid;place-items:center;width:31px;height:30px;border:0;border-radius:5px;background:transparent;color:var(--g-muted)}.g-field-hint{color:var(--g-muted);font-size:8px;font-weight:400;line-height:1.45}.g-auth-options{display:flex;align-items:center;justify-content:space-between;gap:8px}.g-checkbox{display:flex;align-items:flex-start;gap:7px;color:var(--g-secondary);font-size:9px;font-weight:500;line-height:1.45}.g-checkbox input{width:14px;height:14px;flex:none;margin:0;accent-color:var(--g-brand)}.g-consent{margin-top:1px}.g-text-link{border:0;background:transparent;padding:3px;color:var(--g-brand);font-size:9px;font-weight:650;text-decoration:none}.g-auth-submit{width:100%;min-height:39px;margin-top:1px}.g-auth-submit svg{margin-left:auto}.g-auth-note{display:flex;align-items:center;gap:5px;margin:0;color:var(--g-muted);font-size:8px;line-height:1.5}.g-auth-switch{margin:17px 0 0;padding-top:12px;border-top:1px solid var(--g-border);color:var(--g-secondary);font-size:9px;text-align:center}.g-pending-state{display:grid;justify-items:center;gap:9px;padding:12px 0 3px;text-align:center}.g-pending-state>span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--g-amber-bg);color:var(--g-amber)}.g-pending-state h2{margin:0;font-size:15px}.g-pending-state>b{font-size:10px;color:var(--g-amber)}.g-pending-state p{margin:0 0 5px;color:var(--g-secondary);font-size:10px;line-height:1.55}.g-expired-state>span{background:var(--g-red-bg);color:var(--g-red)}.g-expired-preview{display:block;margin:10px auto 0}.g-auth-loading{display:flex;align-items:center;gap:7px;color:var(--g-secondary);font-size:9px}.g-auth-footer{position:absolute;right:20px;bottom:13px;left:20px;display:flex;align-items:center;justify-content:space-between;color:var(--g-muted);font-size:8px}.g-auth-footer button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--g-secondary);font-size:9px}.g-sidebar-scrim{display:none}.g-mobile-nav{display:none}.g-preview-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-top:1px solid var(--g-border);background:var(--g-surface-muted);color:var(--g-muted);font-size:8px}.g-preview-footer span{display:flex;align-items:center;gap:5px}.g-preview-footer svg{color:var(--g-brand)}.g-tutorial-layer,.g-dialog-layer{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:18px;background:#07140d80;backdrop-filter:blur(2px)}.g-tutorial-panel,.g-create-user-panel{position:relative;width:min(100%,440px);max-height:min(90vh,700px);overflow-y:auto;padding:21px;border:1px solid var(--g-border);border-radius:13px;background:var(--g-surface);color:var(--g-ink);box-shadow:0 15px 50px #0003}.g-dialog-close{position:absolute;top:14px;right:14px;display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:var(--g-secondary)}.g-tutorial-panel h2,.g-create-user-panel h2{margin:6px 35px 8px 0;font-size:18px;letter-spacing:-.03em}.g-tutorial-tip{margin-top:12px;padding:10px;border:1px solid var(--g-border);border-radius:8px;background:var(--g-surface-muted)}.g-tutorial-tip b,.g-tutorial-tip p,.g-tutorial-tip small{font-size:9px}.g-tutorial-tip p{margin:4px 0;color:var(--g-secondary)}.g-tutorial-tip small{color:var(--g-muted)}.g-tutorial-panel>p{color:var(--g-secondary);font-size:10px;line-height:1.55}.g-tutorial-panel>h3{margin:15px 0 5px;font-size:10px}.g-tutorial-panel ul{padding-left:17px;color:var(--g-secondary);font-size:10px;line-height:1.7}.g-tutorial-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--g-border)}.g-tutorial-actions label{display:flex;align-items:center;gap:6px;color:var(--g-secondary);font-size:9px}.g-tutorial-actions input{accent-color:var(--g-brand)}.g-create-user-panel>p{font-size:10px;color:var(--g-secondary)}.g-create-user-panel .g-form-grid{grid-template-columns:1fr}.g-create-user-panel .g-form-footer{justify-content:flex-end}.g-sr-only{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;clip-path:inset(50%)!important}
      .g-sidebar.is-collapsed .g-sidebar-brand{justify-content:center;padding:0}.g-sidebar.is-collapsed .g-sidebar-brand-text,.g-sidebar.is-collapsed .g-project-select-copy,.g-sidebar.is-collapsed .g-project-select>svg,.g-sidebar.is-collapsed .g-sidebar-label,.g-sidebar.is-collapsed .g-sidebar-nav button>span:not(.g-nav-count),.g-sidebar.is-collapsed .g-sidebar-footer button>span{display:none}.g-sidebar.is-collapsed .g-project-switch-wrap{padding:10px 9px}.g-sidebar.is-collapsed .g-project-select{justify-content:center;min-height:39px;padding:0}.g-sidebar.is-collapsed .g-sidebar-nav{padding:0 8px}.g-sidebar.is-collapsed .g-sidebar-nav button{justify-content:center;padding:0}.g-sidebar.is-collapsed .g-sidebar-footer button{min-height:32px}.global-review[data-preview-viewport=tablet] .g-sidebar{flex-basis:67px;width:67px}.global-review[data-preview-viewport=tablet] .g-sidebar-brand{justify-content:center;padding:0}.global-review[data-preview-viewport=tablet] .g-sidebar-brand-text,.global-review[data-preview-viewport=tablet] .g-project-select-copy,.global-review[data-preview-viewport=tablet] .g-project-select>svg,.global-review[data-preview-viewport=tablet] .g-sidebar-label,.global-review[data-preview-viewport=tablet] .g-sidebar-nav button>span:not(.g-nav-count),.global-review[data-preview-viewport=tablet] .g-sidebar-footer button>span{display:none}.global-review[data-preview-viewport=tablet] .g-project-switch-wrap{padding:10px 9px}.global-review[data-preview-viewport=tablet] .g-project-select{justify-content:center;min-height:39px;padding:0}.global-review[data-preview-viewport=tablet] .g-sidebar-nav{padding:0 8px}.global-review[data-preview-viewport=tablet] .g-sidebar-nav button{justify-content:center;padding:0}.global-review[data-preview-viewport=tablet] .g-sidebar-footer button{min-height:32px}.global-review[data-preview-viewport=tablet] .g-sidebar-footer button svg{width:15px}@container (max-width:960px){.g-profile-trigger-copy{display:none}}@container (max-width:790px){.g-sidebar{flex-basis:67px;width:67px}.g-sidebar-brand{justify-content:center;padding:0}.g-sidebar-brand-text,.g-project-select-copy,.g-project-select>svg,.g-sidebar-label,.g-sidebar-nav button>span:not(.g-nav-count),.g-sidebar-footer button>span{display:none}.g-project-switch-wrap{padding:10px 9px}.g-project-select{justify-content:center;min-height:39px;padding:0}.g-sidebar-nav{padding:0 8px}.g-sidebar-nav button{justify-content:center;padding:0}.g-sidebar-nav button .g-nav-count{position:absolute;top:1px;right:1px;padding:1px 4px;font-size:7px}.g-sidebar-footer button{min-height:32px}.g-sidebar-footer button svg{width:15px}.g-app-header{padding:0 13px}.g-header-project>button span{display:block;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g-header-project>button{min-width:33px;justify-content:center;padding:0 7px}.g-breadcrumb{display:none}.g-shell-content{padding:19px 16px}}
      @container (max-width:740px){.g-app-shell{height:calc(100vh - 180px);min-height:380px;overflow:hidden}.g-app-main{height:100%;min-height:0}.g-shell-content{min-height:0;flex:1;overflow-y:auto}.g-mobile-nav{position:relative;bottom:auto;flex:none}.g-sidebar{position:absolute;z-index:20;top:0;bottom:0;left:0;display:none;flex-basis:226px;width:226px;box-shadow:10px 0 28px #07140d38}.g-sidebar.is-mobile-open{display:flex}.g-sidebar.is-mobile-open .g-sidebar-brand{justify-content:flex-start;padding:0 17px}.g-sidebar.is-mobile-open .g-sidebar-brand-text,.g-sidebar.is-mobile-open .g-project-select-copy,.g-sidebar.is-mobile-open .g-project-select>svg,.g-sidebar.is-mobile-open .g-sidebar-label,.g-sidebar.is-mobile-open .g-sidebar-nav button>span:not(.g-nav-count),.g-sidebar.is-mobile-open .g-sidebar-footer button>span{display:block}.g-sidebar.is-mobile-open .g-project-select{justify-content:flex-start;padding:7px 8px}.g-sidebar.is-mobile-open .g-sidebar-nav button{justify-content:flex-start;padding:0 10px}.g-sidebar-scrim{position:absolute;z-index:19;inset:0;display:block;border:0;background:#06110ba3}.g-mobile-nav{position:sticky;z-index:15;bottom:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));height:55px;border-top:1px solid var(--g-border);background:var(--g-surface)}.g-mobile-nav button{display:grid;place-content:center;justify-items:center;gap:3px;border:0;background:transparent;color:var(--g-muted);font-size:8px}.g-mobile-nav button.active{color:var(--g-brand)}.g-mobile-nav button svg{width:17px;height:17px}.g-app-shell{position:relative;min-height:0}.g-app-main{min-height:0}.g-app-header{height:54px;padding:0 9px}.g-header-leading,.g-header-actions{gap:3px}.g-menu-trigger,.g-project-mobile{width:31px;height:32px}.g-header-actions .g-help-trigger>span,.g-profile-trigger-copy,.g-locale-control{display:none}.g-header-project>button span{display:block;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g-help-trigger{width:32px;min-width:32px;justify-content:center;padding:0}.g-header-actions .g-profile-trigger{width:37px;min-height:37px;justify-content:center}.g-header-actions .g-avatar{width:30px;height:30px}.g-notification-trigger{margin-right:1px}.g-header-actions .g-notification-trigger{width:32px;height:32px}.g-shell-content{padding:15px 12px 17px}.g-welcome-row h1{font-size:18px}.g-eyebrow{font-size:8px}.g-subtitle{font-size:10px}.g-weather{min-width:72px;padding:6px 7px}.g-project-banner{gap:8px;padding:10px}.g-project-copy b{font-size:10px}.g-banner-detail{display:none}.g-metrics{gap:6px}.g-metric-card{gap:7px;padding:9px 7px}.g-metric-icon{width:27px;height:27px}.g-metric-copy strong{font-size:13px}.g-metric-copy span{font-size:8px}.g-overview-grid,.g-support-grid{grid-template-columns:1fr}.g-view-heading{align-items:flex-start}.g-profile-head .g-status{margin-left:auto}.g-review-main{padding:11px 10px 18px}.g-experience-bar{display:block}.g-experience-bar>span{display:block;margin-bottom:6px}.g-experience-nav{max-width:100%;width:100%}.g-review-tools>span,.g-review-back{display:none}.g-review-top{min-height:49px;padding:0 11px}.g-review-brand{font-size:10px}.g-review-tools{gap:4px}.g-preview-modes button{padding:0 6px;font-size:9px}.g-review-tools>.g-theme-control{display:none}.g-report-form{padding:12px}.g-form-grid{gap:9px}.g-form-footer{align-items:flex-start;flex-direction:column}.g-form-footer>div{width:100%;justify-content:flex-end}.g-mobile-table-note{display:block}.g-auth-page{min-height:670px;padding:57px 13px 48px}.g-auth-brand{top:13px;left:13px}.g-auth-card{padding:18px}.g-auth-footer{right:13px;bottom:10px;left:13px}}
      @container (max-width:430px){.g-shell-content{padding:13px 10px 15px}.g-welcome-row{align-items:center}.g-welcome-row h1{font-size:16px}.g-welcome-row .g-subtitle{max-width:205px}.g-weather{min-width:66px}.g-project-copy em{display:none}.g-project-banner>.g-status{font-size:8px}.g-metrics{grid-template-columns:1fr}.g-metric-card{min-height:54px;padding:8px 10px}.g-metric-copy span{font-size:9px}.g-metric-copy small{margin-left:auto}.g-overview-grid{gap:9px}.g-card{padding:12px}.g-section-title h1{font-size:17px}.g-view-heading{display:block}.g-view-heading>.g-button{margin-top:9px}.g-notification-count{display:block;margin:0 0 11px}.g-notifications-controls,.g-users-toolbar{align-items:flex-start;flex-direction:column}.g-inline-actions{width:100%;justify-content:space-between}.g-notifications-controls .g-segmented{width:max-content}.g-profile-head{align-items:flex-start;flex-wrap:wrap}.g-profile-head>.g-status{margin-left:0}.g-form-grid{grid-template-columns:1fr}.g-field-wide{grid-column:auto}.g-preference-row{align-items:flex-start;flex-direction:column}.g-preference-row .g-theme-control{width:100%;justify-content:space-between}.g-card-actions{align-items:flex-start;flex-direction:column}.g-card-actions .g-button{width:100%}.g-support-hero{align-items:flex-start;flex-wrap:wrap}.g-support-hero>.g-button{width:100%}.g-form-footer>div{justify-content:stretch}.g-form-footer>div .g-button{flex:1;padding:0 6px;font-size:8px}.g-concept-banner{align-items:flex-start}.g-concept-banner .g-status{font-size:8px}.g-users-toolbar .g-segmented{width:100%}.g-users-toolbar .g-segmented button{flex:1;font-size:8px;padding:0 6px}.g-auth-card{padding:16px}.g-auth-footer>span{font-size:7px}.g-review-brand>span:last-child{max-width:155px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
      @media(prefers-color-scheme:dark){.global-review[data-theme=system]{--g-bg:#101713;--g-surface:#18211c;--g-surface-muted:#1c2721;--g-sidebar:#0d1410;--g-sidebar-border:#24342a;--g-sidebar-text:#d5ded8;--g-ink:#edf2ee;--g-secondary:#c0cbc3;--g-muted:#98a69c;--g-border:#2b3930;--g-border-strong:#3a4a3e;--g-brand:#38ad70;--g-brand-dark:#64c18a;--g-brand-soft:#203b2b;--g-green:#88d5a7;--g-green-bg:#1e3928;--g-blue:#a6c7f2;--g-blue-bg:#203149;--g-amber:#efd28a;--g-amber-bg:#3a301d;--g-red:#f1a29c;--g-red-bg:#422723;--g-shadow:0 2px 12px #0004}}@media(max-width:720px){.g-tutorial-layer,.g-dialog-layer{align-items:end;padding:0}.g-tutorial-panel,.g-create-user-panel{width:100%;max-height:88vh;border-radius:15px 15px 0 0;padding:19px 17px max(19px,env(safe-area-inset-bottom));}}
    `}</style>
    <header className="g-review-top"><Link href="/design-review" className="g-review-brand"><span className="g-brand-mark">H</span><span>HIIEKO · {translate('reviewTools')}</span></Link><div className="g-review-tools"><span>{translate('viewTitle')}</span><div className="g-preview-modes" role="group" aria-label={translate('previewMode')}><button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>{translate('desktop')}</button><button type="button" aria-pressed={viewport === 'tablet'} onClick={() => setViewport('tablet')}>{translate('tablet')}</button><button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>390px</button></div><ThemeControl theme={theme} setTheme={setTheme} t={translate} compact /><Link href="/design-review" className="g-review-back">{translate('backReview')}</Link></div></header>
    <main className="g-review-main"><div className="g-experience-bar"><span>{translate('switchView')}</span><nav className="g-experience-nav" aria-label={translate('switchView')}>{experienceViews.map(({ id, icon: Icon, label }) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setActiveView(id)}><Icon size={13} />{translate(label)}</button>)}</nav></div>
      <section className="g-preview-frame" aria-label={translate('accessibilityLabel')}><div className="g-app-shell">
        {view !== 'login' && view !== 'signup' && view !== 'forgot' && <>
          {mobileMenuOpen && <button className="g-sidebar-scrim" type="button" aria-label={translate('closeMenu')} onClick={() => setMobileMenuOpen(false)} />}
          <aside className={`g-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileMenuOpen ? 'is-mobile-open' : ''}`} aria-label={translate('workspace')}>
            <div className="g-sidebar-brand"><span className="g-brand-mark">H</span><span className="g-sidebar-brand-text"><b>HIIEKO</b><small>ROMANIA · EPC</small></span></div>
            <div className="g-project-switch-wrap"><button className="g-project-select" type="button" aria-expanded={projectMenuOpen} aria-label={translate('siteSelector')} onClick={() => setProjectMenuOpen((open) => !open)}><span className="g-project-dot" /><span className="g-project-select-copy"><small>{translate('project')}</small><b>{project.replace('Parc Solar ', '')}</b></span><ChevronDown size={14} /></button>{projectMenuOpen && <div className="g-project-dropdown" role="menu">{['Parc Solar Valea Mare', 'Centrala Fotovoltaică Sud', 'Solar Agri Pitești'].map((name) => <button type="button" role="menuitem" key={name} onClick={() => { setProject(name); setProjectMenuOpen(false); }}>{name}</button>)}</div>}</div>
            <p className="g-sidebar-label">{translate('workspace')}</p><nav className="g-sidebar-nav">{navItems.map(({ id, icon: Icon, label }, index) => <button key={id} type="button" className={view === 'overview' && activeShellPage === label ? 'active' : ''} onClick={() => { if (id === 'overview') setActiveView('overview'); else setActiveShellPage(label); setActiveView('overview'); setMobileMenuOpen(false); }} aria-current={view === 'overview' && activeShellPage === label ? 'page' : undefined} title={collapsed ? translate(label) : undefined}><Icon size={16} /><span>{translate(label)}</span>{index === 1 && <span className="g-nav-count">3</span>}</button>)}</nav>
            <div className="g-sidebar-footer"><button type="button" onClick={() => setActiveView('support')}><Headphones size={15} /><span>{translate('support')}</span></button><button type="button" onClick={() => setActiveView('report')}><AlertCircle size={15} /><span>{translate('report')}</span></button><button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? translate('expand') : translate('collapse')} title={collapsed ? translate('expand') : translate('collapse')}>{collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}<span>{collapsed ? translate('expand') : translate('collapse')}</span></button></div>
          </aside>
          <div className="g-app-main"><header className="g-app-header"><div className="g-header-leading"><button className="g-menu-trigger" type="button" onClick={() => { if (viewport === 'mobile') setMobileMenuOpen(true); else setCollapsed((value) => !value); }} aria-label={viewport === 'mobile' ? translate('openMenu') : collapsed ? translate('expand') : translate('collapse')}>{viewport === 'mobile' ? <Menu size={18} /> : collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button><div className="g-breadcrumb"><span>{translate('operations')}</span><ChevronRight size={13} /><b>{selectedTitle}</b></div><div className="g-header-project"><button type="button" aria-haspopup="menu" aria-expanded={projectMenuOpen} aria-label={`${translate('switchProject')}: ${project}`} onClick={() => setProjectMenuOpen((open) => !open)}><MapPin size={14} /><span>{project.replace('Parc Solar ', '')}</span><ChevronDown size={12} /></button>{projectMenuOpen && <div className="g-project-dropdown" role="menu">{['Parc Solar Valea Mare', 'Centrala Fotovoltaică Sud', 'Solar Agri Pitești'].map((name) => <button key={name} type="button" role="menuitem" onClick={() => { setProject(name); setProjectMenuOpen(false); }}>{name}</button>)}</div>}</div></div>
            <div className="g-header-actions"><div className="g-locale-control" role="group" aria-label={translate('language')}><button type="button" aria-pressed={locale === 'ro'} onClick={() => setLocale('ro')}>RO</button><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button></div><button className="g-help-trigger" type="button" onClick={() => { if (tutorialDismissed) setActiveView('support'); else setHelpOpen(true); }} aria-label={translate('help')}><CircleHelp size={15} /><span>{translate('help')}</span></button><button className="g-icon-button g-notification-trigger" type="button" onClick={() => setActiveView('notifications')} aria-label={`${translate('notifications')} · ${unreadCount} ${translate('notificationsUnread')}`}><Bell size={17} />{unreadCount > 0 && <span className="g-unread-count">{unreadCount}</span>}</button><div className="g-profile-wrap"><button className="g-profile-trigger" type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} aria-label={translate('accountMenu')} onClick={() => setProfileMenuOpen((open) => !open)}><Avatar /><span className="g-profile-trigger-copy"><b>{profileName}</b><small>{translate('manager')}</small></span><ChevronDown size={13} /></button>{profileMenuOpen && <div className="g-account-menu" role="menu"><div className="g-account-menu-head"><Avatar /><span><b>{profileName}</b><small>{translate('manager')} · {project.replace('Parc Solar ', '')}</small></span></div><button role="menuitem" type="button" onClick={() => setActiveView('profile')}><UserRound size={14} />{translate('viewProfile')}</button><button role="menuitem" type="button" onClick={() => setActiveView('profile')}><Settings size={14} />{translate('accountSettings')}</button><button role="menuitem" type="button" onClick={() => setActiveView('notifications')}><Bell size={14} />{translate('notifications')} {unreadCount > 0 && <span className="g-nav-count">{unreadCount}</span>}</button><button role="menuitem" type="button" onClick={() => setActiveView('support')}><Headphones size={14} />{translate('support')}</button>{tutorialDismissed && <button role="menuitem" type="button" onClick={() => { setTutorialDismissed(false); setHelpOpen(true); setProfileMenuOpen(false); }}><CircleHelp size={14} />{translate('showTutorialAgain')}</button>}<button role="menuitem" type="button" onClick={() => setActiveView('report')}><AlertCircle size={14} />{translate('report')}</button><p className="g-menu-setting-label">{translate('language')}</p><LanguageControl locale={locale} setLocale={setLocale} t={translate} /><p className="g-menu-setting-label">{translate('theme')}</p><ThemeControl theme={theme} setTheme={setTheme} t={translate} /><button role="menuitem" type="button" className="g-account-signout" onClick={() => setProfileMenuOpen(false)}><LogOut size={14} />{translate('signOut')}</button></div>}</div></div>
          </header>
          <main className="g-shell-content">{view === 'overview' ? renderOverview() : view === 'profile' ? renderProfile() : view === 'notifications' ? renderNotifications() : view === 'support' ? renderSupport() : view === 'report' ? renderReport() : view === 'users' ? renderUsers() : renderOverview()}</main>
          {viewport === 'mobile' && <nav className="g-mobile-nav" aria-label={translate('workspace')}><button type="button" className={view === 'overview' && activeShellPage === 'overview' ? 'active' : ''} onClick={() => { setActiveShellPage('overview'); setActiveView('overview'); }}><LayoutDashboard size={18} /><span>{translate('overview')}</span></button><button type="button" onClick={() => { setActiveShellPage('tasks'); setActiveView('overview'); }}><ListTodo size={18} /><span>{translate('tasks')}</span></button><button type="button" onClick={() => { setActiveShellPage('attendance'); setActiveView('overview'); }}><Clock3 size={18} /><span>{translate('attendance')}</span></button><button type="button" onClick={() => setMobileMenuOpen(true)}><MoreHorizontal size={18} /><span>{translate('menu')}</span></button></nav>}
          </div>
        </>}
        {(view === 'login' || view === 'signup' || view === 'forgot') && <div className="g-app-main">{renderAuth()}</div>}
      </div><footer className="g-preview-footer"><span><ShieldCheck size={12} />{translate('localNotice')}</span><span>{translate('pageDetails')}</span><span>v1.4.0</span></footer></section>
    </main>
    {(helpOpen || showCreateUser) && <div className="g-dialog-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) { setHelpOpen(false); setShowCreateUser(false); } }}><section className={helpOpen ? 'g-tutorial-panel' : 'g-create-user-panel'} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="g-dialog-title" tabIndex={-1}><button type="button" className="g-dialog-close" aria-label={translate('close')} onClick={() => { setHelpOpen(false); setShowCreateUser(false); }}><X size={17} /></button>{helpOpen ? <><p className="g-eyebrow">{translate('help')} · {translate('overview')}</p><h2 id="g-dialog-title">{translate('introduction')}</h2><p>{translate('tutorialActions')}</p><h3>{translate('whatFor')}</h3><p>{translate('overviewDescription')}</p><h3>{translate('whatCanDo')}</h3><ul><li>{translate('viewQueue')}</li><li>{translate('projectProgress')}</li><li>{translate('report')}</li></ul><div className="g-tutorial-tip"><b>{translate('manager')}</b><p>{translate('tutorialRole')}</p><small>{translate('firstUse')}</small></div><div className="g-tutorial-actions"><label><input type="checkbox" checked={tutorialDismissed} onChange={(event) => setTutorialDismissed(event.target.checked)} />{translate('dontShow')}</label><button type="button" className="g-button g-button-primary" onClick={() => setHelpOpen(false)}>{translate('dismiss')}</button></div></> : <><p className="g-eyebrow">{translate(sitePersonnelMode ? 'siteManagerConcept' : 'teamUsers')}</p><h2 id="g-dialog-title">{translate('createUser')}</h2><p>{translate(sitePersonnelMode ? 'addPersonnelRole' : 'userManagementIntro')}</p><form onSubmit={createUser}><div className="g-form-grid"><Field label={translate('fullName')}><input autoFocus required value={userDraft.name} onChange={(event) => setUserDraft((draft) => ({ ...draft, name: event.target.value }))} /></Field><Field label={translate('email')}><input required type="email" value={userDraft.email} onChange={(event) => setUserDraft((draft) => ({ ...draft, email: event.target.value }))} /></Field><Field label={translate('role')}><select value={userDraft.role} onChange={(event) => setUserDraft((draft) => ({ ...draft, role: event.target.value as CopyKey }))}><option value="usersRole3">{translate('usersRole3')}</option><option value="usersRole2">{translate('usersRole2')}</option><option value="usersRole1">{translate('usersRole1')}</option><option value="usersRole4">{translate('usersRole4')}</option></select></Field><Field label={translate('siteAssignment')}><select value={userDraft.project} onChange={(event) => setUserDraft((draft) => ({ ...draft, project: event.target.value }))}><option>Parc Solar Valea Mare</option><option>Centrala Fotovoltaică Sud</option><option>Solar Agri Pitești</option></select></Field><Field label={translate('status')}><select value={userDraft.status} onChange={(event) => setUserDraft((draft) => ({ ...draft, status: event.target.value }))}><option value="pending">{translate('pending')}</option><option value="active">{translate('active')}</option><option value="suspended">{translate('suspended')}</option></select></Field></div><div className="g-inline-alert"><ShieldCheck size={15} /><span>{translate('productionPermissions')}</span></div><div className="g-form-footer"><button type="button" className="g-button g-button-quiet" onClick={() => setShowCreateUser(false)}>{translate('cancel')}</button><button type="submit" className="g-button g-button-primary"><Send size={14} />{translate(sitePersonnelMode ? 'addSiteInvite' : 'inviteUser')}</button></div></form></>}</section></div>}
  </div>;
}


function ProjectOverviewData({ locale }: { locale: Locale }) {
  const ro = locale === 'ro';
  const workers = [
    ['AP', 'Andrei Popescu', ro ? 'Șef de echipă · Zona B-04' : 'Team Leader · Zone B-04', ro ? 'În teren' : 'On site'],
    ['RM', 'Radu Marin', ro ? 'Muncitor · cablare DC' : 'Worker · DC cabling', ro ? 'În lucru' : 'Working'],
    ['MI', 'Mara Ionescu', ro ? 'QA/QC · Zona B-04' : 'QA/QC · Zone B-04', ro ? 'Verificare' : 'Reviewing'],
    ['IS', 'Ioana Stan', ro ? 'Muncitor · structură B-05' : 'Worker · B-05 structures', ro ? 'Planificat' : 'Planned'],
  ];
  const tasks = [
    ['PV-1842', ro ? 'Montare structură B-04' : 'Install structure B-04', '62%', ro ? 'În lucru' : 'In progress'],
    ['PV-1851', ro ? 'Verificare aliniere șine' : 'Check rail alignment', '80%', ro ? 'În verificare' : 'In review'],
    ['PV-1860', ro ? 'Pregătire front B-05' : 'Prepare work front B-05', '35%', ro ? 'Blocat' : 'Blocked'],
  ];
  const documents = [
    ['DR-2026-104', ro ? 'Raport zilnic · 27 octombrie' : 'Daily report · October 27', ro ? 'În revizuire' : 'In review'],
    ['AVZ-2026-088', ro ? 'Aviz recepție cablu DC' : 'DC cable delivery note', ro ? 'Recepționat' : 'Received'],
    ['QA-VM-041', ro ? 'Fișă inspecție șuruburi B-04' : 'B-04 bolt inspection sheet', ro ? '2 constatări' : '2 findings'],
  ];
  const materials = [
    [ro ? 'Șină aluminiu 4.2 m' : '4.2 m aluminum rail', '120 m', '84 m', ro ? 'Necesar' : 'Needed'],
    [ro ? 'Șurub M10 inox' : 'M10 stainless bolt', '480 buc', '920 buc', ro ? 'Disponibil' : 'Available'],
    [ro ? 'Cablu solar 6 mm²' : '6 mm² solar cable', '840 m', '1,240 m', ro ? 'Disponibil' : 'Available'],
  ];
  return <section className="g-project-data-board">
    <div className="g-project-data-head"><div><p className="g-eyebrow">{ro ? 'DATE PROIECT · DEMONSTRATIVE' : 'PROJECT DATA · ILLUSTRATIVE'}</p><h2>{ro ? 'Proiect complet populat' : 'Fully populated project'}</h2><p>{ro ? 'Date locale pentru Design Review · fără API sau bază de date.' : 'Local Design Review data · no API or database.'}</p></div><span><ShieldCheck size={13} />{ro ? 'Doar preview' : 'Preview only'}</span></div>
    <div className="g-project-data-grid">
      <section className="g-card g-project-data-card"><div className="g-card-heading"><span><Users size={15} /><h2>{ro ? 'Echipă și muncitori' : 'Team & workers'}</h2></span><b>4</b></div><div className="g-project-worker-list">{workers.map(([initials,name,role,status]) => <article key={name}><Avatar initials={initials}/><div><b>{name}</b><small>{role}</small></div><StatusPill>{status}</StatusPill></article>)}</div></section>
      <section className="g-card g-project-data-card"><div className="g-card-heading"><span><ListTodo size={15} /><h2>{ro ? 'Task-uri' : 'Tasks'}</h2></span><b>12</b></div><div className="g-project-task-list">{tasks.map(([id,title,progress,status],index) => <article key={id}><div><small>{id}</small><b>{title}</b><span><i style={{width:progress}} /></span></div><StatusPill tone={index === 2 ? 'red' : index === 1 ? 'amber' : 'blue'}>{status}</StatusPill></article>)}</div></section>
      <section className="g-card g-project-data-card"><div className="g-card-heading"><span><FileText size={15} /><h2>{ro ? 'Documente' : 'Documents'}</h2></span><b>8</b></div><div className="g-project-document-list">{documents.map(([id,title,status]) => <article key={id}><span><FileText size={14} /></span><div><b>{id} · {title}</b><small>{status}</small></div></article>)}</div></section>
      <section className="g-card g-project-data-card"><div className="g-card-heading"><span><PackageCheck size={15} /><h2>{ro ? 'Materiale și stoc' : 'Materials & stock'}</h2></span><b>24</b></div><div className="g-project-material-list">{materials.map(([name,required,stock,status]) => <article key={name}><div><b>{name}</b><small>{ro ? 'Necesar' : 'Required'}: {required} · {ro ? 'Stoc' : 'Stock'}: {stock}</small></div><StatusPill tone={status === (ro ? 'Necesar' : 'Needed') ? 'amber' : 'green'}>{status}</StatusPill></article>)}</div></section>
      <section className="g-card g-project-data-card g-project-photo-card"><div className="g-card-heading"><span><Camera size={15} /><h2>{ro ? 'Fotografii de șantier' : 'Site photos'}</h2></span><b>3</b></div><div className="g-project-photo-grid">{[1,2,3].map((n) => <article key={n}><div><Camera size={19}/><span>{ro ? 'Loc pentru fotografie' : 'Photo area'}</span><small>0{n}</small></div><b>{ro ? ['Front B-04 · structură','Recepție materiale · depozit','Inspecție QA/QC · rând 12'][n-1] : ['Front B-04 · structure','Material receipt · stockyard','QA/QC inspection · row 12'][n-1]}</b></article>)}</div><button type="button" className="g-button g-button-quiet">{ro ? '+ Adaugă fotografie demonstrativă' : '+ Add illustrative photo'}</button></section>
    </div>
  </section>;
}

function MetricCard({ icon: Icon, value, label, note, tone = 'green' }: { icon: LucideIcon; value: string; label: string; note: string; tone?: 'green' | 'blue' | 'amber' }) {
  return <article className="g-metric-card"><span className={`g-metric-icon tone-${tone}`}><Icon size={16} /></span><span className="g-metric-copy"><strong>{value}</strong><span>{label}</span><small>{note}</small></span></article>;
}

function CardHeading({ icon: Icon, title, action, onClick }: { icon: LucideIcon; title: string; action?: string; onClick?: () => void }) {
  return <div className="g-card-heading"><span><Icon size={15} /><h2>{title}</h2></span>{action && <button type="button" onClick={onClick}>{action}<ArrowUpRight size={13} /></button>}</div>;
}

function ActivityRow({ icon: Icon, title, meta, tone }: { icon: LucideIcon; title: string; meta: string; tone: 'green' | 'blue' | 'amber' }) {
  return <article className="g-activity-row"><span className={`tone-${tone}`}><Icon size={14} /></span><div><b>{title}</b><small>{meta}</small></div></article>;
}

function LanguageControl({ locale, setLocale, t }: { locale: Locale; setLocale: (locale: Locale) => void; t: Translate }) {
  return <div className="g-locale-control" role="group" aria-label={t('language')}><button type="button" aria-pressed={locale === 'ro'} onClick={() => setLocale('ro')}>RO</button><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button></div>;
}

function ThemeControl({ theme, setTheme, t, compact = false }: { theme: Theme; setTheme: (theme: Theme) => void; t: Translate; compact?: boolean }) {
  const options: { id: Theme; label: CopyKey; icon: typeof Sun }[] = [{ id: 'light', label: 'light', icon: Sun }, { id: 'dark', label: 'dark', icon: Moon }, { id: 'system', label: 'system', icon: Monitor }];
  return <div className={`g-theme-control flex items-center gap-1 rounded-lg border border-[var(--g-border)] bg-[var(--g-surface-muted)] p-1 ${compact ? 'is-compact' : ''}`} role="group" aria-label={t('theme')}>{options.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={compact ? 'min-w-7 justify-center px-0' : ''} aria-pressed={theme === id} onClick={() => setTheme(id)} aria-label={t(label)} title={t(label)}>{compact ? <Icon size={14} /> : <><Icon size={13} /><span>{t(label)}</span></>}</button>)}</div>;
}
