import express from "express";
import { addExpense, getMyExpenses, getMyPaidExpenses } from "../controllers/expense.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// POST /api/v1/groups/:groupId/expenses
router.post("/:groupId/expenses", requireAuth, addExpense);
router.get("/:groupId/balance-summary", requireAuth, getMyExpenses);
router.get("/:groupId/balance-summary-pay", requireAuth, getMyPaidExpenses);


export const expenseRoutes = router;
