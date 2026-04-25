ALTER TABLE "PayrollSettings"
ADD COLUMN "workDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';

CREATE TABLE "ShopNoWorkDay" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopNoWorkDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopNoWorkDay_shopId_date_key" ON "ShopNoWorkDay"("shopId", "date");
CREATE INDEX "ShopNoWorkDay_date_idx" ON "ShopNoWorkDay"("date");

ALTER TABLE "ShopNoWorkDay"
ADD CONSTRAINT "ShopNoWorkDay_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
