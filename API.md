# inkCRM API Endpoints & Health Specification

This document details the REST API specifications for **inkCRM**, including standard response status codes, payload structures, and health endpoints.

---

## 1. System Health & Readiness Endpoints

All health routes respond directly in JSON format and do **not** require authentication or tenant subdomain context headers.

### System Vital Status
- **Endpoint**: `GET /health`
- **Auth Required**: No
- **Response Code**: `200 OK`
- **Response Payload**:
```json
{
  "status": "UP",
  "timestamp": "2026-07-15T08:14:02.123Z"
}
```

### Database Readiness Status
- **Endpoint**: `GET /ready`
- **Auth Required**: No
- **Response Code**: `200 OK` (when DB is active) or `503 Service Unavailable` (when DB is down)
- **Response Payload**:
```json
{
  "status": "READY",
  "database": "connected"
}
```

### Application Version Specs
- **Endpoint**: `GET /version`
- **Auth Required**: No
- **Response Code**: `200 OK`
- **Response Payload**:
```json
{
  "version": "1.0.0",
  "environment": "production",
  "buildTime": "2026-07-15T08:14:02.123Z"
}
```

---

## 2. Core API Modules Spec (`/api/v1`)

All endpoints under `/api/v1` require:
1. `x-tenant-id` header (except `/auth/*` and tenant resolution routes).
2. `Authorization: Bearer <JWT_TOKEN>` header for protected resources.

| Route Prefix | Method | Endpoint | Description |
| :--- | :---: | :--- | :--- |
| `/auth` | POST | `/login` | Authenticate user credentials and resolve Tenant. |
| `/auth` | POST | `/register`| Register new tenant user. |
| `/auth` | POST | `/verify-mfa`| Verify face authentication attributes. |
| `/auth` | POST | `/refresh` | Get new access token from refresh token. |
| `/dashboard` | GET | `/metrics` | Get real-time metadata counts & funnel KPI charts. |
| `/records` | GET | `/:module` | Paginate custom module record lists. |
| `/records` | POST | `/:module` | Create a new custom record. |
| `/documents` | POST | `/upload` | Upload dynamic attachments and images (Max 10MB). |

---

## 3. Standard HTTP Return Codes

| HTTP Code | Category | Purpose | Typical JSON Response |
| :---: | :--- | :--- | :--- |
| `200` | Success | Request succeeded. Returns data. | `{"success": true, "data": ...}` |
| `201` | Created | Resource successfully created. | `{"success": true, "id": "..."}` |
| `400` | Bad Request | Invalid parameter payload validation failed. | `{"success": false, "error": "Invalid email format"}` |
| `401` | Unauthorized | Bearer token expired, invalid, or absent. | `{"success": false, "error": "Token expired"}` |
| `403` | Forbidden | Cross-tenant access denied or role lacking privileges. | `{"success": false, "error": "Access Denied"}` |
| `404` | Not Found | Resource or route endpoint does not exist. | `{"success": false, "error": "Record not found"}` |
| `429` | Too Many Requests | Rate limit exceeded. | `{"success": false, "error": "Too many attempts"}` |
| `500` | Server Error | Unhandled backend code exceptions. Stack traces hidden in prod. | `{"success": false, "error": "Internal Server Error"}` |
