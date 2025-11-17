import express from "express";
import {getSettleSummary, settlePayment } from "../controllers/settlement.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";


const router = express.Router();

// ✅ Create Settlement
router.get("/settle-summary/:groupId", requireAuth, getSettleSummary);

// ✅ Get all settlements in a group
router.post("/:groupId/settle", requireAuth, settlePayment);

// ✅ Get settlements linked to a specific transaction
// router.get("/transaction/:transactionId", verifyJWT, getTransactionSettlements);

export const sattlementRoutes =  router;
