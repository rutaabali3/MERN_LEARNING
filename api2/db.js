// MongoDB package se MongoClient le rahe hain
const { MongoClient } = require("mongodb");


// MongoDB ka local connection
const client = new MongoClient("mongodb://127.0.0.1:27017");


// MongoDB connection function
async function connectDB() {

    // MongoDB se connect
    await client.connect();

    console.log("MongoDB Connected");


    // employeeDB database return kar rahe hain
    return client.db("employeeDB");
}


// Function ko server.js mein use karne ke liye export
module.exports = connectDB;