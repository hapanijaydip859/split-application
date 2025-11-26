
// import Group from "../models/Group.js";
import Expense from "../models/Expense.js";
import mongoose from "mongoose";
import Settlement from "../models/Settlement.js";
import Balance from "../models/Balance.js";
import Group from "../models/Group.js";
import User from "../models/User.js";

// export const getSettleSummary = async (req, res) => {

  
export const getSettleSummary = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id.toString();

    // 1️⃣ Group + members fetch
    const group = await Group.findById(groupId).populate("members.user", "name");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const members = group.members.map((m) => ({
      id: m.user._id.toString(),
      name: m.user.name,
    }));

    // 2️⃣ Balance matrix: balance[debtor][creditor] = amount owed
    const balance = {};
    members.forEach((a) => {
      balance[a.id] = {};
      members.forEach((b) => {
        if (a.id !== b.id) balance[a.id][b.id] = 0;
      });
    });

    // 3️⃣ Apply EXPENSES (only 'lent' rows)
    const expenses = await Expense.find({ group: groupId });

    expenses.forEach((exp) => {
      exp.splitDetails.forEach((sd) => {
        if (sd.type !== "lent") return;

        const creditor = sd.user.toString();               // payer / lent user
        const related = sd.relatedUsers.map((u) => u.toString());

        if (!related.length) return;

        const perHead = sd.amount / related.length;

        related.forEach((debtor) => {
          balance[debtor][creditor] =
            (balance[debtor][creditor] || 0) + perHead;
        });
      });
    });

    // 4️⃣ Apply SETTLEMENTS
    // 👉 fromUser = creditor, toUser = debtor  (tame je rite use karo chho te mujab)
    const settlements = await Settlement.find({ group: groupId });

    settlements.forEach((s) => {
      const creditor = s.fromUser.toString();
      const debtor = s.toUser.toString();
      const amt = Number(s.amount) || 0;

      if (!balance[debtor]) balance[debtor] = {};
      if (!balance[debtor][creditor]) balance[debtor][creditor] = 0;

      balance[debtor][creditor] -= amt;

      // negative avoid
      if (balance[debtor][creditor] < 0) {
        balance[debtor][creditor] = 0;
      }
    });

    // 5️⃣ AUTO NETTING (A owes B & B owes A → net)
    members.forEach((a) => {
      members.forEach((b) => {
        if (a.id === b.id) return;

        const ab = balance[a.id][b.id] || 0; // a owes b
        const ba = balance[b.id][a.id] || 0; // b owes a

        if (ab > 0 && ba > 0) {
          const net = Math.abs(ab - ba);

          if (ab > ba) {
            balance[a.id][b.id] = net;
            balance[b.id][a.id] = 0;
          } else {
            balance[b.id][a.id] = net;
            balance[a.id][b.id] = 0;
          }
        }
      });
    });

    // 6️⃣ Build response for logged-in user
    const result = [];
    const EPS = 0.0001;

    members.forEach((m) => {
      if (m.id === userId) return;

      const youOwe = balance[userId][m.id] || 0;   // you -> them
      const theyOwe = balance[m.id][userId] || 0;  // them -> you

      const net = theyOwe - youOwe;

      if (Math.abs(net) < EPS) return; // settled

      if (net > 0) {
        // They owe you
        result.push({
          userId: m.id,
          name: m.name,
          status: "you are owed",
          amount: Math.round(net * 100) / 100,
        });
      } else {
        // You owe them
        result.push({
          userId: m.id,
          name: m.name,
          status: "you owe",
          amount: Math.round(Math.abs(net) * 100) / 100,
        });
      }
    });

    return res.status(200).json({
      message: "Settle-up summary",
      data: result,
    });
  } catch (err) {
    console.error("❌ getSettleSummary error:", err);
    return res.status(500).json({
      message: "Failed to calculate settle summary",
      error: err.message,
    });
  }
};


//   try {
//     const { groupId } = req.params;
//     const userId = req.user._id.toString();

//     const group = await Group.findById(groupId).populate("members.user", "name email");
//     if (!group) return res.status(404).json({ message: "Group not found" });

//     const isMember = group.members.some(m => String(m.user._id) === userId);
//     if (!isMember)
//       return res.status(403).json({ message: "You are not a member of this group" });

//     const expenses = await Expense.find({ group: groupId }).populate({
//       path: "splitDetails.user splitDetails.relatedUsers",
//       select: "name email"
//     });

//     const summaryMap = {};

//     expenses.forEach(exp => {
//       exp.splitDetails.forEach(d => {
//         const u = d.user._id.toString();
//         const amt = d.amount;

//         if (d.type === "lent") {
//           summaryMap[u] = (summaryMap[u] || 0) + amt;
//         } else if (d.type === "owes") {
//           summaryMap[u] = (summaryMap[u] || 0) - amt;
//         }
//       });
//     });

//     // Apply settlements
//     const settlements = await Settlement.find({ group: groupId });

//     settlements.forEach(s => {
//       const from = s.fromUser.toString();
//       const to = s.toUser.toString();
//       const amt = s.amount;

//       // fromUser reduces debt
//       summaryMap[from] = (summaryMap[from] || 0) + amt;

//       // toUser reduces credit
//       summaryMap[to] = (summaryMap[to] || 0) - amt;
//     });

//     // Final user perspective only
//     const data = [];

//     group.members.forEach(m => {
//       const id = m.user._id.toString();
//       if (id === userId) return;

//       const net = summaryMap[id] || 0;

//       if (net === 0) return;

//       if (net > 0) {
//         // That user is owed → you owe
//         data.push({
//           user: m.user,
//           amount: Math.abs(net),
//           status: "you owe"
//         });
//       } else if (net < 0) {
//         // That user owes you → you are owed
//         data.push({
//           user: m.user,
//           amount: Math.abs(net),
//           status: "you are owed"
//         });
//       }
//     });

//     return res.json({
//       message: "Settlement summary generated",
//       group: { _id: group._id, name: group.name },
//       data
//     });

//   } catch (error) {
//     console.error("getSettleSummary Error:", error);
//     res.status(500).json({
//       message: "Failed to fetch summary",
//       error: error.message
//     });
//   }
// };



export const  settlePayment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount } = req.body;
    const fromUserId = req.user._id.toString();

    if (!toUserId || !amount) {
      return res.status(400).json({ message: "toUserId and amount are required" });
    }

    // validate group
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // check both users are group members
    const isFromMember = group.members.some(m => String(m.user) === fromUserId);
    const isToMember = group.members.some(m => String(m.user) === toUserId);

    if (!isFromMember || !isToMember) {
      return res.status(403).json({ message: "Both users must be group members" });
    }

    const settlement = await Settlement.create({
      fromUser: fromUserId,
      toUser: toUserId,
      group: groupId,
      amount
    });

    return res.status(201).json({
      message: "Settlement recorded successfully",
      settlement
    });

  } catch (err) {
    console.error("settlePayment error:", err);
    return res.status(500).json({
      message: "Failed to record settlement",
      error: err.message
    });
  }
};



