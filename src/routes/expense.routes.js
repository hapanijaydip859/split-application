import express from "express";
import { addExpense, getGroupBalanceSummary } from "../controllers/expense.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// POST /api/v1/groups/:groupId/expenses
router.post("/:groupId/expenses", requireAuth, addExpense);
router.get("/:groupId/balance-summary", requireAuth, getGroupBalanceSummary);

export const expenseRoutes = router;
