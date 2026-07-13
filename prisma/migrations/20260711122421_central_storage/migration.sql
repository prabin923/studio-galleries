/*
  Warnings:

  - You are about to drop the column `studioId` on the `StorageConnection` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StorageConnection" DROP CONSTRAINT "StorageConnection_studioId_fkey";

-- DropIndex
DROP INDEX "StorageConnection_studioId_key";

-- AlterTable
ALTER TABLE "StorageConnection" DROP COLUMN "studioId";

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "driveFolderId" TEXT;
