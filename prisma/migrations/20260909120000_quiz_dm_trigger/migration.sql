-- DM entries have a message source rather than a comment or post.
ALTER TABLE "QuizRun"
  ADD COLUMN "sourceMessageId" TEXT,
  ALTER COLUMN "sourceCommentId" DROP NOT NULL,
  ALTER COLUMN "sourcePostId" DROP NOT NULL,
  ALTER COLUMN "commentCreatedAt" DROP NOT NULL;
