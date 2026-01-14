/*
  Warnings:

  - You are about to drop the `Vouchers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `Vouchers`;

-- CreateTable
CREATE TABLE `vouchers` (
    `uuid` VARCHAR(30) NOT NULL,
    `voucherNumber` VARCHAR(20) NOT NULL,

    PRIMARY KEY (`uuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
