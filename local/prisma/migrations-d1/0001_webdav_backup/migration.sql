CREATE TABLE "WebDavBackupSettings" (
  "ownerId" TEXT NOT NULL PRIMARY KEY,
  "encryptedConfig" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("ownerId") REFERENCES "LocalAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
