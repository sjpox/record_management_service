# Record Management Service

A NestJS backend API for managing voucher records with MySQL, JWT authentication, and FTP file storage.

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
| POST | `/vouchers/:id/archive` | Archive with photos (multipart/form-data) |
| POST | `/vouchers/:id/unarchive` | Unarchive and delete all photos |
| PUT | `/vouchers/:id/photos` | Add/delete photos |

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

**Update Photos (multipart/form-data):**
```
PUT /api/vouchers/:id/photos
deletePhotoIds: [1, 2]     (optional - photo IDs to delete)
photos: [files...]          (optional - new photos to add)
```

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
    ├── files/
    └── health/
```
