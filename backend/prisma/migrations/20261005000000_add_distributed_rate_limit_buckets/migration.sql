-- Slice 7: distributed authentication rate limiting.
-- Counters are stored in PostgreSQL so separate API instances share the same fixed windows.
CREATE TABLE "rate_limit_buckets" (
  "id" VARCHAR(512) NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_limit_buckets_expires_at_idx"
  ON "rate_limit_buckets"("expires_at");
