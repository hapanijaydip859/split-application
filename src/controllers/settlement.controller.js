
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
    console.log("hello ");
    
    const { groupId } = req.params;
    const userId = req.user._id.toString();

    // Load group
    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) return res.status(404).json({ message: "Group not found" });

    const members = group.members.map(m => m.user._id.toString());

    if (!members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // ---------------------------------------------------------
    // 1️⃣ BUILD RAW MATRIX : matrix[A][B] = A owes B
    // ---------------------------------------------------------
    const matrix = {};
    members.forEach(a => {
      matrix[a] = {};
      members.forEach(b => {
        if (a !== b) matrix[a][b] = 0;
      });
    });

    const expenses = await Expense.find({ group: groupId });

    expenses.forEach(exp => {
      exp.splitDetails.forEach(sd => {
        const user = sd.user.toString();

        if (sd.type === "owes") {
          const payer = sd.relatedUsers[0].toString();
          matrix[user][payer] += sd.amount; 
        }
      });
    });

    // ---------------------------------------------------------
    // 2️⃣ APPLY SETTLEMENTS (A paid B)
    // ---------------------------------------------------------
    const settlements = await Settlement.find({ group: groupId });

    settlements.forEach(s => {
      const from = s.fromUser.toString();
      const to = s.toUser.toString();
      matrix[from][to] -= Number(s.amount);

      if (matrix[from][to] < 0) matrix[from][to] = 0;
    });

    // ---------------------------------------------------------
    // 3️⃣ NET MATRIX : net[A][B] = B owes A
    // ---------------------------------------------------------
    const netMap = {}; // net for logged user only

    members.forEach(other => {
      if (other === userId) return;

      const youOwe = matrix[userId][other];     // you → other
      const theyOwe = matrix[other][userId];    // other → you
      const net = theyOwe - youOwe;

      if (net > 0) {
        netMap[other] = { status: "you are owed", amount: net };
      } else if (net < 0) {
        netMap[other] = { status: "you owe", amount: Math.abs(net) };
      }
    });

    // ---------------------------------------------------------
    // 4️⃣ FORMAT RESULT
    // ---------------------------------------------------------
    const final = Object.keys(netMap).map(otherId => {
      const member = group.members.find(m => m.user._id.toString() === otherId);
      return {
        userId: otherId,
        name: member.user.name,
        status: netMap[otherId].status,
        amount: Number(netMap[otherId].amount.toFixed(2))
      };
    });

    res.json({
      message: "Settle-up summary",
      data: final
    });

  } catch (err) {
    console.error("getSettleSummary ERROR:", err);
    res.status(500).json({ message: "Failed", error: err.message });
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



