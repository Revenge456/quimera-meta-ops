-- CreateEnum
CREATE TYPE "MetaConnectionProvider" AS ENUM ('meta');

-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('active', 'expired', 'revoked', 'invalid');

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "provider" "MetaConnectionProvider" NOT NULL DEFAULT 'meta',
    "meta_business_id" TEXT,
    "meta_business_name" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "token_type" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'invalid',
    "connected_by_user_id" TEXT,
    "last_validated_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sync_log" ADD COLUMN "meta_connection_id" TEXT;

-- AlterTable
ALTER TABLE "ad_accounts" ADD COLUMN "meta_connection_id" TEXT;

-- CreateIndex
CREATE INDEX "meta_connections_client_id_idx" ON "meta_connections"("client_id");

-- CreateIndex
CREATE INDEX "meta_connections_status_idx" ON "meta_connections"("status");

-- CreateIndex
CREATE INDEX "meta_connections_provider_idx" ON "meta_connections"("provider");

-- CreateIndex
CREATE INDEX "meta_connections_connected_by_user_id_idx" ON "meta_connections"("connected_by_user_id");

-- CreateIndex
CREATE INDEX "meta_connections_last_validated_at_idx" ON "meta_connections"("last_validated_at");

-- CreateIndex
CREATE INDEX "sync_log_meta_connection_id_idx" ON "sync_log"("meta_connection_id");

-- CreateIndex
CREATE INDEX "ad_accounts_meta_connection_id_idx" ON "ad_accounts"("meta_connection_id");

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_meta_connection_id_fkey" FOREIGN KEY ("meta_connection_id") REFERENCES "meta_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_meta_connection_id_fkey" FOREIGN KEY ("meta_connection_id") REFERENCES "meta_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
