import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuditController } from './modules/audit/audit.controller';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { TeamsModule } from './modules/teams/teams.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectStagesModule } from './modules/project-stages/project-stages.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TaskDependenciesModule } from './modules/task-dependencies/task-dependencies.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DailyPlansModule } from './modules/daily-plans/daily-plans.module';
import { DailyReportsModule } from './modules/daily-reports/daily-reports.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { QaQcModule } from './modules/qa-qc/qa-qc.module';
import { IssuesModule } from './modules/issues/issues.module';
import { ChangeOrdersModule } from './modules/change-orders/change-orders.module';
import { CostsModule } from './modules/costs/costs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ControlTowerModule } from './modules/control-tower/control-tower.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '.env.local'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    EmployeesModule,
    TeamsModule,
    ProjectsModule,
    ProjectStagesModule,
    TasksModule,
    TaskDependenciesModule,
    AttendanceModule,
    DailyPlansModule,
    DailyReportsModule,
    MaterialsModule,
    InventoryModule,
    WarehousesModule,
    ProcurementModule,
    SuppliersModule,
    DocumentsModule,
    OcrModule,
    ExpensesModule,
    QaQcModule,
    IssuesModule,
    ChangeOrdersModule,
    CostsModule,
    NotificationsModule,
    ControlTowerModule,
  ],
  controllers: [AuditController],
})
export class AppModule {}
