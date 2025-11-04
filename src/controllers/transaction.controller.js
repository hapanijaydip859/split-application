import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Group from "../models/Group.js";
import Transaction from "../models/Transaction.js";
import Settlement from "../models/Settlement.js";

export const createTransactionFromExpense = async (req, res) => {
  try {
    const { expenseId, from, to, amount, note } = req.body;
    const userId = req.user._id;

    // 1️⃣ Validate required fields
    if (!expenseId || !from || !to || !amount) {
      return res
        .status(400)
        .json({ message: "expenseId, from, to, and amount are required" });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    // 2️⃣ Find the expense
    const expense = await Expense.findById(expenseId).populate("group");
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // 3️⃣ Validate users are members of the group
    const group = await Group.findById(expense.group._id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = (id) =>
      group.members.some((m) => String(m.user) === String(id));
    if (!isMember(from) || !isMember(to)) {
      return res
        .status(403)
        .json({ message: "Both users must belong to this group" });
    }

    // 4️⃣ Create the transaction manually
    const transaction = await Transaction.create({
      group: expense.group._id,
      from,
      to,
      totalAmount: amount,
      remainingAmount: amount,
      description:
        note || expense.description || "Manual transaction from expense",
    });

    return res.status(201).json({
      message: "Transaction created manually from expense",
      data: transaction,
    });
  } catch (error) {
    console.error("❌ createTransactionFromExpense error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};


/**
 * @desc Get all Transactions for a Group
 * @route GET /api/v1/transactions/group/:groupId
 * @access Protected
 */
export const  getGroupTransactions = async (req, res) => {
  try {
    const { groupId } = req.params;

    const transactions = await Transaction.find({ group: groupId })
      .populate("from to", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const transactionsWithSettlements = await Promise.all(
      transactions.map(async (tx) => {
        const settlements = await Settlement.find({ transaction: tx._id })
          .populate("from to", "name email")
          .sort({ createdAt: -1 })
          .lean();

        const paidAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
        const remaining = Math.max(tx.totalAmount - paidAmount, 0);

        return {
          ...tx,
          settlements,
          paidAmount,
          remainingAmount: remaining,
          status:
            remaining === 0
              ? "settled"
              : remaining === tx.totalAmount
              ? "unpaid"
              : "partial",
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Group transactions fetched successfully",
      count: transactionsWithSettlements.length,
      data: transactionsWithSettlements,
    });
  } catch (error) {
    console.error("❌ getGroupTransactions error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * @desc Get a single Transaction (with settlements)
 * @route GET /api/v1/transactions/:id
 * @access Protected
 */
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
      .populate("from to group", "name email _id")
      .lean();
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    const settlements = await Settlement.find({ transaction: id })
      .populate("from to", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const paidAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
    const remaining = Math.max(transaction.totalAmount - paidAmount, 0);

    res.status(200).json({
      success: true,
      message: "Transaction details fetched successfully",
      data: {
        ...transaction,
        settlements,
        paidAmount,
        remainingAmount: remaining,
        status:
          remaining === 0
            ? "settled"
            : remaining === transaction.totalAmount
            ? "unpaid"
            : "partial",
      },
    });
  } catch (error) {
    console.error("❌ getTransactionById error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
