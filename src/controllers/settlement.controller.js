
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

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    // 1) load group and ensure membership
    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!Array.isArray(group.members) || !group.members.some(m => String(m.user._id) === userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // 2) load group expenses
    const expenses = await Expense.find({ group: groupId })
      .populate("paidBy", "name email")
      .populate("splitDetails.user", "name email")
      .populate("splitDetails.relatedUsers", "name email");

    if (!expenses.length) {
      return res.status(200).json({
        message: "No expenses found",
        group: { _id: group._id, name: group.name },
        data: []
      });
    }

    // 3) build debts map: debts[creditorId][debtorId] = amount (debtor owes creditor)
    const debts = {}; // { creditorId: { debtorId: amt, ... }, ... }

    const ensureCreditor = (cid) => {
      if (!debts[cid]) debts[cid] = {};
    };

    expenses.forEach(exp => {
      // derive included members from splitDetails if possible
      let includedSet = new Set();

      if (Array.isArray(exp.splitDetails) && exp.splitDetails.length > 0) {
        exp.splitDetails.forEach(sd => {
          if (sd.user && sd.user._id) includedSet.add(sd.user._id.toString());
          // sometimes relatedUsers may include someone not in user rows; include them too
          if (Array.isArray(sd.relatedUsers)) {
            sd.relatedUsers.forEach(r => { if (r && r._id) includedSet.add(r._id.toString()); });
          }
        });
      }

      // fallback to includedMembers field if present on expense
      if ((!includedSet || includedSet.size === 0) && Array.isArray(exp.includedMembers) && exp.includedMembers.length > 0) {
        exp.includedMembers.forEach(id => includedSet.add(String(id)));
      }

      // if still empty, skip this expense
      if (!includedSet || includedSet.size === 0) return;

      const includedArr = Array.from(includedSet);
      const includedCount = includedArr.length;
      if (includedCount === 0) return;

      const perHead = Number(exp.amount) / includedCount;
      const payerId = exp.paidBy?._id ? exp.paidBy._id.toString() : String(exp.paidBy);

      // For every included member except payer, that member owes `perHead` to payer
      includedArr.forEach(memberId => {
        if (memberId === payerId) return; // skip payer
        ensureCreditor(payerId);
        debts[payerId][memberId] = (debts[payerId][memberId] || 0) + perHead;
      });
    });

    // 4) Build summary for logged-in user
    // If user is creditor -> others owe user (show them)
    // If user is debtor in someone's map -> user owes that someone (show them)
    const summaryMap = {}; // otherUserId -> net (positive means other owes you, negative means you owe other)

    // creditor side (others owe logged user)
    if (debts[userId]) {
      Object.entries(debts[userId]).forEach(([debtorId, amt]) => {
        summaryMap[debtorId] = (summaryMap[debtorId] || 0) + amt; // other owes you amt
      });
    }

    // debtor side (logged user owes other)
    Object.entries(debts).forEach(([creditorId, debtorsObj]) => {
      if (creditorId === userId) return; // already handled
      if (debtorsObj[userId]) {
        // user owes creditorId
        summaryMap[creditorId] = (summaryMap[creditorId] || 0) - debtorsObj[userId];
      }
    });

    // 5) prepare final list with user info (use group members data to avoid extra DB calls)
    const final = [];
    const memberMap = {};
    group.members.forEach(m => {
      memberMap[String(m.user._id)] = { _id: m.user._id, name: m.user.name, email: m.user.email };
    });

    for (const otherId in summaryMap) {
      const net = summaryMap[otherId];
      if (net === 0) continue;

      let userInfo = memberMap[otherId];
      if (!userInfo) {
        // fallback DB fetch if not found in group members
        const u = await User.findById(otherId).select("name email");
        if (u) userInfo = u;
      }

      if (!userInfo) continue;

      final.push({
        user: userInfo,
        amount: Math.round(Math.abs(net) * 100) / 100, // round to 2 decimals
        status: net > 0 ? "you are owed" : "you owe"
      });
    }

    // Optional: sort descending by amount
    final.sort((a, b) => b.amount - a.amount);

    return res.status(200).json({
      message: "Settlement summary generated",
      group: { _id: group._id, name: group.name },
      data: final
    });

  } catch (err) {
    console.error("getSettleSummary error:", err);
    return res.status(500).json({ message: "Failed to fetch settle summary", error: err.message });
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



