-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'commercial_manager');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('initial', 'incremental');

-- CreateEnum
CREATE TYPE "AiAnalysisLevel" AS ENUM ('campaign', 'ad_set', 'ad');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "estado" "ClientStatus" NOT NULL DEFAULT 'active',
    "meta_ad_account_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "module" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "ad_account_id" TEXT,
    "sync_type" "SyncType" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "rows_upserted" INTEGER NOT NULL DEFAULT 0,
    "api_calls_used" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata_json" JSONB,

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "meta_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "amount_spent" DECIMAL(18,2),
    "last_synced_at" TIMESTAMP(3),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "meta_campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "buying_type" TEXT,
    "budget_fields" JSONB,
    "effective_status" TEXT,
    "configured_status" TEXT,
    "start_time" TIMESTAMP(3),
    "stop_time" TIMESTAMP(3),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "meta_adset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "optimization_goal" TEXT,
    "billing_event" TEXT,
    "bid_strategy" TEXT,
    "targeting_json" JSONB,
    "effective_status" TEXT,
    "start_time" TIMESTAMP(3),
    "stop_time" TIMESTAMP(3),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "meta_ad_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effective_status" TEXT,
    "configured_status" TEXT,
    "creative_id" TEXT,
    "preview_data" JSONB,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "meta_creative_id" TEXT NOT NULL,
    "name" TEXT,
    "body" TEXT,
    "headline" TEXT,
    "call_to_action" TEXT,
    "asset_type" TEXT,
    "asset_url" TEXT,
    "thumbnail_url" TEXT,
    "landing_url" TEXT,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_insights_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "spend" DECIMAL(18,2),
    "impressions" INTEGER,
    "reach" INTEGER,
    "frequency" DECIMAL(18,4),
    "clicks" INTEGER,
    "link_clicks" INTEGER,
    "landing_page_views" INTEGER,
    "cpm" DECIMAL(18,4),
    "cpc" DECIMAL(18,4),
    "ctr" DECIMAL(18,4),
    "results" DECIMAL(18,4),
    "result_type" TEXT,
    "cost_per_result" DECIMAL(18,4),
    "leads" DECIMAL(18,4),
    "purchases" DECIMAL(18,4),
    "purchase_value" DECIMAL(18,4),
    "roas" DECIMAL(18,4),
    "actions_json" JSONB,
    "action_values_json" JSONB,
    "video_metrics_json" JSONB,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_insights_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adset_insights_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adset_id" TEXT NOT NULL,
    "spend" DECIMAL(18,2),
    "impressions" INTEGER,
    "reach" INTEGER,
    "frequency" DECIMAL(18,4),
    "clicks" INTEGER,
    "link_clicks" INTEGER,
    "landing_page_views" INTEGER,
    "cpm" DECIMAL(18,4),
    "cpc" DECIMAL(18,4),
    "ctr" DECIMAL(18,4),
    "results" DECIMAL(18,4),
    "result_type" TEXT,
    "cost_per_result" DECIMAL(18,4),
    "leads" DECIMAL(18,4),
    "purchases" DECIMAL(18,4),
    "purchase_value" DECIMAL(18,4),
    "roas" DECIMAL(18,4),
    "actions_json" JSONB,
    "action_values_json" JSONB,
    "video_metrics_json" JSONB,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adset_insights_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_insights_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ad_id" TEXT NOT NULL,
    "spend" DECIMAL(18,2),
    "impressions" INTEGER,
    "reach" INTEGER,
    "frequency" DECIMAL(18,4),
    "clicks" INTEGER,
    "link_clicks" INTEGER,
    "landing_page_views" INTEGER,
    "cpm" DECIMAL(18,4),
    "cpc" DECIMAL(18,4),
    "ctr" DECIMAL(18,4),
    "results" DECIMAL(18,4),
    "result_type" TEXT,
    "cost_per_result" DECIMAL(18,4),
    "leads" DECIMAL(18,4),
    "purchases" DECIMAL(18,4),
    "purchase_value" DECIMAL(18,4),
    "roas" DECIMAL(18,4),
    "actions_json" JSONB,
    "action_values_json" JSONB,
    "video_metrics_json" JSONB,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_insights_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_strategist_analyses" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "generated_by_user_id" TEXT,
    "level" "AiAnalysisLevel" NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "context_hash" TEXT,
    "filters_json" JSONB,
    "context_normalized_json" JSONB,
    "output_json" JSONB NOT NULL,
    "context_json" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_strategist_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_advisor_analyses" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "strategist_analysis_id" TEXT,
    "generated_by_user_id" TEXT,
    "level" "AiAnalysisLevel" NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "context_hash" TEXT,
    "filters_json" JSONB,
    "context_normalized_json" JSONB,
    "output_json" JSONB NOT NULL,
    "strategist_output_json" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_advisor_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cliente_assignments_cliente_id_idx" ON "cliente_assignments"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_assignments_user_id_cliente_id_key" ON "cliente_assignments"("user_id", "cliente_id");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_logs_module_idx" ON "system_logs"("module");

-- CreateIndex
CREATE INDEX "sync_log_cliente_id_idx" ON "sync_log"("cliente_id");

-- CreateIndex
CREATE INDEX "sync_log_ad_account_id_idx" ON "sync_log"("ad_account_id");

-- CreateIndex
CREATE INDEX "sync_log_status_idx" ON "sync_log"("status");

-- CreateIndex
CREATE INDEX "sync_log_started_at_idx" ON "sync_log"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_meta_account_id_key" ON "ad_accounts"("meta_account_id");

-- CreateIndex
CREATE INDEX "ad_accounts_cliente_id_idx" ON "ad_accounts"("cliente_id");

-- CreateIndex
CREATE INDEX "ad_accounts_status_idx" ON "ad_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_meta_campaign_id_key" ON "campaigns"("meta_campaign_id");

-- CreateIndex
CREATE INDEX "campaigns_ad_account_id_idx" ON "campaigns"("ad_account_id");

-- CreateIndex
CREATE INDEX "campaigns_effective_status_idx" ON "campaigns"("effective_status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_meta_adset_id_key" ON "ad_sets"("meta_adset_id");

-- CreateIndex
CREATE INDEX "ad_sets_campaign_id_idx" ON "ad_sets"("campaign_id");

-- CreateIndex
CREATE INDEX "ad_sets_effective_status_idx" ON "ad_sets"("effective_status");

-- CreateIndex
CREATE UNIQUE INDEX "ads_meta_ad_id_key" ON "ads"("meta_ad_id");

-- CreateIndex
CREATE INDEX "ads_adset_id_idx" ON "ads"("adset_id");

-- CreateIndex
CREATE INDEX "ads_campaign_id_idx" ON "ads"("campaign_id");

-- CreateIndex
CREATE INDEX "ads_effective_status_idx" ON "ads"("effective_status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_creatives_meta_creative_id_key" ON "ad_creatives"("meta_creative_id");

-- CreateIndex
CREATE INDEX "ad_creatives_ad_id_idx" ON "ad_creatives"("ad_id");

-- CreateIndex
CREATE INDEX "campaign_insights_daily_date_idx" ON "campaign_insights_daily"("date");

-- CreateIndex
CREATE INDEX "campaign_insights_daily_campaign_id_idx" ON "campaign_insights_daily"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_insights_daily_campaign_id_date_key" ON "campaign_insights_daily"("campaign_id", "date");

-- CreateIndex
CREATE INDEX "adset_insights_daily_date_idx" ON "adset_insights_daily"("date");

-- CreateIndex
CREATE INDEX "adset_insights_daily_adset_id_idx" ON "adset_insights_daily"("adset_id");

-- CreateIndex
CREATE UNIQUE INDEX "adset_insights_daily_adset_id_date_key" ON "adset_insights_daily"("adset_id", "date");

-- CreateIndex
CREATE INDEX "ad_insights_daily_date_idx" ON "ad_insights_daily"("date");

-- CreateIndex
CREATE INDEX "ad_insights_daily_ad_id_idx" ON "ad_insights_daily"("ad_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_insights_daily_ad_id_date_key" ON "ad_insights_daily"("ad_id", "date");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_client_id_idx" ON "ai_strategist_analyses"("client_id");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_generated_by_user_id_idx" ON "ai_strategist_analyses"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_level_idx" ON "ai_strategist_analyses"("level");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_generated_at_idx" ON "ai_strategist_analyses"("generated_at");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_date_from_date_to_idx" ON "ai_strategist_analyses"("date_from", "date_to");

-- CreateIndex
CREATE INDEX "ai_strategist_analyses_context_hash_idx" ON "ai_strategist_analyses"("context_hash");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_client_id_idx" ON "commercial_advisor_analyses"("client_id");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_strategist_analysis_id_idx" ON "commercial_advisor_analyses"("strategist_analysis_id");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_generated_by_user_id_idx" ON "commercial_advisor_analyses"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_level_idx" ON "commercial_advisor_analyses"("level");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_generated_at_idx" ON "commercial_advisor_analyses"("generated_at");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_date_from_date_to_idx" ON "commercial_advisor_analyses"("date_from", "date_to");

-- CreateIndex
CREATE INDEX "commercial_advisor_analyses_context_hash_idx" ON "commercial_advisor_analyses"("context_hash");

-- AddForeignKey
ALTER TABLE "cliente_assignments" ADD CONSTRAINT "cliente_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_assignments" ADD CONSTRAINT "cliente_assignments_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ad_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_insights_daily" ADD CONSTRAINT "campaign_insights_daily_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adset_insights_daily" ADD CONSTRAINT "adset_insights_daily_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_insights_daily" ADD CONSTRAINT "ad_insights_daily_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_strategist_analyses" ADD CONSTRAINT "ai_strategist_analyses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_strategist_analyses" ADD CONSTRAINT "ai_strategist_analyses_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_advisor_analyses" ADD CONSTRAINT "commercial_advisor_analyses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_advisor_analyses" ADD CONSTRAINT "commercial_advisor_analyses_strategist_analysis_id_fkey" FOREIGN KEY ("strategist_analysis_id") REFERENCES "ai_strategist_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_advisor_analyses" ADD CONSTRAINT "commercial_advisor_analyses_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
