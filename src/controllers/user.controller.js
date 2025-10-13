import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ✅ Password validation regex
const passwordRegex =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

// ---------------- SIGNUP ----------------
export const signup = async (req, res) => {
  try {
    const { name, mo, email, password } = req.body;

    const requiredFields = { name, mo, email, password };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({ message: `${key} is required` });
      }
    }
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters, include 1 uppercase letter, 1 number, and 1 special character.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { mo }],
    });
    if (existingUser) {
      return res.status(400).json({
        message: "Email or Mobile number already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      mo,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        mo: user.mo,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
};

// ---------------- LOGIN ----------------
export const login = async (req, res) => {
  try {
    const { mo, email, password } = req.body;

    // ✅ Step 1: Check required fields
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (!email && !mo) {
      return res
        .status(400)
        .json({ message: "Please enter your email or mobile number" });
    }

    // ✅ Step 2: Find user by email or mobile
    const user = await User.findOne({
      $or: [{ email }, { mo }],
    });

    if (!user) {
      return res.status(404).json({
        message: email
          ? "No account found with this email"
          : "No account found with this mobile number",
      });
    }

    // ✅ Step 3: Compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        message: "Incorrect password. Please try again.",
      });
    }

    // ✅ Step 4: Generate JWT on success
    const token = jwt.sign(
      { id: user._id, email: user.email, mo: user.mo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

