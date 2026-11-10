-- AlterTable: track who added each action item
ALTER TABLE `comm_actions` ADD COLUMN `created_by` INT NULL;

-- CreateIndex
CREATE INDEX `comm_actions_created_by_idx` ON `comm_actions`(`created_by`);

-- AddForeignKey
ALTER TABLE `comm_actions` ADD CONSTRAINT `comm_actions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: actions created together with their communication were added by the communication's creator.
-- Actions added later (when editing) can't be attributed reliably and stay NULL.
UPDATE `comm_actions` a
JOIN `communications` c ON c.`comm_id` = a.`comm_id`
SET a.`created_by` = c.`created_by`
WHERE a.`created_by` IS NULL
  AND ABS(TIMESTAMPDIFF(SECOND, c.`created_at`, a.`created_at`)) <= 5;
