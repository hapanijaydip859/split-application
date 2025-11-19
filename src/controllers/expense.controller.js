import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Group from "../models/Group.js";
import Settlement from "../models/Settlement.js";
import { date } from "zod";

// export const addExpense = async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const { description, amount, splitType, paidBy, includedMembers } = req.body;
//     const createdBy = req.user._id;

//     if (!description || !amount || !splitType || !paidBy)
//       return res.status(400).json({ message: "Missing required fields" });

//     const group = await Group.findById(groupId).populate("members.user", "name email");
//     console.log("group" , group);

//     if (!group) return res.status(404).json({ message: "Group not found" });

//     const allMembers = group.members.map((m) => String(m.user._id));

//     const members =
//       includedMembers?.length > 0
//         ? includedMembers.filter((id) => allMembers.includes(String(id)))
//         : allMembers;

//     if (members.length < 2)
//       return res.status(400).json({ message: "At least 2 members required for expense" });

//     // 🔹 Step 1: Calculate per-member share
//     const total = Number(amount);
//     const perHead = total / members.length;
//     const payer = String(paidBy);

//     // 🔹 Step 2: Prepare splitDetails (same format)
//     const splitDetails = [];

//     // Record for payer → lent (total minus his own share)
//     const payerShare = members.includes(payer) ? perHead : 0;
//     const payerLent = total - payerShare;

//     const owesUsers = members.filter((id) => id !== payer);

//     if (payerLent > 0) {
//       splitDetails.push({
//         user: new mongoose.Types.ObjectId(payer),
//         type: "lent",
//         amount: +payerLent.toFixed(2),
//         relatedUsers: owesUsers.map((id) => new mongoose.Types.ObjectId(id)),
//       });
//     }

//     owesUsers.forEach((uid) => {
//       splitDetails.push({
//         user: new mongoose.Types.ObjectId(uid),
//         type: "owes",
//         amount: +perHead.toFixed(2),
//         relatedUsers: [new mongoose.Types.ObjectId(payer)],
//       });
//     });

//     // 🔹 Step 3: Save correctly — paidBy is a plain ObjectId
//     const expense = await Expense.create({
//       group: groupId,
//       description,
//       amount,
//       splitType,
//       paidBy: new mongoose.Types.ObjectId(paidBy), // ✅ FIXED
//       splitDetails,
//       createdBy,
//     });

//     // 🔹 Step 4: Response
//     return res.status(201).json({
//       message: "Expense added successfully",
//       data: expense,
//     });
//   } catch (error) {
//     console.error("❌ addExpense Error:", error.message);
//     res.status(500).json({
//       message: "Failed to add expense",
//       error: error.message,
//     });
//   }
// };

export const addExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, paidBy, excludedMembers = [] } = req.body;
    const createdBy = req.user._id; // token user

    if (!description || !amount || !paidBy)
      return res.status(400).json({ message: "Missing required fields" });

    // 🔹 1️⃣ Find group & members
    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) return res.status(404).json({ message: "Group not found" });

    const allMembers = group.members.map((m) => String(m.user._id));

    // 🧠 Check: createdBy (logged-in user) must be part of group
    if (!allMembers.includes(String(createdBy))) {
      return res.status(403).json({
        message: "You are not a member of this group",
      });
    }

    // 🧠 Check: paidBy must be part of this group
    if (!allMembers.includes(String(paidBy))) {
      return res.status(403).json({
        message: "Payer is not a member of this group",
      });
    }

    // 🔹 2️⃣ Filter included members (exclude those in excludedMembers)
    const includedMembers = allMembers.filter(
      (id) => !excludedMembers.includes(String(id))
    );

    if (includedMembers.length < 2)
      return res
        .status(400)
        .json({ message: "At least 2 members required for expense" });

    const total = Number(amount);
    const perHead = total / includedMembers.length;
    const payer = String(paidBy);

    const splitDetails = [];

    // 🔹 3️⃣ Payer lent amount = total - (his own share if included)
    const payerIncluded = includedMembers.includes(payer);
    const payerLent = payerIncluded ? total - perHead : total;

    if (payerLent > 0) {
      const owesUsers = includedMembers.filter((id) => id !== payer);

      splitDetails.push({
        user: new mongoose.Types.ObjectId(payer),
        type: "lent",
        amount: +payerLent.toFixed(2),
        relatedUsers: owesUsers.map((id) => new mongoose.Types.ObjectId(id)),
      });

      // 🔹 4️⃣ For each owe user
      owesUsers.forEach((uid) => {
        splitDetails.push({
          user: new mongoose.Types.ObjectId(uid),
          type: "owes",
          amount: +perHead.toFixed(2),
          relatedUsers: [new mongoose.Types.ObjectId(payer)],
        });
      });
    }

    // 🔹 5️⃣ Save expense
    const expense = await Expense.create({
      group: groupId,
      description,
      amount: total,
      splitType: "equal",
      paidBy: new mongoose.Types.ObjectId(paidBy),
      splitDetails,
      createdBy,
    });

    res.status(201).json({
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

// export const getMyExpenses = async (req, res) => {
//   try {
//     const userId = new mongoose.Types.ObjectId(req.user._id);

//     // ⭐ Find all expenses where this user is involved
//     const expenses = await Expense.find({
//       $or: [
//         { paidBy: userId },
//         { "splitDetails.user": userId },
//         { "splitDetails.relatedUsers": userId }
//       ],
//     })
//       .populate("group", "name")
//       .populate("paidBy", "name email")
//       .populate("splitDetails.user", "name email")
//       .populate("splitDetails.relatedUsers", "name email")
//       .sort({ createdAt: -1 });

//     if (!expenses.length)
//       return res.status(404).json({ message: "No expenses found for this user" });

//     // ⭐ Convert split detail to human messages
//     const formatSplit = (sd) => {
//       if (sd.type === "lent") {
//         return {
//           amount: sd.amount,
//           message: `You lent ₹${sd.amount}`,
//         };
//       }

//       if (sd.type === "owes") {
//         const lender = sd.relatedUsers[0]?.name || "someone";
//         return {
//           amount: sd.amount,
//           message: `You borrowed ₹${sd.amount} from ${lender}`,
//         };
//       }

//       return null;
//     };

//     // ⭐ Final formatted output
//     const finalData = expenses.map((exp) => {
//       // find only this user's split row
//       const userRows = exp.splitDetails.filter((sd) =>
//         sd.user?._id?.equals(userId)
//       );

//       // convert user's row to readable
//       const readable = userRows.map((sd) => formatSplit(sd));

//       return {
//         _id: exp._id,
//         group: exp.group,
//         description: exp.description,
//         amount: exp.amount,
//         splitType: exp.splitType,
//         paidBy: exp.paidBy,
//         createdAt: exp.createdAt,

//         // ⭐ Full original splitDetails (all users)
//         allSplitDetails: exp.splitDetails,

//         // ⭐ Only this user's readable detail
//         yourSplitDetail: readable,
//       };
//     });

//     res.status(200).json({
//       message: "User expenses fetched successfully",
//       count: finalData.length,
//       data: finalData,
//     });
//   } catch (error) {
//     console.error("❌ getMyExpenses Error:", error.message);
//     res.status(500).json({
//       message: "Failed to fetch user expenses",
//       error: error.message,
//     });
//   }
// };






// export const getGroupBalanceSummary = async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const userId = req.user._id;

//     // 1️⃣ Validate group
//     const group = await Group.findById(groupId).populate("members.user", "name email");
//     if (!group) {
//       return res.status(404).json({ message: "Group not found" });
//     }

//     // 2️⃣ Get all expenses for this group
//     const expenses = await Expense.find({ group: groupId })
//       .populate("splitDetails.user", "name email")
//       .populate("splitDetails.relatedUsers", "name email")
//       .populate("paidBy", "name email")
//       .lean();

//     // 3️⃣ Initialize balances
//     const balances = {};
//     group.members.forEach((m) => (balances[m.user._id] = 0));

//     // 4️⃣ Loop through all expenses to calculate balances
//     expenses.forEach((expense) => {
//       expense.splitDetails.forEach((split) => {
//         const userIdStr = String(split.user._id);
//         if (split.type === "lent") {
//           balances[userIdStr] += split.amount;
//         } else if (split.type === "owes") {
//           balances[userIdStr] -= split.amount;
//         }
//       });
//     });

//     // 5️⃣ Adjust balances based on Settlements
//     const settlements = await Settlement.find({ groupId }).sort({ createdAt: 1 }).lean();
//     const latestSettlement = settlements.length ? settlements[settlements.length - 1] : null;

//     settlements.forEach((settlement) => {
//       const fromId = String(settlement.from);
//       const toId = String(settlement.to);
//       const amt = settlement.amount;

//       // The payer ("from") has paid some amount — so they owe less
//       if (balances[fromId] !== undefined) balances[fromId] += amt;

//       // The receiver ("to") has received some money — so they are owed less
//       if (balances[toId] !== undefined) balances[toId] -= amt;
//     });

//     // 6️⃣ Prepare summaryDetails for UI
//     const summaryDetails = [];
//     const currentUserBalance = balances[userId] || 0;

//     for (const [uid, balance] of Object.entries(balances)) {
//       if (uid === String(userId)) continue;

//       const member = group.members.find((m) => String(m.user._id) === uid);
//       if (!member) continue;

//       const name = member.user.name;
//       const email = member.user.email;

//       // If current user lent money to this member
//       if (currentUserBalance > 0 && balance < 0) {
//         const amount = Math.min(Math.abs(balance), currentUserBalance);
//         summaryDetails.push({
//           text: `${name} owes you ₹${amount.toFixed(2)}`,
//           type: "owed",
//           name,
//           email,
//         });
//       }

//       // If current user owes this member
//       if (currentUserBalance < 0 && balance > 0) {
//         const amount = Math.min(balance, Math.abs(currentUserBalance));
//         summaryDetails.push({
//           text: `You owe ${name} ₹${amount.toFixed(2)}`,
//           type: "owe",
//           name,
//           email,
//         });
//       }
//     }

//     // 7️⃣ Final response (added settlementId)
//     res.status(200).json({
//       success: true,
//       message: "Group balance summary fetched successfully",
//       data: {
//         groupId,
//         groupName: group.name,
//         overallBalance: currentUserBalance,
//         summaryDetails,
//         memberBalances: Object.entries(balances).map(([uid, balance]) => {
//           const member = group.members.find((m) => String(m.user._id) === uid);
//           return {
//             _id: uid,
//             name: member ? member.user.name : "Unknown",
//             balance,
//           };
//         }),
//         settlementId: latestSettlement ? latestSettlement._id : null, // ✅ added here
//       },
//     });
//   } catch (error) {
//     console.error("❌ getGroupBalanceSummary Error:", error.message);
//     res.status(500).json({
//       message: "Failed to fetch group summary",
//       error: error.message,
//     });
//   }
// };



export const getMyExpenses = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find expenses where user is involved: paidBy, splitDetails.user or splitDetails.relatedUsers
    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { "splitDetails.user": userId },
        { "splitDetails.relatedUsers": userId },
      ],
    })
      .populate({
        path: "group",
        select: "name members",
        populate: { path: "members.user", select: "_id name email" },
      })
      .populate("paidBy", "_id name email")
      .populate("splitDetails.user", "_id name email")
      .populate("splitDetails.relatedUsers", "_id name email")
      .sort({ createdAt: -1 })
      .lean();

    if (!expenses.length) {
      return res.status(200).json({ message: "No expenses found for this user", count: 0, data: [] });
    }

    // Clean response: keep only token user's member info inside group.members
    const userIdStr = String(userId);
    const cleaned = expenses.map((exp) => {
      const group = exp.group || {};
      let memberInfo = [];
      if (Array.isArray(group.members)) {
        const m = group.members.find((mm) => String(mm.user?._id) === userIdStr);
        if (m && m.user) memberInfo = [{ _id: m.user._id, name: m.user.name, email: m.user.email }];
      }

      return {
        _id: exp._id,
        group: { _id: group._id, name: group.name, members: memberInfo },
        description: exp.description,
        amount: exp.amount,
        splitType: exp.splitType,
        paidBy: exp.paidBy ? { _id: exp.paidBy._id, name: exp.paidBy.name, email: exp.paidBy.email } : null,
        splitDetails: Array.isArray(exp.splitDetails)
          ? exp.splitDetails.map((s) => ({
            user: s.user ? { _id: s.user._id, name: s.user.name, email: s.user.email } : null,
            type: s.type,
            amount: s.amount,
            relatedUsers: Array.isArray(s.relatedUsers)
              ? s.relatedUsers.map((r) => ({ _id: r._id, name: r.name, email: r.email }))
              : [],
          }))
          : [],
        statusMessage: exp.statusMessage || null,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
      };
    });

    return res.status(200).json({ message: "User expenses fetched successfully", count: cleaned.length, data: cleaned });
  } catch (error) {
    console.error("❌ getMyExpenses Error:", error.message);
    return res.status(500).json({ message: "Failed to fetch user expenses", error: error.message });
  }
};





export const getMyPaidExpenses = async (req, res) => {
  try {
    const userId = req.user._id;

    const expenses = await Expense.find({ paidBy: userId })
      .populate("group")
      .populate("paidBy");   // THIS IS CORRECT
      console.log("expense" , expenses);
      
      if(expenses.length == []){return res.status(402).json("Not expense found")}

    return res.json({
      message: "My paid expenses fetched",
      count: expenses.length,
      data: expenses
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching your payments",
      error: error.message
    });
  }
};

// export const getOverallSummary = async (req, res) => {
//   try {
//     const userId = req.user._id.toString();

//     const expenses = await Expense.find({
//       "splitDetails.user": userId
//     })
//       .populate("splitDetails.user")
//       .populate("splitDetails.relatedUsers");

//     let totalLent = 0;
//     let totalOwes = 0;
//     let breakdown = {};

//     for (const exp of expenses) {
//       for (const sd of exp.splitDetails) {
//         const thisUser = sd.user._id.toString();
//         const amount = sd.amount;

//         // --------------------------
//         // 🟢 USER LENT (others owe me)
//         // --------------------------
//         if (sd.type === "lent" && thisUser === userId) {
//           const perUser = amount / sd.relatedUsers.length; // 600/2 = 300

//           // total lent add ONLY ONCE
//           totalLent += amount;

//           sd.relatedUsers.forEach((ru) => {
//             const uid = ru._id.toString();

//             if (!breakdown[uid]) {
//               breakdown[uid] = { user: ru, lent: 0, owes: 0 };
//             }

//             breakdown[uid].lent += perUser; // 300 each
//           });
//         }
//         // --------------------------
//         // 🔴 USER OWES (I owe someone)
//         // --------------------------
//         if (sd.type === "owes" && thisUser === userId) {
//           const ru = sd.relatedUsers[0]; // only one 
//           const uid = ru._id.toString();

//           totalOwes += amount;

//           if (!breakdown[uid]) {
//             breakdown[uid] = { user: ru, lent: 0, owes: 0 };
//           }

//           breakdown[uid].owes += amount; // full 300
//         }
//       }
//     }

//     // --------------------------
//     // Final formatting
//     // --------------------------
//     const finalBreakdown = Object.values(breakdown).map((b) => {
//       const net = b.lent - b.owes;

//       return {
//         user: b.user,
//         amount: Math.abs(net),
//         status: net > 0 ? "owes you" : net < 0 ? "you owe" : "settled",
//         color: net > 0 ? "green" : net < 0 ? "red" : "gray"
//       };
//     });

//     res.json({
//       message: "Overall summary calculated",
//       overall: {
//         totalYouLent: totalLent,
//         totalYouOwe: totalOwes,
//         finalBalance: totalLent - totalOwes
//       },
//       breakdown: finalBreakdown
//     });

//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to calculate summary",
//       error: error.message
//     });
//   }
// };

export const getOverallSummary = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { groupId } = req.params;

    // ----------------------------------------------------
    // 1️⃣ FETCH GROUP + MEMBERS
    // ----------------------------------------------------
    const group = await Group.findById(groupId).populate("members.user", "name");
    if (!group) return res.status(404).json({ message: "Group not found" });

    const members = group.members.map((m) => ({
      id: m.user._id.toString(),
      name: m.user.name,
    }));

    // ----------------------------------------------------
    // 2️⃣ INIT BALANCE MATRIX (ALL ZERO)
    // ----------------------------------------------------
    const balance = {};
    members.forEach((a) => {
      balance[a.id] = {};
      members.forEach((b) => {
        if (a.id !== b.id) balance[a.id][b.id] = 0;
      });
    });

    // ----------------------------------------------------
    // 3️⃣ APPLY EXPENSE LOGIC (ONLY LENT)
    // ----------------------------------------------------
    const expenses = await Expense.find({ group: groupId });

    expenses.forEach((exp) => {
      exp.splitDetails.forEach((sd) => {
        if (sd.type !== "lent") return;

        const payer = sd.user.toString();
        const related = sd.relatedUsers.map((u) => u.toString());
        const perHead = sd.amount / related.length;

        related.forEach((other) => {
          balance[other][payer] += perHead; // other owes payer
        });
      });
    });

    // ----------------------------------------------------
    // 4️⃣ APPLY SETTLEMENT LOGIC
    // ----------------------------------------------------
    const settlements = await Settlement.find({ group: groupId });

    settlements.forEach((s) => {
      const from = s.fromUser.toString(); // fromUser → paid back
      const to = s.toUser.toString();
      const amt = Number(s.amount);

      if (balance[from][to] !== undefined) {
        balance[from][to] -= amt;
        if (balance[from][to] < 0) balance[from][to] = 0; // no negative
      }
    });

    // ----------------------------------------------------
    // 5️⃣ AUTO NETTING (EXPENSE VS EXPENSE)
    // ----------------------------------------------------
    members.forEach((a) => {
      members.forEach((b) => {
        if (a.id === b.id) return;

        const ab = balance[a.id][b.id]; // a owes b
        const ba = balance[b.id][a.id]; // b owes a

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

    // ----------------------------------------------------
    // 6️⃣ FINAL RESULT FOR LOGGED-IN USER
    // ----------------------------------------------------
    const result = [];
    const EPS = 0.0001;

    members.forEach((m) => {
      if (m.id === userId) return;

      const theyOwe = balance[m.id][userId] || 0;
      const youOwe = balance[userId][m.id] || 0;

      const net = theyOwe - youOwe;

      if (Math.abs(net) < EPS) return; // skip zero

      if (net > 0) {
        result.push({
          userId: m.id,
          name: m.name,
          status: "owes you",
          amount: Math.round(net * 100) / 100,
        });
      } else {
        result.push({
          userId: m.id,
          name: m.name,
          status: "you owe",
          amount: Math.round(Math.abs(net) * 100) / 100,
        });
      }
    });

    // ----------------------------------------------------
    // 7️⃣ SEND RESPONSE
    // ----------------------------------------------------
    return res.json({
      message: "Overall summary",
      data: result,
    });

  } catch (err) {
    console.error("getOverallSummary error:", err);
    return res.status(500).json({
      message: "Failed to load summary",
      error: err.message,
    });
  }
};






export const getExpenseHistory = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = String(req.user._id);

    // 🔹 1️⃣ Group exists?
    const group = await Group.findById(groupId).populate("members.user", "name");
    if (!group) return res.status(404).json({ message: "Group not found" });

    // 🔹 2️⃣ Check: user belongs to group?
    const allMembers = group.members.map((m) => String(m.user._id));

    if (!allMembers.includes(userId)) {
      return res.status(403).json({ message: "You're not a member of this group" });
    }

    // 🔹 3️⃣ Fetch all expenses in this group
    const expenses = await Expense.find({ group: groupId })
      .populate("paidBy", "name")
      .populate("splitDetails.user", "name")
      .sort({ createdAt: -1 });

    const history = [];

    expenses.forEach((exp) => {
      const payerId = String(exp.paidBy._id);

      // 🟢 Find splitDetails of logged-in user
      const mySplit = exp.splitDetails.find(
        (sd) => String(sd.user._id) === userId
      );

      let entry = {
        description: exp.description,
        paidBy: payerId === userId ? "You" : exp.paidBy.name,
      };

      if (payerId === userId) {
        // 🟢 YOU PAID
        entry.youPaid = exp.amount;

        if (mySplit) {
          entry.youLent = mySplit.amount; // total lent
        }
      } else {
        // 🔵 SOMEONE ELSE PAID
        if (mySplit && mySplit.type === "owes") {
          entry.youBorrowed = mySplit.amount;
        }
      }

      history.push(entry);
    });

    res.status(200).json({
      message: "Expense history fetched",
      data: history,
    });

  } catch (error) {
    console.error("❌ getExpenseHistory Error:", error.message);
    res.status(500).json({
      message: "Failed to load history",
      error: error.message,
    });
  }
};

export const getSettleUpSummary = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = String(req.user._id);

    // 1️⃣ Find group
    const group = await Group.findById(groupId).populate("members.user", "name");
    if (!group) return res.status(404).json({ message: "Group not found" });

    const members = group.members.map((m) => ({
      id: String(m.user._id),
      name: m.user.name,
    }));

    // 2️⃣ Balance table
    const balance = {};
    members.forEach((m) => (balance[m.id] = {}));

    // 3️⃣ Fetch expenses
    const expenses = await Expense.find({ group: groupId }).populate(
      "splitDetails.user paidBy",
      "name"
    );

    // 4️⃣ Calculate balance ONLY from `lent`
    expenses.forEach((exp) => {
      exp.splitDetails.forEach((sd) => {
        if (sd.type !== "lent") return;  // ❗IGNORE owes — avoids DUPLICATE

        const payer = String(sd.user._id);
        const perHead = sd.amount / sd.relatedUsers.length;

        sd.relatedUsers.forEach((ou) => {
          const other = String(ou);
          balance[other][payer] = (balance[other][payer] || 0) + perHead;
        });
      });
    });

    // 5️⃣ Build UI-style output
    const result = [];

    members.forEach((member) => {
      if (member.id === userId) return;

      const youOwe = balance[userId][member.id] || 0;
      const theyOwe = balance[member.id][userId] || 0;

      const net = theyOwe - youOwe;

      if (net > 0) {
        result.push({
          userId: member.id,
          name: member.name,
          status: "you are owed",
          amount: net,
        });
      } else if (net < 0) {
        result.push({
          userId: member.id,
          name: member.name,
          status: "you owe",
          amount: Math.abs(net),
        });
      }
    });

    res.status(200).json({ message: "Settle-up summary", data: result });

  } catch (error) {
    console.error("❌ settleUp error:", error.message);
    res.status(500).json({ message: "Failed to calculate settle-up", error: error.message });
  }
};


export const deleteExpense = async (req, res) => {
  try {
    const { groupId, expenseId } = req.params;
    const userId = req.user._id.toString();

    // 1️⃣ Find expense
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // 2️⃣ Check group match
    if (expense.group.toString() !== groupId) {
      return res.status(400).json({ message: "Expense does not belong to this group" });
    }

    // 3️⃣ Check group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 4️⃣ Check if user is member of group
    const isMember = group.members.some((m) => m.user.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // 5️⃣ Only creator or payer can delete
    if (
      expense.createdBy?.toString() !== userId &&
      expense.paidBy?.toString() !== userId
    ) {
      return res.status(403).json({
        message: "You are not allowed to delete this expense",
      });
    }

    // 6️⃣ Delete the expense
    await Expense.findByIdAndDelete(expenseId);

    res.json({
      message: "Expense deleted successfully",
      deletedExpenseId: expenseId,
    });
  } catch (error) {
    console.error("❌ deleteExpense error:", error);
    res.status(500).json({
      message: "Failed to delete expense",
      error: error.message,
    });
  }
};










