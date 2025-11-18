import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Settlement", settlementSchema);
