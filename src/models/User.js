import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    mo: {
      type: String,
      required: [true, "Mobile number is required"],
      match: [/^[0-9]{10}$/, "Mobile number must be 10 digits"],
    
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
     
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
