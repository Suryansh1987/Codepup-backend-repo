import { db } from "../db"; // Your drizzle db instance
import { eq, desc } from "drizzle-orm";
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
        llmProvider: "claude", // Default provider
        llmModel: "claude-sonnet-4-20250514", // Default model
        totalInputTokens: 0,
        totalOutputTokens: 0,
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
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    return conversation[0] || null;
  }

  // Get all conversations for a user (across all projects)
  async getUserConversations(userId: string) {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, parseInt(userId)))
      .orderBy(desc(conversations.createdAt));
  }

  // Update conversation by projectId (legacy method - kept for backward compatibility)
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

  // Save message by projectId (legacy method - kept for backward compatibility)
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
        messageType: data.userMessage ? "user" : "assistant",
        ...data,
      })
      .returning();

    return message;
  }

  // NEW: Update conversation with LLM provider info
  async updateConversationWithLLMInfo(
    projectId: number,
    updates: {
      currentStep?: string;
      designChoices?: any;
      generatedFiles?: any;
      llmProvider?: string;
      llmModel?: string;
      inputTokens?: number;
      outputTokens?: number;
    }
  ) {
    const updateData: any = {};

    if (updates.currentStep) updateData.currentStep = updates.currentStep;
    if (updates.designChoices) updateData.designChoices = updates.designChoices;
    if (updates.generatedFiles)
      updateData.generatedFiles = updates.generatedFiles;
    if (updates.llmProvider) updateData.llmProvider = updates.llmProvider;
    if (updates.llmModel) updateData.llmModel = updates.llmModel;

    // Update token counters
    if (updates.inputTokens || updates.outputTokens) {
      // First get current conversation to add to existing totals
      const current = await this.getConversationByProject(projectId);
      if (current) {
        updateData.totalInputTokens =
          (current.totalInputTokens || 0) + (updates.inputTokens || 0);
        updateData.totalOutputTokens =
          (current.totalOutputTokens || 0) + (updates.outputTokens || 0);
      }
    }

    updateData.updatedAt = new Date();
    updateData.lastActivity = new Date();

    return await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.projectId, projectId))
      .returning();
  }

  // NEW: Save message with LLM provider info
  async saveMessageWithLLMInfo(
    projectId: number,
    messageData: {
      userMessage?: string;
      agentResponse?: string;
      functionCalled?: string;
      llmProvider?: string;
      llmModel?: string;
      inputTokens?: number;
      outputTokens?: number;
      processingTimeMs?: number;
      metadata?: any;
    }
  ) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messageInsert: any = {
      conversationId: conversation.id,
      userMessage: messageData.userMessage,
      agentResponse: messageData.agentResponse,
      functionCalled: messageData.functionCalled,
      llmProvider: messageData.llmProvider,
      llmModel: messageData.llmModel,
      inputTokens: messageData.inputTokens,
      outputTokens: messageData.outputTokens,
      processingTimeMs: messageData.processingTimeMs,
      metadata: messageData.metadata,
    };

    // Determine message type
    if (messageData.userMessage && messageData.agentResponse) {
      messageInsert.messageType = "user";
    } else if (messageData.agentResponse) {
      messageInsert.messageType = "assistant";
    } else {
      messageInsert.messageType = "system";
    }

    return await db
      .insert(conversationMessages)
      .values(messageInsert)
      .returning();
  }

  // NEW: Get token usage statistics for a project
  async getTokenUsageStats(projectId: number) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) {
      return null;
    }

    const messages = await db
      .select({
        inputTokens: conversationMessages.inputTokens,
        outputTokens: conversationMessages.outputTokens,
        llmProvider: conversationMessages.llmProvider,
        llmModel: conversationMessages.llmModel,
        createdAt: conversationMessages.createdAt,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversation.id))
      .orderBy(conversationMessages.createdAt);

    const totalInputTokens = messages.reduce(
      (sum, msg) => sum + (msg.inputTokens || 0),
      0
    );
    const totalOutputTokens = messages.reduce(
      (sum, msg) => sum + (msg.outputTokens || 0),
      0
    );

    return {
      totalInputTokens,
      totalOutputTokens,
      messageCount: messages.length,
      providerBreakdown: messages.reduce((acc, msg) => {
        const provider = msg.llmProvider || "unknown";
        if (!acc[provider]) {
          acc[provider] = { inputTokens: 0, outputTokens: 0, messageCount: 0 };
        }
        acc[provider].inputTokens += msg.inputTokens || 0;
        acc[provider].outputTokens += msg.outputTokens || 0;
        acc[provider].messageCount += 1;
        return acc;
      }, {} as Record<string, { inputTokens: number; outputTokens: number; messageCount: number }>),
    };
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

  // NEW: Get messages with LLM provider info
  async getMessagesWithLLMInfo(projectId: number) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) return [];

    return await db
      .select({
        id: conversationMessages.id,
        userMessage: conversationMessages.userMessage,
        agentResponse: conversationMessages.agentResponse,
        functionCalled: conversationMessages.functionCalled,
        messageType: conversationMessages.messageType,
        llmProvider: conversationMessages.llmProvider,
        llmModel: conversationMessages.llmModel,
        inputTokens: conversationMessages.inputTokens,
        outputTokens: conversationMessages.outputTokens,
        processingTimeMs: conversationMessages.processingTimeMs,
        metadata: conversationMessages.metadata,
        createdAt: conversationMessages.createdAt,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversation.id))
      .orderBy(conversationMessages.createdAt);
  }

  // NEW: Delete conversation messages by projectId
  async deleteMessagesByProject(projectId: number) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) return;

    return await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversation.id));
  }

  // NEW: Delete conversation by projectId
  async deleteConversationByProject(projectId: number) {
    return await db
      .delete(conversations)
      .where(eq(conversations.projectId, projectId));
  }

  // NEW: Get conversation summary with LLM info
  async getConversationSummary(projectId: number) {
    const conversation = await this.getConversationByProject(projectId);
    if (!conversation) return null;

    const messages = await this.getMessagesWithLLMInfo(projectId);
    const tokenStats = await this.getTokenUsageStats(projectId);

    return {
      conversation: {
        id: conversation.id,
        projectId: conversation.projectId,
        userId: conversation.userId,
        currentStep: conversation.currentStep,
        llmProvider: conversation.llmProvider,
        llmModel: conversation.llmModel,
        totalInputTokens: conversation.totalInputTokens,
        totalOutputTokens: conversation.totalOutputTokens,
        isActive: conversation.isActive,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastActivity: conversation.lastActivity,
      },
      messages,
      tokenStats,
      hasDesignChoices: !!conversation.designChoices,
      hasGeneratedFiles: !!conversation.generatedFiles,
    };
  }

  // NEW: Update conversation activity
  async updateActivity(projectId: number) {
    return await db
      .update(conversations)
      .set({
        lastActivity: new Date(),
        isActive: true,
      })
      .where(eq(conversations.projectId, projectId));
  }

  // NEW: Set conversation as inactive
  async setInactive(projectId: number) {
    return await db
      .update(conversations)
      .set({
        isActive: false,
        lastActivity: new Date(),
      })
      .where(eq(conversations.projectId, projectId));
  }

  // NEW: Get all active conversations
  async getActiveConversations() {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.isActive, true))
      .orderBy(desc(conversations.lastActivity));
  }

  // NEW: Get conversation statistics for a user
  async getUserConversationStats(userId: string) {
    const userConversations = await this.getUserConversations(userId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalMessages = 0;
    const providerStats: Record<
      string,
      { conversations: number; tokens: number }
    > = {};

    for (const conversation of userConversations) {
      totalInputTokens += conversation.totalInputTokens || 0;
      totalOutputTokens += conversation.totalOutputTokens || 0;

      const provider = conversation.llmProvider || "unknown";
      if (!providerStats[provider]) {
        providerStats[provider] = { conversations: 0, tokens: 0 };
      }
      providerStats[provider].conversations += 1;
      providerStats[provider].tokens +=
        (conversation.totalInputTokens || 0) +
        (conversation.totalOutputTokens || 0);

      const messages = await this.getMessagesByProject(conversation.projectId);
      totalMessages += messages.length;
    }

    return {
      totalConversations: userConversations.length,
      totalInputTokens,
      totalOutputTokens,
      totalMessages,
      activeConversations: userConversations.filter((c) => c.isActive).length,
      providerStats,
    };
  }

  // NEW: Reset conversation (clear all data but keep the record)
  async resetConversation(projectId: number) {
    // Delete all messages
    await this.deleteMessagesByProject(projectId);

    // Reset conversation state
    return await db
      .update(conversations)
      .set({
        currentStep: "analysis",
        designChoices: null,
        generatedFiles: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        isActive: true,
        lastActivity: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.projectId, projectId))
      .returning();
  }
  async designfile(projectId: number){
const result=  await db
  .select({
    generatedFiles: conversations.generatedFiles,
  })
  .from(conversations)
  .where(eq(conversations.projectId, projectId));
 const files = (result[0]?.generatedFiles as any[]) ?? [];
const filteredFiles = files.filter((file) => file.name?.endsWith("design-system.md"));
return filteredFiles;
 }
}
 