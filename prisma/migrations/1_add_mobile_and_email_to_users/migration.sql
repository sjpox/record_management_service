-- AlterTable: Add mobile_number and email columns with defaults for existing rows
ALTER TABLE `users` ADD COLUMN `mobile_number` VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NOT NULL DEFAULT '';
