import Settlement from "../models/Settlement.js";
import Group from "../models/Group.js";
import Expense from "../models/Expense.js";

export const createSettlement = async (req, res) => {
  try {
    const { groupId, from, to, expenseId, amount, note } = req.body;

    // ✅ Validate group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // ✅ Ensure both users belong to group
    const isFromMember = group.members.some((m) => String(m.user) === String(from));
    const isToMember = group.members.some((m) => String(m.user) === String(to));
    if (!isFromMember || !isToMember) {
      return res.status(400).json({
        success: false,
        message: "Both users must be part of this group",
      });
    }

    // ✅ Optional: check if expense exists
    if (expenseId) {
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return res.status(404).json({ success: false, message: "Expense not found" });
      }
    }

    // ✅ Calculate net owed amount between from → to
    // Step 1: get all group expenses
    const expenses = await Expense.find({ group: groupId })
      .populate("splitDetails.user", "name")
      .lean();

    // Step 2: initialize balances for both users
    let fromBalance = 0;
    let toBalance = 0;

    expenses.forEach((expense) => {
      expense.splitDetails.forEach((split) => {
        if (String(split.user._id) === String(from)) {
          if (split.type === "lent") fromBalance += split.amount;
          else if (split.type === "owes") fromBalance -= split.amount;
        }
        if (String(split.user._id) === String(to)) {
          if (split.type === "lent") toBalance += split.amount;
          else if (split.type === "owes") toBalance -= split.amount;
        }
      });
    });

    // Step 3: adjust based on previous settlements
    const settlements = await Settlement.find({ groupId }).lean();
    settlements.forEach((s) => {
      const f = String(s.from);
      const t = String(s.to);
      const amt = s.amount;

      if (f === String(from)) fromBalance += amt;
      if (t === String(from)) fromBalance -= amt;

      if (f === String(to)) toBalance += amt;
      if (t === String(to)) toBalance -= amt;
    });

    // Step 4: Determine how much "from" actually owes "to"
    // (If fromBalance < toBalance → from owes to)
    const fromOwesTo = Math.max(toBalance - fromBalance, 0);

    // ✅ Prevent overpayment
    if (amount > fromOwesTo) {
      return res.status(400).json({
        success: false,
        message: `Settlement exceeds owed amount. ${fromOwesTo === 0
          ? "No amount is due between these users."
          : `Max payable is ₹${fromOwesTo.toFixed(2)}.`}`,
      });
    }

    // ✅ Record new settlement
    const settlement = new Settlement({
      groupId,
      from,
      to,
      expenseId,
      amount,
      note,
    });

    await settlement.save();

    return res.status(201).json({
      success: true,
      message: "Settlement recorded successfully",
      data: settlement,
    });
  } catch (error) {
    console.error("❌ createSettlement Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to record settlement",
      error: error.message,
    });
  }
};
