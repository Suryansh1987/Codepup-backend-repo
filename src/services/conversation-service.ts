import { db } from "../db"; // Your drizzle db instance
import { eq } from "drizzle-orm";
import { conversationMessages, conversations } from "../db/message_schema";

export class ConversationService {
  // Create new conversation for a project
  async createConversation(userId: string, projectId: number) {
    // Check if conversation already exists for this project
    const existing = await this.getConversationByProject(projectId);
    if (existing) {
      throw new Error("Conversation already exists for this project");
    }

    const [conversation] = await db
      .insert(conversations)
      .values({
        userId: parseInt(userId),
        projectId: projectId,
        currentStep: "analysis",
      })
      .returning();

    return conversation;
  }

  // Get conversation by projectId (primary way)
  async getConversationByProject(projectId: number) {
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.projectId, projectId))
      .limit(1);

    return conversation[0] || null;
  }

  // Get conversation by userId (for backward compatibility)
  async getConversation(userId: string) {
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, parseInt(userId)))
      .orderBy(conversations.createdAt)
      .limit(1);

    return conversation[0] || null;
  }

  // Get all conversations for a user (across all projects)
  async getUserConversations(userId: string) {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, parseInt(userId)))
      .orderBy(conversations.createdAt);
  }

  // Update conversation by projectId
  async updateConversationByProject(
    projectId: number,
    updates: {
      currentStep?: string;
      designChoices?: any;
      generatedFiles?: any;
    }
  ) {
    const [updated] = await db
      .update(conversations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(conversations.projectId, projectId))
      .returning();

    return updated;
  }

  // Save message by projectId
  async saveMessageByProject(
    projectId: number,
    data: {
      userMessage?: string;
      agentResponse?: string;
      functionCalled?: string;
    }
  ) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) throw new Error("Conversation not found for project");

    const [message] = await db
      .insert(conversationMessages)
      .values({
        conversationId: conversation.id,
        ...data,
      })
      .returning();

    return message;
  }

  // Get conversation messages by projectId
  async getMessagesByProject(projectId: number) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) return [];

    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversation.id))
      .orderBy(conversationMessages.createdAt);
  }
}
