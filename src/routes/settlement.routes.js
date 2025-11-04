import express from "express";
import {
  createSettlement
} from "../controllers/settlement.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";


const router = express.Router();

// ✅ Create Settlement
router.post("/", requireAuth, createSettlement);

// ✅ Get all settlements in a group
// router.get("/group/:groupId", requireAuth, getGroupSettlements);

// ✅ Get settlements linked to a specific transaction
// router.get("/transaction/:transactionId", verifyJWT, getTransactionSettlements);

export const sattlementRoutes =  router;
