// routes/conversation.ts - Conversation and history management routes
import express, { Request, Response } from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { RedisService } from '../services/Redis';
import { StatelessSessionManager } from './session';

const router = express.Router();

// Enhanced Conversation Helper using existing services + Redis state
class StatelessConversationHelper {
  constructor(
    private messageDB: DrizzleMessageHistoryDB,
    private redis: RedisService,
    private sessionManager: StatelessSessionManager
  ) {}

  async saveModification(sessionId: string, modification: any): Promise<void> {
    // Save to database (persistent)
    await this.messageDB.saveModification(modification);
    
    // Save to Redis session state (fast access) - using proper ModificationChange interface
    const change = {
      type: 'modified' as const, // Use proper type from your ModificationChange interface
      file: 'session_modification', // Required field
      description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`, // Required field
       timestamp: new Date().toISOString(), 
      prompt: modification.prompt,
      approach: modification.approach,
      filesModified: modification.filesModified || [],
      filesCreated: modification.filesCreated || [],
      success: modification.result?.success || false
    };
    await this.redis.addModificationChange(sessionId, change);
  }

  async getEnhancedContext(sessionId: string): Promise<string> {
    // Try Redis first for fast access
    const cachedContext = await this.redis.getSessionState<string>(sessionId, 'conversation_context');
    if (cachedContext) {
      return cachedContext;
    }

    // Fall back to database
    const dbContext = await this.messageDB.getConversationContext();
    if (dbContext) {
      // Cache for next time
      await this.redis.setSessionState(sessionId, 'conversation_context', dbContext);
      return dbContext;
    }
    
    return '';
  }

  async getConversationWithSummary(): Promise<any> {
    const conversation = await this.messageDB.getRecentConversation();
    return {
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        metadata: {
          fileModifications: msg.fileModifications,
          modificationApproach: msg.modificationApproach,
          modificationSuccess: msg.modificationSuccess
        },
        createdAt: msg.createdAt
      })),
      summaryCount: conversation.summaryCount,
      totalMessages: conversation.totalMessages
    };
  }
}

// Frontend history helper
async function getRecentFrontendPrompts(messageDB: DrizzleMessageHistoryDB, limit: number = 10) {
  try {
    const recentConversation = await messageDB.getRecentConversation();
    
    const frontendPrompts = recentConversation.messages
      .filter((msg: any) => {
        if (!msg.reasoning) return false;
        
        try {
          const metadata = JSON.parse(msg.reasoning);
          return metadata.promptType === 'frontend_generation';
        } catch {
          return false;
        }
      })
      .slice(0, limit * 2)
      .reduce((acc: any[], msg: any) => {
        try {
          const metadata = JSON.parse(msg.reasoning || '{}');
          
          if (metadata.requestType === 'user_prompt') {
            const response = recentConversation.messages.find((m: any) => {
              try {
                const respMetadata = JSON.parse(m.reasoning || '{}');
                return respMetadata.promptType === 'frontend_generation' && 
                       respMetadata.requestType === 'claude_response' &&
                       respMetadata.relatedUserMessageId === msg.id;
              } catch {
                return false;
              }
            });

            acc.push({
              id: msg.id,
              prompt: msg.content,
              response: response?.content || null,
              success: response ? JSON.parse(response.reasoning || '{}').success : false,
              timestamp: msg.createdAt,
              processingTime: response ? JSON.parse(response.reasoning || '{}').processingTimeMs : null,
              tokenUsage: response ? JSON.parse(response.reasoning || '{}').tokenUsage : null,
              contextInfo: metadata.contextInfo,
              error: response ? JSON.parse(response.reasoning || '{}').error : null,
              responseLength: response ? JSON.parse(response.reasoning || '{}').responseLength : null,
              sessionId: metadata.sessionId || null // Include session info
            });
          }
        } catch (parseError) {
          console.error('Error parsing message metadata:', parseError);
        }
        
        return acc;
      }, [] as any[])
      .slice(0, limit);

    return frontendPrompts;
  } catch (error) {
    console.error('Failed to retrieve recent frontend prompts:', error);
    return [];
  }
}

export function initializeConversationRoutes(
  messageDB: DrizzleMessageHistoryDB,
  redis: RedisService,
  sessionManager: StatelessSessionManager
): express.Router {
  
  const conversationHelper = new StatelessConversationHelper(messageDB, redis, sessionManager);

  // Enhanced message creation with session tracking
  router.post("/messages", async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, messageType, metadata, sessionId } = req.body;
      
      if (!content || !messageType || !['user', 'assistant'].includes(messageType)) {
        res.status(400).json({
          success: false,
          error: "Valid content and messageType required"
        });
        return;
      }

      // Enhance metadata with session information
      const enhancedMetadata = {
        ...metadata,
        sessionId: sessionId || sessionManager.generateSessionId(),
        timestamp: new Date().toISOString()
      };

      const messageId = await messageDB.addMessage(content, messageType, enhancedMetadata);
      
      res.json({
        success: true,
        data: { 
          messageId, 
          sessionId: enhancedMetadata.sessionId,
          message: "Message added successfully" 
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to add message'
      });
    }
  });

  // Get conversation with summary
  router.get("/conversation-with-summary", async (req: Request, res: Response): Promise<void> => {
    try {
      const conversationData = await conversationHelper.getConversationWithSummary();
      res.json({
        success: true,
        data: conversationData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation'
      });
    }
  });

  // Get conversation stats
  router.get("/conversation-stats", async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await messageDB.getConversationStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation stats'
      });
    }
  });

  // Get all summaries
  router.get("/summaries", async (req: Request, res: Response): Promise<void> => {
    try {
      const summaries = await messageDB.getAllSummaries();
      res.json({
        success: true,
        data: summaries
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get summaries'
      });
    }
  });

  // Clear all conversation data
  router.delete("/conversation", async (req: Request, res: Response): Promise<void> => {
    try {
      await messageDB.clearAllData();
      res.json({
        success: true,
        data: { message: "All conversation data cleared successfully" }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clear conversation data'
      });
    }
  });

  // Get current summary
  router.get("/current-summary", async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('🔍 /current-summary endpoint hit');
      
      const summary = await messageDB.getCurrentSummary();
      console.log('🔍 getCurrentSummary result:', summary);
      
      const recentConversation = await messageDB.getRecentConversation();
      console.log('🔍 getRecentConversation result:', recentConversation);
      
      const summarizedCount = summary?.messageCount || 0;
      const recentCount = recentConversation.messages.length;
      const totalMessages = summarizedCount + recentCount;
      
      const responseData = {
        summary: summary?.summary || null,
        summarizedMessageCount: summarizedCount,
        recentMessageCount: recentCount,
        totalMessages: totalMessages,
        hasSummary: !!summary && !!summary.summary
      };
      
      console.log('🔍 Sending response:', responseData);
      
      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('❌ /current-summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current summary'
      });
    }
  });

  // Fix conversation stats
  router.post("/fix-stats", async (req: Request, res: Response): Promise<void> => {
    try {
      await messageDB.fixConversationStats();
      const stats = await messageDB.getConversationStats();
      
      res.json({
        success: true,
        data: {
          message: "Stats fixed successfully",
          stats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fix stats'
      });
    }
  });

  // Get frontend history (enhanced with session support)
  router.get("/frontend-history", async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const frontendHistory = await getRecentFrontendPrompts(messageDB, limit);
      
      res.json({
        success: true,
        data: {
          history: frontendHistory,
          count: frontendHistory.length
        }
      });
    } catch (error) {
      console.error('Failed to get frontend history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve frontend generation history'
      });
    }
  });

  // Get project status (enhanced with session support)
  router.get("/project-status", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.query;
      
      let projectData;
      
      // If session ID provided, check Redis first
      if (sessionId) {
        const sessionContext = await sessionManager.getSessionContext(sessionId as string);
        if (sessionContext && sessionContext.projectSummary) {
          projectData = sessionContext.projectSummary;
        }
      }
      
      // Fall back to database
      if (!projectData) {
        projectData = await messageDB.getActiveProjectSummary();
      }
      
      if (projectData) {
        res.json({
          success: true,
          data: {
            hasProject: true,
            projectId: projectData.id,
            summary: projectData.summary,
            zipUrl: projectData.zipUrl,
            buildId: projectData.buildId,
            sessionId: sessionId || null,
            status: 'ready_for_modification',
            source: sessionId && projectData ? 'redis_session' : 'database'
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            hasProject: false,
            sessionId: sessionId || null,
            status: 'awaiting_first_generation'
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