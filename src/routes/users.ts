import { Router, Request, Response } from "express";
import userService from "../services/userService";

const router = Router();

// Create or update user
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await userService.createOrUpdateUser(req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get user by Clerk ID
router.get("/clerk/:clerkId", async (req, res) => {
  try {
    const user = await userService.getUserByClerkId(req.params.clerkId);
 
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
