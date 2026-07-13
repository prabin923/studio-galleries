-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_fileId_createdAt_idx" ON "Comment"("fileId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_clientSessionId_fkey" FOREIGN KEY ("clientSessionId") REFERENCES "ClientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
