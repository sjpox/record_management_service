# Record Management Service

A NestJS backend API for managing voucher records with MySQL, JWT authentication, and FTP file storage.

## Release Notes

### v1.5.0

**New Features**
- Automated database backup — scheduled cron job dumps MySQL/MariaDB via `mysqldump`, compresses to `.sql.gz`, and uploads to AWS S3
- Automated FTP files backup — scheduled cron job downloads all files from FTP, packages them into a `.zip` archive, and uploads to S3
- Both backups run twice daily (12:30 PM and 5:30 PM)
- Local fallback — when S3 is unreachable (e.g. no internet), backups are saved to a configurable local directory
- Manual backup API endpoints (JWT-protected):
  - `POST /backup/database` — trigger database backup
  - `POST /backup/ftp` — trigger FTP files backup
  - `POST /backup/all` — trigger both backups in parallel
- Cross-platform support — backup service works on both Windows and macOS/Linux (uses Node.js `zlib` instead of shell commands, configurable `MYSQLDUMP_PATH`)
- Image discrepancy reports — scheduled generation of data discrepancy reports between database records and FTP storage

**New Environment Variables**
- `BACKUP_S3_BUCKET` — S3 bucket for backups
- `BACKUP_S3_PREFIX` — S3 key prefix for database backups
- `BACKUP_S3_FTP_PREFIX` — S3 key prefix for FTP backups
- `BACKUP_LOCAL_DIR` — local fallback directory when S3 is unavailable
- `MYSQLDUMP_PATH` — path to `mysqldump` binary (defaults to `mysqldump`)
- `REPORTS_OUTPUT_DIR` — directory for discrepancy report output

**Dependencies Added**
- `@aws-sdk/client-s3` — AWS S3 uploads
- `archiver` — zip archive creation for FTP backups

### v1.4.0

**New Features**
- Compose PDF endpoint (`POST /vouchers/:id/compose-pdf`) — compose voucher images into a single A4-sized PDF for printing
  - Select specific images via `imageIds` in request body
  - Client-side crop support per image via `crops` parameter
  - Black & white print option via `?color=bw` query parameter
  - Optional document scan effect via `?scanEffect=true` query parameter
  - Images are fit-to-frame on A4 pages (595x842pt) with aspect ratio preserved and centered
  - Returns base64-encoded PDF in response (no server-side storage)
- Crop and replace images (`PUT /vouchers/:id/photos`) — crop existing images and overwrite originals on FTP via `crops` parameter
- Document scan effect for image display — enhanced image rendering when viewing voucher details (`GET /vouchers/:id/details`)
  - Applies normalize, contrast boost, brightness adjustment, and sharpening
- FTP data integrity check — voucher list and details endpoints now return `ftpFileCount` alongside DB image count (`_count.VoucherImages`) to detect data discrepancies between the database and FTP storage

**Changes**
- Uploaded images are now stored as JPEG (quality 85) without any scan effect applied — preserves original image fidelity
- Image display (`GET /vouchers/:id/details`) applies scan effect enhancement and returns images as PNG
- Added `pdfkit` dependency for PDF generation
- Added `sharp` image processing pipeline with scan effect (normalize, contrast, brightness, sharpen)

### v1.3.0

- Added scan effect, enhance image, and black & white option
- Use PNG format with backward compatibility
- Added pdfkit library

## Prerequisites

- Node.js 18+
- MySQL / MariaDB
- FTP Server (for file uploads)

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
# MySQL connection string
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/record_management_service"

# FTP Configuration
FTP_HOST=127.0.0.1
FTP_PORT=21
FTP_USER=ftpuser
FTP_PASSWORD=your_password
FTP_UPLOAD_DIR=/ftp

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=900            # Access token expiry in seconds (default: 15 minutes)
JWT_REFRESH_EXPIRES_IN=604800 # Refresh token expiry in seconds (default: 7 days)

# Server port
PORT=3000
```

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Production Deployment

### 1. Prepare the server

```bash
# Install Node.js 18+ and MySQL/MariaDB on your server
# Clone the repository
git clone <repo-url>
cd record_management_service
npm install --production
```

### 2. Configure environment

```bash
# Create .env with production values
cp .env .env.production

# Update with production database, FTP, and JWT settings
# IMPORTANT: Use a strong JWT_SECRET in production
```

### 3. Run database migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Build and start

```bash
npm run build
npm run start:prod
```

### 5. Process manager (recommended)

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start dist/main.js --name record-management-service

# Auto-restart on server reboot
pm2 startup
pm2 save

# View logs
pm2 logs record-management-service
```

## API Endpoints

Base URL: `http://localhost:3000/api`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | No | Login with employeeId and password |
| POST | `/auth/logout` | Yes | Invalidate current session |
| GET | `/auth/me` | Yes | Get current authenticated user |
| POST | `/auth/refresh` | No | Refresh access token |

**Login:**
```json
POST /api/auth/login
{
  "employeeId": "EMP001",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "Id": 1,
    "FirstName": "John",
    "LastName": "Doe",
    "EmployeeId": "EMP001",
    "Section": "Finance",
    "Role": "admin",
    "MobileNo": "09171234567",
    "Email": "john@example.com",
    "IsActive": true
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

**Refresh Token:**
```json
POST /api/auth/refresh
{
  "refreshToken": "eyJhbG..."
}
```

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all (paginated) |
| GET | `/users/:id` | Get by ID |
| POST | `/users` | Create new user |
| PUT | `/users/:id` | Update user |
| POST | `/users/:id/deactivate` | Deactivate user |
| DELETE | `/users/:id` | Delete user |

**Create User:**
```json
POST /api/users
{
  "FirstName": "John",
  "LastName": "Doe",
  "EmployeeId": "EMP001",
  "Password": "password123",
  "Section": "Finance",
  "Role": "admin",
  "MobileNo": "09171234567",
  "Email": "john@example.com"
}
```

### Vouchers (all endpoints require Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vouchers` | Get all (paginated, filterable) |
| GET | `/vouchers/stats` | Get voucher statistics |
| GET | `/vouchers/search?voucherNo=` | Search by voucher number |
| GET | `/vouchers/:id` | Get by ID |
| GET | `/vouchers/:id/details` | Get with photos (base64) |
| GET | `/vouchers/:id/photos` | Get photo list |
| POST | `/vouchers` | Create new (multipart/form-data) |
| PUT | `/vouchers/:id` | Update voucher |
| POST | `/vouchers/bulk` | Bulk create vouchers |
| POST | `/vouchers/:id/compose-pdf` | Compose images into PDF for printing |
| POST | `/vouchers/:id/archive` | Archive with photos (multipart/form-data) |
| POST | `/vouchers/:id/unarchive` | Unarchive and delete all photos |
| PUT | `/vouchers/:id/photos` | Add/delete/crop photos |

**Create Voucher (multipart/form-data):**
```
VoucherNo: "101-181020-307"
TransactionNo: "TXN-001"
Payee: "Juan Dela Cruz"
Particulars: "Office supplies"
ClaimType: "Supplies"
Amount: 5000.00
DateDisbursed: "2026-02-06"
photos: [files...]
```

**Filter Parameters (GET /vouchers):**
| Parameter | Description |
|-----------|-------------|
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 10) |
| `isArchived` | Filter by archived status (`true`/`false`) |
| `search` | Search across voucher no and transaction no |
| `voucherNo` | Filter by voucher number |
| `transactionNo` | Filter by transaction number |
| `payee` | Filter by payee |
| `claimType` | Filter by claim type |

**Bulk Create:**
```json
POST /api/vouchers/bulk
{
  "vouchers": [
    {
      "VoucherNo": "V-001",
      "TransactionNo": "TXN-001",
      "Payee": "Juan Dela Cruz",
      "Particulars": "Office supplies",
      "Amount": 5000.00,
      "DateDisbursed": "2026-02-06"
    }
  ]
}
```

**Compose PDF (print voucher images):**
```
POST /api/vouchers/:id/compose-pdf?color=bw&scanEffect=true
```
```json
{
  "imageIds": [1, 2, 3],
  "crops": [
    {
      "imageId": 1,
      "left": 50,
      "top": 100,
      "width": 800,
      "height": 600
    }
  ]
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `color` | Query | Set to `bw` for black & white print |
| `scanEffect` | Query | Set to `true` to apply document scan effect |
| `imageIds` | Body | Array of image IDs to include in PDF |
| `crops` | Body | Optional array of crop areas per image |

**Response:**
```json
{
  "fileType": "application/pdf",
  "fileSize": 123456,
  "base64": "JVBERi0xLjMK..."
}
```

**Update Photos (multipart/form-data):**
```
PUT /api/vouchers/:id/photos
deletePhotoIds: [1, 2]     (optional - photo IDs to delete)
photos: [files...]          (optional - new photos to add)
crops: [...]                (optional - crop and replace existing images)
```

**Crop and replace example (JSON body):**
```json
{
  "crops": [
    {
      "imageId": 5,
      "left": 50,
      "top": 100,
      "width": 800,
      "height": 600
    }
  ]
}
```

### Backup (all endpoints require Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/backup/database` | Trigger database backup manually |
| POST | `/backup/ftp` | Trigger FTP files backup manually |
| POST | `/backup/all` | Trigger both backups in parallel |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/files/*` | Serve file from FTP by path |

### Pagination

All list endpoints support pagination:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page |

**Response Format:**
```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── common.module.ts
│   ├── dto/
│   │   └── pagination.dto.ts
│   └── services/
│       └── ftp.service.ts
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── dto/
    │   ├── guards/
    │   ├── strategies/
    │   └── decorators/
    ├── users/
    ├── vouchers/
    ├── reports/
    │   ├── reports.module.ts
    │   ├── reports.service.ts
    │   ├── backup.service.ts
    │   └── backup.controller.ts
    ├── files/
    └── health/
```
