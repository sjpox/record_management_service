# Record Management Service

A NestJS backend application for managing records with SQL Server and FTP file uploads.

## Prerequisites

- Node.js 18+
- SQL Server
- FTP Server (for file uploads)

## Installation

```bash
npm install
```

## Configuration

Update the `.env` file with your settings:

```env
# SQL Server connection string
DATABASE_URL="sqlserver://localhost:1433;database=record_management_service;user=sa;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true"

# FTP Configuration
FTP_HOST=127.0.0.1
FTP_PORT=21
FTP_USER=root
FTP_PASSWORD=admin
FTP_UPLOAD_DIR=/ftp

# Server port
PORT=3000
```

## Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

Base URL: `http://localhost:3000/api`

### Lookup Tables

#### DocOrigins
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/doc-origins` | Get all (paginated) |
| GET | `/doc-origins/:id` | Get by ID |
| POST | `/doc-origins` | Create new |
| PUT | `/doc-origins/:id` | Update |
| DELETE | `/doc-origins/:id` | Delete |

**Request Body (POST/PUT):**
```json
{
  "Origin": "string"
}
```

#### ResponPersons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/respon-persons` | Get all (paginated) |
| GET | `/respon-persons/:id` | Get by ID |
| POST | `/respon-persons` | Create new |
| PUT | `/respon-persons/:id` | Update |
| DELETE | `/respon-persons/:id` | Delete |

**Request Body (POST/PUT):**
```json
{
  "Name": "string",
  "ContactNo": "string",
  "IP_Add": "string",
  "Email": "string",
  "Department": "string"
}
```

#### DocTypes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/doc-types` | Get all (paginated) |
| GET | `/doc-types/:id` | Get by ID |
| POST | `/doc-types` | Create new |
| PUT | `/doc-types/:id` | Update |
| DELETE | `/doc-types/:id` | Delete |

**Request Body (POST/PUT):**
```json
{
  "Type": "string"
}
```

#### Receivers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/receivers` | Get all (paginated) |
| GET | `/receivers/:id` | Get by ID |
| POST | `/receivers` | Create new |
| PUT | `/receivers/:id` | Update |
| DELETE | `/receivers/:id` | Delete |

**Request Body (POST/PUT):**
```json
{
  "Department": "string"
}
```

#### StockRooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stock-rooms` | Get all (paginated) |
| GET | `/stock-rooms/:id` | Get by ID |
| POST | `/stock-rooms` | Create new |
| PUT | `/stock-rooms/:id` | Update |
| DELETE | `/stock-rooms/:id` | Delete |

**Request Body (POST/PUT):**
```json
{
  "RoomName": "string"
}
```

### Main Tables

#### Vouchers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vouchers` | Get all (paginated) |
| GET | `/vouchers/search?voucherNo=` | Search by voucher number |
| GET | `/vouchers/:id` | Get by ID (includes photos) |
| POST | `/vouchers` | Create new (multipart/form-data) |
| PUT | `/vouchers/:id` | Update |
| POST | `/vouchers/:id/photos` | Add photos (multipart/form-data) |
| DELETE | `/vouchers/:id/photos/:photoId` | Delete a photo |
| DELETE | `/vouchers/:id` | Delete voucher and all photos |

**Request Body (POST/PUT):**
```json
{
  "VoucherNo": "string (required)",
  "TrackNo": "string",
  "Payee": "string",
  "Particulars": "string",
  "Amount": "number",
  "DateReleased": "ISO date string",
  "Folder": "string",
  "RoomNo": "string",
  "DocTag": "string"
}
```

**Photo Upload (multipart/form-data):**
- Field name: `photos`
- Max files: 10
- Max file size: 10MB
- Allowed types: JPEG, PNG, GIF, WEBP, PDF

#### InComms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/in-comms` | Get all (paginated) |
| GET | `/in-comms/search?q=` | Search by particulars |
| GET | `/in-comms/:id` | Get by ID (includes photos) |
| POST | `/in-comms` | Create new (multipart/form-data) |
| PUT | `/in-comms/:id` | Update |
| POST | `/in-comms/:id/photos` | Add photos (multipart/form-data) |
| DELETE | `/in-comms/:id/photos/:photoId` | Delete a photo |
| DELETE | `/in-comms/:id` | Delete record and all photos |

**Request Body (POST/PUT):**
```json
{
  "DateReceived": "string",
  "DatePrepared": "string",
  "DocOrigin_Id": "number",
  "DocType": "string",
  "Particulars": "string",
  "RoutedToPA": "string",
  "dtToPA": "string",
  "Rerouted": "string",
  "dtRerouted": "string",
  "dtFilling": "string",
  "FilingArea": "string",
  "Folder": "string",
  "DocStatus": "string"
}
```

#### OutGoings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/out-goings` | Get all (paginated) |
| GET | `/out-goings/search?q=` | Search by particulars |
| GET | `/out-goings/:id` | Get by ID (includes photos) |
| POST | `/out-goings` | Create new (multipart/form-data) |
| PUT | `/out-goings/:id` | Update |
| POST | `/out-goings/:id/photos` | Add photos (multipart/form-data) |
| DELETE | `/out-goings/:id/photos/:photoId` | Delete a photo |
| DELETE | `/out-goings/:id` | Delete record and all photos |

**Request Body (POST/PUT):**
```json
{
  "DatePrepared": "string",
  "DocType": "string",
  "Particulars": "string",
  "ReceivedBy": "string",
  "DateTrans": "string",
  "ResponPerson_Id": "number",
  "ActionNeeded": "string",
  "ActionTime": "string",
  "dtFilling": "string",
  "FilingArea": "string",
  "Folder": "string",
  "DocStatus": "string",
  "EncodedBy": "string"
}
```

### Pagination

All list endpoints support pagination via query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page |

**Example:** `GET /api/vouchers?page=2&limit=20`

**Response Format:**
```json
{
  "data": [],
  "total": 100,
  "page": 2,
  "limit": 20,
  "totalPages": 5
}
```

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── prisma/
│   ├── prisma.module.ts       # Global Prisma module
│   └── prisma.service.ts      # Prisma client service
├── common/
│   ├── common.module.ts       # Global common module
│   ├── dto/
│   │   └── pagination.dto.ts  # Pagination DTO
│   └── services/
│       └── ftp.service.ts     # FTP upload service
└── modules/
    ├── doc-origins/
    ├── respon-persons/
    ├── doc-types/
    ├── receivers/
    ├── stock-rooms/
    ├── vouchers/
    ├── in-comms/
    └── out-goings/
```
