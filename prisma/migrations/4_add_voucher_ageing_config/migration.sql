-- CreateTable
CREATE TABLE `voucher_ageing_config` (
    `config_id` INTEGER NOT NULL DEFAULT 1,
    `threshold_days` INTEGER NOT NULL DEFAULT 30,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by_id` INTEGER NULL,

    PRIMARY KEY (`config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `voucher_ageing_config` ADD CONSTRAINT `voucher_ageing_config_updated_by_id_fkey`
  FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default row
INSERT INTO `voucher_ageing_config` (`config_id`, `threshold_days`) VALUES (1, 30)
  ON DUPLICATE KEY UPDATE `config_id` = `config_id`;
