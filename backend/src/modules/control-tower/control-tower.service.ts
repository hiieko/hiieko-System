import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  ControlTowerOverviewDto,
  ProjectsMetrics,
  WorkforceMetrics,
  ProductionMetrics,
  MaterialsMetrics,
  FinanceMetrics,
  QualityMetrics,
  DocumentationMetrics,
  RedFlag,
  DrillDownParams,
  DrillDownResult,
  ActiveProjectSummary,
  DeadlineItem,
  OverdueProjectItem,
  ScheduledWorker,
  MissingWorker,
  OvertimeWorker,
  PlannedTaskItem,
  ActualTaskItem,
  BlockedTaskItem,
  LowStockItem,
  MissingRequiredItem,
  OverconsumptionItem,
  PendingDeliveryItem,
  ProjectFinanceItem,
  FailedInspectionItem,
  OpenNCRItem,
  PendingCorrectionItem,
  MissingDocumentItem,
  AwaitingApprovalItem,
  SupersededDocumentItem,
} from './interfaces/control-tower.interface';
import { TaskStatusEnum, NCRStatusEnum, ProjectStatusEnum } from '@prisma/client';

@Injectable()
export class ControlTowerService {
  private readonly logger = new Logger(ControlTowerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Aggregates the cross-functional Control Tower overview for an organization
   * Optionally filtered to a single project.
   */
  async getOverview(
    organizationId: string,
    projectId?: string,
  ): Promise<ControlTowerOverviewDto> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Fetch projects for the organization (or single project)
    const projects = await this.prisma.project.findMany({
      where: {
        ...(organizationId ? { organization_id: organizationId } : {}),
        ...(projectId ? { id: projectId } : {}),
        is_active: true,
      },
      include: {
        stages: true,
        tasks: true,
        members: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });

    const projectIds = projects.map((p) => p.id);

    // 1. PROJECTS METRICS
    const projectsMetrics = this.computeProjectsMetrics(projects, now);

    // 2. WORKFORCE METRICS
    const workforceMetrics = await this.computeWorkforceMetrics(
      projectIds,
      todayStr,
    );

    // 3. PRODUCTION METRICS
    const productionMetrics = await this.computeProductionMetrics(
      projectIds,
      todayStr,
    );

    // 4. MATERIALS METRICS
    const materialsMetrics = await this.computeMaterialsMetrics(projectIds);

    // 5. FINANCE METRICS
    const financeMetrics = await this.computeFinanceMetrics(
      projects,
      projectIds,
    );

    // 6. QUALITY METRICS
    const qualityMetrics = await this.computeQualityMetrics(projectIds);

    // 7. DOCUMENTATION METRICS
    const documentationMetrics = await this.computeDocumentationMetrics(
      projectIds,
    );

    // 8. RED FLAGS ENGINE (Rule-based exceptions with WHY, WHO, WHEN, SEVERITY)
    const redFlags = this.computeRedFlags({
      projects: projectsMetrics,
      workforce: workforceMetrics,
      production: productionMetrics,
      materials: materialsMetrics,
      finance: financeMetrics,
      quality: qualityMetrics,
      documentation: documentationMetrics,
    });

    return {
      projects: projectsMetrics,
      workforce: workforceMetrics,
      production: productionMetrics,
      materials: materialsMetrics,
      finance: financeMetrics,
      quality: qualityMetrics,
      documentation: documentationMetrics,
      redFlags,
    };
  }

  /**
   * Drill down into specific category items with pagination
   */
  async getDrillDown(
    organizationId: string,
    params: DrillDownParams,
  ): Promise<DrillDownResult<any>> {
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const offset = params.offset && params.offset >= 0 ? params.offset : 0;

    if (!params.category) {
      throw new BadRequestException('category query parameter is required');
    }

    const overview = await this.getOverview(organizationId, params.projectId);

    let allItems: any[] = [];

    switch (params.category.toUpperCase()) {
      case 'PROJECTS':
        allItems = [
          ...overview.projects.overdueProjectsList,
          ...overview.projects.upcomingDeadlinesList,
          ...overview.projects.activeProjectsList,
        ];
        break;
      case 'WORKFORCE':
        allItems = [
          ...overview.workforce.missingList,
          ...overview.workforce.overtimeList,
          ...overview.workforce.scheduledTodayList,
        ];
        break;
      case 'PRODUCTION':
        allItems = [
          ...overview.production.blockedTasksList,
          ...overview.production.plannedTasksList,
          ...overview.production.actualTasksList,
        ];
        break;
      case 'MATERIALS':
        allItems = [
          ...overview.materials.lowStockList,
          ...overview.materials.missingRequiredList,
          ...overview.materials.overconsumptionList,
          ...overview.materials.pendingDeliveriesList,
        ];
        break;
      case 'FINANCE':
        allItems = overview.finance.budgetByProject;
        break;
      case 'QUALITY':
        allItems = [
          ...overview.quality.openNCRsList,
          ...overview.quality.failedInspectionsList,
          ...overview.quality.pendingCorrectionsList,
        ];
        break;
      case 'DOCUMENTATION':
        allItems = [
          ...overview.documentation.missingDocumentsList,
          ...overview.documentation.awaitingApprovalList,
          ...overview.documentation.supersededDocumentsList,
        ];
        break;
      case 'RED_FLAGS':
        allItems = overview.redFlags;
        break;
      default:
        allItems = overview.redFlags;
    }

    const total = allItems.length;
    const items = allItems.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items,
      total,
      hasMore,
    };
  }

  /**
   * Direct red flags endpoint
   */
  async getRedFlags(
    organizationId: string,
    projectId?: string,
    severity?: string,
  ): Promise<RedFlag[]> {
    const overview = await this.getOverview(organizationId, projectId);
    let flags = overview.redFlags;

    if (severity) {
      flags = flags.filter(
        (f) => f.severity.toUpperCase() === severity.toUpperCase(),
      );
    }

    return flags;
  }

  // =========================================================================
  // DOMAIN COMPUTATION HELPERS
  // =========================================================================

  private computeProjectsMetrics(projects: any[], now: Date): ProjectsMetrics {
    const activeProjectsList: ActiveProjectSummary[] = [];
    const upcomingDeadlinesList: DeadlineItem[] = [];
    const overdueProjectsList: OverdueProjectItem[] = [];
    const projectsByStage: Record<string, number> = {};

    const fourteenDaysAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    for (const project of projects) {
      const stageName = project.status || 'PLANNING';
      projectsByStage[stageName] = (projectsByStage[stageName] || 0) + 1;

      // Calculate progress based on tasks completion if available
      const totalTasks = project.tasks ? project.tasks.length : 0;
      const completedTasks = project.tasks
        ? project.tasks.filter((t: any) => t.status === TaskStatusEnum.COMPLETED || t.status === TaskStatusEnum.VERIFIED).length
        : 0;
      const progressPercent =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const projectSummary: ActiveProjectSummary = {
        id: project.id,
        name: project.name,
        code: project.code,
        stage: stageName,
        targetEndDate: project.target_end_date
          ? project.target_end_date.toISOString()
          : null,
        budgetTotal: project.budget_total ? Number(project.budget_total) : null,
        currency: project.currency || 'RON',
        progressPercent,
      };
      activeProjectsList.push(projectSummary);

      // Responsible person (project PM/Manager if assigned)
      const pmMember = project.members?.find((m: any) => m.role === 'PM' || m.role === 'SITE_MANAGER');
      const responsiblePerson = pmMember?.user?.profile?.full_name
        ? pmMember.user.profile.full_name
        : 'Unassigned PM';

      if (project.target_end_date) {
        const endDate = new Date(project.target_end_date);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0 && project.status !== ProjectStatusEnum.COMPLETED && project.status !== ProjectStatusEnum.HANDOVER) {
          overdueProjectsList.push({
            id: `overdue-${project.id}`,
            projectId: project.id,
            projectName: project.name,
            projectCode: project.code,
            stage: stageName,
            targetEndDate: endDate.toISOString(),
            daysOverdue: Math.abs(diffDays),
            responsiblePerson,
          });
        } else if (diffDays >= 0 && diffDays <= 14) {
          upcomingDeadlinesList.push({
            id: `deadline-${project.id}`,
            projectId: project.id,
            projectName: project.name,
            projectCode: project.code,
            stage: stageName,
            targetDate: endDate.toISOString(),
            daysUntilDeadline: diffDays,
            responsiblePerson,
          });
        }
      }
    }

    return {
      activeProjects: activeProjectsList.length,
      projectsByStage,
      upcomingDeadlines: upcomingDeadlinesList.length,
      overdueProjects: overdueProjectsList.length,
      activeProjectsList,
      upcomingDeadlinesList,
      overdueProjectsList,
    };
  }

  private async computeWorkforceMetrics(
    projectIds: string[],
    todayStr: string,
  ): Promise<WorkforceMetrics> {
    if (projectIds.length === 0) {
      return {
        scheduledToday: 0,
        checkedIn: 0,
        missing: 0,
        overtimeMinutes: 0,
        scheduledTodayList: [],
        missingList: [],
        overtimeList: [],
      };
    }

    // Attendance records for today across accessible projects
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        project_id: { in: projectIds },
        date: new Date(todayStr),
      },
    });

    // Employees or project members scheduled/assigned
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        project_id: { in: projectIds },
      },
      include: {
        project: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    const checkedInUserIds = new Set(
      attendanceRecords
        .filter((r) => r.check_in_time !== null)
        .map((r) => r.user_id),
    );

    const scheduledTodayList: ScheduledWorker[] = [];
    const missingList: MissingWorker[] = [];
    const overtimeList: OvertimeWorker[] = [];

    let totalOvertimeMinutes = 0;

    for (const member of projectMembers) {
      const hasCheckedIn = checkedInUserIds.has(member.user_id);
      const record = attendanceRecords.find((r) => r.user_id === member.user_id);

      const fullName = member.user?.profile?.full_name || member.user_id;

      scheduledTodayList.push({
        id: member.id,
        userId: member.user_id,
        fullName: fullName || 'Team Member',
        projectId: member.project_id,
        projectName: member.project?.name || 'Unknown Project',
        projectCode: member.project?.code || '',
        role: member.role,
        checkInTime: record?.check_in_time
          ? record.check_in_time.toISOString()
          : null,
        isWithinGeofence: record?.is_within_geofence ?? null,
      });

      if (!hasCheckedIn) {
        missingList.push({
          userId: member.user_id,
          fullName: fullName || 'Team Member',
          projectId: member.project_id,
          projectName: member.project?.name || 'Unknown Project',
          projectCode: member.project?.code || '',
          role: member.role,
          expectedAt: '08:00',
          responsiblePerson: 'Site Manager',
        });
      }
    }

    for (const record of attendanceRecords) {
      if (record.overtime_minutes && record.overtime_minutes > 0) {
        totalOvertimeMinutes += record.overtime_minutes;

        const member = projectMembers.find((m) => m.user_id === record.user_id);
        const fullName = member?.user?.profile?.full_name || record.user_id;

        const hours = (record.overtime_minutes / 60).toFixed(1);

        overtimeList.push({
          userId: record.user_id,
          fullName: fullName || 'Worker',
          projectId: record.project_id,
          projectName: member?.project?.name || 'Project',
          projectCode: member?.project?.code || '',
          overtimeMinutes: record.overtime_minutes,
          overtimeHours: `${hours}h`,
        });
      }
    }

    return {
      scheduledToday: projectMembers.length,
      checkedIn: checkedInUserIds.size,
      missing: missingList.length,
      overtimeMinutes: totalOvertimeMinutes,
      scheduledTodayList,
      missingList,
      overtimeList,
    };
  }

  private async computeProductionMetrics(
    projectIds: string[],
    todayStr: string,
  ): Promise<ProductionMetrics> {
    if (projectIds.length === 0) {
      return {
        plannedToday: 0,
        actualToday: 0,
        completionPercentage: 0,
        blockedProduction: 0,
        plannedTasksList: [],
        actualTasksList: [],
        blockedTasksList: [],
      };
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        project_id: { in: projectIds },
      },
      include: {
        project: true,
        zone: true,
        assignments: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        prerequisites: {
          include: {
            predecessor: true,
          },
        },
      },
    });

    const plannedTasksList: PlannedTaskItem[] = [];
    const actualTasksList: ActualTaskItem[] = [];
    const blockedTasksList: BlockedTaskItem[] = [];

    let totalPlannedQty = 0;
    let totalActualQty = 0;

    for (const task of tasks) {
      const assignedWorkers = task.assignments.map((a) =>
        a.user?.profile?.full_name || a.user_id,
      );

      // Planned
      if (task.planned_quantity) {
        totalPlannedQty += Number(task.planned_quantity);
      }
      if (task.actual_quantity) {
        totalActualQty += Number(task.actual_quantity);
      }

      plannedTasksList.push({
        id: task.id,
        taskCode: task.code,
        title: task.title,
        projectId: task.project_id,
        projectName: task.project.name,
        projectCode: task.project.code,
        zoneName: task.zone?.name || null,
        plannedStart: task.planned_start
          ? task.planned_start.toISOString()
          : null,
        plannedEnd: task.planned_end ? task.planned_end.toISOString() : null,
        plannedQuantity: task.planned_quantity
          ? Number(task.planned_quantity)
          : null,
        unitOfMeasure: task.unit_of_measure,
        assignedWorkers,
      });

      // Actual
      if (
        task.status === TaskStatusEnum.IN_PROGRESS ||
        task.status === TaskStatusEnum.COMPLETED ||
        task.status === TaskStatusEnum.VERIFIED
      ) {
        const planned = task.planned_quantity ? Number(task.planned_quantity) : 1;
        const actual = task.actual_quantity ? Number(task.actual_quantity) : 0;
        const completionPercent =
          task.status === TaskStatusEnum.COMPLETED || task.status === TaskStatusEnum.VERIFIED
            ? 100
            : Math.min(100, Math.round((actual / planned) * 100));

        actualTasksList.push({
          id: task.id,
          taskCode: task.code,
          title: task.title,
          projectId: task.project_id,
          projectName: task.project.name,
          projectCode: task.project.code,
          actualStart: task.actual_start
            ? task.actual_start.toISOString()
            : null,
          actualEnd: task.actual_end ? task.actual_end.toISOString() : null,
          actualQuantity: task.actual_quantity
            ? Number(task.actual_quantity)
            : null,
          completionPercent,
          assignedWorkers,
        });
      }

      // Blocked
      if (task.status === TaskStatusEnum.BLOCKED) {
        const blockingTasks = task.prerequisites.map(
          (p) => `${p.predecessor.code} - ${p.predecessor.title}`,
        );

        blockedTasksList.push({
          id: task.id,
          taskCode: task.code,
          title: task.title,
          projectId: task.project_id,
          projectName: task.project.name,
          projectCode: task.project.code,
          zoneName: task.zone?.name || null,
          blockedReason: task.description || 'Blocked by prerequisites or field issue',
          blockingTasks,
          assignedWorkers,
          responsiblePerson: assignedWorkers[0] || 'Unassigned',
        });
      }
    }

    const completionPercentage =
      totalPlannedQty > 0
        ? Math.min(100, Math.round((totalActualQty / totalPlannedQty) * 100))
        : tasks.length > 0
          ? Math.round((actualTasksList.length / tasks.length) * 100)
          : 0;

    return {
      plannedToday: plannedTasksList.length,
      actualToday: actualTasksList.length,
      completionPercentage,
      blockedProduction: blockedTasksList.length,
      plannedTasksList,
      actualTasksList,
      blockedTasksList,
    };
  }

  private async computeMaterialsMetrics(
    projectIds: string[],
  ): Promise<MaterialsMetrics> {
    if (projectIds.length === 0) {
      return {
        lowStock: 0,
        missingRequired: 0,
        overconsumption: 0,
        pendingDeliveries: 0,
        lowStockList: [],
        missingRequiredList: [],
        overconsumptionList: [],
        pendingDeliveriesList: [],
      };
    }

    // Stock balances for project warehouses or site balances
    const stockBalances = await this.prisma.stockBalance.findMany({
      where: {
        OR: [
          { project_id: { in: projectIds } },
          { project_id: null }, // Central warehouses
        ],
      },
      include: {
        material: true,
        project: true,
        warehouse: true,
      },
    });

    const lowStockList: LowStockItem[] = [];

    for (const sb of stockBalances) {
      const current = Number(sb.current_quantity);
      const minThreshold = sb.material.min_stock_threshold
        ? Number(sb.material.min_stock_threshold)
        : 0;

      if (current < minThreshold) {
        lowStockList.push({
          materialId: sb.material_id,
          materialCode: sb.material.code,
          materialName: sb.material.name,
          unit: sb.material.unit,
          currentQuantity: current,
          minThreshold,
          projectId: sb.project_id,
          projectName: sb.project?.name || null,
          warehouseId: sb.warehouse_id,
          warehouseName: sb.warehouse?.name || null,
          deficit: minThreshold - current,
        });
      }
    }

    // Pending deliveries / Avize
    const pendingAvize = await this.prisma.aviz.findMany({
      where: {
        project_id: { in: projectIds },
      },
      include: {
        project: true,
        supplier: true,
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: { delivery_date: 'desc' },
      take: 15,
    });

    const pendingDeliveriesList: PendingDeliveryItem[] = pendingAvize.map((a) => ({
      id: a.id,
      avizNumber: a.aviz_number,
      supplierName: a.supplier?.name || 'Direct Supplier',
      deliveryDate: a.delivery_date.toISOString(),
      projectId: a.project_id,
      projectName: a.project.name,
      projectCode: a.project.code,
      status: 'DELIVERED',
      items: a.items.map((i) => ({
        materialId: i.material_id,
        materialCode: i.material.code,
        materialName: i.material.name,
        quantity: Number(i.quantity),
        unit: i.material.unit,
      })),
    }));

    // Mock/derived missing & overconsumption for operational metrics
    const missingRequiredList: MissingRequiredItem[] = [];
    const overconsumptionList: OverconsumptionItem[] = [];

    return {
      lowStock: lowStockList.length,
      missingRequired: missingRequiredList.length,
      overconsumption: overconsumptionList.length,
      pendingDeliveries: pendingDeliveriesList.length,
      lowStockList,
      missingRequiredList,
      overconsumptionList,
      pendingDeliveriesList,
    };
  }

  private async computeFinanceMetrics(
    projects: any[],
    projectIds: string[],
  ): Promise<FinanceMetrics> {
    if (projectIds.length === 0) {
      return {
        budget: 0,
        actual: 0,
        committed: 0,
        forecast: 0,
        variance: 0,
        variancePercent: 0,
        budgetByProject: [],
      };
    }

    // Cost entries
    const costEntries = await this.prisma.costEntry.findMany({
      where: { project_id: { in: projectIds } },
    });

    // Approved expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        project_id: { in: projectIds },
        status: 'APPROVED',
      },
    });

    let totalBudget = 0;
    let totalActual = 0;
    let totalCommitted = 0;

    const budgetByProject: ProjectFinanceItem[] = [];

    for (const project of projects) {
      const pBudget = project.budget_total ? Number(project.budget_total) : 0;
      totalBudget += pBudget;

      const pCostEntries = costEntries
        .filter((c) => c.project_id === project.id)
        .reduce((sum, c) => sum + Number(c.amount), 0);

      const pExpenses = expenses
        .filter((e) => e.project_id === project.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const pActual = pCostEntries + pExpenses;
      totalActual += pActual;

      const pCommitted = 0;
      totalCommitted += pCommitted;

      const pForecast = pActual + pCommitted;
      const pVariance = pBudget - pForecast;
      const pVariancePercent =
        pBudget > 0 ? Math.round((pVariance / pBudget) * 100) : 0;

      budgetByProject.push({
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        budget: pBudget,
        actual: pActual,
        committed: pCommitted,
        forecast: pForecast,
        variance: pVariance,
        variancePercent: pVariancePercent,
        currency: project.currency || 'RON',
      });
    }

    const totalForecast = totalActual + totalCommitted;
    const totalVariance = totalBudget - totalForecast;
    const totalVariancePercent =
      totalBudget > 0 ? Math.round((totalVariance / totalBudget) * 100) : 0;

    return {
      budget: totalBudget,
      actual: totalActual,
      committed: totalCommitted,
      forecast: totalForecast,
      variance: totalVariance,
      variancePercent: totalVariancePercent,
      budgetByProject,
    };
  }

  private async computeQualityMetrics(
    projectIds: string[],
  ): Promise<QualityMetrics> {
    if (projectIds.length === 0) {
      return {
        failedInspections: 0,
        openNCRs: 0,
        pendingCorrections: 0,
        failedInspectionsList: [],
        openNCRsList: [],
        pendingCorrectionsList: [],
      };
    }

    // Inspections
    const inspections = await this.prisma.inspection.findMany({
      where: {
        project_id: { in: projectIds },
      },
      include: {
        project: true,
        measurements: true,
      },
      orderBy: { inspected_at: 'desc' },
    });

    const failedInspectionsList: FailedInspectionItem[] = [];

    for (const insp of inspections) {
      const failedMeasurements = insp.measurements.filter((m) => !m.passed);
      if (insp.status === 'FAILED' || failedMeasurements.length > 0) {
        failedInspectionsList.push({
          id: insp.id,
          projectId: insp.project_id,
          projectName: insp.project.name,
          projectCode: insp.project.code,
          inspectorName: insp.inspector_name,
          inspectedAt: insp.inspected_at.toISOString(),
          failedParameters: failedMeasurements.map((m) => ({
            parameter: m.parameter,
            value: Number(m.value),
            unit: m.unit,
            passed: m.passed,
          })),
          responsiblePerson: insp.inspector_name,
        });
      }
    }

    // NCRs
    const ncrs = await this.prisma.nCR.findMany({
      where: {
        inspection: {
          project_id: { in: projectIds },
        },
      },
      include: {
        inspection: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const openNCRsList: OpenNCRItem[] = [];
    const pendingCorrectionsList: PendingCorrectionItem[] = [];

    for (const ncr of ncrs) {
      const project = ncr.inspection?.project;
      const projectName = project?.name || 'Project';
      const projectCode = project?.code || '';
      const projectId = project?.id || '';

      if (ncr.status === NCRStatusEnum.OPEN) {
        openNCRsList.push({
          id: ncr.id,
          ncrNumber: ncr.ncr_number,
          projectId,
          projectName,
          projectCode,
          description: ncr.description,
          status: ncr.status,
          createdAt: ncr.created_at.toISOString(),
          responsiblePerson: 'QA/QC Lead',
        });
      } else if (
        ncr.status === NCRStatusEnum.DISPOSITION_PROPOSED ||
        ncr.status === NCRStatusEnum.UNDER_REVIEW
      ) {
        pendingCorrectionsList.push({
          id: ncr.id,
          ncrNumber: ncr.ncr_number,
          projectId,
          projectName,
          projectCode,
          description: ncr.description,
          proposedCorrection: 'Disposition under evaluation',
          status: ncr.status,
          responsiblePerson: 'QA/QC Lead',
          dueDate: null,
        });
      }
    }

    return {
      failedInspections: failedInspectionsList.length,
      openNCRs: openNCRsList.length,
      pendingCorrections: pendingCorrectionsList.length,
      failedInspectionsList,
      openNCRsList,
      pendingCorrectionsList,
    };
  }

  private async computeDocumentationMetrics(
    projectIds: string[],
  ): Promise<DocumentationMetrics> {
    if (projectIds.length === 0) {
      return {
        missingDocuments: 0,
        awaitingApproval: 0,
        supersededDocuments: 0,
        missingDocumentsList: [],
        awaitingApprovalList: [],
        supersededDocumentsList: [],
      };
    }

    const documents = await this.prisma.document.findMany({
      where: {
        project_id: { in: projectIds },
      },
      include: {
        project: true,
        versions: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    const awaitingApprovalList: AwaitingApprovalItem[] = [];
    const supersededDocumentsList: SupersededDocumentItem[] = [];
    const missingDocumentsList: MissingDocumentItem[] = [];

    for (const doc of documents) {
      const latestVersionNum = doc.versions.reduce(
        (max, v) => (v.version > max ? v.version : max),
        doc.current_version,
      );

      if (latestVersionNum > doc.current_version) {
        supersededDocumentsList.push({
          id: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          projectId: doc.project_id,
          projectName: doc.project?.name || null,
          projectCode: doc.project?.code || null,
          currentVersion: doc.current_version,
          latestVersion: latestVersionNum,
          supersededAt: doc.updated_at.toISOString(),
          responsiblePerson: 'Document Controller',
        });
      }
    }

    return {
      missingDocuments: missingDocumentsList.length,
      awaitingApproval: awaitingApprovalList.length,
      supersededDocuments: supersededDocumentsList.length,
      missingDocumentsList,
      awaitingApprovalList,
      supersededDocumentsList,
    };
  }

  // =========================================================================
  // CROSS-FUNCTIONAL RED FLAGS RULE ENGINE
  // =========================================================================

  private computeRedFlags(data: {
    projects: ProjectsMetrics;
    workforce: WorkforceMetrics;
    production: ProductionMetrics;
    materials: MaterialsMetrics;
    finance: FinanceMetrics;
    quality: QualityMetrics;
    documentation: DocumentationMetrics;
  }): RedFlag[] {
    const redFlags: RedFlag[] = [];
    const nowIso = new Date().toISOString();

    // 1. Projects: Overdue projects (CRITICAL / HIGH)
    for (const overdue of data.projects.overdueProjectsList) {
      redFlags.push({
        id: `rf-proj-${overdue.projectId}`,
        category: 'PROJECTS',
        affectedEntity: overdue.projectName,
        entityId: overdue.projectId,
        reason: `Project overdue by ${overdue.daysOverdue} days (target was ${overdue.targetEndDate.split('T')[0]})`,
        responsiblePerson: overdue.responsiblePerson,
        responsiblePersonId: null,
        timestamp: nowIso,
        sourceRecord: 'Project',
        sourceRecordId: overdue.projectId,
        severity: overdue.daysOverdue > 14 ? 'CRITICAL' : 'HIGH',
      });
    }

    // 2. Workforce: Missing workers > 15% of scheduled (HIGH)
    if (data.workforce.scheduledToday > 0) {
      const missingRate = data.workforce.missing / data.workforce.scheduledToday;
      if (missingRate >= 0.15) {
        for (const worker of data.workforce.missingList.slice(0, 5)) {
          redFlags.push({
            id: `rf-wf-${worker.userId}`,
            category: 'WORKFORCE',
            affectedEntity: worker.fullName,
            entityId: worker.userId,
            reason: `Missing at scheduled project ${worker.projectName} (${worker.role})`,
            responsiblePerson: worker.responsiblePerson,
            responsiblePersonId: null,
            timestamp: nowIso,
            sourceRecord: 'AttendanceRecord',
            sourceRecordId: worker.userId,
            severity: 'HIGH',
          });
        }
      }
    }

    // 3. Production: Blocked tasks (HIGH)
    for (const blocked of data.production.blockedTasksList) {
      redFlags.push({
        id: `rf-prod-${blocked.id}`,
        category: 'PRODUCTION',
        affectedEntity: `${blocked.taskCode}: ${blocked.title}`,
        entityId: blocked.id,
        reason: `Blocked task in ${blocked.projectName}: ${blocked.blockedReason}`,
        responsiblePerson: blocked.responsiblePerson,
        responsiblePersonId: null,
        timestamp: nowIso,
        sourceRecord: 'Task',
        sourceRecordId: blocked.id,
        severity: 'HIGH',
      });
    }

    // 4. Materials: Low stock (HIGH / MEDIUM)
    for (const low of data.materials.lowStockList) {
      redFlags.push({
        id: `rf-mat-${low.materialId}`,
        category: 'MATERIALS',
        affectedEntity: `${low.materialCode} - ${low.materialName}`,
        entityId: low.materialId,
        reason: `Current quantity (${low.currentQuantity} ${low.unit}) is below minimum threshold (${low.minThreshold} ${low.unit}). Deficit: ${low.deficit}`,
        responsiblePerson: 'Warehouse Manager',
        responsiblePersonId: null,
        timestamp: nowIso,
        sourceRecord: 'StockBalance',
        sourceRecordId: low.materialId,
        severity: low.currentQuantity === 0 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 5. Finance: Budget deficit / cost overrun (HIGH)
    for (const fItem of data.finance.budgetByProject) {
      if (fItem.variance < 0) {
        redFlags.push({
          id: `rf-fin-${fItem.projectId}`,
          category: 'FINANCE',
          affectedEntity: fItem.projectName,
          entityId: fItem.projectId,
          reason: `Budget overrun: forecast (${fItem.forecast} ${fItem.currency}) exceeds budget (${fItem.budget} ${fItem.currency}) by ${Math.abs(fItem.variance)} ${fItem.currency}`,
          responsiblePerson: 'Finance Director / PM',
          responsiblePersonId: null,
          timestamp: nowIso,
          sourceRecord: 'ProjectFinance',
          sourceRecordId: fItem.projectId,
          severity: 'HIGH',
        });
      }
    }

    // 6. Quality: Open NCRs (CRITICAL / HIGH)
    for (const ncr of data.quality.openNCRsList) {
      redFlags.push({
        id: `rf-ncr-${ncr.id}`,
        category: 'QUALITY',
        affectedEntity: `NCR ${ncr.ncrNumber}`,
        entityId: ncr.id,
        reason: `Open non-conformance in ${ncr.projectName}: ${ncr.description}`,
        responsiblePerson: ncr.responsiblePerson,
        responsiblePersonId: null,
        timestamp: ncr.createdAt,
        sourceRecord: 'NCR',
        sourceRecordId: ncr.id,
        severity: 'CRITICAL',
      });
    }

    // 7. Quality: Failed inspections (HIGH)
    for (const failed of data.quality.failedInspectionsList) {
      redFlags.push({
        id: `rf-insp-${failed.id}`,
        category: 'QUALITY',
        affectedEntity: `Inspection in ${failed.projectName}`,
        entityId: failed.id,
        reason: `Failed inspection by ${failed.inspectorName}. Failed parameters: ${failed.failedParameters.map((p) => p.parameter).join(', ')}`,
        responsiblePerson: failed.responsiblePerson,
        responsiblePersonId: null,
        timestamp: failed.inspectedAt,
        sourceRecord: 'Inspection',
        sourceRecordId: failed.id,
        severity: 'HIGH',
      });
    }

    // 8. Documentation: Superseded documents still in use (MEDIUM)
    for (const doc of data.documentation.supersededDocumentsList) {
      redFlags.push({
        id: `rf-doc-${doc.id}`,
        category: 'DOCUMENTATION',
        affectedEntity: doc.title,
        entityId: doc.id,
        reason: `Document is on version ${doc.currentVersion} while version ${doc.latestVersion} exists`,
        responsiblePerson: doc.responsiblePerson,
        responsiblePersonId: null,
        timestamp: doc.supersededAt,
        sourceRecord: 'Document',
        sourceRecordId: doc.id,
        severity: 'MEDIUM',
      });
    }

    return redFlags;
  }
}
