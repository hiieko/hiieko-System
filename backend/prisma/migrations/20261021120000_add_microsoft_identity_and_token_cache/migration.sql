-- Additive schema support for the future delegated Microsoft 365 integration.
-- No existing document tables or file data are changed. Token-cache columns are
-- ciphertext/envelope-encryption material only; application code must not write
-- plaintext MSAL cache data here.

CREATE TYPE "MicrosoftIdentityStatusEnum" AS ENUM (
    'CONNECTED',
    'REAUTH_REQUIRED',
    'DISCONNECTED'
);

CREATE TABLE "microsoft_identity_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "status" "MicrosoftIdentityStatusEnum" NOT NULL DEFAULT 'CONNECTED',
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_authenticated_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_identity_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "microsoft_token_caches" (
    "identity_link_id" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "wrapped_data_key" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "auth_tag" BYTEA NOT NULL,
    "key_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_token_caches_pkey" PRIMARY KEY ("identity_link_id")
);

CREATE UNIQUE INDEX "microsoft_identity_links_user_id_key"
    ON "microsoft_identity_links"("user_id");

CREATE UNIQUE INDEX "microsoft_identity_links_tenant_id_object_id_key"
    ON "microsoft_identity_links"("tenant_id", "object_id");

ALTER TABLE "microsoft_identity_links"
    ADD CONSTRAINT "microsoft_identity_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "microsoft_token_caches"
    ADD CONSTRAINT "microsoft_token_caches_identity_link_id_fkey"
    FOREIGN KEY ("identity_link_id") REFERENCES "microsoft_identity_links"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
