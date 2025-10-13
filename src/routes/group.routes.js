// src/routes/group.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { addMember, adminLeaveGroup, createGroup, deleteGroup, getAllGroups, getGroupById, getInviteLink, 
    joinGroupByToken, leaveGroup, removeMember, updateGroupDetails } from "../controllers/group.controller.js";

const router = Router();
// router.use(requireAuth);

// B1: Create Group
router.post("/", requireAuth ,createGroup);

// 🔹 B2 routes
router.get("/:id", requireAuth,getInviteLink);
router.post("/:groupId/add-member", requireAuth, addMember);
router.post("/join/:token", requireAuth, joinGroupByToken);
router.get("/", requireAuth, getAllGroups);         
router.get("/findone/:groupId", requireAuth, getGroupById);
router.patch("/:groupId/leave", requireAuth, leaveGroup);
router.patch("/:groupId/remove/:memberId", requireAuth, removeMember);
router.patch("/:groupId/admin-leave", requireAuth, adminLeaveGroup);
router.patch("/:groupId/update", requireAuth, updateGroupDetails);
router.delete("/:groupId", requireAuth, deleteGroup);


export const groupRoutes =  router;
