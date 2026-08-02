-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'SKIPPED', 'RETRYING', 'FAILED');
CREATE TYPE "JobKind" AS ENUM ('COMMENT', 'POSTBACK', 'FOLLOW_UP', 'MESSAGE', 'RECOVER_R2', 'RECONCILE', 'REFRESH_TOKENS', 'ATTACH_NEXT_REEL', 'SNAPSHOT_FOLLOWERS', 'RETENTION');
CREATE TYPE "JobStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'SKIPPED', 'RETRYING', 'FAILED');
CREATE TYPE "EventSource" AS ENUM ('WEBHOOK', 'POLLING', 'INTERNAL', 'RECOVERY');
CREATE TYPE "OperationalEventSource" AS ENUM ('CORE', 'JOBS', 'WORKFLOW', 'CRON', 'SYSTEM');
CREATE TYPE "OperationalEventLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

CREATE TABLE "InstagramAccount" (
  "id" TEXT NOT NULL,
  "instagramId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "name" TEXT,
  "accessToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
  "requiresReconnect" BOOLEAN NOT NULL DEFAULT false,
  "lastErrorCode" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Automation" (
  "id" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "postId" TEXT,
  "postUrl" TEXT,
  "pendingNextReel" BOOLEAN NOT NULL DEFAULT false,
  "matchAnyPost" BOOLEAN NOT NULL DEFAULT false,
  "keywords" TEXT[],
  "matchAnyWord" BOOLEAN NOT NULL DEFAULT false,
  "dmTriggerEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dmMessage" TEXT NOT NULL,
  "openingDmEnabled" BOOLEAN NOT NULL DEFAULT false,
  "openingDmMessage" TEXT,
  "openingDmButtonLabel" TEXT,
  "linkButtonLabel" TEXT,
  "requireFollowBeforeFreebie" BOOLEAN NOT NULL DEFAULT false,
  "followPromptMessage" TEXT,
  "followPromptButtonLabel" TEXT,
  "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "followUpMessage" TEXT,
  "followUpDelayMinutes" INTEGER NOT NULL DEFAULT 0,
  "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publicReplyMessage" TEXT,
  "publicReplyMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "wholeWordMatch" BOOLEAN NOT NULL DEFAULT true,
  "reportShareSlug" TEXT,
  "reportShareEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessedEvent" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "instagramAccountId" TEXT,
  "source" "EventSource" NOT NULL,
  "kind" "JobKind" NOT NULL,
  "terminalStatus" "JobStatus",
  "r2Key" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmLog" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "commenterId" TEXT NOT NULL,
  "commenterName" TEXT,
  "commentText" TEXT,
  "commentId" TEXT,
  "matchedKeyword" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "dmSentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "publicReplySentAt" TIMESTAMP(3),
  "publicReplyError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DmLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackedLink" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT,
  "destinationUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkClick" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "trackedLinkId" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowerSnapshot" (
  "id" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "followersCount" INTEGER NOT NULL,
  "backfilled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowerSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyAggregate" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "received" INTEGER NOT NULL DEFAULT 0,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "queueJobs" INTEGER NOT NULL DEFAULT 0,
  "workflowSteps" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyBudget" (
  "date" DATE NOT NULL,
  "received" INTEGER NOT NULL DEFAULT 0,
  "queueJobs" INTEGER NOT NULL DEFAULT 0,
  "workflowSteps" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DailyBudget_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "OperationalEvent" (
  "id" TEXT NOT NULL,
  "source" "OperationalEventSource" NOT NULL,
  "level" "OperationalEventLevel" NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "automationId" TEXT,
  "instagramAccountId" TEXT,
  "kind" "JobKind" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramAccount_instagramId_key" ON "InstagramAccount"("instagramId");
CREATE INDEX "InstagramAccount_updatedAt_idx" ON "InstagramAccount"("updatedAt");
CREATE UNIQUE INDEX "Automation_reportShareSlug_key" ON "Automation"("reportShareSlug");
CREATE INDEX "Automation_instagramAccountId_isActive_idx" ON "Automation"("instagramAccountId", "isActive");
CREATE INDEX "Automation_postId_idx" ON "Automation"("postId");
CREATE INDEX "Automation_updatedAt_idx" ON "Automation"("updatedAt");
CREATE UNIQUE INDEX "ProcessedEvent_externalId_key" ON "ProcessedEvent"("externalId");
CREATE INDEX "ProcessedEvent_instagramAccountId_firstSeenAt_idx" ON "ProcessedEvent"("instagramAccountId", "firstSeenAt");
CREATE INDEX "ProcessedEvent_firstSeenAt_idx" ON "ProcessedEvent"("firstSeenAt");
CREATE INDEX "ProcessedEvent_terminalStatus_completedAt_idx" ON "ProcessedEvent"("terminalStatus", "completedAt");
CREATE UNIQUE INDEX "DmLog_externalId_key" ON "DmLog"("externalId");
CREATE INDEX "DmLog_automationId_createdAt_idx" ON "DmLog"("automationId", "createdAt");
CREATE INDEX "DmLog_instagramAccountId_createdAt_idx" ON "DmLog"("instagramAccountId", "createdAt");
CREATE INDEX "DmLog_status_createdAt_idx" ON "DmLog"("status", "createdAt");
CREATE INDEX "DmLog_createdAt_idx" ON "DmLog"("createdAt");
CREATE UNIQUE INDEX "TrackedLink_slug_key" ON "TrackedLink"("slug");
CREATE INDEX "TrackedLink_automationId_createdAt_idx" ON "TrackedLink"("automationId", "createdAt");
CREATE INDEX "LinkClick_automationId_createdAt_idx" ON "LinkClick"("automationId", "createdAt");
CREATE INDEX "LinkClick_instagramAccountId_createdAt_idx" ON "LinkClick"("instagramAccountId", "createdAt");
CREATE INDEX "LinkClick_trackedLinkId_createdAt_idx" ON "LinkClick"("trackedLinkId", "createdAt");
CREATE INDEX "LinkClick_createdAt_idx" ON "LinkClick"("createdAt");
CREATE UNIQUE INDEX "FollowerSnapshot_instagramAccountId_date_key" ON "FollowerSnapshot"("instagramAccountId", "date");
CREATE INDEX "FollowerSnapshot_date_idx" ON "FollowerSnapshot"("date");
CREATE INDEX "FollowerSnapshot_createdAt_idx" ON "FollowerSnapshot"("createdAt");
CREATE UNIQUE INDEX "DailyAggregate_date_instagramAccountId_key" ON "DailyAggregate"("date", "instagramAccountId");
CREATE INDEX "DailyAggregate_date_idx" ON "DailyAggregate"("date");
CREATE INDEX "OperationalEvent_createdAt_idx" ON "OperationalEvent"("createdAt");
CREATE INDEX "OperationalEvent_source_createdAt_idx" ON "OperationalEvent"("source", "createdAt");
CREATE INDEX "OperationalEvent_level_createdAt_idx" ON "OperationalEvent"("level", "createdAt");
CREATE UNIQUE INDEX "JobRun_externalId_key" ON "JobRun"("externalId");
CREATE INDEX "JobRun_instagramAccountId_createdAt_idx" ON "JobRun"("instagramAccountId", "createdAt");
CREATE INDEX "JobRun_status_createdAt_idx" ON "JobRun"("status", "createdAt");
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");

ALTER TABLE "Automation" ADD CONSTRAINT "Automation_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessedEvent" ADD CONSTRAINT "ProcessedEvent_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "TrackedLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowerSnapshot" ADD CONSTRAINT "FollowerSnapshot_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyAggregate" ADD CONSTRAINT "DailyAggregate_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
