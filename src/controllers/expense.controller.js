import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Group from "../models/Group.js";
import Settlement from "../models/Settlement.js";

export const addExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, splitType, paidBy, includedMembers } = req.body;
    const createdBy = req.user._id;

    if (!description || !amount || !splitType || !paidBy)
      return res.status(400).json({ message: "Missing required fields" });

    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) return res.status(404).json({ message: "Group not found" });

    const allMembers = group.members.map((m) => String(m.user._id));

    const members =
      includedMembers?.length > 0
        ? includedMembers.filter((id) => allMembers.includes(String(id)))
        : allMembers;

    if (members.length < 2)
      return res.status(400).json({ message: "At least 2 members required for expense" });

    // 🔹 Step 1: Calculate per-member share
    const total = Number(amount);
    const perHead = total / members.length;
    const payer = String(paidBy);

    // 🔹 Step 2: Prepare splitDetails (same format)
    const splitDetails = [];

    // Record for payer → lent (total minus his own share)
    const payerShare = members.includes(payer) ? perHead : 0;
    const payerLent = total - payerShare;

    const owesUsers = members.filter((id) => id !== payer);

    if (payerLent > 0) {
      splitDetails.push({
        user: new mongoose.Types.ObjectId(payer),
        type: "lent",
        amount: +payerLent.toFixed(2),
        relatedUsers: owesUsers.map((id) => new mongoose.Types.ObjectId(id)),
      });
    }

    owesUsers.forEach((uid) => {
      splitDetails.push({
        user: new mongoose.Types.ObjectId(uid),
        type: "owes",
        amount: +perHead.toFixed(2),
        relatedUsers: [new mongoose.Types.ObjectId(payer)],
      });
    });

    // 🔹 Step 3: Save correctly — paidBy is a plain ObjectId
    const expense = await Expense.create({
      group: groupId,
      description,
      amount,
      splitType,
      paidBy: new mongoose.Types.ObjectId(paidBy), // ✅ FIXED
      splitDetails,
      createdBy,
    });

    // 🔹 Step 4: Response
    return res.status(201).json({
      message: "Expense added successfully",
      data: expense,
    });
  } catch (error) {
    console.error("❌ addExpense Error:", error.message);
    res.status(500).json({
      message: "Failed to add expense",
      error: error.message,
    });
  }
};

export const getGroupBalanceSummary = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // 1️⃣ Validate group
    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Get all expenses for this group
    const expenses = await Expense.find({ group: groupId })
      .populate("splitDetails.user", "name email")
      .populate("splitDetails.relatedUsers", "name email")
      .populate("paidBy", "name email")
      .lean();

    // 3️⃣ Initialize balances
    const balances = {};
    group.members.forEach((m) => (balances[m.user._id] = 0));

    // 4️⃣ Loop through all expenses to calculate balances
    expenses.forEach((expense) => {
      expense.splitDetails.forEach((split) => {
        const userIdStr = String(split.user._id);
        if (split.type === "lent") {
          balances[userIdStr] += split.amount;
        } else if (split.type === "owes") {
          balances[userIdStr] -= split.amount;
        }
      });
    });

    // 5️⃣ Adjust balances based on Settlements
    const settlements = await Settlement.find({ groupId }).sort({ createdAt: 1 }).lean();
    const latestSettlement = settlements.length ? settlements[settlements.length - 1] : null;

    settlements.forEach((settlement) => {
      const fromId = String(settlement.from);
      const toId = String(settlement.to);
      const amt = settlement.amount;

      // The payer ("from") has paid some amount — so they owe less
      if (balances[fromId] !== undefined) balances[fromId] += amt;

      // The receiver ("to") has received some money — so they are owed less
      if (balances[toId] !== undefined) balances[toId] -= amt;
    });

    // 6️⃣ Prepare summaryDetails for UI
    const summaryDetails = [];
    const currentUserBalance = balances[userId] || 0;

    for (const [uid, balance] of Object.entries(balances)) {
      if (uid === String(userId)) continue;

      const member = group.members.find((m) => String(m.user._id) === uid);
      if (!member) continue;

      const name = member.user.name;
      const email = member.user.email;

      // If current user lent money to this member
      if (currentUserBalance > 0 && balance < 0) {
        const amount = Math.min(Math.abs(balance), currentUserBalance);
        summaryDetails.push({
          text: `${name} owes you ₹${amount.toFixed(2)}`,
          type: "owed",
          name,
          email,
        });
      }

      // If current user owes this member
      if (currentUserBalance < 0 && balance > 0) {
        const amount = Math.min(balance, Math.abs(currentUserBalance));
        summaryDetails.push({
          text: `You owe ${name} ₹${amount.toFixed(2)}`,
          type: "owe",
          name,
          email,
        });
      }
    }

    // 7️⃣ Final response (added settlementId)
    res.status(200).json({
      success: true,
      message: "Group balance summary fetched successfully",
      data: {
        groupId,
        groupName: group.name,
        overallBalance: currentUserBalance,
        summaryDetails,
        memberBalances: Object.entries(balances).map(([uid, balance]) => {
          const member = group.members.find((m) => String(m.user._id) === uid);
          return {
            _id: uid,
            name: member ? member.user.name : "Unknown",
            balance,
          };
        }),
        settlementId: latestSettlement ? latestSettlement._id : null, // ✅ added here
      },
    });
  } catch (error) {
    console.error("❌ getGroupBalanceSummary Error:", error.message);
    res.status(500).json({
      message: "Failed to fetch group summary",
      error: error.message,
    });
  }
};




