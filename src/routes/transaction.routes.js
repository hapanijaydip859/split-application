import express from "express";


import {  createTransactionFromExpense, getGroupTransactions } from "../controllers/transaction.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ✅ Create a new transaction
router.post("/", requireAuth , createTransactionFromExpense);

// ✅ List all transactions in a group
router.get("/group/:groupId", requireAuth, getGroupTransactions);

// // ✅ Get single transaction details (with settlements)
// router.get("/:id", verifyJWT, getTransactionById);

export const transactionRoutes =  router;
