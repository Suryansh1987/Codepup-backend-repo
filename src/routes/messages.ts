// routes/messages.ts - Simplified with only essential endpoints
import { Router, Request, Response } from 'express';

const router = Router();

// This will be set when the main app initializes the routes
let messageDB: any = null;

// Function to initialize the message service (called from main app)
export function setMessageDB(db: any) {
  messageDB = db;
}

// Get messages for a specific project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    if (!messageDB) {
      res.status(500).json({
        success: false,
        error: 'Message service not initialized'
      });
      return;
    }

    const projectId = parseInt(req.params.projectId);
    const limit = parseInt(req.query.limit as string) || 50;

    if (isNaN(projectId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid project ID provided'
      });
      return;
    }

    // Get project messages using the enhanced method
    const result = await messageDB.getProjectMessages(projectId, limit);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get project messages error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create message with project linking
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!messageDB) {
      res.status(500).json({
        success: false,
        error: 'Message service not initialized'
      });
      return;
    }

    const { projectId, sessionId, role, content, userId, metadata } = req.body;

    if (!content || !role) {
      res.status(400).json({
        success: false,
        error: 'Content and role are required'
      });
      return;
    }

    // Use the enhanced addMessage method with project context
    const messageId = await messageDB.addMessage(
      content,
      role,
      {
        projectId,
        sessionId,
        userId,
        ...metadata
      }
    );

    res.json({
      success: true,
      data: {
        messageId,
        projectId,
        sessionId
      }
    });

  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get messages for a specific session


export default router;