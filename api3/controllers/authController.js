const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
    try{
        const { name, email, password } = req.body;

        if (await User.findOne({ email })) 
            return res.status(400).json({ message: "User already exists" });
        await User.create({ 
            name, 
            email, 
            password: await bcrypt.hash(password, 10) 
        });
        res.status(201).json({ message: "Registered Successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


//LOGIN
const login = async (req, res) => {
    try{
        const { email, password } = req.body;
        const user = await User.findOne({ email });
    }
}