-- CreateEnum
CREATE TYPE "QuizRunStatus" AS ENUM ('WAITING_START', 'ACTIVE', 'WAITING_REPLY', 'WAITING_WINDOW', 'PAUSED', 'HUMAN', 'UNKNOWN', 'COMPLETED', 'STOPPED', 'RESTARTED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuizWorkStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'CANCELLED', 'FAILED', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "JobKind" ADD VALUE 'QUIZ_STEP';

-- CreateTable
CREATE TABLE "QuizContact" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "instagramUserId" TEXT,
    "username" TEXT,
    "email" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastInteractionAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizPath" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "draftRevision" INTEGER NOT NULL DEFAULT 1,
    "publishedVersionId" TEXT,
    "acceptsEntries" BOOLEAN NOT NULL DEFAULT false,
    "halted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizVersion" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "graph" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizRun" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "QuizRunStatus" NOT NULL DEFAULT 'WAITING_START',
    "snapshot" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "sourceCommentId" TEXT NOT NULL,
    "sourcePostId" TEXT NOT NULL,
    "commentCreatedAt" TIMESTAMP(3) NOT NULL,
    "lastInteractionAt" TIMESTAMP(3),
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "qualificationReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualifiedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "nodeId" TEXT,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizWork" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "QuizWorkStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "afterSnapshot" JSONB,
    "r2Key" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizContact_instagramAccountId_updatedAt_idx" ON "QuizContact"("instagramAccountId", "updatedAt");

-- CreateIndex
CREATE INDEX "QuizContact_instagramAccountId_email_idx" ON "QuizContact"("instagramAccountId", "email");

-- CreateIndex
CREATE INDEX "QuizContact_tags_idx" ON "QuizContact" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "QuizContact_instagramAccountId_participantKey_key" ON "QuizContact"("instagramAccountId", "participantKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuizPath_publishedVersionId_key" ON "QuizPath"("publishedVersionId");

-- CreateIndex
CREATE INDEX "QuizPath_instagramAccountId_acceptsEntries_idx" ON "QuizPath"("instagramAccountId", "acceptsEntries");

-- CreateIndex
CREATE UNIQUE INDEX "QuizVersion_pathId_number_key" ON "QuizVersion"("pathId", "number");

-- CreateIndex
CREATE INDEX "QuizRun_pathId_status_createdAt_idx" ON "QuizRun"("pathId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QuizRun_contactId_createdAt_idx" ON "QuizRun"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizRun_pathId_qualified_createdAt_idx" ON "QuizRun"("pathId", "qualified", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizEvent_externalId_key" ON "QuizEvent"("externalId");

-- CreateIndex
CREATE INDEX "QuizEvent_runId_createdAt_idx" ON "QuizEvent"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizWork_externalId_key" ON "QuizWork"("externalId");

-- CreateIndex
CREATE INDEX "QuizWork_status_updatedAt_idx" ON "QuizWork"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "QuizWork_runId_revision_idx" ON "QuizWork"("runId", "revision");

-- AddForeignKey
ALTER TABLE "QuizContact" ADD CONSTRAINT "QuizContact_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizPath" ADD CONSTRAINT "QuizPath_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizPath" ADD CONSTRAINT "QuizPath_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "QuizVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizVersion" ADD CONSTRAINT "QuizVersion_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "QuizPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizRun" ADD CONSTRAINT "QuizRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "QuizContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizRun" ADD CONSTRAINT "QuizRun_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "QuizPath"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizRun" ADD CONSTRAINT "QuizRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QuizVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizEvent" ADD CONSTRAINT "QuizEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuizRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizWork" ADD CONSTRAINT "QuizWork_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QuizRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "QuizRun_one_active_per_contact" ON "QuizRun" ("contactId") WHERE "status" IN ('WAITING_START','ACTIVE','WAITING_REPLY','WAITING_WINDOW','PAUSED','HUMAN','UNKNOWN');
