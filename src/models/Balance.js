import mongoose from "mongoose";

const balanceSchema = new mongoose.Schema(
  {
    user1: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, default: 0 }, // +ve => user1 is owed, -ve => user1 owes
  },
  { timestamps: true }
);

export default mongoose.model("Balance", balanceSchema);
