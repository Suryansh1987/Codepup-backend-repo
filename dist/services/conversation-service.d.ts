export declare class ConversationService {
    createConversation(userId: string, projectId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        projectId: number;
        currentStep: string | null;
        designChoices: unknown;
        generatedFiles: unknown;
    }>;
    getConversationByProject(projectId: number): Promise<{
        id: number;
        projectId: number;
        userId: number;
        currentStep: string | null;
        designChoices: unknown;
        generatedFiles: unknown;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getConversation(userId: string): Promise<{
        id: number;
        projectId: number;
        userId: number;
        currentStep: string | null;
        designChoices: unknown;
        generatedFiles: unknown;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getUserConversations(userId: string): Promise<{
        id: number;
        projectId: number;
        userId: number;
        currentStep: string | null;
        designChoices: unknown;
        generatedFiles: unknown;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    updateConversationByProject(projectId: number, updates: {
        currentStep?: string;
        designChoices?: any;
        generatedFiles?: any;
    }): Promise<{
        id: number;
        projectId: number;
        userId: number;
        currentStep: string | null;
        designChoices: unknown;
        generatedFiles: unknown;
        createdAt: Date;
        updatedAt: Date;
    }>;
    saveMessageByProject(projectId: number, data: {
        userMessage?: string;
        agentResponse?: string;
        functionCalled?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        conversationId: number;
        userMessage: string | null;
        agentResponse: string | null;
        functionCalled: string | null;
    }>;
    getMessagesByProject(projectId: number): Promise<{
        id: number;
        conversationId: number;
        userMessage: string | null;
        agentResponse: string | null;
        functionCalled: string | null;
        createdAt: Date;
    }[]>;
}
