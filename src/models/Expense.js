import mongoose from "mongoose";

const splitDetailSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["lent", "owes"], required: true },
    amount: { type: Number, required: true },
    relatedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    description: String,
    amount: Number,
    splitType: String,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    splitDetails: [splitDetailSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
