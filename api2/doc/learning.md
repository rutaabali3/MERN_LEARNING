# 📘 Master Learning Guide: Bare-Metal Node.js & MongoDB CRUD API

Welcome to the definitive learning guide for this project! This repository contains a **bare-metal CRUD (Create, Read, Update, Delete) REST API** built entirely with Node.js's native `http` module and the official MongoDB native driver (`mongodb`).

No Express, no Fastify, no heavyweight ORM/ODM—just pure, raw Node.js and MongoDB.

Studying bare-metal code is one of the most effective ways to understand how backend web servers work under the hood before moving to abstraction layers like Express, Fastify, or NestJS.

---

## 📑 Table of Contents

1. [High-Level Architecture & Request Lifecycle](#1-high-level-architecture--request-lifecycle)
2. [Core Fundamentals You Learn From This Code](#2-core-fundamentals-you-learn-from-this-code)
   - [The Node.js HTTP Server & Event Loop](#the-nodejs-http-server--event-loop)
   - [Streams & Buffers (Handling Request Bodies)](#streams--buffers-handling-request-bodies)
   - [Asynchronous JavaScript (async / await)](#asynchronous-javascript-async--await)
   - [MongoDB Native Driver Mechanics](#mongodb-native-driver-mechanics)
3. [File-by-File Deep Dive](#3-file-by-file-deep-dive)
   - [`db.js`: Database Connection Management](#dbjs-database-connection-management)
   - [`employee.js`: Collection Abstraction](#employeejs-collection-abstraction)
   - [`server.js`: Server Setup, Routing & Handlers](#serverjs-server-setup-routing--handlers)
   - [`package.json` & `packages-install.txt`: Dependency Analysis](#packagejson--packages-installtxt-dependency-analysis)
4. [CRUD Operations Breakdown](#4-crud-operations-breakdown)
5. [The "Aha!" Moments: Hidden Pitfalls & Gotchas](#5-the-aha-moments-hidden-pitfalls--gotchas)
6. [Why Web Frameworks (Express / Fastify) Exist](#6-why-web-frameworks-express--fastify-exist)
7. [Hands-On Practice Challenges](#7-hands-on-practice-challenges)

---

## 1. High-Level Architecture & Request Lifecycle

Below is the end-to-end journey of an HTTP request as it flows through this server:

```
[ Client / Browser / Postman / cURL ]
                 │
                 │ HTTP Request (e.g., POST /employees)
                 ▼
      ┌─────────────────────┐
      │  Node.js HTTP Server │  <-- http.createServer()
      │     (Port 3000)      │
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │    Route Matcher    │  <-- if (req.method === 'POST' && req.url === '/employees')
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  Body Stream Reader │  <-- req.on('data', chunk) -> req.on('end')
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  JSON.parse(body)   │  <-- Deserialize raw string into JavaScript Object
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │ MongoDB Native Wire │  <-- await employees.insertOne(employee)
      │     Driver          │
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │   MongoDB Daemon    │  <-- mongodb://127.0.0.1:27017/employeeDB
      │      (mongod)       │
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  HTTP Response Send │  <-- res.end("Employee Added")
      └─────────────────────┘
```

---

## 2. Core Fundamentals You Learn From This Code

### The Node.js HTTP Server & Event Loop

In modern frameworks, request listeners are hidden behind `app.get(...)` or `router.post(...)`. In `server.js`, you see the raw callback:

```javascript
const server = http.createServer((req, res) => {
    // Every single incoming HTTP request enters here!
});
```

- **Single-threaded Event Loop**: Node.js executes this callback on a single thread. When a request arrives, Node.js fires the callback.
- **`req` (`http.IncomingMessage`)**: A readable stream representing the incoming HTTP request (headers, method, URL, and body).
- **`res` (`http.ServerResponse`)**: A writable stream used to send HTTP headers and data back to the client.

### Streams & Buffers (Handling Request Bodies)

One of the biggest surprises for developers coming from Express is that **`req.body` does not exist by default in Node.js**.

In HTTP, a request payload can be huge (megabytes or gigabytes). Node.js reads request bodies in **chunks (Streams)** to prevent memory overflow:

```javascript
let body = "";

// 1. Data event: Fires every time a network packet chunk arrives
req.on("data", data => {
    body += data; // Converts binary Buffer to string and concatenates
});

// 2. End event: Fires once all packets have been received
req.on("end", async () => {
    const employee = JSON.parse(body);
    // Proceed with database operations...
});
```

#### What is happening under the hood?
1. The TCP socket receives network packets.
2. The Node.js C++ core translates packets into `Buffer` objects.
3. The `req` stream emits `'data'` events containing chunks.
4. When `body += data` is executed, JavaScript automatically coerces the `Buffer` into a string.
5. The `'end'` event signals that the client has closed the stream and all data is ready.

### Asynchronous JavaScript (`async` / `await`)

Database queries across a network are **I/O-bound** operations. They take milliseconds to return:

```javascript
async function getEmployees(res, employees) {
    // Non-blocking: While MongoDB fetches data, Node.js handles other incoming requests
    const data = await employees.find().toArray();
    res.end(JSON.stringify(data));
}
```

- Without `await`, `employees.find().toArray()` returns a `Promise { <pending> }`.
- Using `await` suspends the execution of `getEmployees` without blocking the main event loop, resuming when MongoDB returns the cursor results.

### MongoDB Native Driver Mechanics

Instead of an Object Data Modeling (ODM) layer like Mongoose, this project uses the official MongoDB driver (`mongodb`):

- **`MongoClient`**: Manages a connection pool to the MongoDB server daemon.
- **`client.db("employeeDB")`**: Selects or creates the database namespace.
- **`db.collection("employees")`**: Interacts with the document collection.
- **Direct BSON Operations**: Bypasses schema casting, sending raw JavaScript objects directly to MongoDB.

---

## 3. File-by-File Deep Dive

### `db.js`: Database Connection Management

Source: [db.js](file:///c:/Users/asp/Music/new/db.js)

```javascript
const { MongoClient } = require("mongodb");

const client = new MongoClient("mongodb://127.0.0.1:27017");

async function connectDB() {
    await client.connect();
    console.log("MongoDB Connected");
    return client.db("employeeDB");
}

module.exports = connectDB;
```

#### Concepts Illustrated:
1. **Module Pattern (`CommonJS`)**: Uses `require` and `module.exports`.
2. **MongoClient Instantiation**: Creates a client instance targeting the default local MongoDB port `27017`.
3. **Connection Pooling**: Under the hood, `MongoClient` maintains a pool of active sockets (default size: 100 connections) to reuse across requests.

---

### `employee.js`: Collection Abstraction

Source: [employee.js](file:///c:/Users/asp/Music/new/employee.js)

```javascript
function employeeCollection(db) {
    return db.collection("employees");
}

module.exports = employeeCollection;
```

#### Concepts Illustrated:
1. **Dependency Injection**: Takes the connected `db` instance as an argument and returns the target collection.
2. **Separation of Concerns**: Isolates the collection identifier (`"employees"`) from the server routing logic.

---

### `server.js`: Server Setup, Routing & Handlers

Source: [server.js](file:///c:/Users/asp/Music/new/server.js)

`server.js` is the core coordinator:

1. **Bootstrapping**:
   ```javascript
   async function startServer() {
       const db = await connectDB();
       const employees = employeeCollection(db);
       // ... creates server and binds to port 3000
   }
   ```
   Notice that the database connection is established **before** the HTTP server starts listening. This ensures no request is accepted until the database is ready.

2. **Manual Route Dispatching**:
   ```javascript
   if (req.method === "GET" && req.url === "/employees") { ... }
   else if (req.method === "POST" && req.url === "/employees") { ... }
   else if (req.method === "PUT" && req.url.startsWith("/employees/")) { ... }
   else if (req.method === "DELETE" && req.url.startsWith("/employees/")) { ... }
   else { res.end("Route Not Found"); }
   ```
   Without a router library, routing is implemented using basic string comparisons on `req.method` and `req.url`.

3. **URL Parameter Extraction**:
   ```javascript
   const id = req.url.split("/")[2];
   ```
   Splitting `/employees/101` by `/` produces:
   - index 0: `""`
   - index 1: `"employees"`
   - index 2: `"101"`

---

### `package.json` & `packages-install.txt`: Dependency Analysis

Let's examine `packages-install.txt`:
```bash
npm install init -y
npm install 
npm install mongodb mongoose
```

And `package.json`:
```json
{
  "dependencies": {
    "init": "^0.1.2",
    "mongodb": "^7.6.0"
  }
}
```

#### 💡 Learning Moment: The Accidental Package
Look closely at line 1: `npm install init -y`.
- The developer intended to run `npm init -y` (which initializes a new `package.json` with default values).
- By running `npm install init -y`, npm downloaded a third-party package named `init` from npmjs.org!
- **Lesson**: `npm init` is an npm CLI command, whereas `npm install <package>` installs a dependency.

---

## 4. CRUD Operations Breakdown

| Operation | HTTP Method | Route | MongoDB Driver Method | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Read (All)** | `GET` | `/employees` | `employees.find().toArray()` | Returns all employee documents as a JSON array |
| **Create** | `POST` | `/employees` | `employees.insertOne(employee)` | Inserts a new employee document |
| **Update** | `PUT` | `/employees/:id` | `employees.updateOne({ id: Number(id) }, { $set: employee })` | Modifies fields of an employee by custom numeric `id` |
| **Delete** | `DELETE` | `/employees/:id` | `employees.deleteOne({ id: Number(id) })` | Removes employee document by numeric `id` |

---

## 5. The "Aha!" Moments: Hidden Pitfalls & Gotchas

Working with raw Node.js exposes critical pitfalls that frameworks normally solve for you:

### Pitfall 1: The Missing Content-Type Header
When `getEmployees` runs:
```javascript
res.end(JSON.stringify(data));
```
Because no `res.setHeader("Content-Type", "application/json")` was specified, the browser/client receives this with no explicit content-type or as plain text. Frontend apps might not parse it automatically.

### Pitfall 2: The Default HTTP 200 Status Code Trap
In Node's `http` module, `res.end()` defaults to status code `200 OK`.
- If an employee is created, it returns `200` instead of `201 Created`.
- Even when a route doesn't match:
  ```javascript
  res.end("Route Not Found");
  ```
  This returns HTTP `200 OK` with the string `"Route Not Found"`, instead of an actual HTTP `404 Not Found` status!

### Pitfall 3: The Fatal `JSON.parse` Crash
In `addEmployee`:
```javascript
req.on("end", async () => {
    const employee = JSON.parse(body);
    await employees.insertOne(employee);
    res.end("Employee Added");
});
```
If a client sends invalid JSON (e.g. `{ name: "Alice", ` with a missing closing brace), `JSON.parse` throws an unhandled `SyntaxError`.
Because it is inside an asynchronous event listener with no `try...catch`, **the entire Node.js server process will crash and terminate immediately!**

### Pitfall 4: Denial of Service via Unbounded Stream
```javascript
let body = "";
req.on("data", data => body += data);
```
There is no limit on how much data a client can send. A malicious client could send a continuous stream of 2 Gigabytes. The server would keep concatenating it into RAM until Node.js runs out of memory (V8 Heap Exhaustion) and crashes.

### Pitfall 5: Numeric `id` vs MongoDB `_id`
Notice how updates and deletes are performed:
```javascript
await employees.updateOne({ id: Number(id) }, { $set: employee });
```
MongoDB automatically assigns a unique identifier named `_id` of type `ObjectId` (`ObjectId("66... ")`).
This project queries by a custom field `id`. If the client creates an employee without an explicit `id` field:
```json
{ "name": "John", "role": "Engineer" }
```
The document will have an `_id`, but no `id`. Subsequent PUT and DELETE requests targeting `/employees/1` will match **zero documents**!

---

## 6. Why Web Frameworks (Express / Fastify) Exist

Now that you've seen the raw implementation, you can appreciate what Express or Fastify do:

| Feature | Raw Node.js (`http`) | Express / Fastify |
| :--- | :--- | :--- |
| **Routing** | Manual string manipulation (`req.url.split('/')`) | Parameterized paths (`/employees/:id`) |
| **Body Parsing** | Manual stream listening (`req.on('data')`) | Middleware (`express.json()`) with size limits |
| **Status Codes** | Manual `res.statusCode = 404` | Fluent helpers (`res.status(201).json(...)`) |
| **Headers** | Manual `res.setHeader(...)` | Automatic JSON Content-Type and security headers |
| **Error Handling** | Unhandled errors crash the process | Centralized error-handling middleware |

---

## 7. Hands-On Practice Challenges

To solidify your understanding, try solving these 5 challenges:

1. **Challenge 1: Fix the 404 Route**
   Modify the fallback block so it sets `res.statusCode = 404` and returns `{"error": "Route Not Found"}` with `Content-Type: application/json`.
2. **Challenge 2: Implement `GET /employees/:id`**
   Add a route handler to fetch a single employee by their `id`. Return `404` if the employee does not exist.
3. **Challenge 3: Prevent JSON Crash with `try...catch`**
   Wrap the `JSON.parse(body)` in `addEmployee` and `updateEmployee` inside a `try...catch` block. If parsing fails, return HTTP `400 Bad Request`.
4. **Challenge 4: Enforce Request Payload Limits**
   Add a counter in `req.on("data")` to check if `body.length > 1e6` (1MB). If exceeded, destroy the connection with HTTP `413 Payload Too Large`.
5. **Challenge 5: Support MongoDB `ObjectId`**
   Import `const { ObjectId } = require("mongodb");` and update the search queries to allow finding documents by their native `_id`.

---
*Created as part of the engineering codebase documentation.*
