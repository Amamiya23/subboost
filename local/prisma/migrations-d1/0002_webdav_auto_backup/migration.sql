ALTER TABLE "WebDavBackupSettings" ADD COLUMN "lastBackupAt" DATETIME;
ALTER TABLE "WebDavBackupSettings" ADD COLUMN "lastAttemptedAt" DATETIME;
ALTER TABLE "WebDavBackupSettings" ADD COLUMN "lastError" TEXT;
