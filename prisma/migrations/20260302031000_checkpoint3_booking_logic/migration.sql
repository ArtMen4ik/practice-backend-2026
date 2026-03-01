/*
  Warnings:

  - The values [CONFIRMED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, they will be mapped to PENDING.
  - You are about to drop the column `serviceId` on the `Booking` table. All the data in the column will be lost.
*/

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_serviceId_fkey";

-- DropIndex
DROP INDEX "Booking_clientId_idx";

-- DropIndex
DROP INDEX "Booking_status_idx";

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "durationHours" INTEGER NOT NULL DEFAULT 1,
  DROP COLUMN "serviceId";

-- Backfill duration with whole hours from [startAt, endAt]
UPDATE "Booking"
SET "durationHours" = GREATEST(
  1,
  CEIL(EXTRACT(EPOCH FROM ("endAt" - "startAt")) / 3600.0)::INTEGER
);

ALTER TABLE "Booking"
  ALTER COLUMN "durationHours" DROP DEFAULT;

-- Update existing CONFIRMED rows before enum replacement
UPDATE "Booking"
SET "status" = 'PENDING'
WHERE "status" = 'CONFIRMED';

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED');
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
