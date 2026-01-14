-- CreateTable
CREATE TABLE `Vouchers` (
    `uuid` VARCHAR(30) NOT NULL,
    `voucherNumber` VARCHAR(20) NOT NULL,

    PRIMARY KEY (`uuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
