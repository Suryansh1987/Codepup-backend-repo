// services/messageService.ts - Simplified for 4-table schema
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { RedisService } from './Redis';
import { StatelessSessionManager } from '../routes/session';
import Anthropic from '@anthropic-ai/sdk';

interface CreateMessageRequest {
  content: string;
  messageType: 'user' | 'assistant' | 'system';
  projectId: number;
  userId?: number;
  sessionId?: string;
  metadata?: {
    functionCalled?: string;
    success?: boolean;
    processingTimeMs?: number;
    tokenUsage?: any;
    [key: string]: any;
  };
}

interface MessageResponse {
  success: boolean;
  data?: {
    messageId: string;
    projectId: number;
    userId: number;
    timestamp: string;
  };
  error?: string;
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
      console.log('✅ Message service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize message service:', error);
      throw error;
    }
  }

  // Create message - simplified for 4-table schema
  async createMessage(request: CreateMessageRequest): Promise<MessageResponse> {
    try {
      // Validate required fields
      if (!request.content || !request.messageType || !request.projectId) {
        return {
          success: false,
          error: 'Content, messageType, and projectId are required'
        };
      }

      // Get project to ensure it exists and get userId
      const project = await this.messageDB.getProject(request.projectId);
      if (!project) {
        return {
          success: false,
          error: `Project ${request.projectId} not found`
        };
      }

      const userId = request.userId || project.userId;

      // Ensure user exists
      await this.messageDB.ensureUserExists(userId);

      // Prepare metadata
      const metadata = {
        ...request.metadata,
        projectId: request.projectId,
        sessionId: request.sessionId || project.lastSessionId,
        userId: userId,
        timestamp: new Date().toISOString()
      };

      // Create message in database
      const messageId = await this.messageDB.addMessage(
        request.content,
        request.messageType,
      );

      // Update project last message time
      await this.messageDB.updateProject(request.projectId, {
        lastMessageAt: new Date(),
      });

      return {
        success: true,
        data: {
          messageId: messageId,
          projectId: request.projectId,
          userId: userId,
          timestamp: metadata.timestamp
        }
      };

    } catch (error) {
      console.error('❌ Failed to create message:', error);
      return {
        success: false,
        error: 'Failed to create message'
      };
    }
  }

  // Get messages for a project
  async getProjectMessages(projectId: number, limit: number = 50): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      return await this.messageDB.getProjectMessages(projectId, limit);
    } catch (error) {
      console.error('❌ Failed to get project messages:', error);
      return {
        success: false,
        error: 'Failed to retrieve project messages'
      };
    }
  }

  // Get messages for a session
  async getSessionMessages(sessionId: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      return await this.messageDB.getSessionMessages(sessionId);
    } catch (error) {
      console.error('❌ Failed to get session messages:', error);
      return {
        success: false,
        error: 'Failed to retrieve session messages'
      };
    }
  }

  // Get user's messages across all projects
  async getUserMessages(userId: number, limit: number = 50): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      // Ensure user exists
      await this.messageDB.ensureUserExists(userId);
      
      // Get all user's projects
      const userProjects = await this.messageDB.getUserProjects(userId);
      
      if (userProjects.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // Get messages from all user's projects
      const allMessages: any[] = [];
      
      for (const project of userProjects) {
        const messagesResult = await this.messageDB.getProjectMessages(project.id, limit);
        
        if (messagesResult.success && messagesResult.data) {
          // Add project info to each message
          const messagesWithProject = messagesResult.data.map(msg => ({
            ...msg,
            projectId: project.id,
            projectName: project.name
          }));
          
          allMessages.push(...messagesWithProject);
        }
      }

      // Sort by creation date (newest first) and limit
      const sortedMessages = allMessages
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return {
        success: true,
        data: sortedMessages
      };

    } catch (error) {
      console.error('❌ Failed to get user messages:', error);
      return {
        success: false,
        error: 'Failed to retrieve user messages'
      };
    }
  }

  // Get user's projects with message counts
  async getUserProjects(userId: number): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const projects = await this.messageDB.getUserProjects(userId);
      
      return {
        success: true,
        data: projects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          messageCount: project.messageCount || 0,
          lastMessageAt: project.lastMessageAt,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }))
      };

    } catch (error) {
      console.error('❌ Failed to get user projects:', error);
      return {
        success: false,
        error: 'Failed to retrieve user projects'
      };
    }
  }

  // Create a new project
  async createProject(projectData: {
    userId: number;
    name: string;
    description: string;
    projectType?: string;
    framework?: string;
    template?: string;
    sessionId?: string;
  }): Promise<{
    success: boolean;
    data?: { projectId: number };
    error?: string;
  }> {
    try {
      const projectId = await this.messageDB.createProject({
        ...projectData,
        status: 'active',
        projectType: projectData.projectType || 'frontend',
        framework: projectData.framework || 'react',
        template: projectData.template || 'vite-react-ts',
        deploymentUrl: '',
        downloadUrl: '',
        zipUrl: '',
        buildId: '',
        lastSessionId: projectData.sessionId || '',
        lastMessageAt: new Date(),
        messageCount: 0,
        supabaseurl: '',
        aneonkey: ''
      });

      return {
        success: true,
        data: { projectId }
      };

    } catch (error) {
      console.error('❌ Failed to create project:', error);
      return {
        success: false,
        error: 'Failed to create project'
      };
    }
  }

  // Update project details
  async updateProject(projectId: number, updateData: {
    name?: string;
    description?: string;
    status?: string;
    deploymentUrl?: string;
    downloadUrl?: string;
    zipUrl?: string;
    buildId?: string;
    [key: string]: any;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.messageDB.updateProject(projectId, updateData);
      
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to update project:', error);
      return {
        success: false,
        error: 'Failed to update project'
      };
    }
  }

  // Get project details
  async getProject(projectId: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const project = await this.messageDB.getProject(projectId);
      
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      return {
        success: true,
        data: project
      };

    } catch (error) {
      console.error('❌ Failed to get project:', error);
      return {
        success: false,
        error: 'Failed to retrieve project'
      };
    }
  }

  // Get conversation for a project
  async getProjectConversation(projectId: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const conversation = await this.messageDB.getProjectConversation(projectId);
      
      return {
        success: true,
        data: conversation
      };

    } catch (error) {
      console.error('❌ Failed to get project conversation:', error);
      return {
        success: false,
        error: 'Failed to retrieve project conversation'
      };
    }
  }

  // Ensure user exists
  async ensureUser(userId: number, userData?: {
    clerkId?: string;
    email?: string;
    name?: string;
  }): Promise<{
    success: boolean;
    data?: { userId: number };
    error?: string;
  }> {
    try {
      const resolvedUserId = await this.messageDB.ensureUserExists(userId, userData);
      
      return {
        success: true,
        data: { userId: resolvedUserId }
      };

    } catch (error) {
      console.error('❌ Failed to ensure user:', error);
      return {
        success: false,
        error: 'Failed to ensure user exists'
      };
    }
  }

  // Get service health
  async getServiceHealth(): Promise<{
    success: boolean;
    data?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      database: boolean;
      uptime: string;
    };
    error?: string;
  }> {
    try {
      // Simple health check - try to validate a user exists
      let dbHealth = false;
      try {
        await this.messageDB.validateUserExists(1);
        dbHealth = true;
      } catch {
        dbHealth = false;
      }

      return {
        success: true,
        data: {
          status: dbHealth ? 'healthy' : 'unhealthy',
          database: dbHealth,
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

  // Delete project (soft delete by updating status)
  async deleteProject(projectId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.messageDB.updateProject(projectId, {
        status: 'deleted'
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      return {
        success: false,
        error: 'Failed to delete project'
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