-- Add logical document folders and versioned project-folder templates.
-- Existing documents and projects remain unfiled/untyped; no data is backfilled.
-- Folder changes never alter document binaries, storage paths, versions or attachments.
-- This migration follows 20261103090000_add_document_lifecycle because its document index uses is_archived.
-- Template rows are intentionally not seeded; the reviewed catalog must be published separately.

CREATE TYPE "ProjectTypeEnum" AS ENUM (
    'RESIDENTIAL_SOLAR',
    'COMMERCIAL_SOLAR',
    'INDUSTRIAL_SOLAR',
    'OTHER_CUSTOM'
);

CREATE TYPE "ProjectRequirementStateEnum" AS ENUM (
    'NOT_ASSESSED',
    'APPLICABLE',
    'NOT_APPLICABLE'
);

CREATE TYPE "ProjectFolderTemplateKindEnum" AS ENUM (
    'COMMON_CORE',
    'PROJECT_TYPE_EXTENSION'
);

CREATE TYPE "ProjectFolderRequirementEnum" AS ENUM (
    'REQUIRED',
    'CONDITIONAL',
    'OPTIONAL'
);

CREATE TYPE "ProjectFolderProtectionPolicyEnum" AS ENUM (
    'STANDARD',
    'NO_DELETE',
    'IMMUTABLE'
);

ALTER TABLE "projects" ADD COLUMN "project_type" "ProjectTypeEnum";
ALTER TABLE "projects" ADD COLUMN "requirement_catalog_version_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "requirement_catalog_adoption_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "folder_id" TEXT;

CREATE TABLE "document_folders" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "parent_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT,
    "created_by" TEXT,
    "template_folder_key" VARCHAR(120),
    "source_template_version_id" TEXT,
    "protection_policy" "ProjectFolderProtectionPolicyEnum" NOT NULL DEFAULT 'STANDARD',
    "allow_custom_children" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirements" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "state" "ProjectRequirementStateEnum" NOT NULL DEFAULT 'NOT_ASSESSED',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirement_catalogs" (
    "id" TEXT NOT NULL,
    "catalog_key" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_version_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_requirement_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirement_catalog_versions" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "created_by" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_requirement_catalog_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirement_definitions" (
    "id" TEXT NOT NULL,
    "catalog_version_id" TEXT NOT NULL,
    "requirement_key" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "project_requirement_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirement_applicability" (
    "definition_id" TEXT NOT NULL,
    "project_type" "ProjectTypeEnum" NOT NULL,
    CONSTRAINT "project_requirement_applicability_pkey" PRIMARY KEY ("definition_id", "project_type")
);

CREATE TABLE "project_requirement_assessments" (
    "id" TEXT NOT NULL,
    "project_requirement_id" TEXT NOT NULL,
    "previous_state" "ProjectRequirementStateEnum",
    "new_state" "ProjectRequirementStateEnum" NOT NULL,
    "assessed_by" TEXT,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_requirement_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirement_catalog_adoptions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_catalog_version_id" TEXT,
    "to_catalog_version_id" TEXT NOT NULL,
    "previous_project_type" "ProjectTypeEnum",
    "new_project_type" "ProjectTypeEnum" NOT NULL,
    "reviewed_by" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_requirement_catalog_adoptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_folder_templates" (
    "id" TEXT NOT NULL,
    "template_key" VARCHAR(100) NOT NULL,
    "kind" "ProjectFolderTemplateKindEnum" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_version_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_folder_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_folder_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "requirement_catalog_version_id" TEXT NOT NULL,
    "created_by" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_folder_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_folder_template_version_applicability" (
    "template_version_id" TEXT NOT NULL,
    "project_type" "ProjectTypeEnum" NOT NULL,

    CONSTRAINT "project_folder_template_version_applicability_pkey" PRIMARY KEY ("template_version_id", "project_type")
);

CREATE TABLE "project_folder_template_folders" (
    "id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "folder_key" VARCHAR(120) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "parent_folder_key" VARCHAR(120),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "requirement" "ProjectFolderRequirementEnum" NOT NULL DEFAULT 'OPTIONAL',
    "condition_definition_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "protection_policy" "ProjectFolderProtectionPolicyEnum" NOT NULL DEFAULT 'STANDARD',
    "allow_custom_children" BOOLEAN NOT NULL DEFAULT false,
    "create_by_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_folder_template_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_folder_template_folder_applicability" (
    "folder_definition_id" TEXT NOT NULL,
    "project_type" "ProjectTypeEnum" NOT NULL,

    CONSTRAINT "project_folder_template_folder_applicability_pkey" PRIMARY KEY ("folder_definition_id", "project_type")
);

CREATE TABLE "project_folder_template_version_conflicts" (
    "template_version_id" TEXT NOT NULL,
    "incompatible_template_version_id" TEXT NOT NULL,

    CONSTRAINT "project_folder_template_version_conflicts_pkey" PRIMARY KEY ("template_version_id", "incompatible_template_version_id")
);

CREATE TABLE "project_folder_template_assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "component_kind" "ProjectFolderTemplateKindEnum" NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),
    "applied_by" TEXT,

    CONSTRAINT "project_folder_template_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_project_type_idx" ON "projects"("project_type");
CREATE INDEX "projects_requirement_catalog_version_id_idx"
    ON "projects"("requirement_catalog_version_id");
CREATE UNIQUE INDEX "projects_requirement_catalog_adoption_id_key"
    ON "projects"("requirement_catalog_adoption_id");
CREATE INDEX "document_folders_organization_id_project_id_parent_id_name_idx"
    ON "document_folders"("organization_id", "project_id", "parent_id", "name");
CREATE INDEX "document_folders_organization_id_parent_id_idx"
    ON "document_folders"("organization_id", "parent_id");
CREATE INDEX "document_folders_source_template_version_id_idx"
    ON "document_folders"("source_template_version_id");
CREATE UNIQUE INDEX "document_folders_company_template_key_uq"
    ON "document_folders"("organization_id", "template_folder_key")
    WHERE "project_id" IS NULL AND "template_folder_key" IS NOT NULL;
CREATE UNIQUE INDEX "document_folders_project_template_key_uq"
    ON "document_folders"("organization_id", "project_id", "template_folder_key")
    WHERE "project_id" IS NOT NULL AND "template_folder_key" IS NOT NULL;
CREATE UNIQUE INDEX "document_folders_company_root_name_ci_uq"
    ON "document_folders"("organization_id", lower(btrim("name")))
    WHERE "project_id" IS NULL AND "parent_id" IS NULL;
CREATE UNIQUE INDEX "document_folders_company_child_name_ci_uq"
    ON "document_folders"("organization_id", "parent_id", lower(btrim("name")))
    WHERE "project_id" IS NULL AND "parent_id" IS NOT NULL;
CREATE UNIQUE INDEX "document_folders_project_root_name_ci_uq"
    ON "document_folders"("organization_id", "project_id", lower(btrim("name")))
    WHERE "project_id" IS NOT NULL AND "parent_id" IS NULL;
CREATE UNIQUE INDEX "document_folders_project_child_name_ci_uq"
    ON "document_folders"("organization_id", "project_id", "parent_id", lower(btrim("name")))
    WHERE "project_id" IS NOT NULL AND "parent_id" IS NOT NULL;
CREATE INDEX "documents_folder_id_is_archived_updated_at_idx"
    ON "documents"("folder_id", "is_archived", "updated_at");
CREATE INDEX "documents_organization_id_folder_id_is_archived_updated_at_idx"
    ON "documents"("organization_id", "folder_id", "is_archived", "updated_at");
CREATE UNIQUE INDEX "project_folder_templates_template_key_key"
    ON "project_folder_templates"("template_key");
CREATE UNIQUE INDEX "project_folder_templates_id_published_version_id_key"
    ON "project_folder_templates"("id", "published_version_id");
CREATE UNIQUE INDEX "project_requirement_catalogs_catalog_key_key"
    ON "project_requirement_catalogs"("catalog_key");
CREATE UNIQUE INDEX "project_requirement_catalogs_id_published_version_id_key"
    ON "project_requirement_catalogs"("id", "published_version_id");
CREATE INDEX "project_requirement_catalog_versions_catalog_id_published_a_idx"
    ON "project_requirement_catalog_versions"("catalog_id", "published_at");
CREATE UNIQUE INDEX "project_requirement_catalog_versions_catalog_id_version_key"
    ON "project_requirement_catalog_versions"("catalog_id", "version");
CREATE UNIQUE INDEX "project_requirement_catalog_versions_catalog_id_id_key"
    ON "project_requirement_catalog_versions"("catalog_id", "id");
CREATE INDEX "project_requirement_definitions_catalog_version_id_is_activ_idx"
    ON "project_requirement_definitions"("catalog_version_id", "is_active");
CREATE UNIQUE INDEX "project_requirement_definitions_catalog_version_id_requirem_key"
    ON "project_requirement_definitions"("catalog_version_id", "requirement_key");
CREATE INDEX "project_folder_templates_kind_is_active_idx"
    ON "project_folder_templates"("kind", "is_active");
CREATE INDEX "project_folder_template_versions_template_id_published_at_idx"
    ON "project_folder_template_versions"("template_id", "published_at");
CREATE INDEX "project_folder_template_versions_requirement_catalog_versio_idx"
    ON "project_folder_template_versions"("requirement_catalog_version_id");
CREATE UNIQUE INDEX "project_folder_template_versions_template_id_version_key"
    ON "project_folder_template_versions"("template_id", "version");
CREATE UNIQUE INDEX "project_folder_template_versions_template_id_id_key"
    ON "project_folder_template_versions"("template_id", "id");
CREATE INDEX "project_folder_template_folders_template_version_id_parent__idx"
    ON "project_folder_template_folders"("template_version_id", "parent_folder_key", "sort_order");
CREATE UNIQUE INDEX "project_folder_template_folders_template_version_id_folder__key"
    ON "project_folder_template_folders"("template_version_id", "folder_key");
CREATE INDEX "project_folder_template_folders_condition_definition_id_idx"
    ON "project_folder_template_folders"("condition_definition_id");
CREATE INDEX "project_folder_template_folder_applicability_project_type_idx"
    ON "project_folder_template_folder_applicability"("project_type");
CREATE INDEX "project_folder_template_version_conflicts_incompatible_temp_idx"
    ON "project_folder_template_version_conflicts"("incompatible_template_version_id");
CREATE INDEX "project_folder_template_assignments_project_id_component_ki_idx"
    ON "project_folder_template_assignments"("project_id", "component_kind");
CREATE INDEX "project_folder_template_assignments_project_id_superseded_a_idx"
    ON "project_folder_template_assignments"("project_id", "superseded_at");
CREATE INDEX "project_folder_template_assignments_project_id_template_id__idx"
    ON "project_folder_template_assignments"("project_id", "template_id", "superseded_at");
CREATE UNIQUE INDEX "project_folder_template_assignments_current_template_uq"
    ON "project_folder_template_assignments"("project_id", "template_id")
    WHERE "superseded_at" IS NULL;
CREATE UNIQUE INDEX "project_folder_template_assignments_one_core_per_project_idx"
    ON "project_folder_template_assignments"("project_id")
    WHERE "component_kind" = 'COMMON_CORE' AND "superseded_at" IS NULL;

ALTER TABLE "document_folders"
    ADD CONSTRAINT "document_folders_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_folders"
    ADD CONSTRAINT "document_folders_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_folders"
    ADD CONSTRAINT "document_folders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_folders"
    ADD CONSTRAINT "document_folders_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "document_folders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_folders"
    ADD CONSTRAINT "document_folders_source_template_version_id_fkey"
    FOREIGN KEY ("source_template_version_id") REFERENCES "project_folder_template_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents"
    ADD CONSTRAINT "documents_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents"
    ADD CONSTRAINT "documents_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_requirements"
    ADD CONSTRAINT "project_requirements_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements"
    ADD CONSTRAINT "project_requirements_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirements"
    ADD CONSTRAINT "project_requirements_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "project_requirement_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_applicability"
    ADD CONSTRAINT "project_requirement_applicability_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "project_requirement_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirement_assessments"
    ADD CONSTRAINT "project_requirement_assessments_project_requirement_id_fkey"
    FOREIGN KEY ("project_requirement_id") REFERENCES "project_requirements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirement_assessments"
    ADD CONSTRAINT "project_requirement_assessments_assessed_by_fkey"
    FOREIGN KEY ("assessed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "project_requirements_project_id_definition_id_key"
    ON "project_requirements"("project_id", "definition_id");
CREATE INDEX "project_requirements_project_id_state_idx"
    ON "project_requirements"("project_id", "state");
CREATE INDEX "project_requirement_assessments_project_requirement_id_crea_idx"
    ON "project_requirement_assessments"("project_requirement_id", "created_at");
CREATE INDEX "project_requirement_catalog_adoptions_project_id_created_at_idx"
    ON "project_requirement_catalog_adoptions"("project_id", "created_at");
CREATE INDEX "project_requirement_applicability_project_type_idx"
    ON "project_requirement_applicability"("project_type");

ALTER TABLE "project_requirement_catalogs"
    ADD CONSTRAINT "project_requirement_catalogs_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_versions"
    ADD CONSTRAINT "project_requirement_catalog_versions_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "project_requirement_catalogs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_versions"
    ADD CONSTRAINT "project_requirement_catalog_versions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_versions"
    ADD CONSTRAINT "project_requirement_catalog_versions_published_by_fkey"
    FOREIGN KEY ("published_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalogs"
    ADD CONSTRAINT "project_requirement_catalogs_id_published_version_id_fkey"
    FOREIGN KEY ("id", "published_version_id")
    REFERENCES "project_requirement_catalog_versions"("catalog_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_definitions"
    ADD CONSTRAINT "project_requirement_definitions_catalog_version_id_fkey"
    FOREIGN KEY ("catalog_version_id") REFERENCES "project_requirement_catalog_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_requirement_catalog_version_id_fkey"
    FOREIGN KEY ("requirement_catalog_version_id") REFERENCES "project_requirement_catalog_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_requirement_catalog_adoption_id_fkey"
    FOREIGN KEY ("requirement_catalog_adoption_id") REFERENCES "project_requirement_catalog_adoptions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_adoptions"
    ADD CONSTRAINT "project_requirement_catalog_adoptions_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_adoptions"
    ADD CONSTRAINT "project_requirement_catalog_adoptions_from_catalog_version_fkey"
    FOREIGN KEY ("from_catalog_version_id") REFERENCES "project_requirement_catalog_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_adoptions"
    ADD CONSTRAINT "project_requirement_catalog_adoptions_to_catalog_version_i_fkey"
    FOREIGN KEY ("to_catalog_version_id") REFERENCES "project_requirement_catalog_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_requirement_catalog_adoptions"
    ADD CONSTRAINT "project_requirement_catalog_adoptions_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "guard_published_project_requirement_catalog_pointer"() RETURNS trigger AS $$
DECLARE
    version_catalog_id TEXT;
    version_published_at TIMESTAMP(3);
    old_version_number INTEGER;
    new_version_number INTEGER;
BEGIN
    IF NEW."published_version_id" IS NULL THEN
        IF TG_OP = 'UPDATE' AND OLD."published_version_id" IS NOT NULL THEN
            RAISE EXCEPTION 'A published requirement catalog cannot be unpublished; deactivate it instead'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    SELECT "catalog_id", "published_at"
    INTO version_catalog_id, version_published_at
    FROM "project_requirement_catalog_versions"
    WHERE "id" = NEW."published_version_id";
    IF NOT FOUND
       OR version_catalog_id IS DISTINCT FROM NEW."id"
       OR version_published_at IS NULL THEN
        RAISE EXCEPTION 'Current requirement catalog version must be published and belong to this catalog'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."published_version_id" IS NOT NULL
       AND NEW."published_version_id" IS DISTINCT FROM OLD."published_version_id" THEN
        SELECT "version" INTO old_version_number
        FROM "project_requirement_catalog_versions" WHERE "id" = OLD."published_version_id";
        SELECT "version" INTO new_version_number
        FROM "project_requirement_catalog_versions" WHERE "id" = NEW."published_version_id";
        IF new_version_number <= old_version_number THEN
            RAISE EXCEPTION 'Publishing must advance to a newer requirement catalog version'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_catalogs_published_pointer_insert_guard"
    BEFORE INSERT ON "project_requirement_catalogs"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_requirement_catalog_pointer"();
CREATE TRIGGER "project_requirement_catalogs_published_pointer_update_guard"
    BEFORE UPDATE OF "published_version_id" ON "project_requirement_catalogs"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_requirement_catalog_pointer"();

CREATE FUNCTION "guard_published_project_requirement_catalog_version"() RETURNS trigger AS $$
BEGIN
    IF OLD."published_at" IS NOT NULL THEN
        RAISE EXCEPTION 'Published requirement catalog versions are immutable; create a new draft version'
            USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_catalog_versions_immutable"
    BEFORE UPDATE OR DELETE ON "project_requirement_catalog_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_requirement_catalog_version"();

CREATE FUNCTION "guard_project_requirement_catalog_identity"() RETURNS trigger AS $$
BEGIN
    IF (OLD."catalog_id" IS DISTINCT FROM NEW."catalog_id"
        OR OLD."version" IS DISTINCT FROM NEW."version") THEN
        RAISE EXCEPTION 'Requirement catalog version identity is stable after creation'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_catalog_versions_identity_guard"
    BEFORE UPDATE OF "catalog_id", "version" ON "project_requirement_catalog_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_catalog_identity"();

CREATE FUNCTION "guard_project_requirement_catalog_key"() RETURNS trigger AS $$
BEGIN
    IF OLD."catalog_key" IS DISTINCT FROM NEW."catalog_key"
       AND EXISTS (
           SELECT 1 FROM "project_requirement_catalog_versions"
           WHERE "catalog_id" = OLD."id"
       ) THEN
        RAISE EXCEPTION 'Requirement catalog key is stable after a version is created'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_catalogs_key_guard"
    BEFORE UPDATE OF "catalog_key" ON "project_requirement_catalogs"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_catalog_key"();

CREATE FUNCTION "guard_published_project_requirement_catalog_child"() RETURNS trigger AS $$
DECLARE
    definition_id TEXT;
    catalog_version_id TEXT;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        IF TG_TABLE_NAME = 'project_requirement_applicability' THEN
            definition_id := to_jsonb(OLD)->>'definition_id';
            SELECT "catalog_version_id" INTO catalog_version_id
            FROM "project_requirement_definitions" WHERE "id" = definition_id;
        ELSE
            catalog_version_id := to_jsonb(OLD)->>'catalog_version_id';
        END IF;
        IF catalog_version_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM "project_requirement_catalog_versions"
            WHERE "id" = catalog_version_id AND "published_at" IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Published requirement catalog definitions are immutable; create a new draft version'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        IF TG_TABLE_NAME = 'project_requirement_applicability' THEN
            definition_id := to_jsonb(NEW)->>'definition_id';
            SELECT "catalog_version_id" INTO catalog_version_id
            FROM "project_requirement_definitions" WHERE "id" = definition_id;
        ELSE
            catalog_version_id := to_jsonb(NEW)->>'catalog_version_id';
        END IF;
        IF catalog_version_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM "project_requirement_catalog_versions"
            WHERE "id" = catalog_version_id AND "published_at" IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Published requirement catalog definitions are immutable; create a new draft version'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_definitions_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_requirement_definitions"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_requirement_catalog_child"();
CREATE TRIGGER "project_requirement_applicability_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_requirement_applicability"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_requirement_catalog_child"();

CREATE FUNCTION "guard_project_requirement_catalog_adoption"() RETURNS trigger AS $$
DECLARE
    current_catalog_version_id TEXT;
    current_project_type "ProjectTypeEnum";
    target_catalog_id TEXT;
    target_catalog_key TEXT;
    target_published_version_id TEXT;
    target_published_at TIMESTAMP(3);
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Requirement catalog adoption history is append-only'
            USING ERRCODE = '23514';
    END IF;
    IF btrim(NEW."reason") = '' OR NEW."new_project_type" IS NULL THEN
        RAISE EXCEPTION 'Catalog adoption requires a project type and a non-empty review reason'
            USING ERRCODE = '23514';
    END IF;

    SELECT "requirement_catalog_version_id", "project_type"
    INTO current_catalog_version_id, current_project_type
    FROM "projects" WHERE "id" = NEW."project_id"
    FOR UPDATE;
    IF NOT FOUND
       OR current_catalog_version_id IS DISTINCT FROM NEW."from_catalog_version_id"
       OR current_project_type IS DISTINCT FROM NEW."previous_project_type" THEN
        RAISE EXCEPTION 'Catalog adoption must record the project current catalog and type as its source'
            USING ERRCODE = '23514';
    END IF;

    SELECT version."catalog_id", catalog."catalog_key", catalog."published_version_id", version."published_at"
    INTO target_catalog_id, target_catalog_key, target_published_version_id, target_published_at
    FROM "project_requirement_catalog_versions" AS version
    JOIN "project_requirement_catalogs" AS catalog ON catalog."id" = version."catalog_id"
    WHERE version."id" = NEW."to_catalog_version_id" AND catalog."is_active"
    FOR SHARE OF catalog;
    IF NOT FOUND OR target_catalog_key IS DISTINCT FROM 'PROJECT_REQUIREMENTS'
       OR target_published_at IS NULL
       OR target_published_version_id IS DISTINCT FROM NEW."to_catalog_version_id" THEN
        RAISE EXCEPTION 'Adoption target must be the latest published version of an active catalog'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_catalog_adoptions_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_requirement_catalog_adoptions"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_catalog_adoption"();

CREATE FUNCTION "assert_requirement_catalog_adoption_applied"() RETURNS trigger AS $$
DECLARE
    project_catalog_version_id TEXT;
    project_type_value "ProjectTypeEnum";
    project_adoption_id TEXT;
BEGIN
    SELECT "requirement_catalog_version_id", "project_type", "requirement_catalog_adoption_id"
    INTO project_catalog_version_id, project_type_value, project_adoption_id
    FROM "projects" WHERE "id" = NEW."project_id";
    IF NOT FOUND
       OR project_catalog_version_id IS DISTINCT FROM NEW."to_catalog_version_id"
       OR project_type_value IS DISTINCT FROM NEW."new_project_type"
       OR project_adoption_id IS DISTINCT FROM NEW."id" THEN
        RAISE EXCEPTION 'A reviewed catalog adoption and its project pin must commit atomically'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "project_requirement_catalog_adoptions_must_be_applied"
    AFTER INSERT ON "project_requirement_catalog_adoptions"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_requirement_catalog_adoption_applied"();

CREATE FUNCTION "guard_project_requirement_catalog_pin"() RETURNS trigger AS $$
DECLARE
    catalog_id TEXT;
    published_version_id TEXT;
    version_published_at TIMESTAMP(3);
    catalog_active BOOLEAN;
    adoption_project_id TEXT;
    adoption_from_catalog_version_id TEXT;
    adoption_to_catalog_version_id TEXT;
    adoption_previous_project_type "ProjectTypeEnum";
    adoption_new_project_type "ProjectTypeEnum";
    catalog_key_value VARCHAR(100);
BEGIN
    IF TG_OP = 'INSERT' AND NEW."requirement_catalog_adoption_id" IS NOT NULL THEN
        RAISE EXCEPTION 'New projects initialize from the current catalog; adoption records are for existing projects'
            USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD."project_type" IS NOT NULL AND NEW."project_type" IS NULL THEN
        RAISE EXCEPTION 'An initialized project type cannot be silently cleared'
            USING ERRCODE = '23514';
    END IF;
    IF NEW."project_type" IS NULL THEN
        IF NEW."requirement_catalog_version_id" IS NOT NULL THEN
            RAISE EXCEPTION 'A requirement catalog cannot be pinned without a project type'
                USING ERRCODE = '23514';
        END IF;
        IF NEW."requirement_catalog_adoption_id" IS NOT NULL THEN
            RAISE EXCEPTION 'An untyped project cannot reference a requirement catalog adoption'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW."requirement_catalog_version_id" IS NULL THEN
        RAISE EXCEPTION 'Typed projects must pin a published requirement catalog version'
            USING ERRCODE = '23514';
    END IF;

    SELECT version."catalog_id", catalog."published_version_id", version."published_at", catalog."is_active", catalog."catalog_key"
    INTO catalog_id, published_version_id, version_published_at, catalog_active, catalog_key_value
    FROM "project_requirement_catalog_versions" AS version
    JOIN "project_requirement_catalogs" AS catalog ON catalog."id" = version."catalog_id"
    WHERE version."id" = NEW."requirement_catalog_version_id"
    FOR SHARE OF catalog;
    IF NOT FOUND OR NOT catalog_active OR catalog_key_value IS DISTINCT FROM 'PROJECT_REQUIREMENTS'
       OR version_published_at IS NULL
       OR published_version_id IS DISTINCT FROM NEW."requirement_catalog_version_id" THEN
        RAISE EXCEPTION 'Projects must pin the latest published requirement catalog version'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (OLD."project_type" IS DISTINCT FROM NEW."project_type"
            OR OLD."requirement_catalog_version_id" IS DISTINCT FROM NEW."requirement_catalog_version_id"
            OR OLD."requirement_catalog_adoption_id" IS DISTINCT FROM NEW."requirement_catalog_adoption_id") THEN
        IF NEW."requirement_catalog_adoption_id" IS NULL
           OR NEW."requirement_catalog_adoption_id" IS NOT DISTINCT FROM OLD."requirement_catalog_adoption_id" THEN
            RAISE EXCEPTION 'Changing a project type or pinned catalog requires a new reviewed adoption record'
                USING ERRCODE = '23514';
        END IF;
        SELECT "project_id", "from_catalog_version_id", "to_catalog_version_id",
               "previous_project_type", "new_project_type"
        INTO adoption_project_id, adoption_from_catalog_version_id, adoption_to_catalog_version_id,
             adoption_previous_project_type, adoption_new_project_type
        FROM "project_requirement_catalog_adoptions"
        WHERE "id" = NEW."requirement_catalog_adoption_id";
        IF NOT FOUND
           OR adoption_project_id IS DISTINCT FROM NEW."id"
           OR adoption_from_catalog_version_id IS DISTINCT FROM OLD."requirement_catalog_version_id"
           OR adoption_to_catalog_version_id IS DISTINCT FROM NEW."requirement_catalog_version_id"
           OR adoption_previous_project_type IS DISTINCT FROM OLD."project_type"
           OR adoption_new_project_type IS DISTINCT FROM NEW."project_type" THEN
            RAISE EXCEPTION 'Project catalog/type changes must match their reviewed adoption record'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "projects_requirement_catalog_pin_insert_guard"
    BEFORE INSERT ON "projects"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_catalog_pin"();
CREATE TRIGGER "projects_requirement_catalog_pin_update_guard"
    BEFORE UPDATE OF "project_type", "requirement_catalog_version_id", "requirement_catalog_adoption_id" ON "projects"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_catalog_pin"();

CREATE FUNCTION "guard_project_requirement_definition_scope"() RETURNS trigger AS $$
DECLARE
    project_catalog_version_id TEXT;
    definition_catalog_version_id TEXT;
    project_type_value "ProjectTypeEnum";
BEGIN
    IF TG_OP = 'UPDATE'
       AND (OLD."project_id" IS DISTINCT FROM NEW."project_id"
            OR OLD."definition_id" IS DISTINCT FROM NEW."definition_id") THEN
        RAISE EXCEPTION 'Requirement identity is immutable; retain historical decisions and add a new catalog requirement'
            USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' THEN
        SELECT "requirement_catalog_version_id", "project_type"
        INTO project_catalog_version_id, project_type_value
        FROM "projects" WHERE "id" = NEW."project_id"
        FOR SHARE;
        SELECT "catalog_version_id" INTO definition_catalog_version_id
        FROM "project_requirement_definitions" WHERE "id" = NEW."definition_id";
        IF project_type_value IS NULL
           OR project_catalog_version_id IS DISTINCT FROM definition_catalog_version_id
           OR NOT EXISTS (
               SELECT 1 FROM "project_requirement_applicability"
               WHERE "definition_id" = NEW."definition_id"
                 AND "project_type" = project_type_value
           ) THEN
            RAISE EXCEPTION 'New project requirements must use the project pinned catalog version'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirements_definition_scope_guard"
    BEFORE INSERT OR UPDATE ON "project_requirements"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_requirement_definition_scope"();

CREATE FUNCTION "prevent_project_requirement_delete"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Project requirement history is retained; create a new catalog version instead of deleting a requirement'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirements_retained"
    BEFORE DELETE ON "project_requirements"
    FOR EACH ROW EXECUTE FUNCTION "prevent_project_requirement_delete"();

CREATE FUNCTION "prevent_project_requirement_assessment_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Requirement assessment history is append-only'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_requirement_assessments_append_only"
    BEFORE UPDATE OR DELETE ON "project_requirement_assessments"
    FOR EACH ROW EXECUTE FUNCTION "prevent_project_requirement_assessment_mutation"();

ALTER TABLE "project_folder_templates"
    ADD CONSTRAINT "project_folder_templates_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_folder_templates"
    ADD CONSTRAINT "project_folder_templates_id_published_version_id_fkey"
    FOREIGN KEY ("id", "published_version_id")
    REFERENCES "project_folder_template_versions"("template_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_versions"
    ADD CONSTRAINT "project_folder_template_versions_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "project_folder_templates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_versions"
    ADD CONSTRAINT "project_folder_template_versions_requirement_catalog_versi_fkey"
    FOREIGN KEY ("requirement_catalog_version_id") REFERENCES "project_requirement_catalog_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_versions"
    ADD CONSTRAINT "project_folder_template_versions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_versions"
    ADD CONSTRAINT "project_folder_template_versions_published_by_fkey"
    FOREIGN KEY ("published_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "guard_template_requirement_catalog_version"() RETURNS trigger AS $$
DECLARE
    catalog_key_value VARCHAR(100);
    version_published_at TIMESTAMP(3);
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW."requirement_catalog_version_id" IS NOT DISTINCT FROM OLD."requirement_catalog_version_id" THEN
        RETURN NEW;
    END IF;
    SELECT catalog."catalog_key", version."published_at"
    INTO catalog_key_value, version_published_at
    FROM "project_requirement_catalog_versions" AS version
    JOIN "project_requirement_catalogs" AS catalog ON catalog."id" = version."catalog_id"
    WHERE version."id" = NEW."requirement_catalog_version_id";
    IF NOT FOUND OR catalog_key_value IS DISTINCT FROM 'PROJECT_REQUIREMENTS'
       OR version_published_at IS NULL THEN
        RAISE EXCEPTION 'Template versions must pin an immutable published project requirement catalog version'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_versions_catalog_insert_guard"
    BEFORE INSERT ON "project_folder_template_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_template_requirement_catalog_version"();
CREATE TRIGGER "project_folder_template_versions_catalog_update_guard"
    BEFORE UPDATE OF "requirement_catalog_version_id" ON "project_folder_template_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_template_requirement_catalog_version"();

ALTER TABLE "project_folder_template_version_applicability"
    ADD CONSTRAINT "project_folder_template_version_applicability_template_ver_fkey"
    FOREIGN KEY ("template_version_id") REFERENCES "project_folder_template_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_folders"
    ADD CONSTRAINT "project_folder_template_folders_template_version_id_fkey"
    FOREIGN KEY ("template_version_id") REFERENCES "project_folder_template_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_folder_applicability"
    ADD CONSTRAINT "project_folder_template_folder_applicability_folder_defini_fkey"
    FOREIGN KEY ("folder_definition_id") REFERENCES "project_folder_template_folders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_folders"
    ADD CONSTRAINT "project_folder_template_folders_condition_definition_id_fkey"
    FOREIGN KEY ("condition_definition_id") REFERENCES "project_requirement_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_version_conflicts"
    ADD CONSTRAINT "project_folder_template_version_conflicts_template_version_fkey"
    FOREIGN KEY ("template_version_id") REFERENCES "project_folder_template_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_version_conflicts"
    ADD CONSTRAINT "project_folder_template_version_conflicts_incompatible_tem_fkey"
    FOREIGN KEY ("incompatible_template_version_id") REFERENCES "project_folder_template_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_assignments"
    ADD CONSTRAINT "project_folder_template_assignments_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_assignments"
    ADD CONSTRAINT "project_folder_template_assignments_applied_by_fkey"
    FOREIGN KEY ("applied_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_folder_template_assignments"
    ADD CONSTRAINT "project_folder_template_assignments_template_id_template_v_fkey"
    FOREIGN KEY ("template_id", "template_version")
    REFERENCES "project_folder_template_versions"("template_id", "version")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "guard_published_project_folder_template_pointer"() RETURNS trigger AS $$
DECLARE
    version_template_id TEXT;
    version_published_at TIMESTAMP(3);
    new_version_number INTEGER;
    current_version_number INTEGER;
BEGIN
    IF NEW."published_version_id" IS NULL THEN
        IF TG_OP = 'UPDATE' AND OLD."published_version_id" IS NOT NULL THEN
            RAISE EXCEPTION 'A published template cannot be unpublished; deactivate it instead'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    SELECT "template_id", "published_at"
    INTO version_template_id, version_published_at
    FROM "project_folder_template_versions"
    WHERE "id" = NEW."published_version_id";
    IF NOT FOUND
       OR version_template_id IS DISTINCT FROM NEW."id"
       OR version_published_at IS NULL THEN
        RAISE EXCEPTION 'Current template version must be published and belong to this template'
            USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD."published_version_id" IS NOT NULL
       AND NEW."published_version_id" IS DISTINCT FROM OLD."published_version_id" THEN
        SELECT "version" INTO current_version_number
        FROM "project_folder_template_versions"
        WHERE "id" = OLD."published_version_id";
        SELECT "version" INTO new_version_number
        FROM "project_folder_template_versions"
        WHERE "id" = NEW."published_version_id";
        IF new_version_number <= current_version_number THEN
            RAISE EXCEPTION 'Publishing must advance to a newer template version'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_templates_published_pointer_insert_guard"
    BEFORE INSERT ON "project_folder_templates"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_pointer"();
CREATE TRIGGER "project_folder_templates_published_pointer_update_guard"
    BEFORE UPDATE OF "published_version_id" ON "project_folder_templates"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_pointer"();

CREATE FUNCTION "guard_project_folder_template_identity"() RETURNS trigger AS $$
BEGIN
    IF (OLD."template_key" IS DISTINCT FROM NEW."template_key"
        OR OLD."kind" IS DISTINCT FROM NEW."kind")
       AND EXISTS (
           SELECT 1 FROM "project_folder_template_versions"
           WHERE "template_id" = OLD."id"
       ) THEN
        RAISE EXCEPTION 'Template key and kind are stable after a version is created'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_templates_identity_guard"
    BEFORE UPDATE OF "template_key", "kind" ON "project_folder_templates"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_folder_template_identity"();

CREATE FUNCTION "guard_published_project_folder_template_version"() RETURNS trigger AS $$
BEGIN
    IF OLD."published_at" IS NOT NULL THEN
        RAISE EXCEPTION 'Published template versions are immutable; create a new draft version'
            USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_versions_immutable"
    BEFORE UPDATE OR DELETE ON "project_folder_template_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_version"();

CREATE FUNCTION "guard_project_folder_template_version_identity"() RETURNS trigger AS $$
BEGIN
    IF OLD."template_id" IS DISTINCT FROM NEW."template_id"
       OR OLD."version" IS DISTINCT FROM NEW."version" THEN
        RAISE EXCEPTION 'Folder template version identity is stable after creation'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_versions_identity_guard"
    BEFORE UPDATE OF "template_id", "version" ON "project_folder_template_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_folder_template_version_identity"();

CREATE FUNCTION "guard_published_project_folder_template_child"() RETURNS trigger AS $$
DECLARE
    version_ids TEXT[] := ARRAY[]::TEXT[];
    version_id TEXT;
    folder_definition_id TEXT;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        IF TG_TABLE_NAME = 'project_folder_template_folder_applicability' THEN
            folder_definition_id := to_jsonb(OLD)->>'folder_definition_id';
            SELECT "template_version_id" INTO version_id
            FROM "project_folder_template_folders" WHERE "id" = folder_definition_id;
        ELSE
            version_id := to_jsonb(OLD)->>'template_version_id';
        END IF;
        version_ids := array_append(version_ids, version_id);
    END IF;

    IF TG_OP <> 'DELETE' THEN
        IF TG_TABLE_NAME = 'project_folder_template_folder_applicability' THEN
            folder_definition_id := to_jsonb(NEW)->>'folder_definition_id';
            SELECT "template_version_id" INTO version_id
            FROM "project_folder_template_folders" WHERE "id" = folder_definition_id;
        ELSE
            version_id := to_jsonb(NEW)->>'template_version_id';
        END IF;
        version_ids := array_append(version_ids, version_id);
    END IF;

    FOREACH version_id IN ARRAY version_ids LOOP
        IF version_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM "project_folder_template_versions"
            WHERE "id" = version_id AND "published_at" IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Published template contents are immutable; create a new draft version'
                USING ERRCODE = '23514';
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_folders_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_folder_template_folders"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_child"();
CREATE TRIGGER "project_folder_template_version_applicability_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_folder_template_version_applicability"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_child"();
CREATE TRIGGER "project_folder_template_folder_applicability_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_folder_template_folder_applicability"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_child"();
CREATE TRIGGER "project_folder_template_version_conflicts_immutable"
    BEFORE INSERT OR UPDATE OR DELETE ON "project_folder_template_version_conflicts"
    FOR EACH ROW EXECUTE FUNCTION "guard_published_project_folder_template_child"();

CREATE FUNCTION "guard_template_folder_requirement_catalog_scope"() RETURNS trigger AS $$
DECLARE
    template_catalog_version_id TEXT;
    definition_catalog_version_id TEXT;
BEGIN
    IF NEW."requirement" = 'CONDITIONAL' AND NEW."condition_definition_id" IS NULL THEN
        RAISE EXCEPTION 'Conditional template folders must reference a requirement definition'
            USING ERRCODE = '23514';
    END IF;
    IF NEW."requirement" <> 'CONDITIONAL' AND NEW."condition_definition_id" IS NOT NULL THEN
        RAISE EXCEPTION 'Only conditional template folders may reference a requirement definition'
            USING ERRCODE = '23514';
    END IF;
    IF NEW."condition_definition_id" IS NOT NULL THEN
        SELECT "requirement_catalog_version_id" INTO template_catalog_version_id
        FROM "project_folder_template_versions" WHERE "id" = NEW."template_version_id";
        SELECT "catalog_version_id" INTO definition_catalog_version_id
        FROM "project_requirement_definitions" WHERE "id" = NEW."condition_definition_id";
        IF template_catalog_version_id IS DISTINCT FROM definition_catalog_version_id THEN
            RAISE EXCEPTION 'Conditional folders must reference a requirement from the template pinned catalog version'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_folder_requirement_catalog_guard"
    BEFORE INSERT OR UPDATE ON "project_folder_template_folders"
    FOR EACH ROW EXECUTE FUNCTION "guard_template_folder_requirement_catalog_scope"();

CREATE FUNCTION "guard_project_folder_template_version_catalog_change"() RETURNS trigger AS $$
BEGIN
    IF NEW."requirement_catalog_version_id" IS DISTINCT FROM OLD."requirement_catalog_version_id"
       AND EXISTS (
           SELECT 1 FROM "project_folder_template_folders"
           WHERE "template_version_id" = OLD."id" AND "condition_definition_id" IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'A template version cannot change its requirement catalog after conditional folders are defined'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_version_catalog_guard"
    BEFORE UPDATE OF "requirement_catalog_version_id" ON "project_folder_template_versions"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_folder_template_version_catalog_change"();

CREATE FUNCTION "guard_project_template_folder_creation"() RETURNS trigger AS $$
DECLARE
    project_type_value "ProjectTypeEnum";
    project_catalog_version_id TEXT;
    source_template_id TEXT;
    source_catalog_version_id TEXT;
    definition_id TEXT;
    requirement_state "ProjectRequirementStateEnum";
    has_folder_applicability BOOLEAN;
BEGIN
    IF NEW."template_folder_key" IS NULL AND NEW."source_template_version_id" IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW."template_folder_key" IS NULL OR NEW."source_template_version_id" IS NULL
       OR NEW."project_id" IS NULL THEN
        RAISE EXCEPTION 'Template-derived project folders require a project, template version, and folder key'
            USING ERRCODE = '23514';
    END IF;

    SELECT "project_type", "requirement_catalog_version_id"
    INTO project_type_value, project_catalog_version_id
    FROM "projects" WHERE "id" = NEW."project_id"
    FOR SHARE;
    SELECT "template_id", "requirement_catalog_version_id"
    INTO source_template_id, source_catalog_version_id
    FROM "project_folder_template_versions" WHERE "id" = NEW."source_template_version_id";
    IF NOT FOUND OR project_type_value IS NULL
       OR source_catalog_version_id IS DISTINCT FROM project_catalog_version_id
       OR NOT EXISTS (
           SELECT 1 FROM "project_folder_template_assignments" AS assignment
           JOIN "project_folder_template_versions" AS version
             ON version."template_id" = assignment."template_id"
            AND version."version" = assignment."template_version"
           WHERE assignment."project_id" = NEW."project_id"
             AND assignment."template_id" = source_template_id
             AND version."id" = NEW."source_template_version_id"
             AND assignment."superseded_at" IS NULL
       ) THEN
        RAISE EXCEPTION 'Template-derived folders must use a currently assigned template version pinned to the project catalog'
            USING ERRCODE = '23514';
    END IF;

    SELECT definition."id" INTO definition_id
    FROM "project_folder_template_folders" AS definition
    WHERE definition."template_version_id" = NEW."source_template_version_id"
      AND definition."folder_key" = NEW."template_folder_key"
      AND definition."is_active";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template folder key is not active in the assigned template version'
            USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM "project_folder_template_folder_applicability"
        WHERE "folder_definition_id" = definition_id
    ) INTO has_folder_applicability;
    IF has_folder_applicability AND NOT EXISTS (
        SELECT 1 FROM "project_folder_template_folder_applicability"
        WHERE "folder_definition_id" = definition_id
          AND "project_type" = project_type_value
    ) THEN
        RAISE EXCEPTION 'Template folder is not applicable to this project type'
            USING ERRCODE = '23514';
    END IF;

    SELECT "condition_definition_id" INTO definition_id
    FROM "project_folder_template_folders"
    WHERE "template_version_id" = NEW."source_template_version_id"
      AND "folder_key" = NEW."template_folder_key";
    IF definition_id IS NOT NULL THEN
        SELECT "state" INTO requirement_state
        FROM "project_requirements"
        WHERE "project_id" = NEW."project_id" AND "definition_id" = definition_id
        FOR SHARE;
        IF requirement_state IS DISTINCT FROM 'APPLICABLE' THEN
            RAISE EXCEPTION 'Conditional folders are created only when the pinned project requirement is APPLICABLE'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_folders_template_creation_insert_guard"
    BEFORE INSERT ON "document_folders"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_template_folder_creation"();
CREATE TRIGGER "document_folders_template_creation_update_guard"
    BEFORE UPDATE OF "project_id", "template_folder_key", "source_template_version_id" ON "document_folders"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_template_folder_creation"();

CREATE FUNCTION "guard_project_folder_template_assignment"() RETURNS trigger AS $$
DECLARE
    project_type_value "ProjectTypeEnum";
    project_catalog_version_id TEXT;
    template_kind_value "ProjectFolderTemplateKindEnum";
    template_active BOOLEAN;
    current_version_id TEXT;
    assigned_version_id TEXT;
    assigned_published_at TIMESTAMP(3);
    assigned_catalog_version_id TEXT;
BEGIN
    SELECT "project_type", "requirement_catalog_version_id"
    INTO project_type_value, project_catalog_version_id
    FROM "projects" WHERE "id" = NEW."project_id"
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project does not exist for template assignment'
            USING ERRCODE = '23503';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."superseded_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Historical template assignments are immutable'
                USING ERRCODE = '23514';
        END IF;
        IF NEW."superseded_at" IS NOT NULL
           AND NEW."superseded_at" >= OLD."applied_at"
           AND OLD."project_id" IS NOT DISTINCT FROM NEW."project_id"
           AND OLD."template_id" IS NOT DISTINCT FROM NEW."template_id"
           AND OLD."template_version" IS NOT DISTINCT FROM NEW."template_version"
           AND OLD."component_kind" IS NOT DISTINCT FROM NEW."component_kind"
           AND OLD."applied_at" IS NOT DISTINCT FROM NEW."applied_at"
           AND OLD."applied_by" IS NOT DISTINCT FROM NEW."applied_by" THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Template assignments are append-only; supersede and insert a replacement'
            USING ERRCODE = '23514';
    END IF;

    IF project_type_value IS NULL THEN
        RAISE EXCEPTION 'A project type is required before folder templates can be assigned'
            USING ERRCODE = '23514';
    END IF;

    SELECT "kind", "is_active", "published_version_id"
    INTO template_kind_value, template_active, current_version_id
    FROM "project_folder_templates" WHERE "id" = NEW."template_id"
    FOR SHARE;
    IF NOT FOUND OR template_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Folder template is missing or inactive'
            USING ERRCODE = '23514';
    END IF;

    SELECT "id", "published_at", "requirement_catalog_version_id"
    INTO assigned_version_id, assigned_published_at, assigned_catalog_version_id
    FROM "project_folder_template_versions"
    WHERE "template_id" = NEW."template_id" AND "version" = NEW."template_version";
    IF NOT FOUND
       OR assigned_published_at IS NULL
       OR assigned_version_id IS DISTINCT FROM current_version_id THEN
        RAISE EXCEPTION 'Project assignments must pin the current published template version'
            USING ERRCODE = '23514';
    END IF;
    IF NEW."component_kind" IS DISTINCT FROM template_kind_value THEN
        RAISE EXCEPTION 'Assignment component kind must match the template kind'
            USING ERRCODE = '23514';
    END IF;
    IF assigned_catalog_version_id IS DISTINCT FROM project_catalog_version_id THEN
        RAISE EXCEPTION 'Template versions must use the project pinned requirement catalog version'
            USING ERRCODE = '23514';
    END IF;
    IF template_kind_value = 'PROJECT_TYPE_EXTENSION'
       AND NOT EXISTS (
           SELECT 1
           FROM "project_folder_template_version_applicability"
           WHERE "template_version_id" = assigned_version_id
             AND "project_type" = project_type_value
       ) THEN
        RAISE EXCEPTION 'Template extension is not applicable to this project type'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "project_folder_template_assignments" AS existing_assignment
        JOIN "project_folder_template_versions" AS existing_version
          ON existing_version."template_id" = existing_assignment."template_id"
         AND existing_version."version" = existing_assignment."template_version"
        JOIN "project_folder_template_version_conflicts" AS conflict
          ON (conflict."template_version_id" = assigned_version_id
              AND conflict."incompatible_template_version_id" = existing_version."id")
          OR (conflict."template_version_id" = existing_version."id"
              AND conflict."incompatible_template_version_id" = assigned_version_id)
        WHERE existing_assignment."project_id" = NEW."project_id"
          AND existing_assignment."superseded_at" IS NULL
          AND existing_assignment."template_id" <> NEW."template_id"
    ) THEN
        RAISE EXCEPTION 'Incompatible folder template extensions cannot be assigned together'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_assignment_guard"
    BEFORE INSERT OR UPDATE ON "project_folder_template_assignments"
    FOR EACH ROW EXECUTE FUNCTION "guard_project_folder_template_assignment"();

CREATE FUNCTION "prevent_project_folder_template_assignment_delete"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Template assignment history is append-only; supersede the current assignment'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_folder_template_assignments_append_only"
    BEFORE DELETE ON "project_folder_template_assignments"
    FOR EACH ROW EXECUTE FUNCTION "prevent_project_folder_template_assignment_delete"();

CREATE FUNCTION "assert_project_folder_template_initialization_complete"() RETURNS trigger AS $$
DECLARE
    target_project_id TEXT;
    target_project_type "ProjectTypeEnum";
    target_catalog_version_id TEXT;
    core_count INTEGER;
    extension_count INTEGER;
    missing_requirement BOOLEAN;
BEGIN
    IF TG_TABLE_NAME = 'projects' THEN
        target_project_id := NEW."id";
    ELSIF TG_OP = 'DELETE' THEN
        target_project_id := OLD."project_id";
    ELSE
        target_project_id := NEW."project_id";
    END IF;

    SELECT "project_type", "requirement_catalog_version_id"
    INTO target_project_type, target_catalog_version_id
    FROM "projects" WHERE "id" = target_project_id;
    IF NOT FOUND OR target_project_type IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*) FILTER (WHERE "component_kind" = 'COMMON_CORE'),
           COUNT(*) FILTER (WHERE "component_kind" = 'PROJECT_TYPE_EXTENSION')
    INTO core_count, extension_count
    FROM "project_folder_template_assignments"
    WHERE "project_id" = target_project_id AND "superseded_at" IS NULL;

    IF core_count <> 1 OR extension_count < 1 THEN
        RAISE EXCEPTION 'Typed projects require exactly one common core and at least one extension'
            USING ERRCODE = '23514';
    END IF;
    SELECT EXISTS (
        SELECT 1
        FROM "project_requirement_definitions" AS definition
        JOIN "project_requirement_applicability" AS applicability
          ON applicability."definition_id" = definition."id"
         AND applicability."project_type" = target_project_type
        LEFT JOIN "project_requirements" AS requirement
          ON requirement."project_id" = target_project_id
         AND requirement."definition_id" = definition."id"
        WHERE definition."catalog_version_id" = target_catalog_version_id
          AND definition."is_active"
          AND requirement."id" IS NULL
    ) INTO missing_requirement;
    IF missing_requirement THEN
        RAISE EXCEPTION 'Typed projects require a row for every active applicable catalog definition'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "project_folder_template_assignments" AS assignment
        JOIN "project_folder_template_versions" AS version
          ON version."template_id" = assignment."template_id"
         AND version."version" = assignment."template_version"
        WHERE assignment."project_id" = target_project_id
          AND assignment."superseded_at" IS NULL
          AND version."requirement_catalog_version_id" IS DISTINCT FROM target_catalog_version_id
    ) THEN
        RAISE EXCEPTION 'Current template assignments must use the project pinned requirement catalog version'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "project_folder_template_assignments" AS assignment
        JOIN "project_folder_template_versions" AS version
          ON version."template_id" = assignment."template_id"
         AND version."version" = assignment."template_version"
        WHERE assignment."project_id" = target_project_id
          AND assignment."superseded_at" IS NULL
          AND assignment."component_kind" = 'PROJECT_TYPE_EXTENSION'
          AND NOT EXISTS (
              SELECT 1 FROM "project_folder_template_version_applicability" AS applicability
              WHERE applicability."template_version_id" = version."id"
                AND applicability."project_type" = target_project_type
          )
    ) THEN
        RAISE EXCEPTION 'Current template extensions must remain applicable to the project type'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "projects_require_complete_folder_templates"
    AFTER INSERT OR UPDATE ON "projects"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_project_folder_template_initialization_complete"();
CREATE CONSTRAINT TRIGGER "assignments_require_complete_folder_templates"
    AFTER INSERT OR UPDATE OR DELETE ON "project_folder_template_assignments"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_project_folder_template_initialization_complete"();
CREATE CONSTRAINT TRIGGER "requirements_require_complete_catalog_snapshot"
    AFTER INSERT OR UPDATE OR DELETE ON "project_requirements"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_project_folder_template_initialization_complete"();

-- Enforce organization/project-consistent folder trees, including direct SQL writes.
CREATE FUNCTION "guard_document_folder_scope"() RETURNS trigger AS $$
DECLARE
    project_org_id TEXT;
    parent_org_id TEXT;
    parent_project_id TEXT;
    cycle_found BOOLEAN;
BEGIN
    IF NEW."project_id" IS NOT NULL THEN
        SELECT "organization_id" INTO project_org_id
        FROM "projects" WHERE "id" = NEW."project_id"
        FOR SHARE;
        IF NOT FOUND OR project_org_id IS DISTINCT FROM NEW."organization_id" THEN
            RAISE EXCEPTION 'Project folder organization must match its project'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Serialize all tree edits in this company/project scope so two concurrent
    -- reparent operations cannot each pass the cycle check and create a cycle.
    PERFORM pg_advisory_xact_lock(
        hashtext(NEW."organization_id"),
        hashtext(COALESCE(NEW."project_id", '<company>'))
    );

    IF TG_OP = 'UPDATE' THEN
        IF OLD."organization_id" IS DISTINCT FROM NEW."organization_id"
           OR OLD."project_id" IS DISTINCT FROM NEW."project_id" THEN
            RAISE EXCEPTION 'A folder cannot change organization or project scope'
                USING ERRCODE = '23514';
        END IF;

        IF NEW."parent_id" IS NOT NULL THEN
            IF NEW."parent_id" = OLD."id" THEN
                RAISE EXCEPTION 'A folder cannot be its own parent'
                    USING ERRCODE = '23514';
            END IF;
            WITH RECURSIVE descendants(folder_id) AS (
                SELECT "id" FROM "document_folders" WHERE "parent_id" = OLD."id"
                UNION
                SELECT child."id"
                FROM "document_folders" AS child
                JOIN descendants AS parent ON child."parent_id" = parent.folder_id
            )
            SELECT EXISTS (
                SELECT 1 FROM descendants WHERE folder_id = NEW."parent_id"
            ) INTO cycle_found;
            IF cycle_found THEN
                RAISE EXCEPTION 'A folder cannot be moved inside its descendant'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    IF NEW."parent_id" IS NOT NULL THEN
        SELECT "organization_id", "project_id"
        INTO parent_org_id, parent_project_id
        FROM "document_folders" WHERE "id" = NEW."parent_id";
        IF NOT FOUND
           OR parent_org_id IS DISTINCT FROM NEW."organization_id"
           OR parent_project_id IS DISTINCT FROM NEW."project_id" THEN
            RAISE EXCEPTION 'Parent and child folders must share organization and project scope'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_folders_scope_guard"
    BEFORE INSERT OR UPDATE ON "document_folders"
    FOR EACH ROW EXECUTE FUNCTION "guard_document_folder_scope"();

-- Existing project-less legacy documents have no tenant owner and stay unfiled.
-- New company documents can be filed only with an explicit organization owner.
CREATE FUNCTION "guard_document_folder_assignment_scope"() RETURNS trigger AS $$
DECLARE
    project_org_id TEXT;
    folder_org_id TEXT;
    folder_project_id TEXT;
BEGIN
    IF TG_OP = 'INSERT' AND NEW."project_id" IS NULL AND NEW."organization_id" IS NULL THEN
        RAISE EXCEPTION 'New company-level documents require explicit organization ownership'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."project_id" IS NULL AND OLD."organization_id" IS NULL AND OLD."folder_id" IS NULL
           AND NEW."folder_id" IS NOT NULL THEN
            RAISE EXCEPTION 'Legacy project-less documents cannot be assigned to folders'
                USING ERRCODE = '23514';
        END IF;
        IF OLD."project_id" IS NULL AND OLD."organization_id" IS NOT NULL
           AND NEW."project_id" IS NULL
           AND NEW."organization_id" IS DISTINCT FROM OLD."organization_id" THEN
            RAISE EXCEPTION 'Company document organization ownership cannot be changed implicitly'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW."project_id" IS NOT NULL THEN
        SELECT "organization_id" INTO project_org_id
        FROM "projects" WHERE "id" = NEW."project_id";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document project does not exist'
                USING ERRCODE = '23503';
        END IF;
        IF (TG_OP = 'INSERT' OR NEW."organization_id" IS NOT NULL)
           AND NEW."organization_id" IS DISTINCT FROM project_org_id THEN
            RAISE EXCEPTION 'New or explicitly owned project documents must match their project organization'
                USING ERRCODE = '23514';
        END IF;
        IF NEW."organization_id" IS NOT NULL
           AND NEW."organization_id" IS DISTINCT FROM project_org_id THEN
            RAISE EXCEPTION 'Document organization does not match its project'
                USING ERRCODE = '23514';
        END IF;
        IF NEW."folder_id" IS NOT NULL THEN
            IF NEW."organization_id" IS DISTINCT FROM project_org_id THEN
                RAISE EXCEPTION 'Project documents must establish the project organization before filing'
                    USING ERRCODE = '23514';
            END IF;
            SELECT "organization_id", "project_id"
            INTO folder_org_id, folder_project_id
            FROM "document_folders" WHERE "id" = NEW."folder_id";
            IF NOT FOUND
               OR folder_org_id IS DISTINCT FROM project_org_id
               OR folder_project_id IS DISTINCT FROM NEW."project_id" THEN
                RAISE EXCEPTION 'Project documents must use a folder in the same organization and project'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    ELSIF NEW."folder_id" IS NOT NULL THEN
        IF NEW."organization_id" IS NULL THEN
            RAISE EXCEPTION 'Company folder documents require explicit organization ownership'
                USING ERRCODE = '23514';
        END IF;
        SELECT "organization_id", "project_id"
        INTO folder_org_id, folder_project_id
        FROM "document_folders" WHERE "id" = NEW."folder_id";
        IF NOT FOUND
           OR folder_org_id IS DISTINCT FROM NEW."organization_id"
           OR folder_project_id IS NOT NULL THEN
            RAISE EXCEPTION 'Company documents must use a company folder in the same organization'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "documents_folder_scope_insert_guard"
    BEFORE INSERT ON "documents"
    FOR EACH ROW EXECUTE FUNCTION "guard_document_folder_assignment_scope"();
CREATE TRIGGER "documents_folder_scope_update_guard"
    BEFORE UPDATE OF "project_id", "organization_id", "folder_id" ON "documents"
    FOR EACH ROW EXECUTE FUNCTION "guard_document_folder_assignment_scope"();

-- Enforce explicit cleanup even when a folder is deleted outside the HTTP API.
CREATE FUNCTION "prevent_nonempty_document_folder_delete"() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "document_folders" WHERE "parent_id" = OLD."id")
       OR EXISTS (SELECT 1 FROM "documents" WHERE "folder_id" = OLD."id") THEN
        RAISE EXCEPTION 'Document folders must be empty before deletion'
            USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_folders_empty_before_delete"
    BEFORE DELETE ON "document_folders"
    FOR EACH ROW EXECUTE FUNCTION "prevent_nonempty_document_folder_delete"();

-- Do not let the existing Project.documents SET NULL action silently orphan files.
CREATE FUNCTION "prevent_project_delete_with_documents"() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "document_folders" WHERE "project_id" = OLD."id")
       OR EXISTS (SELECT 1 FROM "documents" WHERE "project_id" = OLD."id") THEN
        RAISE EXCEPTION 'Project folders and documents must be explicitly transferred or retained before project deletion'
            USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "projects_require_document_cleanup"
    BEFORE DELETE ON "projects"
    FOR EACH ROW EXECUTE FUNCTION "prevent_project_delete_with_documents"();

-- The Organization FK remains CASCADE, but direct organization deletion must
-- explicitly handle its folder tree and related documents first.
CREATE FUNCTION "prevent_organization_delete_with_document_folders"() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "document_folders" WHERE "organization_id" = OLD."id")
       OR EXISTS (SELECT 1 FROM "documents" WHERE "organization_id" = OLD."id")
       OR EXISTS (
            SELECT 1
            FROM "documents" AS document
            JOIN "projects" AS project ON project."id" = document."project_id"
            WHERE project."organization_id" = OLD."id"
       ) THEN
        RAISE EXCEPTION 'Organization folders and documents must be explicitly transferred or retained before organization deletion'
            USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "organizations_require_document_folder_cleanup"
    BEFORE DELETE ON "organizations"
    FOR EACH ROW EXECUTE FUNCTION "prevent_organization_delete_with_document_folders"();
