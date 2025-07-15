// routes/conversation.ts - Essential routes only for simplified frontend
import express, { Request, Response } from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';

const router = express.Router();

export function initializeConversationRoutes(
  messageDB: DrizzleMessageHistoryDB
): express.Router {

  // Get project conversation messages - Used by ChatPage for loading project messages
  router.get("/messages", async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.query;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: "projectId is required"
        });
        return;
      }

      const messagesResult = await messageDB.getProjectMessages(parseInt(projectId as string), 50);
      
      if (messagesResult.success) {
        res.json({
          success: true,
          data: messagesResult.data || []
        });
      } else {
        res.json({
          success: false,
          error: "Failed to retrieve messages"
        });
      }
    } catch (error) {
      console.error('Failed to get project messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project messages'
      });
    }
  });

  // Get basic project status - Used by ChatPage for project verification
  router.get("/project-status", async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.query;
      
      if (!projectId) {
        res.json({
          success: true,
          data: {
            hasProject: false,
            status: 'no_project'
          }
        });
        return;
      }

      const project = await messageDB.getProject(parseInt(projectId as string));
      
      if (project) {
        res.json({
          success: true,
          data: {
            hasProject: true,
            projectId: project.id,
            projectName: project.name,
            deploymentUrl: project.deploymentUrl,
            status: project.status,
            messageCount: project.messageCount
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            hasProject: false,
            status: 'project_not_found'
          }
        });
      }
    } catch (error) {
      console.error('Failed to get project status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project status'
      });
    }
  });

  return router;
}