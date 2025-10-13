import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./src/config/db.js";
import { UserRoutes } from "./src/routes/user.routes.js";
import { groupRoutes } from "./src/routes/group.routes.js";
import { groupjoin } from "./src/routes/join.routes.js";

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Database Connection
connectDB();

// ✅ EJS view engine setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views")); // create folder src/views

// ✅ Optional: serve static files (for popup icons, CSS, etc.)
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/user", UserRoutes);
app.use("/api/v1/groups", groupRoutes);
app.use("/join", groupjoin);

// Root endpoint
app.get("/", (req, res) => {
  res.send("Auth API Running ✅");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
