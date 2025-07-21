import { Router, Request, Response } from "express";
import projectService from "../services/projectService";
import { createMessageService } from "../services/messageService";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Initialize message service
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ""
});

const messageService = createMessageService(
  process.env.DATABASE_URL || "",
  anthropic,
  process.env.REDIS_URL
);

// Create project
router.post("/", async (req: Request, res: Response) => {
  try {
    const project = await projectService.createProject(req.body);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get projects by user ID
// In your projects route
// In your projects route
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Get all projects
    const allProjects = await projectService.getProjectsByUserId(userId);
    
    // Filter out deleted projects using status
    const activeProjects = allProjects.filter(project => 
      project.status !== 'deleted'
    );
    
    console.log(`📋 Found ${activeProjects.length} active projects (${allProjects.length} total)`);
    res.json(activeProjects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get project by ID
router.get("/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await projectService.getProjectById(
      parseInt(req.params.projectId)
    );
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update project
router.put("/:projectId", async (req: Request, res: Response) => {
  try {
    const project = await projectService.updateProject(
      parseInt(req.params.projectId),
      req.body
    );
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete project
router.delete("/:projectId", async (req: Request, res: Response) => {
  try {
    await projectService.deleteProject(parseInt(req.params.projectId));
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

//@ts-ignore
router.get("/:projectId/messages", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    // Get project to find the user ID
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Use getUserMessages since getMessagesByProjectId doesn't exist in new service
    const result = await messageService.getUserMessages(project.userId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;