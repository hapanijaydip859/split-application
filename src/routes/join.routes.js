// src/routes/group.routes.js
import { Router } from "express";
// import { requireAuth } from "../middlewares/auth.middleware.js";
import { joingroup } from "../controllers/group.controller.js";


const router = Router();
// router.use(requireAuth);


router.get("/:groupId", joingroup);


export const groupjoin =  router;
