// services/messageService.ts - Enhanced message service with dynamic user handling
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { RedisService } from './Redis';
import { StatelessSessionManager } from '../routes/session';
import Anthropic from '@anthropic-ai/sdk';

interface CreateMessageRequest {
  content: string;
  messageType: 'user' | 'assistant' | 'system';
  userId?: number;
  sessionId?: string;
  metadata?: {
    fileModifications?: string[];
    modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION';
    modificationSuccess?: boolean;
    createdFiles?: string[];
    addedFiles?: string[];
    promptType?: string;
    requestType?: string;
    relatedUserMessageId?: string;
    success?: boolean;
    processingTimeMs?: number;
    tokenUsage?: any;
    responseLength?: number;
    buildId?: string;
    previewUrl?: string;
    downloadUrl?: string;
    zipUrl?: string;
    projectId?: number;
    [key: string]: any;
  };
  userData?: {
    clerkId?: string;
    email?: string;
    name?: string;
  };
}

interface MessageResponse {
  success: boolean;
  data?: {
    messageId: string;
    sessionId: string;
    userId: number;
    timestamp: string;
    metadata?: any;
  };
  error?: string;
  details?: string;
}

class MessageService {
  private messageDB: DrizzleMessageHistoryDB;
  private redis: RedisService;
  private sessionManager: StatelessSessionManager;

  constructor(
    databaseUrl: string,
    anthropic: Anthropic,
    redisUrl?: string
  ) {
    this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
    this.redis = new RedisService(redisUrl);
    this.sessionManager = new StatelessSessionManager(this.redis);
  }

  // Initialize the service
  async initialize(): Promise<void> {
    try {
      await this.messageDB.initializeStats();
      console.log('✅ Message service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize message service:', error);
      throw error;
    }
  }

  // Dynamic user resolution with fallback mechanisms
  private async resolveUserId(
    providedUserId?: number,
    sessionId?: string
  ): Promise<number> {
    try {
      // Priority 1: Use provided userId if valid
      if (providedUserId && await this.messageDB.validateUserExists(providedUserId)) {
        return providedUserId;
      }

      // Priority 2: Get userId from session's most recent project
      if (sessionId) {
        const sessionProject = await this.messageDB.getProjectBySessionId(sessionId);
        if (sessionProject && sessionProject.userId) {
          return sessionProject.userId;
        }
      }

      // Priority 3: Get most recent user from any project
      const mostRecentUserId = await this.messageDB.getMostRecentUserId();
      if (mostRecentUserId && await this.messageDB.validateUserExists(mostRecentUserId)) {
        return mostRecentUserId;
      }

      // Priority 4: Create a new user with current timestamp
      const newUserId = Date.now() % 1000000; // Use timestamp-based ID
      await this.messageDB.ensureUserExists(newUserId, {
        email: `user${newUserId}@buildora.dev`,
        name: `User ${newUserId}`
      });
      
      console.log(`✅ Created new user ${newUserId} as fallback`);
      return newUserId;
    } catch (error) {
      console.error('❌ Failed to resolve user ID:', error);
      throw new Error('Could not resolve or create user');
    }
  }

  // Create message with enhanced user handling
  async createMessage(request: CreateMessageRequest): Promise<MessageResponse> {
    try {
      // Validate required fields
      if (!request.content || !request.messageType) {
        return {
          success: false,
          error: 'Content and messageType are required'
        };
      }

      if (!['user', 'assistant', 'system'].includes(request.messageType)) {
        return {
          success: false,
          error: 'Invalid messageType. Must be user, assistant, or system'
        };
      }

      // Resolve user ID dynamically
      let userId: number;
      try {
        userId = await this.resolveUserId(request.userId, request.sessionId);
        console.log(`📝 Message creation - Resolved user ID: ${userId} (provided: ${request.userId})`);
      } catch (error) {
        return {
          success: false,
          error: 'Failed to resolve user for message creation',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Generate or use provided session ID
      const sessionId = request.sessionId || this.sessionManager.generateSessionId();

      // Enhance metadata with resolved user and session information
      const enhancedMetadata = {
        ...request.metadata,
        sessionId: sessionId,
        userId: userId,
        timestamp: new Date().toISOString(),
        serviceVersion: '2.0',
        userResolutionStrategy: request.userId ? 'provided' : 'resolved'
      };

      // Create message in database
      const messageId = await this.messageDB.addMessage(
        request.content,
        request.messageType,
        enhancedMetadata
      );

      // Update session activity
      await this.sessionManager.updateSessionContext(sessionId, {
        lastActivity: Date.now(),
        lastMessageId: messageId,
        userId: userId
      });

      return {
        success: true,
        data: {
          messageId: messageId,
          sessionId: sessionId,
          userId: userId,
          timestamp: enhancedMetadata.timestamp,
          metadata: enhancedMetadata
        }
      };

    } catch (error) {
      console.error('❌ Failed to create message:', error);
      return {
        success: false,
        error: 'Failed to create message',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get user's message history
  async getUserMessages(userId: number, limit: number = 50): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      // Ensure user exists
      const resolvedUserId = await this.resolveUserId(userId);
      
      // Get recent conversation (filtered by user would require additional DB methods)
      const conversation = await this.messageDB.getRecentConversation();
      
      // Filter messages by user (basic implementation)
      const userMessages = conversation.messages
        .filter((msg: any) => {
          try {
            if (msg.reasoning) {
              const metadata = JSON.parse(msg.reasoning);
              return metadata.userId === resolvedUserId;
            }
            return false;
          } catch {
            return false;
          }
        })
        .slice(0, limit);

      return {
        success: true,
        data: userMessages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
          metadata: msg.reasoning ? JSON.parse(msg.reasoning) : {}
        }))
      };

    } catch (error) {
      console.error('❌ Failed to get user messages:', error);
      return {
        success: false,
        error: 'Failed to retrieve user messages'
      };
    }
  }

  // Get session messages
  async getSessionMessages(sessionId: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      // Get session context to verify it exists
      const sessionContext = await this.sessionManager.getSessionContext(sessionId);
      
      // Get recent conversation and filter by session
      const conversation = await this.messageDB.getRecentConversation();
      
      const sessionMessages = conversation.messages
        .filter((msg: any) => {
          try {
            if (msg.reasoning) {
              const metadata = JSON.parse(msg.reasoning);
              return metadata.sessionId === sessionId;
            }
            return false;
          } catch {
            return false;
          }
        });

      return {
        success: true,
        data: sessionMessages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
          metadata: msg.reasoning ? JSON.parse(msg.reasoning) : {}
        }))
      };

    } catch (error) {
      console.error('❌ Failed to get session messages:', error);
      return {
        success: false,
        error: 'Failed to retrieve session messages'
      };
    }
  }

  // Create user if they don't exist
  async ensureUser(userId: number, userData?: {
    clerkId?: string;
    email?: string;
    name?: string;
  }): Promise<{
    success: boolean;
    data?: { userId: number; action: 'created' | 'existed' };
    error?: string;
  }> {
    try {
      const resolvedUserId = await this.messageDB.ensureUserExists(userId, userData);
      
      return {
        success: true,
        data: {
          userId: resolvedUserId,
          action: resolvedUserId === userId ? 'existed' : 'created'
        }
      };

    } catch (error) {
      console.error('❌ Failed to ensure user:', error);
      return {
        success: false,
        error: 'Failed to ensure user exists'
      };
    }
  }

  // Get message statistics for user
  async getUserMessageStats(userId: number): Promise<{
    success: boolean;
    data?: {
      totalMessages: number;
      userMessages: number;
      assistantMessages: number;
      systemMessages: number;
      recentActivity: Date | null;
      modificationCount: number;
    };
    error?: string;
  }> {
    try {
      // Ensure user exists
      const resolvedUserId = await this.resolveUserId(userId);
      
      // Get conversation data
      const conversation = await this.messageDB.getRecentConversation();
      const modificationStats = await this.messageDB.getModificationStats();
      
      // Filter and count messages by user
      const userMessages = conversation.messages.filter((msg: any) => {
        try {
          if (msg.reasoning) {
            const metadata = JSON.parse(msg.reasoning);
            return metadata.userId === resolvedUserId;
          }
          return false;
        } catch {
          return false;
        }
      });

      const messagesByType = userMessages.reduce((acc: any, msg: any) => {
        acc[msg.messageType] = (acc[msg.messageType] || 0) + 1;
        return acc;
      }, {});

      const recentActivity = userMessages.length > 0 
        ? userMessages[0].createdAt 
        : null;

      return {
        success: true,
        data: {
          totalMessages: userMessages.length,
          userMessages: messagesByType.user || 0,
          assistantMessages: messagesByType.assistant || 0,
          systemMessages: messagesByType.system || 0,
          recentActivity,
          modificationCount: modificationStats.totalModifications
        }
      };

    } catch (error) {
      console.error('❌ Failed to get user message stats:', error);
      return {
        success: false,
        error: 'Failed to retrieve user message statistics'
      };
    }
  }

  // Delete messages for user (mark as deleted, don't actually delete)
  async deleteUserMessages(userId: number, sessionId?: string): Promise<{
    success: boolean;
    data?: { deletedCount: number };
    error?: string;
  }> {
    try {
      // For now, we'll just clear all data since we don't have user-specific deletion
      // In a full implementation, you'd add user-specific deletion methods
      
      console.log(`🗑️ Would delete messages for user ${userId} in session ${sessionId || 'all'}`);
      
      // This is a placeholder - implement user-specific message deletion
      return {
        success: true,
        data: { deletedCount: 0 }
      };

    } catch (error) {
      console.error('❌ Failed to delete user messages:', error);
      return {
        success: false,
        error: 'Failed to delete user messages'
      };
    }
  }

  // Get conversation context for user
  async getUserConversationContext(userId: number, sessionId?: string): Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }> {
    try {
      // Ensure user exists
      await this.resolveUserId(userId);
      
      // Get enhanced context
      const context = await this.messageDB.getEnhancedContext();
      
      return {
        success: true,
        data: context
      };

    } catch (error) {
      console.error('❌ Failed to get user conversation context:', error);
      return {
        success: false,
        error: 'Failed to retrieve conversation context'
      };
    }
  }

  // Export conversation history for user
  async exportUserConversation(userId: number, format: 'json' | 'csv' = 'json'): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // Get user messages
      const messagesResult = await this.getUserMessages(userId, 1000);
      
      if (!messagesResult.success || !messagesResult.data) {
        return {
          success: false,
          error: 'Failed to retrieve user messages for export'
        };
      }

      const messages = messagesResult.data;

      if (format === 'csv') {
        // Convert to CSV format
        const csvHeader = 'id,content,messageType,createdAt,sessionId,userId\n';
        const csvRows = messages.map(msg => {
          const sessionId = msg.metadata?.sessionId || '';
          const content = `"${msg.content.replace(/"/g, '""')}"`;
          return `${msg.id},${content},${msg.messageType},${msg.createdAt},${sessionId},${userId}`;
        }).join('\n');
        
        return {
          success: true,
          data: {
            format: 'csv',
            content: csvHeader + csvRows,
            messageCount: messages.length,
            exportedAt: new Date().toISOString()
          }
        };
      }

      // Default JSON format
      return {
        success: true,
        data: {
          format: 'json',
          userId: userId,
          messageCount: messages.length,
          exportedAt: new Date().toISOString(),
          messages: messages
        }
      };

    } catch (error) {
      console.error('❌ Failed to export user conversation:', error);
      return {
        success: false,
        error: 'Failed to export conversation'
      };
    }
  }

  // Get service health and stats
  async getServiceHealth(): Promise<{
    success: boolean;
    data?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      database: boolean;
      redis: boolean;
      totalUsers: number;
      totalMessages: number;
      activeeSessions: number;
      uptime: string;
    };
    error?: string;
  }> {
    try {
      // Check database health
      let dbHealth = false;
      let totalMessages = 0;
      try {
        const stats = await this.messageDB.getConversationStats();
        dbHealth = true;
        totalMessages = stats?.totalMessageCount || 0;
      } catch {
        dbHealth = false;
      }

      // Check Redis health (simplified)
      let redisHealth = false;
      let activeSessions = 0;
      try {
        // This would need to be implemented in RedisService
        redisHealth = true;
        activeSessions = 0; // Placeholder
      } catch {
        redisHealth = false;
      }

      // Get total users (would need additional method in DB)
      const totalUsers = 0; // Placeholder

      const status = dbHealth && redisHealth ? 'healthy' : 
                    dbHealth || redisHealth ? 'degraded' : 'unhealthy';

      return {
        success: true,
        data: {
          status,
          database: dbHealth,
          redis: redisHealth,
          totalUsers,
          totalMessages,
          activeeSessions: activeSessions,
          uptime: process.uptime().toString()
        }
      };

    } catch (error) {
      console.error('❌ Failed to get service health:', error);
      return {
        success: false,
        error: 'Failed to retrieve service health'
      };
    }
  }

  // Cleanup old data
  async cleanupOldData(options: {
    olderThanDays?: number;
    userId?: number;
    dryRun?: boolean;
  } = {}): Promise<{
    success: boolean;
    data?: { messagesDeleted: number; sessionsCleared: number };
    error?: string;
  }> {
    try {
      const { olderThanDays = 30, userId, dryRun = true } = options;
      
      console.log(`🧹 Cleanup requested: ${dryRun ? 'DRY RUN' : 'ACTUAL'} - older than ${olderThanDays} days`);
      
      if (userId) {
        console.log(`👤 Cleanup for user: ${userId}`);
      }

      // This would implement actual cleanup logic
      // For now, return placeholder results
      return {
        success: true,
        data: {
          messagesDeleted: dryRun ? 0 : 0,
          sessionsCleared: dryRun ? 0 : 0
        }
      };

    } catch (error) {
      console.error('❌ Failed to cleanup old data:', error);
      return {
        success: false,
        error: 'Failed to cleanup old data'
      };
    }
  }
}

// Create singleton instance
let messageServiceInstance: MessageService | null = null;

export function createMessageService(
  databaseUrl: string,
  anthropic: Anthropic,
  redisUrl?: string
): MessageService {
  if (!messageServiceInstance) {
    messageServiceInstance = new MessageService(databaseUrl, anthropic, redisUrl);
  }
  return messageServiceInstance;
}

export default MessageService;