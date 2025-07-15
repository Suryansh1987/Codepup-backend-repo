// db/messagesummary.ts - Updated with Clerk ID support for 4-table schema
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';


import {
  projects,
  users,
  conversations,
  conversationMessages,
  type User,
  type NewUser,
  type Project,
  type NewProject,
  type Conversation,
  type NewConversation,
  type ConversationMessage,
  type NewConversationMessage
} from './message_schema';

export class DrizzleMessageHistoryDB {
  private db: ReturnType<typeof drizzle>;
  private anthropic: Anthropic;

  constructor(databaseUrl: string, anthropic: Anthropic) {
    const sqlConnection = neon(databaseUrl);
    this.db = drizzle(sqlConnection);
    this.anthropic = anthropic;
  }

  // ============================================================================
  // USER MANAGEMENT WITH CLERK ID SUPPORT
  // ============================================================================

  // Get user by Clerk ID
  async getUserByClerkId(clerkId: string): Promise<User | null> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error(`Error getting user by Clerk ID ${clerkId}:`, error);
      return null;
    }
  }



async getProjectStructure(projectId: number): Promise<string | null> {
  try {
    // Get ALL project data in one query
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    
    if (project.length === 0) {
      console.log(`Project ${projectId} not found`);
      return null;
    }
    
    const projectData = project[0];
    
    // Return the complete project data as JSON
    // The analysis engine can then differentiate what it needs
    return JSON.stringify(projectData);
    
  } catch (error) {
    console.error(`Error getting project structure for project ${projectId}:`, error);
    return null;
  }
}

// Additional helper method for component-specific structure analysis
async getProjectComponentStructure(projectId: number): Promise<any | null> {
  try {
    const structureJson = await this.getProjectStructure(projectId);
    if (!structureJson) return null;
    
    const structure = JSON.parse(structureJson);
    
    // Extract component-specific information
    const componentStructure = {
      projectId: structure.id,
      framework: structure.framework,
      template: structure.template,
      hasDatabase: structure.metadata.structureAnalysis.hasDatabase,
      
      // Component analysis
      components: structure.metadata.structureAnalysis.componentHints.codeStructure || {},
      
      // File structure hints for intelligent modification
      fileStructure: {
        hasGeneratedCode: structure.metadata.structureAnalysis.hasGeneratedCode,
        lastModified: structure.updatedAt,
        deploymentUrl: structure.deploymentUrl,
        
        // Hints for file modifier
        modificationHints: {
          framework: structure.framework,
          template: structure.template,
          hasActiveConversation: structure.metadata.hasActiveConversation,
          lastActivity: structure.metadata.lastActivity
        }
      }
    };
    
    return componentStructure;
    
  } catch (error) {
    console.error(`❌ Error getting component structure for project ${projectId}:`, error);
    return null;
  }
}

  // Create user with Clerk ID
  async createUserWithClerkId(userData: {
    clerkId: string;
    email: string;
    name: string;
    phoneNumber?: string | null;
    profileImage?: string | null;
  }): Promise<number> {
    try {
      console.log(`📝 Creating user with Clerk ID: ${userData.clerkId}`);
      
      const newUserData: NewUser = {
        clerkId: userData.clerkId,
        email: userData.email,
        name: userData.name,
        phoneNumber: userData.phoneNumber || null,
        profileImage: userData.profileImage || null,
        plan: 'free',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .insert(users)
        .values(newUserData)
        .returning({ id: users.id });
      
      const userId = result[0].id;
      console.log(`✅ Created user ${userId} with Clerk ID ${userData.clerkId}`);
      return userId;
    } catch (error) {
      console.error(`Error creating user with Clerk ID ${userData.clerkId}:`, error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user by ID
  async getUser(userId: number): Promise<User | null> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error(`Error getting user by ID ${userId}:`, error);
      return null;
    }
  }

  // Update user by ID
  async updateUser(userId: number, updateData: {
    email?: string;
    name?: string;
    phoneNumber?: string | null;
    profileImage?: string | null;
    plan?: string;
    isActive?: boolean;
    lastLoginAt?: Date;
  }): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log(`✅ Updated user ${userId}`);
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }

  // Get most recent user ID (for fallback)
  async getMostRecentUserId(): Promise<number | null> {
    try {
      const result = await this.db
        .select({ id: users.id })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(1);
      
      return result[0]?.id || null;
    } catch (error) {
      console.error('Error getting most recent user ID:', error);
      return null;
    }
  }

  // Validate user exists by ID
  async validateUserExists(userId: number): Promise<boolean> {
    try {
      const user = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user.length > 0;
    } catch (error) {
      console.error(`Error validating user ${userId}:`, error);
      return false;
    }
  }

  // Legacy method - now uses Clerk ID approach
  async ensureUserExists(userId: number, userData?: {
    clerkId?: string;
    email?: string;
    name?: string;
  }): Promise<number> {
    try {
      // If user exists, return their ID
      const userExists = await this.validateUserExists(userId);
      if (userExists) {
        return userId;
      }

      // If Clerk ID provided, try to find by Clerk ID first
      if (userData?.clerkId) {
        const existingUser = await this.getUserByClerkId(userData.clerkId);
        if (existingUser) {
          console.log(`✅ Found existing user by Clerk ID: ${existingUser.id}`);
          return existingUser.id;
        }
      }

      // Create new user with provided data
      console.log(`📝 Creating user ${userId} as they don't exist...`);
      
      const newUserData: NewUser = {
        id: userId,
        clerkId: userData?.clerkId || `user-${userId}-${Date.now()}`,
        email: userData?.email || `user${userId}@buildora.dev`,
        name: userData?.name || `User ${userId}`,
        plan: 'free',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.db.insert(users).values(newUserData);
      
      console.log(`✅ Created user ${userId}`);
      return userId;
    } catch (error) {
      console.error(`Error ensuring user ${userId} exists:`, error);
      throw new Error(`Failed to ensure user ${userId} exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // PROJECT MANAGEMENT - Essential only
  // ============================================================================

  async getProject(projectId: number): Promise<Project | null> {
    try {
      const result = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error(`Error getting project by ID ${projectId}:`, error);
      return null;
    }
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    try {
      console.log(`🔍 Getting projects for user: ${userId}`);
      
      const userExists = await this.validateUserExists(userId);
      if (!userExists) {
        console.warn(`⚠️ User ${userId} does not exist`);
        return [];
      }

      const projectList = await this.db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.updatedAt));

      console.log(`🔍 Found ${projectList.length} projects for user ${userId}`);
      return projectList;
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  async createProject(projectData: {
    userId: number;
    name: string;
    description: string;
    status: string;
    projectType: string;
    deploymentUrl: string;
    downloadUrl: string;
    zipUrl: string;
    buildId: string;
    lastSessionId: string;
    framework: string;
    template: string;
    lastMessageAt: Date;
    messageCount: number;
    supabaseurl: string;
    aneonkey: string;
  }): Promise<number> {
    try {
      // Ensure the user exists before creating project
      await this.ensureUserExists(projectData.userId);
      
      const result = await this.db
        .insert(projects)
        .values({
          ...projectData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning({ id: projects.id });
      
      const projectId = result[0].id;
      console.log(`✅ Created new project ${projectId} for user ${projectData.userId}`);
      
      // Create conversation for this project
      await this.createConversation(projectId, projectData.userId, projectData.lastSessionId);
      
      return projectId;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(projectId: number, updateData: {
    name?: string;
    description?: string;
    conversationTitle?: string;
    lastMessageAt?: Date;
    updatedAt?: Date;
    status?: string;
    buildId?: string;
    lastSessionId?: string;
    framework?: string;
    template?: string;
    deploymentUrl?: string;
    downloadUrl?: string;
    zipUrl?: string;
    supabaseurl?: string;
    aneonkey?: string;
    [key: string]: any;
  }): Promise<void> {
    try {
      await this.db
        .update(projects)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));
      
      console.log(`✅ Updated project ${projectId}`);
    } catch (error) {
      console.error(`Error updating project ${projectId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CONVERSATION MANAGEMENT - Essential only
  // ============================================================================

  async createConversation(projectId: number, userId: number, sessionId?: string): Promise<number> {
    try {
      // Check if conversation already exists for this project
      const existing = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .limit(1);

      if (existing.length > 0) {
        return existing[0].id;
      }

      const newConversation: NewConversation = {
        projectId,
        userId,
        sessionId: sessionId || null,
        currentStep: 'analysis',
        isActive: true,
        lastActivity: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .insert(conversations)
        .values(newConversation)
        .returning({ id: conversations.id });

      console.log(`✅ Created conversation ${result[0].id} for project ${projectId}`);
      return result[0].id;
    } catch (error) {
      console.error(`Error creating conversation for project ${projectId}:`, error);
      throw error;
    }
  }

  async getProjectConversation(projectId: number): Promise<Conversation | null> {
    try {
      const result = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error(`Error getting conversation for project ${projectId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // MESSAGE MANAGEMENT - Essential only
  // ============================================================================

  async addMessage(
    content: string,
    messageType: 'user' | 'assistant' | 'system',
    metadata?: {
      projectId?: number;
      sessionId?: string;
      userId?: number;
      functionCalled?: string;
      [key: string]: any;
    }
  ): Promise<string> {
    try {
      const projectId = metadata?.projectId;
      
      if (!projectId) {
        throw new Error('ProjectId is required for messages');
      }

      // Get or create conversation for this project
      let conversation = await this.getProjectConversation(projectId);
      if (!conversation) {
        const project = await this.getProject(projectId);
        if (!project) {
          throw new Error(`Project ${projectId} not found`);
        }
        const conversationId = await this.createConversation(projectId, project.userId, metadata?.sessionId);
        conversation = await this.db
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1)
          .then(results => results[0]);
      }

      // Create message with proper field mapping
      const newMessage: NewConversationMessage = {
        conversationId: conversation!.id,
        messageType,
        // Map content to appropriate field based on message type
        userMessage: messageType === 'user' ? content : null,
        agentResponse: messageType === 'assistant' ? content : null,
        functionCalled: metadata?.functionCalled || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date()
      };

      const result = await this.db
        .insert(conversationMessages)
        .values(newMessage)
        .returning({ id: conversationMessages.id });

      // Update conversation activity
      await this.db
        .update(conversations)
        .set({
          lastActivity: new Date(),
          updatedAt: new Date()
        })
        .where(eq(conversations.id, conversation!.id));

      // Update project message count and activity
      await this.db
        .update(projects)
        .set({
          messageCount: (conversation!.id), // This should be incremented properly
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));

      return result[0].id.toString();
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async getProjectMessages(projectId: number, limit: number = 50): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      // Validate project exists
      const project = await this.getProject(projectId);
      if (!project) {
        return {
          success: false,
          error: `Project ${projectId} not found`
        };
      }

      // Get conversation for this project
      const conversation = await this.getProjectConversation(projectId);
      if (!conversation) {
        return {
          success: true,
          data: []
        };
      }

      // Get messages for this conversation
      const messages = await this.db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversation.id))
        .orderBy(desc(conversationMessages.createdAt))
        .limit(limit);

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        // Combine userMessage and agentResponse into content field
        content: msg.userMessage || msg.agentResponse || '',
        role: msg.messageType,
        createdAt: msg.createdAt,
        projectId: projectId,
        functionCalled: msg.functionCalled,
       metadata: msg.metadata || {}
      }));

      return {
        success: true,
        data: formattedMessages
      };

    } catch (error) {
      console.error(`Error getting messages for project ${projectId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getSessionMessages(sessionId: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      // Find conversations with this session ID
      const conversationsWithSession = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.sessionId, sessionId));

      if (conversationsWithSession.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      // Get messages from all conversations with this session ID
      const conversationIds = conversationsWithSession.map(c => c.id);
      const messages = await this.db
        .select()
        .from(conversationMessages)
        .where(
          conversationIds.length === 1 
            ? eq(conversationMessages.conversationId, conversationIds[0])
            : // For multiple conversations, would need `inArray` from drizzle-orm
              eq(conversationMessages.conversationId, conversationIds[0])
        )
        .orderBy(desc(conversationMessages.createdAt));

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.userMessage || msg.agentResponse || '',
        role: msg.messageType,
        createdAt: msg.createdAt,
        sessionId: sessionId,
        functionCalled: msg.functionCalled,
       metadata: msg.metadata || {}
      }));

      return {
        success: true,
        data: formattedMessages
      };

    } catch (error) {
      console.error(`Error getting messages for session ${sessionId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // INITIALIZATION - Essential only
  // ============================================================================

  async initializeSessionStats(sessionId: string, projectId?: number): Promise<void> {
    try {
      console.log(`🔧 Initializing session stats for ${sessionId}`);
      // For the 4-table schema, we don't need separate session stats
      // Session tracking is handled through conversations table
    } catch (error) {
      console.error('Error initializing session stats:', error);
    }
  }
}