-- CreateTable
CREATE TABLE "ReplyFromAnky" (
    "id" SERIAL NOT NULL,
    "rootCastText" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replyingToFid" INTEGER,
    "replyingToUsername" TEXT,
    "replyingToCastHash" TEXT,
    "timeOfReply" TIMESTAMP(3),
    "replyText" TEXT,
    "replyReasoning" TEXT,
    "replyCastHash" TEXT,
    "humanTrainerFeedback" TEXT,

    CONSTRAINT "ReplyFromAnky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" SERIAL NOT NULL,
    "replyId" INTEGER NOT NULL,
    "engagementType" TEXT NOT NULL,
    "engagementValue" DOUBLE PRECISION NOT NULL,
    "engagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPerformance" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalReplies" INTEGER NOT NULL,
    "totalEngagementScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyForTrainingAnky" (
    "id" TEXT NOT NULL,
    "rootCastHash" TEXT NOT NULL,
    "goodReplyHash" TEXT,
    "goodReplyText" TEXT,
    "badReplyHash" TEXT,
    "badReplyText" TEXT,
    "comments" TEXT,

    CONSTRAINT "ReplyForTrainingAnky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BringTheBlood" (
    "id" TEXT NOT NULL,
    "fid" TEXT,
    "cid" TEXT,

    CONSTRAINT "BringTheBlood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplyFromAnky_id_key" ON "ReplyFromAnky"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_id_key" ON "Engagement"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPerformance_id_key" ON "DailyPerformance"("id");
