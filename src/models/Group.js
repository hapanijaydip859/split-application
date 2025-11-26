import mongoose from "mongoose";
import { type } from "os";

const memberSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "member"], default: "member" },
    },
    { _id: false }
);

const groupSchema = new mongoose.Schema(
    {
        // group_id: {type: String , require: true , unique : true},
        name: { type: String, required: true, trim: true },
        currency: { type: String, default: "INR" },
        category: {
            type: String,
            enum: ["Trip", "Home", "Event", "Other"],
            default: "Other",
        },
        icon: { type: String, default: "🐦‍🔥" },
        members: [memberSchema],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        inviteToken: { type: String},
        expense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" }
    },
    { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
