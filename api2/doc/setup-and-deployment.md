# 🛠️ Setup, Configuration & Deployment Guide

This guide walks through local installation, environment configuration, database setup, and production deployment options for the Employee REST API.

---

## 📋 Prerequisites

Before running the project, verify that your development environment has:
- **Node.js**: v18.x or v20.x+ LTS ([nodejs.org](https://nodejs.org))
- **npm**: v9.x or v10.x+
- **MongoDB**: Local Community Server (v6.x or v7.x) OR Docker installed.

Verify installations:
```bash
node -v
npm -v
mongod --version
```

---

## ⚙️ Step 1: Cleaning & Configuring `package.json`

Currently, `package.json` contains an accidental dependency (`init`) and lacks standard npm scripts.

### Recommended `package.json`:
```json
{
  "name": "employee-api",
  "version": "1.0.0",
  "description": "Employee CRUD REST API with Node.js and MongoDB",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "mongodb": "^7.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

### Install Dependencies:
```bash
# Clean install standard dependencies
npm install dotenv mongodb
npm install -D nodemon
```

---

## 🗄️ Step 2: Database Setup

The API expects a running MongoDB instance at `mongodb://127.0.0.1:27017`.

### Option A: Using Docker (Recommended for Developers)
Spin up an isolated MongoDB container in seconds:
```bash
docker run -d \
  --name local-mongo \
  -p 27017:27017 \
  -v mongo_data:/data/db \
  mongo:7.0
```

### Option B: Local MongoDB Service (Windows / macOS / Linux)
- **Windows**: Verify that the `MongoDB` Windows Service is started in `services.msc`, or run:
  ```powershell
  net start MongoDB
  ```
- **macOS (Homebrew)**:
  ```bash
  brew services start mongodb-community@7.0
  ```
- **Linux (systemd)**:
  ```bash
  sudo systemctl start mongod
  ```

---

## 🔐 Step 3: Environment Configuration (`.env`)

Create a `.env` file in the root of the project to isolate secrets and configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://127.0.0.1:27017
DB_NAME=employeeDB

# Security & Limits
MAX_PAYLOAD_BYTES=102400
```

---

## 🚀 Step 4: Running the Server

### Development Mode (with Live Reloading):
If using Node 18+:
```bash
node --watch server.js
```
Or with `nodemon`:
```bash
npx nodemon server.js
```

### Production Mode:
```bash
npm start
```

You should see:
```
MongoDB Connected
Server Running on Port 3000
```

---

## 🧪 Step 5: Verification & Testing

Execute these quick cURL commands in your terminal to verify end-to-end functionality:

```bash
# 1. Check all employees (Initially empty array [])
curl -X GET http://localhost:3000/employees

# 2. Insert a new employee
curl -X POST http://localhost:3000/employees \
     -H "Content-Type: application/json" \
     -d '{"id": 1, "name": "John Doe", "role": "Software Engineer", "salary": 90000}'

# 3. Retrieve all employees to confirm insertion
curl -X GET http://localhost:3000/employees

# 4. Update the employee's role
curl -X PUT http://localhost:3000/employees/1 \
     -H "Content-Type: application/json" \
     -d '{"role": "Senior Software Engineer", "salary": 110000}'

# 5. Delete the employee
curl -X DELETE http://localhost:3000/employees/1
```

---

## 🐳 Step 6: Full Containerization with Docker Compose

For a 1-click reproducible environment, create a `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  api:
    build: .
    container_name: employee-api
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - MONGO_URI=mongodb://mongo:27017
      - DB_NAME=employeeDB
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:7.0
    container_name: employee-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

### Dockerfile for API:
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Start Entire Stack:
```bash
docker-compose up -d
```

---

## 🛡️ Production Readiness Checklist

Before deploying this service to a live production cluster:

- [ ] **Environment Isolation**: Ensure `.env` is listed in `.gitignore` and credentials are supplied via Secret Managers (AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault).
- [ ] **Error Boundaries**: Verify no unhandled `try/catch` or stream listeners can crash the process.
- [ ] **Rate Limiting**: Apply an upstream reverse proxy (Nginx, Cloudflare, or AWS ALB) to prevent HTTP request flooding.
- [ ] **Database Connection Pooling**: Ensure `maxPoolSize` and timeout parameters match your database tier capacity.
- [ ] **Logging & Monitoring**: Forward stdout JSON logs to an aggregation service (Datadog, Grafana Loki, or CloudWatch).

---
*Created as part of the engineering operational documentation.*
