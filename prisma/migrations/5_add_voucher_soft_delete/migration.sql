-- Create voucher deletion log table
CREATE TABLE `voucher_deletion_log` (
    `id`              INTEGER      NOT NULL AUTO_INCREMENT,
    `voucher_no`      VARCHAR(50)  NOT NULL,
    `transaction_no`  VARCHAR(50)  NULL,
    `payee`           VARCHAR(255) NOT NULL,
    `particulars`     TEXT         NOT NULL,
    `claim_type`      VARCHAR(255) NULL,
    `amount`          DECIMAL(18,2) NOT NULL,
    `date_disbursed`  DATETIME     NOT NULL,
    `is_archived`     TINYINT(1)   NOT NULL DEFAULT 0,
    `delete_reason`   TEXT         NOT NULL,
    `deleted_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_by_id`   INTEGER      NULL,

    PRIMARY KEY (`id`),
    CONSTRAINT `voucher_deletion_log_deleted_by_id_fkey`
      FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`user_id`)
      ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
