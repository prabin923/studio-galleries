-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "StorageStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED', 'MISSING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageConnection" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_drive',
    "googleEmail" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "rootFolderId" TEXT NOT NULL,
    "status" "StorageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "status" "GalleryStatus" NOT NULL DEFAULT 'DRAFT',
    "driveFolderId" TEXT,
    "coverFileId" TEXT,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "takenAt" TIMESTAMP(3),
    "driveFileId" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "selectionLimit" INTEGER,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSession" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_studioId_key" ON "Membership"("userId", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageConnection_studioId_key" ON "StorageConnection"("studioId");

-- CreateIndex
CREATE INDEX "Gallery_studioId_createdAt_idx" ON "Gallery"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "File_galleryId_sortOrder_idx" ON "File"("galleryId", "sortOrder");

-- CreateIndex
CREATE INDEX "File_studioId_idx" ON "File"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_clientSessionId_fileId_key" ON "Favorite"("clientSessionId", "fileId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageConnection" ADD CONSTRAINT "StorageConnection_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSession" ADD CONSTRAINT "ClientSession_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_clientSessionId_fkey" FOREIGN KEY ("clientSessionId") REFERENCES "ClientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
