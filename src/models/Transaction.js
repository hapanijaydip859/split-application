import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // debtor
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // creditor
    totalAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
