-- CreateEnum
CREATE TYPE "SelectionLabel" AS ENUM ('MUST_HAVE', 'MAYBE');

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN "selectionClosesAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClientSession" ADD COLUMN "selectionFinalizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN "label" "SelectionLabel" NOT NULL DEFAULT 'MUST_HAVE';
