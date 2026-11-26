# 📖 Employee REST API Reference & Contract Specification

This document details the HTTP REST API endpoints, schemas, status codes, and test payloads for the Employee Service.

---

## 🌐 Base URL & Protocol

| Environment | Base URL | Protocol |
| :--- | :--- | :--- |
| **Local Development** | `http://localhost:3000` | HTTP/1.1 |
| **Default Content-Type** | `application/json` | UTF-8 |

---

## 📋 Endpoints Overview

| Method | Endpoint | Description | Status Code (Success) |
| :--- | :--- | :--- | :--- |
| `GET` | `/employees` | Retrieve a list of all employees (supports pagination) | `200 OK` |
| `GET` | `/employees/:id` | Retrieve single employee details by ID | `200 OK` |
| `POST` | `/employees` | Register a new employee | `201 Created` |
| `PUT` | `/employees/:id` | Update fields of an existing employee by ID | `200 OK` |
| `DELETE` | `/employees/:id` | Delete an employee by ID | `200 OK` / `204 No Content` |
| `GET` | `/health` | Service and database health check | `200 OK` |

---

## 🔍 Detailed Endpoint Specifications

### 1. Retrieve All Employees

#### Request
- **Method**: `GET`
- **Path**: `/employees`
- **Query Parameters (Optional)**:
  - `page` *(integer, optional, default: 1)*: Page number.
  - `limit` *(integer, optional, default: 20, max: 100)*: Items per page.

#### Response (200 OK)
```json
[
  {
    "_id": "673cf298b4c09d6f83ab1234",
    "id": 101,
    "name": "Jane Doe",
    "role": "Senior Software Engineer",
    "salary": 115000
  },
  {
    "_id": "673cf298b4c09d6f83ab1235",
    "id": 102,
    "name": "John Smith",
    "role": "Product Manager",
    "salary": 120000
  }
]
```

#### cURL Example:
```bash
curl -X GET http://localhost:3000/employees \
     -H "Accept: application/json"
```

---

### 2. Retrieve Single Employee

#### Request
- **Method**: `GET`
- **Path**: `/employees/:id`
- **URL Parameters**:
  - `id` *(number, required)*: The unique numeric employee identifier.

#### Responses:
- **`200 OK`**:
```json
{
  "id": 101,
  "name": "Jane Doe",
  "role": "Senior Software Engineer",
  "salary": 115000
}
```
- **`404 Not Found`**:
```json
{
  "error": "Employee #999 not found"
}
```
- **`400 Bad Request`**:
```json
{
  "error": "Invalid Employee ID; must be numeric"
}
```

#### cURL Example:
```bash
curl -X GET http://localhost:3000/employees/101
```

---

### 3. Create a New Employee

#### Request
- **Method**: `POST`
- **Path**: `/employees`
- **Headers**: `Content-Type: application/json`
- **Body Schema**:
```json
{
  "id": 103,
  "name": "Alice Johnson",
  "role": "DevOps Engineer",
  "salary": 105000
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Number` | **Yes** | Unique identifier for the employee |
| `name` | `String` | **Yes** | Full name of the employee |
| `role` | `String` | No | Job title / department (default: `"General"`) |
| `salary` | `Number` | No | Annual compensation |

#### Responses:
- **`201 Created`**:
```json
{
  "message": "Employee Added",
  "data": {
    "id": 103,
    "name": "Alice Johnson",
    "role": "DevOps Engineer",
    "salary": 105000
  }
}
```
- **`400 Bad Request`**:
```json
{
  "error": "Malformed JSON: Unexpected token in JSON at position 12"
}
```
- **`409 Conflict`**:
```json
{
  "error": "Employee #103 already exists"
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/employees \
     -H "Content-Type: application/json" \
     -d '{"id": 103, "name": "Alice Johnson", "role": "DevOps Engineer", "salary": 105000}'
```

---

### 4. Update an Employee

#### Request
- **Method**: `PUT`
- **Path**: `/employees/:id`
- **Headers**: `Content-Type: application/json`
- **URL Parameters**:
  - `id` *(number, required)*: Target employee's ID.
- **Body Schema (Partial updates permitted)**:
```json
{
  "role": "Lead DevOps Architect",
  "salary": 135000
}
```

#### Responses:
- **`200 OK`**:
```json
{
  "message": "Employee Updated",
  "updatedFields": {
    "role": "Lead DevOps Architect",
    "salary": 135000
  }
}
```
- **`404 Not Found`**:
```json
{
  "error": "Employee #103 not found"
}
```

#### cURL Example:
```bash
curl -X PUT http://localhost:3000/employees/103 \
     -H "Content-Type: application/json" \
     -d '{"role": "Lead DevOps Architect", "salary": 135000}'
```

---

### 5. Delete an Employee

#### Request
- **Method**: `DELETE`
- **Path**: `/employees/:id`
- **URL Parameters**:
  - `id` *(number, required)*: Target employee's ID.

#### Responses:
- **`200 OK`**:
```json
{
  "message": "Employee Deleted"
}
```
- **`404 Not Found`**:
```json
{
  "error": "Employee #103 not found"
}
```

#### cURL Example:
```bash
curl -X DELETE http://localhost:3000/employees/103
```

---

### 6. Health Check Probe

#### Request
- **Method**: `GET`
- **Path**: `/health`

#### Response (200 OK):
```json
{
  "status": "UP",
  "database": "connected",
  "timestamp": "2026-11-24T15:15:00.000Z"
}
```

---

## ⚠️ Standard Error Response Format

All error responses from the API adhere to the following consistent JSON structure:

```json
{
  "error": "Human readable error description",
  "statusCode": 404,
  "timestamp": "2026-11-24T15:15:00.000Z"
}
```

---
*Created as part of the engineering API documentation suite.*
