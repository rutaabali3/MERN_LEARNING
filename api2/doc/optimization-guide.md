# 🚀 Architecture & Optimization Blueprint

This guide provides concrete, actionable optimizations to transition the Employee API from an unhardened educational prototype into a robust, secure, and production-grade microservice.

---

## 📑 Table of Contents

1. [Optimization Overview & Metrics](#1-optimization-overview--metrics)
2. [Critical Code Refactorings (Before vs. After)](#2-critical-code-refactorings-before-vs-after)
   - [Safe Request Body Streaming & DoS Prevention](#safe-request-body-streaming--dos-prevention)
   - [Standardized JSON & HTTP Status Helper](#standardized-json--http-status-helper)
   - [Environment Configuration Management](#environment-configuration-management)
   - [MongoDB Query Optimization & Indexing](#mongodb-query-optimization--indexing)
   - [Graceful Shutdown & Connection Lifecycle](#graceful-shutdown--connection-lifecycle)
3. [Full Hardened Implementation (Native Node.js)](#3-full-hardened-implementation-native-nodejs)
4. [Modern Architecture Alternative (Fastify / Express + Zod)](#4-modern-architecture-alternative-fastify--express--zod)
5. [Performance Benchmarks & Tuning](#5-performance-benchmarks--tuning)

---

## 1. Optimization Overview & Metrics

| Dimension | Baseline Prototype | Hardened / Optimized Target |
| :--- | :--- | :--- |
| **Crash Vulnerability** | 💥 High (SyntaxError on bad JSON crashes node) | 🛡️ Zero (Graceful 400 Bad Request error response) |
| **DoS Vulnerability** | 💥 Unbounded memory allocation | 🛡️ Max 100KB payload limit with HTTP 413 |
| **REST Compliance** | ❌ Uniform 200 OK without JSON headers | ✅ Strict HTTP status codes (`200`, `201`, `400`, `404`, `500`) |
| **Database Performance** | 🐢 Full table scan on `id` ($O(N)$) | ⚡ Unique B-Tree Index lookup ($O(\log N)$) |
| **Memory on Large Collections** | 🐢 Loads entire collection into RAM | ⚡ Cursor pagination (`limit`, `skip`, or keyset) |
| **Configuration** | ❌ Hardcoded localhost strings | ✅ 12-Factor compliant via environment variables |
| **Process Lifecycle** | ❌ Process terminated abruptly on restart | ✅ Graceful drain of active requests and DB connection |

---

## 2. Critical Code Refactorings (Before vs. After)

### Safe Request Body Streaming & DoS Prevention

#### ❌ Before (Unsafe):
```javascript
function addEmployee(req, res, employees) {
    let body = "";
    req.on("data", data => body += data); // Vulnerable to memory flood
    req.on("end", async () => {
        const employee = JSON.parse(body); // Crashes server on invalid JSON!
        await employees.insertOne(employee);
        res.end("Employee Added");
    });
}
```

#### ✅ After (Hardened):
```javascript
function parseRequestBody(req, maxBytes = 100 * 1024) {
    return new Promise((resolve, reject) => {
        let body = "";
        let size = 0;

        req.on("data", chunk => {
            size += chunk.length;
            if (size > maxBytes) {
                const err = new Error("Payload Too Large");
                err.statusCode = 413;
                req.destroy();
                return reject(err);
            }
            body += chunk;
        });

        req.on("end", () => {
            if (!body.trim()) return resolve({});
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (err) {
                const parseErr = new Error("Malformed JSON: " + err.message);
                parseErr.statusCode = 400;
                reject(parseErr);
            }
        });

        req.on("error", err => reject(err));
    });
}
```

---

### Standardized JSON & HTTP Status Helper

#### ❌ Before (Unsafe):
```javascript
res.end(JSON.stringify(data)); // Missing Content-Type
res.end("Route Not Found");    // Still returns HTTP 200 OK!
```

#### ✅ After (Standardized Helper):
```javascript
function sendJSON(res, statusCode, payload) {
    const responseBody = JSON.stringify(payload);
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(responseBody),
        "X-Content-Type-Options": "nosniff"
    });
    res.end(responseBody);
}
```

---

### Environment Configuration Management

#### ❌ Before (Hardcoded in `db.js`):
```javascript
const client = new MongoClient("mongodb://127.0.0.1:27017");
return client.db("employeeDB");
```

#### ✅ After (Config Module `config.js`):
```javascript
require("dotenv").config();

module.exports = {
    PORT: parseInt(process.env.PORT || "3000", 10),
    MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
    DB_NAME: process.env.DB_NAME || "employeeDB",
    NODE_ENV: process.env.NODE_ENV || "development"
};
```

---

### MongoDB Query Optimization & Indexing

#### ❌ Before:
- Custom field `id` without index.
- Loads 10,000+ employees in memory with `employees.find().toArray()`.
- Updates ignore whether document actually existed.

#### ✅ After:
1. **Create Index on Boot**:
   ```javascript
   await employees.createIndex({ id: 1 }, { unique: true });
   ```
2. **Paginate Queries**:
   ```javascript
   async function getEmployees(req, res, employees) {
       const url = new URL(req.url, `http://${req.headers.host}`);
       const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
       const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
       const skip = (page - 1) * limit;

       const [data, total] = await Promise.all([
           employees.find({}, { projection: { _id: 0 } }).skip(skip).limit(limit).toArray(),
           employees.countDocuments()
       ]);

       sendJSON(res, 200, {
           success: true,
           pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
           data
       });
   }
   ```
3. **Verify Match on Update & Delete**:
   ```javascript
   const result = await employees.updateOne({ id: Number(id) }, { $set: updateData });
   if (result.matchedCount === 0) {
       return sendJSON(res, 404, { success: false, error: "Employee not found" });
   }
   sendJSON(res, 200, { success: true, message: "Employee updated successfully" });
   ```

---

### Graceful Shutdown & Connection Lifecycle

```javascript
function setupGracefulShutdown(server, mongoClient) {
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        
        server.close(async () => {
            console.log("HTTP server closed.");
            try {
                await mongoClient.close();
                console.log("MongoDB connection closed.");
                process.exit(0);
            } catch (err) {
                console.error("Error closing MongoDB:", err);
                process.exit(1);
            }
        });

        // Force shutdown after timeout
        setTimeout(() => {
            console.error("Forceful shutdown after timeout.");
            process.exit(1);
        }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}
```

---

## 3. Full Hardened Implementation (Native Node.js)

Below is the complete, self-contained, hardened architecture that solves every issue raised in the code review while preserving the zero-framework native Node.js core:

```javascript
/**
 * Hardened Native Node.js REST API
 */
const http = require("http");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = parseInt(process.env.PORT || "3000", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "employeeDB";
const MAX_BODY_BYTES = 100 * 1024; // 100 KB limit

// Standardized Response Helper
function sendJSON(res, statusCode, data) {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        "X-Content-Type-Options": "nosniff"
    });
    res.end(payload);
}

// Resilient Stream Body Parser
function readJSONBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        let bytesReceived = 0;

        req.on("data", chunk => {
            bytesReceived += chunk.length;
            if (bytesReceived > MAX_BODY_BYTES) {
                const err = new Error("Payload Too Large");
                err.statusCode = 413;
                req.destroy();
                return reject(err);
            }
            body += chunk;
        });

        req.on("end", () => {
            if (!body.trim()) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                const parseErr = new Error("Invalid JSON: " + err.message);
                parseErr.statusCode = 400;
                reject(parseErr);
            }
        });

        req.on("error", err => reject(err));
    });
}

// Main Bootstrap
async function start() {
    const client = new MongoClient(MONGO_URI, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000
    });

    await client.connect();
    console.log("Connected to MongoDB successfully");

    const db = client.db(DB_NAME);
    const employees = db.collection("employees");

    // Ensure index on 'id'
    await employees.createIndex({ id: 1 }, { unique: true });

    const server = http.createServer(async (req, res) => {
        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
            const pathname = parsedUrl.pathname;
            const method = req.method;

            // Health Check
            if (method === "GET" && pathname === "/health") {
                await db.command({ ping: 1 });
                return sendJSON(res, 200, { status: "UP", database: "connected" });
            }

            // GET /employees (List with pagination)
            if (method === "GET" && pathname === "/employees") {
                const page = Math.max(1, parseInt(parsedUrl.searchParams.get("page") || "1", 10));
                const limit = Math.min(100, Math.max(1, parseInt(parsedUrl.searchParams.get("limit") || "20", 10)));
                const skip = (page - 1) * limit;

                const [list, total] = await Promise.all([
                    employees.find({}, { projection: { _id: 0 } }).skip(skip).limit(limit).toArray(),
                    employees.countDocuments()
                ]);

                return sendJSON(res, 200, {
                    data: list,
                    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
                });
            }

            // GET /employees/:id (Single employee)
            if (method === "GET" && pathname.startsWith("/employees/")) {
                const rawId = pathname.split("/")[2];
                const numId = Number(rawId);
                if (isNaN(numId)) {
                    return sendJSON(res, 400, { error: "Invalid Employee ID; must be numeric" });
                }

                const emp = await employees.findOne({ id: numId }, { projection: { _id: 0 } });
                if (!emp) {
                    return sendJSON(res, 404, { error: `Employee #${numId} not found` });
                }
                return sendJSON(res, 200, { data: emp });
            }

            // POST /employees (Create)
            if (method === "POST" && pathname === "/employees") {
                const body = await readJSONBody(req);
                if (!body.id || !body.name) {
                    return sendJSON(res, 400, { error: "Fields 'id' and 'name' are required" });
                }

                const exists = await employees.findOne({ id: Number(body.id) });
                if (exists) {
                    return sendJSON(res, 409, { error: `Employee #${body.id} already exists` });
                }

                const newEmployee = {
                    id: Number(body.id),
                    name: String(body.name),
                    role: body.role ? String(body.role) : "General",
                    salary: body.salary ? Number(body.salary) : 0,
                    createdAt: new Date()
                };

                await employees.insertOne(newEmployee);
                return sendJSON(res, 201, { message: "Employee Created", data: newEmployee });
            }

            // PUT /employees/:id (Update)
            if (method === "PUT" && pathname.startsWith("/employees/")) {
                const rawId = pathname.split("/")[2];
                const numId = Number(rawId);
                if (isNaN(numId)) {
                    return sendJSON(res, 400, { error: "Invalid Employee ID; must be numeric" });
                }

                const body = await readJSONBody(req);
                const updateFields = {};
                if (body.name !== undefined) updateFields.name = String(body.name);
                if (body.role !== undefined) updateFields.role = String(body.role);
                if (body.salary !== undefined) updateFields.salary = Number(body.salary);
                updateFields.updatedAt = new Date();

                const result = await employees.updateOne({ id: numId }, { $set: updateFields });
                if (result.matchedCount === 0) {
                    return sendJSON(res, 404, { error: `Employee #${numId} not found` });
                }

                return sendJSON(res, 200, { message: "Employee Updated", updatedFields });
            }

            // DELETE /employees/:id (Delete)
            if (method === "DELETE" && pathname.startsWith("/employees/")) {
                const rawId = pathname.split("/")[2];
                const numId = Number(rawId);
                if (isNaN(numId)) {
                    return sendJSON(res, 400, { error: "Invalid Employee ID; must be numeric" });
                }

                const result = await employees.deleteOne({ id: numId });
                if (result.deletedCount === 0) {
                    return sendJSON(res, 404, { error: `Employee #${numId} not found` });
                }

                return sendJSON(res, 200, { message: "Employee Deleted" });
            }

            // 404 Fallback
            return sendJSON(res, 404, { error: "Route Not Found", method, path: pathname });

        } catch (err) {
            console.error("Unhandled Request Error:", err);
            const statusCode = err.statusCode || 500;
            return sendJSON(res, statusCode, { error: err.message || "Internal Server Error" });
        }
    });

    server.listen(PORT, () => {
        console.log(`Production server running on http://localhost:${PORT}`);
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        server.close(async () => {
            console.log("HTTP server closed.");
            await client.close();
            console.log("MongoDB connection closed.");
            process.exit(0);
        });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(err => {
    console.error("Fatal Startup Error:", err);
    process.exit(1);
});
```

---

## 4. Modern Architecture Alternative (Fastify / Express + Zod)

For enterprise development, moving to a modular framework like **Fastify** or **Express** with **Zod** schema validation provides automatic type checking, OpenAPI generation, and automated body parsing.

### Proposed Directory Structure:
```
src/
├── config/             # Environment configuration (dotenv)
│   └── env.js
├── database/           # Connection and schema setup
│   └── mongo.js
├── modules/
│   └── employee/
│       ├── employee.schema.js     # Zod schema validation
│       ├── employee.repository.js # Database CRUD queries
│       ├── employee.service.js    # Business logic & authorization
│       ├── employee.controller.js # HTTP request/response mapping
│       └── employee.routes.js     # Route definitions
├── middleware/
│   ├── errorHandler.js # Centralized error handler
│   └── rateLimiter.js  # Brute-force & DoS protection
└── app.js              # Application entry point
```

### Example Zod Schema (`employee.schema.js`):
```javascript
const { z } = require("zod");

const EmployeeSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(2).max(100),
    role: z.string().min(2).max(50).default("Staff"),
    salary: z.number().nonnegative().optional()
});

const UpdateEmployeeSchema = EmployeeSchema.partial().omit({ id: true });

module.exports = { EmployeeSchema, UpdateEmployeeSchema };
```

---

## 5. Performance Benchmarks & Tuning

### MongoDB Connection Pool Tuning
Configure the pool size based on expected concurrent load:
```javascript
const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 50, // Limits maximum concurrent sockets
    minPoolSize: 5,  // Keeps warmed sockets ready
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000
});
```

### Node.js Cluster Mode / PM2
Since Node.js runs on a single core, optimize CPU utilization using Node.js `cluster` or a process manager like **PM2**:
```bash
# Run in cluster mode across all CPU cores
pm2 start server.js -i max --name employee-api
```

---
*Created as part of the engineering optimization suite.*
