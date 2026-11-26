const http = require("http");

const connectDB = require("./db");
const employeeCollection = require("./employee");


// GET
async function getEmployees(res, employees) {

    const data = await employees.find().toArray();

    res.end(JSON.stringify(data));
}


// POST
function addEmployee(req, res, employees) {

    let body = "";

    req.on("data", data => body += data);

    req.on("end", async () => {

        const employee = JSON.parse(body);

        await employees.insertOne(employee);

        res.end("Employee Added");
    });
}


// PUT
function updateEmployee(req, res, employees, id) {

    let body = "";

    req.on("data", data => body += data);

    req.on("end", async () => {

        const employee = JSON.parse(body);

        await employees.updateOne(
            { id: Number(id) },
            { $set: employee }
        );

        res.end("Employee Updated");
    });
}


// DELETE
async function deleteEmployee(res, employees, id) {

    await employees.deleteOne({
        id: Number(id)
    });

    res.end("Employee Deleted");
}


// SERVER
async function startServer() {

    const db = await connectDB();

    const employees = employeeCollection(db);

    const server = http.createServer((req, res) => {

        // GET
        if (req.method === "GET" && req.url === "/employees") {

            getEmployees(res, employees);

        }

        // POST
        else if (req.method === "POST" && req.url === "/employees") {

            addEmployee(req, res, employees);

        }

        // PUT
        else if (req.method === "PUT" && req.url.startsWith("/employees/")) {

            const id = req.url.split("/")[2];

            updateEmployee(req, res, employees, id);

        }

        // DELETE
        else if (req.method === "DELETE" && req.url.startsWith("/employees/")) {

            const id = req.url.split("/")[2];

            deleteEmployee(res, employees, id);

        }

        // Wrong Route
        else {

            res.end("Route Not Found");

        }

    });


    server.listen(3000, () => {

        console.log("Server Running on Port 3000");

    });
}


startServer();