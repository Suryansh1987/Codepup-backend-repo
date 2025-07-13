// db/messagesummary.ts - Updated to use unified schema
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, sql, and, like } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// Import from unified schema (SINGLE SOURCE)
import {
  projects,
  users,
  ciMessages as messages,
  messageSummaries,
  conversationStats,
  projectSummaries,
  type CIMessage as Message,
  type NewCIMessage as NewMessage,
  type MessageSummary,
  type NewMessageSummary,
  type ConversationStats,
  type ProjectSummary,
  type NewProjectSummary
} from './message_schema';

// Import the modular file modifier with proper types
import { StatelessIntelligentFileModifier } from '../services/filemodifier';

// Updated interfaces to work with new modular system
interface ModificationResult {
  success: boolean;
  selectedFiles?: string[];
  approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  reasoning?: string;
  modifiedRanges?: Array<{
    file: string;
    range: {
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
      originalCode: string;
    };
    modifiedCode: string;
  }>;
  addedFiles?: string[];  // New component/page files
  createdFiles?: Array<{  // Legacy compatibility
    path: string;
    content: string;
    type: 'component' | 'page' | 'utility';
  }>;
  modificationSummary?: string;
  error?: string;
}

// Define modification record interface
interface ModificationRecord {
  prompt: string;
  result: ModificationResult;
  approach: string;
  filesModified: string[];
  filesCreated: string[];
  timestamp: string;
}

export class DrizzleMessageHistoryDB {
  private db: ReturnType<typeof drizzle>;
  private anthropic: Anthropic;
  private defaultSessionId: string = 'default-session';

  constructor(databaseUrl: string, anthropic: Anthropic) {
    const sqlConnection = neon(databaseUrl);
    this.db = drizzle(sqlConnection);
    this.anthropic = anthropic;
  }

  // Additional methods to add to your DrizzleMessageHistoryDB class
// Add these methods to your existing DrizzleMessageHistoryDB class in db/messagesummary.ts

// Add these methods to your DrizzleMessageHistoryDB class


async getProject(projectId: number): Promise<any> {
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



/**
 * Update project title and conversation metadata
 */
async updateProjectTitle(projectId: number, updateData: {
  conversationTitle?: string;
  updatedAt: Date;
}): Promise<void> {
  try {
    await this.db
      .update(projects)
      .set({
        conversationTitle: updateData.conversationTitle,
        lastMessageAt: new Date(),
        updatedAt: updateData.updatedAt
      })
      .where(eq(projects.id, projectId));
    
    console.log(`✅ Updated project ${projectId} title`);
  } catch (error) {
    console.error(`Error updating project ${projectId} title:`, error);
    throw error;
  }
}

 async  getProjectSecretsById(projectId: number) {
  const result = await this.db
    .select({
      aneonkey: projects.aneonkey,
      supabaseurl: projects.supabaseurl,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return result[0]; 
}

async getProjectMessages(projectId: number, limit: number = 50): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    // Validate project exists
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return {
        success: false,
        error: `Project ${projectId} not found`
      };
    }

    const projectMessages = await this.db
      .select()
      .from(messages)
      .where(eq(messages.projectId, projectId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Also get messages from session linked to project
    const projectSessionMessages = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, project[0].lastSessionId || `project-${projectId}`))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Combine and deduplicate messages
    const allMessages = [...projectMessages, ...projectSessionMessages];
    const uniqueMessages = allMessages.filter((msg, index, self) => 
      index === self.findIndex(m => m.id === msg.id)
    );

    // Sort by creation date
    uniqueMessages.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );


    const formattedMessages = uniqueMessages.slice(0, limit).map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.messageType,
      createdAt: msg.createdAt,
      timestamp: msg.createdAt,
      projectId: msg.projectId,
      sessionId: msg.sessionId,
      fileModifications: msg.fileModifications,
      modificationApproach: msg.modificationApproach,
      modificationSuccess: msg.modificationSuccess
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

/**
 * Get messages for a specific user
 */
async getUserMessages(userId: number, limit: number = 50): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    // Validate user exists
    const userExists = await this.validateUserExists(userId);
    if (!userExists) {
      return {
        success: false,
        error: `User ${userId} not found`
      };
    }

    // Get user's projects first
    const userProjects = await this.getUserProjects(userId);
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    // Get messages from all user's projects
    const userMessages = await this.db
      .select()
      .from(messages)
      .where(sql`${messages.projectId} IN (${projectIds.join(',')})`)
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Format messages
    const formattedMessages = userMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.messageType,
      createdAt: msg.createdAt,
      timestamp: msg.createdAt,
      projectId: msg.projectId,
      sessionId: msg.sessionId,
      fileModifications: msg.fileModifications,
      modificationApproach: msg.modificationApproach,
      modificationSuccess: msg.modificationSuccess
    }));

    return {
      success: true,
      data: formattedMessages
    };

  } catch (error) {
    console.error(`Error getting messages for user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get messages for a specific session
 */
async getSessionMessages(sessionId: string): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const sessionMessages = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt));

    // Format messages
    const formattedMessages = sessionMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.messageType,
      createdAt: msg.createdAt,
      timestamp: msg.createdAt,
      projectId: msg.projectId,
      sessionId: msg.sessionId,
      fileModifications: msg.fileModifications,
      modificationApproach: msg.modificationApproach,
      modificationSuccess: msg.modificationSuccess
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

/**
 * Delete messages for a specific project
 */
async deleteProjectMessages(projectId: number): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Validate project exists
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return {
        success: false,
        error: `Project ${projectId} not found`
      };
    }

    // Delete messages linked to this project
    const deletedCount = await this.db
      .delete(messages)
      .where(eq(messages.projectId, projectId));

    // Also delete messages from project session
    if (project[0].lastSessionId) {
      await this.db
        .delete(messages)
        .where(eq(messages.sessionId, project[0].lastSessionId));
    }

    // Reset project message count
    await this.db
      .update(projects)
      .set({
        messageCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    return {
      success: true,
      data: {
        deletedCount,
        projectId
      }
    };

  } catch (error) {
    console.error(`Error deleting messages for project ${projectId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get conversation context for a specific project
 */
async getProjectConversationContext(projectId: number): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Get project details
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return {
        success: false,
        error: `Project ${projectId} not found`
      };
    }

    // Get project messages
    const messagesResult = await this.getProjectMessages(projectId, 20);
    if (!messagesResult.success) {
      return messagesResult;
    }

    // Get project summary if exists
    const projectSummary = await this.db
      .select()
      .from(projectSummaries)
      .where(eq(projectSummaries.projectId, projectId))
      .orderBy(desc(projectSummaries.createdAt))
      .limit(1);

    // Build context
    let context = `**PROJECT CONTEXT:**\n`;
    context += `Project: ${project[0].name}\n`;
    context += `Description: ${project[0].description || 'No description'}\n`;
    context += `Framework: ${project[0].framework}\n`;
    context += `Status: ${project[0].status}\n\n`;

    if (projectSummary.length > 0) {
      context += `**PROJECT SUMMARY:**\n${projectSummary[0].summary}\n\n`;
    }

    if (messagesResult.data && messagesResult.data.length > 0) {
      context += `**RECENT MESSAGES:**\n`;
      messagesResult.data.reverse().forEach((msg, index) => {
        context += `${index + 1}. [${msg.role.toUpperCase()}]: ${msg.content}\n`;
        if (msg.fileModifications && msg.fileModifications.length > 0) {
          context += `   Modified: ${msg.fileModifications.join(', ')}\n`;
        }
      });
    }

    return {
      success: true,
      data: {
        context,
        project: project[0],
        messages: messagesResult.data,
        summary: projectSummary[0] || null
      }
    };

  } catch (error) {
    console.error(`Error getting context for project ${projectId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enhanced addMessage method to support project linking
 */
async addMessage(
  content: string,
  messageType: 'user' | 'assistant' | 'system',
  metadata?: {
    fileModifications?: string[];
    modificationApproach?: 
      'FULL_FILE' 
      | 'TARGETED_NODES' 
      | 'COMPONENT_ADDITION' 
      | 'FULL_FILE_GENERATION' 
      | null;
    modificationSuccess?: boolean;
    createdFiles?: string[];
    addedFiles?: string[];
    duration?: number;
    projectSummaryId?: string;
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
    sessionId?: string;
    userId?: number;
    projectId?: number; // ENHANCED: Add projectId support
  }
): Promise<string> {
  const sessionId = metadata?.sessionId || this.defaultSessionId;
  const projectId = metadata?.projectId || null;
  
  // If userId is provided in metadata, ensure they exist
  if (metadata?.userId) {
    try {
      await this.ensureUserExists(metadata.userId);
    } catch (error) {
      console.warn(`⚠️ Failed to ensure user ${metadata.userId} exists:`, error);
    }
  }
  
  const newMessage: NewMessage = {
    sessionId,
    projectId, // ENHANCED: Link to project
    content,
    messageType,
    fileModifications: metadata?.fileModifications || null,
    //@ts-ignore
    modificationApproach: metadata?.modificationApproach || null,
    modificationSuccess: metadata?.modificationSuccess || null,
    reasoning: JSON.stringify({
      promptType: metadata?.promptType,
      requestType: metadata?.requestType,
      relatedUserMessageId: metadata?.relatedUserMessageId,
      success: metadata?.success,
      processingTimeMs: metadata?.processingTimeMs,
      tokenUsage: metadata?.tokenUsage,
      responseLength: metadata?.responseLength,
      buildId: metadata?.buildId,
      previewUrl: metadata?.previewUrl,
      downloadUrl: metadata?.downloadUrl,
      zipUrl: metadata?.zipUrl,
      userId: metadata?.userId,
      projectId: metadata?.projectId, // Include projectId
      error: metadata?.success === false ? 'Generation failed' : undefined
    }),
    projectSummaryId: metadata?.projectSummaryId || null,
    createdAt: new Date()
  };

  const result = await this.db.insert(messages).values(newMessage).returning({ id: messages.id });
  const messageId = result[0].id;

  // Update conversation stats
  await this.db.update(conversationStats)
    .set({
      totalMessageCount: sql`${conversationStats.totalMessageCount} + 1`,
      lastMessageAt: new Date(),
      lastActivity: new Date(),
      updatedAt: new Date()
    })
    .where(eq(conversationStats.sessionId, sessionId));

  // ENHANCED: Update project message count if linked to project


  await this.maintainRecentMessages(sessionId);

  return messageId;
}
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

  async ensureUserExists(userId: number, userData?: {
    clerkId?: string;
    email?: string;
    name?: string;
  }): Promise<number> {
    try {
      const userExists = await this.validateUserExists(userId);
      
      if (userExists) {
        return userId;
      }

      console.log(`📝 Creating user ${userId} as they don't exist...`);
      
      const newUserData = {
        id: userId,
        clerkId: userData?.clerkId || `user-${userId}-${Date.now()}`,
        email: userData?.email || `user${userId}@buildora.dev`,
        name: userData?.name || `User ${userId}`,
        plan: 'free' as const,
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

  // NEW: Get the most recent user ID from projects (fallback when no userId provided)
  async getMostRecentUserId(): Promise<number | null> {
    try {
      const recentProjects = await this.db
        .select({ userId: projects.userId })
        .from(projects)
        .orderBy(desc(projects.updatedAt))
        .limit(1);

      if (recentProjects.length > 0) {
        return recentProjects[0].userId;
      }

      // If no projects exist, check for any user
      const anyUser = await this.db
        .select({ id: users.id })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(1);

      return anyUser.length > 0 ? anyUser[0].id : null;
    } catch (error) {
      console.error('Error getting most recent user ID:', error);
      return null;
    }
  }

  // UPDATED: Method to get recent projects with user validation
  async getRecentProjects(limit: number = 10): Promise<any[]> {
  try {
    console.log(`🔍 [DEBUG] Getting ${limit} most recent projects across all users:`);
    
    const recentProjects = await this.db
      .select()
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(limit);

    console.log(`🔍 [DEBUG] Recent projects (all users):`);
    recentProjects.forEach((project, index) => {
      console.log(`  ${index + 1}. Project ${project.id}: "${project.name}" (User: ${project.userId})`);
      console.log(`     updatedAt: ${project.updatedAt}`);
      console.log(`     zipUrl: ${project.zipUrl ? 'HAS_ZIP' : 'NO_ZIP'}`);
      console.log(`     ---`);
    });

    return recentProjects;
  } catch (error) {
    console.error('Error getting recent projects:', error);
    return [];
  }
}

  // UPDATED: Enhanced getUserProjects method with user validation
async getUserProjects(userId: number): Promise<any[]> {
  try {
    console.log(`🔍 [DEBUG] Getting projects for user: ${userId}`);
    
    const userExists = await this.validateUserExists(userId);
    if (!userExists) {
      console.warn(`⚠️ User ${userId} does not exist`);
      return [];
    }

    // Cast to any[] to avoid TypeScript issues temporarily
    const projectList: any[] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));

    console.log(`🔍 [DEBUG] Found ${projectList.length} projects for user ${userId}:`);
    projectList.forEach((project, index) => {
      console.log(`  ${index + 1}. Project ${project.id}: "${project.name}"`);
      console.log(`     createdAt: ${project.createdAt}`);
      console.log(`     updatedAt: ${project.updatedAt}`);
      console.log(`     lastMessageAt: ${project.lastMessageAt}`);
      console.log(`     zipUrl: ${project.zipUrl ? 'HAS_ZIP' : 'NO_ZIP'}`);
      console.log(`     ---`);
    });

    return projectList;
  } catch (error) {
    console.error('Error getting user projects:', error);
    return [];
  }
}

  // Method to get all projects with their deployment URLs
  async getAllProjectsWithUrls(): Promise<any[]> {
    try {
      return await this.db
        .select()
        .from(projects)
        .where(and(
          eq(projects.status, 'ready'),
          sql`${projects.deploymentUrl} IS NOT NULL`
        ))
        .orderBy(desc(projects.updatedAt));
    } catch (error) {
      console.error('Error getting projects with URLs:', error);
      return [];
    }
  }

  async getProjectBySessionId(sessionId: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(projects)
        .where(eq(projects.lastSessionId, sessionId))
        .orderBy(desc(projects.updatedAt))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting project by session ID:', error);
      return null;
    }
  }

  // Method to get project by build ID
  async getProjectByBuildId(buildId: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(projects)
        .where(eq(projects.buildId, buildId))
        .orderBy(desc(projects.updatedAt))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting project by build ID:', error);
      return null;
    }
  }


  async updateProjectUrls(projectId: number, updateData: {
    deploymentUrl: string;
    downloadUrl: string;
    zipUrl: string;
    buildId: string;
    status: string;
    lastSessionId: string;
    lastMessageAt: Date;
    updatedAt: Date;
  }): Promise<void> {
    try {
      await this.db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, projectId));
      
      console.log(`✅ Updated project ${projectId} with new URLs`);
    } catch (error) {
      console.error('Error updating project URLs:', error);
      throw error;
    }
  }

  // UPDATED: Create new project with user validation
  // In your DrizzleMessageHistoryDB class, update these methods:

// Update the createProject method to handle the correct field names
// Update your DrizzleMessageHistoryDB methods to make these fields required:

// Update the createProject method - make aneonkey and supabaseurl REQUIRED
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
  supabaseurl: string;     // REQUIRED - remove the ?
  aneonkey: string;        // REQUIRED - remove the ?
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
    return projectId;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

// Update the updateProject method - keep these optional for updates
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
  supabaseurl?: string;     // Optional for updates
  aneonkey?: string;        // Optional for updates
  [key: string]: any;
}): Promise<void> {
  try {
    await this.db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId));
    
    console.log(`✅ Updated project ${projectId}`);
  } catch (error) {
    console.error(`Error updating project ${projectId}:`, error);
    throw error;
  }
}

  // Method to get project with deployment history
  async getProjectWithHistory(projectId: number): Promise<any> {
    try {
      const project = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      
      if (!project[0]) {
        return null;
      }

      return {
        ...project[0],
        // Add any additional project history data you want
      };
    } catch (error) {
      console.error('Error getting project with history:', error);
      return null;
    }
  }

  // Method to update project status
  async updateProjectStatus(projectId: number, status: string): Promise<void> {
    try {
      await this.db
        .update(projects)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));
    } catch (error) {
      console.error('Error updating project status:', error);
      throw error;
    }
  }

  // Method to link session to project
  async linkSessionToProject(sessionId: string, projectId: number): Promise<void> {
    try {
      await this.db
        .update(projects)
        .set({ 
          lastSessionId: sessionId,
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));
    } catch (error) {
      console.error('Error linking session to project:', error);
      throw error;
    }
  }

  // Method to increment message count for project
  async incrementProjectMessageCount(sessionId: string): Promise<void> {
    try {
      const project = await this.getProjectBySessionId(sessionId);
      if (project) {
        await this.db
          .update(projects)
          .set({ 
            messageCount: project.messageCount + 1,
            lastMessageAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(projects.id, project.id));
      }
    } catch (error) {
      console.error('Error incrementing project message count:', error);
      // Don't throw - this is not critical
    }
  }

  // UPDATED: Save project summary with user context
  async saveProjectSummary(
    summary: string, 
    prompt: string, 
    zipUrl?: string, 
    buildId?: string,
    userId?: number
  ): Promise<string | null> {
    try {
      // If userId provided, ensure they exist
      if (userId) {
        await this.ensureUserExists(userId);
      }

      // First, mark all existing summaries as inactive for the default session
      await this.db.update(projectSummaries)
        .set({ isActive: false })
        .where(and(
          eq(projectSummaries.sessionId, this.defaultSessionId),
          eq(projectSummaries.isActive, true)
        ));
      
      // Insert the new project summary with ZIP URL and buildId
      const [newSummary] = await this.db.insert(projectSummaries)
        .values({
          sessionId: this.defaultSessionId,
          projectId: null,
          summary,
          originalPrompt: prompt,
          zipUrl: zipUrl || null,
          buildId: buildId || null,
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date()
        })
        .returning({ id: projectSummaries.id });
      
      console.log(`💾 Saved new project summary with ZIP URL (${zipUrl}) and ID: ${newSummary?.id}`);
      
      // Return the ID of the new summary
      return newSummary?.id?.toString() || null;
    } catch (error) {
      console.error('Error saving project summary:', error);
      return null;
    }
  }

  /**
   * Update existing project summary with new ZIP URL and buildId
   */
  async updateProjectSummary(
    summaryId: string, 
    zipUrl: string, 
    buildId: string
  ): Promise<boolean> {
    try {
      await this.db.update(projectSummaries)
        .set({ 
          zipUrl: zipUrl,
          buildId: buildId,
          lastUsedAt: new Date()
        })
        .where(eq(projectSummaries.id, summaryId));
      
      console.log(`💾 Updated project summary ${summaryId} with new ZIP URL: ${zipUrl}`);
      return true;
    } catch (error) {
      console.error('Error updating project summary:', error);
      return false;
    }
  }

  /**
   * Get the active project summary with ZIP URL and buildId
   */
  async getActiveProjectSummary(): Promise<{ 
    id: string; 
    summary: string; 
    zipUrl?: string; 
    buildId?: string; 
  } | null> {
    try {
      const result = await this.db.select({
        id: projectSummaries.id,
        summary: projectSummaries.summary,
        zipUrl: projectSummaries.zipUrl,
        buildId: projectSummaries.buildId
      })
      .from(projectSummaries)
      .where(and(
        eq(projectSummaries.sessionId, this.defaultSessionId),
        eq(projectSummaries.isActive, true)
      ))
      .limit(1);
      
      if (result.length === 0) {
        console.log('No active project summary found');
        return null;
      }
      
      // Update last used time
      await this.db.update(projectSummaries)
        .set({ lastUsedAt: new Date() })
        .where(eq(projectSummaries.id, result[0].id));
      
      console.log(`📂 Retrieved active project summary (ID: ${result[0].id})`);
      
      return {
        id: result[0].id.toString(),
        summary: result[0].summary,
        zipUrl: result[0].zipUrl || undefined,
        buildId: result[0].buildId || undefined
      };
    } catch (error) {
      console.error('Error getting active project summary:', error);
      return null;
    }
  }

  /**
   * Get project summary for scope analysis
   */
  async getProjectSummaryForScope(): Promise<string | null> {
    try {
      const activeSummary = await this.getActiveProjectSummary();
      
      if (!activeSummary) {
        console.log('No active project summary found for scope analysis');
        return null;
      }
      
      console.log(`🔍 Retrieved project summary (ID: ${activeSummary.id}) for scope analysis`);
      return activeSummary.summary;
    } catch (error) {
      console.error('Error retrieving project summary for scope analysis:', error);
      return null;
    }
  }

  /**
   * Override the getEnhancedContext method to include project summary
   */
  async getEnhancedContext(): Promise<string> {
    // Get the original conversation context
    const conversationContext = await this.getConversationContext();
    
    // Get project summary if available
    let projectSummaryContext = '';
    try {
      const projectSummary = await this.getProjectSummaryForScope();
      if (projectSummary) {
        projectSummaryContext = `\n\n**PROJECT SUMMARY:**\n${projectSummary}`;
      }
    } catch (error) {
      console.error('Error retrieving project summary for context:', error);
    }
    
    // Get recent modifications
    let modificationContext = '';
    try {
      const recentMods = await this.getRecentModifications(3);
      
      if (recentMods.length > 0) {
        modificationContext = '\n\n**RECENT MODIFICATIONS:**\n';
        recentMods.forEach((mod, index) => {
          modificationContext += `${index + 1}. ${mod.approach} modification:\n`;
          modificationContext += `   Request: "${mod.prompt}"\n`;
          if (mod.filesCreated.length > 0) {
            modificationContext += `   Created: ${mod.filesCreated.join(', ')}\n`;
          }
          if (mod.filesModified.length > 0) {
            modificationContext += `   Modified: ${mod.filesModified.join(', ')}\n`;
          }
          modificationContext += `   Success: ${mod.result.success}\n`;
          modificationContext += `   When: ${mod.timestamp}\n\n`;
        });
      }
    } catch (error) {
      console.error('Error retrieving modification history for context:', error);
    }
    
    // Combine all contexts
    return conversationContext + projectSummaryContext + modificationContext;
  }

  /**
   * Get all project summaries
   */
  async getAllProjectSummaries(): Promise<ProjectSummary[]> {
    try {
      const summaries = await this.db.select()
        .from(projectSummaries)
        .orderBy(desc(projectSummaries.lastUsedAt));
      
      return summaries;
    } catch (error) {
      console.error('Error retrieving all project summaries:', error);
      return [];
    }
  }

  /**
   * Delete a project summary by ID
   */
  async deleteProjectSummary(id: string): Promise<boolean> {
    try {
      await this.db.delete(projectSummaries)
        .where(eq(projectSummaries.id, id));
      
      console.log(`🗑️ Deleted project summary with ID: ${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting project summary ${id}:`, error);
      return false;
    }
  }

  async initializeStats(): Promise<void> {
    // Initialize for default session
    const existing = await this.db.select()
      .from(conversationStats)
      .where(eq(conversationStats.sessionId, this.defaultSessionId));
    
    if (existing.length === 0) {
      await this.db.insert(conversationStats).values({
        sessionId: this.defaultSessionId,
        projectId: null,
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  // UPDATED: Add a new message with user context


  /**
   * Save modification details for future context
   */
  async saveModification(modification: ModificationRecord): Promise<void> {
    try {
      // Generate a detailed modification summary
      const summary = this.generateModificationSummary(modification);
      
      // Save as a system message with detailed metadata
      await this.addMessage(
        summary,
        'assistant',
        {
          fileModifications: modification.filesModified,
          modificationApproach: modification.approach as 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION',
          modificationSuccess: modification.result.success,
          createdFiles: modification.filesCreated,
          addedFiles: modification.result.addedFiles || []
        }
      );

      console.log('💾 Saved modification to conversation history');
    } catch (error) {
      console.error('Failed to save modification record:', error);
      throw error;
    }
  }

  /**
   * Generate a comprehensive modification summary
   */
  private generateModificationSummary(modification: ModificationRecord): string {
    const { prompt, approach, filesModified, filesCreated, result } = modification;
    
    let summary = `MODIFICATION COMPLETED:\n`;
    summary += `Request: "${prompt}"\n`;
    summary += `Approach: ${approach}\n`;
    summary += `Success: ${result.success}\n`;
    
    // Handle both addedFiles and createdFiles for compatibility
    const newFiles = result.addedFiles || result.createdFiles?.map(f => f.path) || filesCreated;
    if (newFiles.length > 0) {
      summary += `Created files:\n`;
      newFiles.forEach(file => {
        summary += `  - ${file}\n`;
      });
    }
    
    if (filesModified.length > 0) {
      summary += `Modified files:\n`;
      filesModified.forEach(file => {
        summary += `  - ${file}\n`;
      });
    }

    if (result.reasoning) {
      summary += `Reasoning: ${result.reasoning}\n`;
    }

    if (result.modificationSummary) {
      summary += `Summary: ${result.modificationSummary}\n`;
    }

    if (!result.success && result.error) {
      summary += `Error: ${result.error}\n`;
    }
    
    summary += `Timestamp: ${modification.timestamp}`;
    
    return summary;
  }

  /**
   * Get recent modifications for context
   */
  async getRecentModifications(limit: number = 5): Promise<ModificationRecord[]> {
    try {
      // Get recent modification messages
      const recentModifications = await this.db
        .select()
        .from(messages)
        .where(and(
          eq(messages.sessionId, this.defaultSessionId),
          eq(messages.messageType, 'assistant'),
          like(messages.content, 'MODIFICATION COMPLETED:%')
        ))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      
      return recentModifications.map(msg => ({
        prompt: this.extractPromptFromSummary(msg.content),
        result: { success: msg.modificationSuccess || false },
        approach: msg.modificationApproach || 'UNKNOWN',
        filesModified: msg.fileModifications || [],
        filesCreated: [], // Would need to extend schema to store this separately
        timestamp: msg.createdAt!.toISOString()
      }));
    } catch (error) {
      console.error('Failed to get recent modifications:', error);
      return [];
    }
  }

  private extractPromptFromSummary(summary: string): string {
    const match = summary.match(/Request: "(.+?)"/);
    return match ? match[1] : 'Unknown request';
  }

  // Maintain only 5 recent messages, summarize older ones
  private async maintainRecentMessages(sessionId: string = this.defaultSessionId): Promise<void> {
    const allMessages = await this.db.select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt));

    if (allMessages.length > 5) {
      const recentMessages = allMessages.slice(0, 5);
      const oldMessages = allMessages.slice(5);

      if (oldMessages.length > 0) {
        // Update the single growing summary instead of creating new ones
        await this.updateGrowingSummary(oldMessages, sessionId);
      }

      // Delete old messages (keep only recent 5)
      const oldMessageIds = oldMessages.map(m => m.id);
      for (const id of oldMessageIds) {
        await this.db.delete(messages).where(eq(messages.id, id));
      }
    }
  }

  async fixConversationStats(): Promise<void> {
    try {
      // Count actual messages for default session
      const allMessages = await this.db.select()
        .from(messages)
        .where(eq(messages.sessionId, this.defaultSessionId));
      const messageCount = allMessages.length;
      
      // Count summaries for default session
      const summaries = await this.db.select()
        .from(messageSummaries)
        .where(eq(messageSummaries.sessionId, this.defaultSessionId));
      const summaryCount = summaries.length;
      
      // Get summary message count
      const latestSummary = summaries[0];
      const summarizedMessageCount = latestSummary?.messageCount || 0;
      
      // Calculate total messages
      const totalMessages = messageCount + summarizedMessageCount;
      
      // Update stats
      await this.db.update(conversationStats)
        .set({
          totalMessageCount: totalMessages,
          summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
          lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
          updatedAt: new Date()
        })
        .where(eq(conversationStats.sessionId, this.defaultSessionId));
        
      console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
    } catch (error) {
      console.error('Error fixing conversation stats:', error);
    }
  }

  private async updateGrowingSummary(newMessages: Message[], sessionId: string = this.defaultSessionId): Promise<void> {
    // Get the existing summary
    const existingSummaries = await this.db.select()
      .from(messageSummaries)
      .where(eq(messageSummaries.sessionId, sessionId))
      .orderBy(desc(messageSummaries.createdAt))
      .limit(1);
    const existingSummary = existingSummaries[0];

    // Generate new content to add to summary
    const { summary: newContent } = await this.generateSummaryUpdate(newMessages, existingSummary?.summary);

    if (existingSummary) {
      // Update existing summary by appending new content
      await this.db.update(messageSummaries)
        .set({
          summary: newContent,
          messageCount: existingSummary.messageCount + newMessages.length,
          endTime: newMessages[0].createdAt!, // Most recent time
          updatedAt: new Date()
        })
        .where(eq(messageSummaries.id, existingSummary.id));
    } else {
      // Create first summary
      const newSummary: NewMessageSummary = {
        sessionId,
        projectId: null,
        summary: newContent,
        messageCount: newMessages.length,
        startTime: newMessages[newMessages.length - 1].createdAt!, // Oldest
        endTime: newMessages[0].createdAt!, // Newest
        keyTopics: ['react', 'file-modification'],
        createdAt: new Date()
      };
      await this.db.insert(messageSummaries).values(newSummary);
    }

    // Update summary count in stats if this is the first summary
    if (!existingSummary) {
      await this.db.update(conversationStats)
        .set({
          summaryCount: 1,
          updatedAt: new Date()
        })
        .where(eq(conversationStats.sessionId, sessionId));
    }
  }

  // Generate updated summary using Claude
  private async generateSummaryUpdate(newMessages: Message[], existingSummary?: string): Promise<{summary: string}> {
    const newMessagesText = newMessages.reverse().map(msg => {
      let text = `[${msg.messageType.toUpperCase()}]: ${msg.content}`;
      if (msg.fileModifications && msg.fileModifications.length > 0) {
        text += ` (Modified: ${msg.fileModifications.join(', ')})`;
      }
      return text;
    }).join('\n\n');

    const claudePrompt = existingSummary 
      ? `Update this existing conversation summary by incorporating the new messages:

**EXISTING SUMMARY:**
${existingSummary}

**NEW MESSAGES TO ADD:**
${newMessagesText}

**Instructions:**
- Merge the new information into the existing summary
- Keep the summary concise but comprehensive
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Include component/page creation patterns and modification strategies
- Return only the updated summary text, no JSON`
      : `Create a concise summary of this React development conversation:

**MESSAGES:**
${newMessagesText}

**Instructions:**
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Include component/page creation patterns and modification strategies
- Keep it concise but informative for future context
- Return only the summary text, no JSON`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 800,
        temperature: 0.2,
        messages: [{ role: 'user', content: claudePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        return { summary: firstBlock.text.trim() };
      }
    } catch (error) {
      console.error('Error generating summary update:', error);
    }

    // Fallback
    const fallbackSummary = existingSummary 
      ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
      : `React development conversation with file modifications (${newMessages.length} messages)`;
      
    return { summary: fallbackSummary };
  }

  // Get conversation context for file modification prompts
  async getConversationContext(): Promise<string> {
    // Get the single summary for default session
    const summaries = await this.db.select()
      .from(messageSummaries)
      .where(eq(messageSummaries.sessionId, this.defaultSessionId))
      .orderBy(desc(messageSummaries.createdAt))
      .limit(1);
    
    // Get recent messages for default session
    const recentMessages = await this.db.select()
      .from(messages)
      .where(eq(messages.sessionId, this.defaultSessionId))
      .orderBy(desc(messages.createdAt));

    let context = '';

    // Add the single growing summary
    if (summaries.length > 0) {
      const summary = summaries[0];
      context += `**CONVERSATION SUMMARY (${summary.messageCount} previous messages):**\n`;
      context += `${summary.summary}\n\n`;
    }

    // Add recent messages with enhanced formatting
    if (recentMessages.length > 0) {
      context += '**RECENT MESSAGES:**\n';
      recentMessages.reverse().forEach((msg, index) => {
        context += `${index + 1}. [${msg.messageType.toUpperCase()}]: ${msg.content}\n`;
        if (msg.fileModifications && msg.fileModifications.length > 0) {
          context += `   Modified: ${msg.fileModifications.join(', ')}\n`;
        }
        if (msg.modificationApproach) {
          context += `   Approach: ${msg.modificationApproach}\n`;
        }
        if (msg.modificationSuccess !== null) {
          context += `   Success: ${msg.modificationSuccess}\n`;
        }
      });
    }

    return context;
  }

  // Get recent conversation for display
  async getRecentConversation(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
  }> {
    // Get recent messages for default session
    const recentMessages = await this.db.select()
      .from(messages)
      .where(eq(messages.sessionId, this.defaultSessionId))
      .orderBy(desc(messages.createdAt));

    // Get stats for default session
    const stats = await this.db.select()
      .from(conversationStats)
      .where(eq(conversationStats.sessionId, this.defaultSessionId));
    const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };

    return {
      messages: recentMessages,
      summaryCount: currentStats.summaryCount || 0,
      totalMessages: currentStats.totalMessageCount || 0
    };
  }

  // Get current summary for display
  async getCurrentSummary(): Promise<{summary: string; messageCount: number} | null> {
    const summaries = await this.db.select()
      .from(messageSummaries)
      .where(eq(messageSummaries.sessionId, this.defaultSessionId))
      .orderBy(desc(messageSummaries.createdAt))
      .limit(1);
    
    if (summaries.length > 0) {
      const summary = summaries[0];
      return {
        summary: summary.summary,
        messageCount: summary.messageCount
      };
    }
    
    return null;
  }

  // Get conversation stats
  async getConversationStats(): Promise<ConversationStats | null> {
    const stats = await this.db.select()
      .from(conversationStats)
      .where(eq(conversationStats.sessionId, this.defaultSessionId));
    return stats[0] || null;
  }

  // Get all summaries
  async getAllSummaries(): Promise<MessageSummary[]> {
    return await this.db.select()
      .from(messageSummaries)
      .orderBy(desc(messageSummaries.createdAt));
  }

  // Clear all conversation data (for testing/reset)
  async clearAllData(): Promise<void> {
    await this.db.delete(messages);
    await this.db.delete(messageSummaries);
    await this.db.delete(projectSummaries);
    await this.db.update(conversationStats)
      .set({
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      })
      .where(eq(conversationStats.sessionId, this.defaultSessionId));
  }

  // Get modification statistics
  async getModificationStats(): Promise<{
    totalModifications: number;
    successfulModifications: number;
    failedModifications: number;
    mostModifiedFiles: Array<{ file: string; count: number }>;
    approachUsage: Record<string, number>;
  }> {
    try {
      const modificationMessages = await this.db
        .select()
        .from(messages)
        .where(and(
          eq(messages.sessionId, this.defaultSessionId),
          eq(messages.messageType, 'assistant'),
          like(messages.content, 'MODIFICATION COMPLETED:%')
        ));

      const stats = {
        totalModifications: modificationMessages.length,
        successfulModifications: modificationMessages.filter(m => m.modificationSuccess === true).length,
        failedModifications: modificationMessages.filter(m => m.modificationSuccess === false).length,
        mostModifiedFiles: [] as Array<{ file: string; count: number }>,
        approachUsage: {} as Record<string, number>
      };

      // Count file modifications
      const fileCount: Record<string, number> = {};
      modificationMessages.forEach(msg => {
        if (msg.fileModifications) {
          msg.fileModifications.forEach(file => {
            fileCount[file] = (fileCount[file] || 0) + 1;
          });
        }
        
        // Count approach usage
        if (msg.modificationApproach) {
          stats.approachUsage[msg.modificationApproach] = (stats.approachUsage[msg.modificationApproach] || 0) + 1;
        }
      });

      // Get top 10 most modified files
      stats.mostModifiedFiles = Object.entries(fileCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }));

      return stats;
    } catch (error) {
      console.error('Failed to get modification stats:', error);
      return {
        totalModifications: 0,
        successfulModifications: 0,
        failedModifications: 0,
        mostModifiedFiles: [],
        approachUsage: {}
      };
    }
  }

  // NEW SESSION-BASED METHODS (for future use)
  
  /**
   * Initialize stats for a specific session (new method)
   */
  async initializeSessionStats(sessionId: string, projectId?: number): Promise<void> {
    const existing = await this.db.select()
      .from(conversationStats)
      .where(eq(conversationStats.sessionId, sessionId));
    
    if (existing.length === 0) {
      await this.db.insert(conversationStats).values({
        sessionId,
        projectId: projectId || null,
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

 
  async getProjectSessions(projectId: number): Promise<any[]> {
    try {
      const sessions = await this.db.select()
        .from(conversationStats)
        .where(and(
          eq(conversationStats.projectId, projectId),
          eq(conversationStats.isActive, true)
        ))
        .orderBy(desc(conversationStats.lastActivity));

     return sessions.map(session => ({
        sessionId: session.sessionId,
        projectId: session.projectId,
        hasActiveConversation: (session.totalMessageCount ?? 0) > 0,
        messageCount: session.totalMessageCount ?? 0,
        lastActivity: session.lastActivity || session.createdAt,
        summaryExists: (session.summaryCount ?? 0) > 0
      }));

    } catch (error) {
      console.error('Error getting project sessions:', error);
      return [];
    }
  }
}