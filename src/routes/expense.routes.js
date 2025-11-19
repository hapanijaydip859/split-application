import express from "express";
import { addExpense, deleteExpense, getExpenseHistory, getMyExpenses, getMyPaidExpenses, getOverallSummary, getSettleUpSummary } from "../controllers/expense.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// POST /api/v1/groups/:groupId/expenses
router.post("/:groupId/expenses", requireAuth, addExpense);
router.get("/:groupId/balance-summary", requireAuth, getMyExpenses);
router.get("/:groupId/balance-summary-pay", requireAuth, getMyPaidExpenses);
router.get("/:groupId/overall-summary", requireAuth, getOverallSummary);
router.get("/:groupId/expesne-history", requireAuth, getExpenseHistory);
router.get("/:groupId/settleup-history", requireAuth, getSettleUpSummary);
router.delete("/:groupId/:expenseId/expensehistory-delete", requireAuth, deleteExpense);






export const expenseRoutes = router;
