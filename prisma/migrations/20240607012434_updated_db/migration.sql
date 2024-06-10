/*
  Warnings:

  - You are about to drop the `NewMana` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewManaTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NewWritingSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NewMana" DROP CONSTRAINT "NewMana_userId_fkey";

-- DropForeignKey
ALTER TABLE "NewManaTransaction" DROP CONSTRAINT "NewManaTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "NewWritingSession" DROP CONSTRAINT "NewWritingSession_userId_fkey";

-- DropTable
DROP TABLE "NewMana";

-- DropTable
DROP TABLE "NewManaTransaction";

-- DropTable
DROP TABLE "NewUser";

-- DropTable
DROP TABLE "NewWritingSession";
