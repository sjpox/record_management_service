# Changelog

## [1.11.0] - 2026-07-22

### Added
- Password strength criteria enforced when changing password.
- Document type field on communications.
- Rotate support for images in PDF composition (vouchers, communications, other documents, index documents), alongside existing crop support.
- Optional watermark on composed PDFs — `composeToPdf` accepts a `watermark` string; when set, a diagonal semi-transparent "COPY" label is drawn on every page via PDFKit. `ComposePdfDto` extended with `watermark?: boolean`; all four compose-pdf endpoints (vouchers, communications, index documents, other documents) forward it through the service layer.
- Action item status change notifications — `toggleActionStatus` notifies all assignees and the communication creator when status changes (in-progress, completed, reopened), excluding the user who triggered it.
- Action item reply notifications — `addReply` notifies all assignees and the communication creator when a new reply is posted, excluding the sender.

### Fixed
- Raised the max photo upload count for communications to 40.
- Fixed PDF composition producing a misaligned/incorrect image when both crop and rotate were applied — rotation is now applied before the crop is measured and clamped to the rotated image's bounds.

## [1.10.0] - 2026-07-20

### Added
- Self-service password change endpoint (`PATCH /auth/change-password`), requiring the current password before setting a new one.

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
