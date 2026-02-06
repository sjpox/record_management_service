-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) NOT NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `employee_id` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `section` VARCHAR(255) NULL,
    `role` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `date_added` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login` DATETIME NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vouchers` (
    `voucher_id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(50) NOT NULL,
    `transaction_no` VARCHAR(50) NOT NULL,
    `payee` VARCHAR(255) NOT NULL,
    `particulars` TEXT NOT NULL,
    `claim_type` VARCHAR(255) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `date_disbursed` DATETIME NOT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `date_archived` DATETIME NULL,
    `date_added` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `date_last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `added_by` INTEGER NULL,
    `last_modified_by` INTEGER NULL,

    INDEX `vouchers_added_by_idx`(`added_by`),
    INDEX `vouchers_last_modified_by_idx`(`last_modified_by`),
    PRIMARY KEY (`voucher_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_images` (
    `voucher_image_id` INTEGER NOT NULL AUTO_INCREMENT,
    `image_file` VARCHAR(500) NOT NULL,
    `image_file_type` VARCHAR(50) NULL,
    `voucher_id` INTEGER NOT NULL,
    `evidenced_by` INTEGER NULL,

    INDEX `voucher_images_voucher_id_idx`(`voucher_id`),
    INDEX `voucher_images_evidenced_by_idx`(`evidenced_by`),
    PRIMARY KEY (`voucher_image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_added_by_fkey` FOREIGN KEY (`added_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_last_modified_by_fkey` FOREIGN KEY (`last_modified_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_images` ADD CONSTRAINT `voucher_images_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`voucher_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_images` ADD CONSTRAINT `voucher_images_evidenced_by_fkey` FOREIGN KEY (`evidenced_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
