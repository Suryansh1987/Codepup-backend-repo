import Anthropic from '@anthropic-ai/sdk';
import { type User, type Project, type Conversation } from './message_schema';
export declare class DrizzleMessageHistoryDB {
    private db;
    private anthropic;
    constructor(databaseUrl: string, anthropic: Anthropic);
    getUserByClerkId(clerkId: string): Promise<User | null>;
    getProjectStructure(projectId: number): Promise<string | null>;
    getProjectComponentStructure(projectId: number): Promise<any | null>;
    createUserWithClerkId(userData: {
        clerkId: string;
        email: string;
        name: string;
        phoneNumber?: string | null;
        profileImage?: string | null;
    }): Promise<number>;
    getUser(userId: number): Promise<User | null>;
    updateUser(userId: number, updateData: {
        email?: string;
        name?: string;
        phoneNumber?: string | null;
        profileImage?: string | null;
        plan?: string;
        isActive?: boolean;
        lastLoginAt?: Date;
    }): Promise<void>;
    getMostRecentUserId(): Promise<number | null>;
    validateUserExists(userId: number): Promise<boolean>;
    ensureUserExists(userId: number, userData?: {
        clerkId?: string;
        email?: string;
        name?: string;
    }): Promise<number>;
    getProject(projectId: number): Promise<Project | null>;
    getUserProjects(userId: number): Promise<Project[]>;
    createProject(projectData: {
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
    }): Promise<number>;
    updateProject(projectId: number, updateData: {
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
    }): Promise<void>;
    createConversation(projectId: number, userId: number, sessionId?: string): Promise<number>;
    getProjectConversation(projectId: number): Promise<Conversation | null>;
    addMessage(content: string, messageType: 'user' | 'assistant' | 'system', metadata?: {
        projectId?: number;
        sessionId?: string;
        userId?: number;
        functionCalled?: string;
        [key: string]: any;
    }): Promise<string>;
    getProjectMessages(projectId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    getSessionMessages(sessionId: string): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    initializeSessionStats(sessionId: string, projectId?: number): Promise<void>;
}
