# Changelog

## [1.9.0] - 2026-07-20

### Added
- Voucher ageing configuration, with a settable threshold (in days) for when a voucher is considered aged.
- Voucher deletion log — deleting a voucher from the source pool now snapshots its details before removal.
- Daily cron job to automatically mark overdue communication actions and recalculate the parent communication's status.
- Chat groups can now be managed (added/removed members) via the chat gateway and controller.
- PDF composition for communications, allowing communication images to be combined into a single document.

### Fixed
- Voucher deletion now records the deleted record's details (voucher no., payee, amount, etc.) in the audit log instead of just the delete action.

### Changed
- Upgraded dependencies and refactored the communications service.

## [1.8.0] - 2026-04-28

### Fixed
- Removed unused index and unique key constraints from the schema.
