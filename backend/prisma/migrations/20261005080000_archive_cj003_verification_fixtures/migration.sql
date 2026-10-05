ALTER TABLE "tasks" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "tasks_project_id_is_archived_idx" ON "tasks"("project_id", "is_archived");

UPDATE "tasks"
SET "is_archived" = true
WHERE "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'CJ-003')
  AND "code" IN ('SMOKE-40926', 'PH2-VER-01', 'P3-GATE-T1', 'P3-GATE-T2');
