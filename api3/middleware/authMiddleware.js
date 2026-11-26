const jwt = require('jsonwebtoken');
const protect = (req, res, next) => {
    const token = req.header.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Token Required" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: "Invalid Token" });
    }   

};

module.exports = protect;