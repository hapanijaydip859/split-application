import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(402).json({message: "Authorization header missing or invalid"})
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user){return res.status(402).json({message: "User not found"})}


        req.user = user;
        next();
    } catch (error) {
       res.status(404).json({
        status: 'fail',
        message: error.message
       })
    }
};
