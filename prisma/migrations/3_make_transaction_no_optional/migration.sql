-- Make transaction_no optional
ALTER TABLE `vouchers` MODIFY COLUMN `transaction_no` VARCHAR(50) NULL;
