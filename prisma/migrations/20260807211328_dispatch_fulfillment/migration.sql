-- DropForeignKey
ALTER TABLE "Challan" DROP CONSTRAINT "Challan_dispatchId_fkey";

-- DropForeignKey
ALTER TABLE "DRF" DROP CONSTRAINT "DRF_recipientId_fkey";

-- AlterTable
ALTER TABLE "DRF" ALTER COLUMN "packageTier" SET DEFAULT 'BASIC',
ALTER COLUMN "selectionMode" SET DEFAULT 'ANONYMOUS';

-- AddForeignKey
ALTER TABLE "DRF" ADD CONSTRAINT "DRF_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challan" ADD CONSTRAINT "Challan_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "DispatchOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
