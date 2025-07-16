"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrizzleMessageHistoryDB = void 0;
// db/messagesummary.ts - Updated with Clerk ID support for 4-table schema
const neon_http_1 = require("drizzle-orm/neon-http");
const serverless_1 = require("@neondatabase/serverless");
const drizzle_orm_1 = require("drizzle-orm");
const message_schema_1 = require("./message_schema");
class DrizzleMessageHistoryDB {
    constructor(databaseUrl, anthropic) {
        const sqlConnection = (0, serverless_1.neon)(databaseUrl);
        this.db = (0, neon_http_1.drizzle)(sqlConnection);
        this.anthropic = anthropic;
    }
    // ============================================================================
    // USER MANAGEMENT WITH CLERK ID SUPPORT
    // ============================================================================
    // Get user by Clerk ID
    getUserByClerkId(clerkId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.clerkId, clerkId))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error(`Error getting user by Clerk ID ${clerkId}:`, error);
                return null;
            }
        });
    }
    getProjectStructure(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get ALL project data in one query
                const project = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                if (project.length === 0) {
                    console.log(`Project ${projectId} not found`);
                    return null;
                }
                const projectData = project[0];
                // Return the complete project data as JSON
                // The analysis engine can then differentiate what it needs
                return JSON.stringify(projectData);
            }
            catch (error) {
                console.error(`Error getting project structure for project ${projectId}:`, error);
                return null;
            }
        });
    }
    // Additional helper method for component-specific structure analysis
    getProjectComponentStructure(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const structureJson = yield this.getProjectStructure(projectId);
                if (!structureJson)
                    return null;
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
            }
            catch (error) {
                console.error(`❌ Error getting component structure for project ${projectId}:`, error);
                return null;
            }
        });
    }
    // Create user with Clerk ID
    createUserWithClerkId(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`📝 Creating user with Clerk ID: ${userData.clerkId}`);
                const newUserData = {
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
                const result = yield this.db
                    .insert(message_schema_1.users)
                    .values(newUserData)
                    .returning({ id: message_schema_1.users.id });
                const userId = result[0].id;
                console.log(`✅ Created user ${userId} with Clerk ID ${userData.clerkId}`);
                return userId;
            }
            catch (error) {
                console.error(`Error creating user with Clerk ID ${userData.clerkId}:`, error);
                throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // Get user by ID
    getUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.id, userId))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error(`Error getting user by ID ${userId}:`, error);
                return null;
            }
        });
    }
    // Update user by ID
    updateUser(userId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.users)
                    .set(Object.assign(Object.assign({}, updateData), { updatedAt: new Date() }))
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.id, userId));
                console.log(`✅ Updated user ${userId}`);
            }
            catch (error) {
                console.error(`Error updating user ${userId}:`, error);
                throw error;
            }
        });
    }
    // Get most recent user ID (for fallback)
    getMostRecentUserId() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const result = yield this.db
                    .select({ id: message_schema_1.users.id })
                    .from(message_schema_1.users)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.users.createdAt))
                    .limit(1);
                return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.id) || null;
            }
            catch (error) {
                console.error('Error getting most recent user ID:', error);
                return null;
            }
        });
    }
    // Validate user exists by ID
    validateUserExists(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield this.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.id, userId))
                    .limit(1);
                return user.length > 0;
            }
            catch (error) {
                console.error(`Error validating user ${userId}:`, error);
                return false;
            }
        });
    }
    // Legacy method - now uses Clerk ID approach
    ensureUserExists(userId, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // If user exists, return their ID
                const userExists = yield this.validateUserExists(userId);
                if (userExists) {
                    return userId;
                }
                // If Clerk ID provided, try to find by Clerk ID first
                if (userData === null || userData === void 0 ? void 0 : userData.clerkId) {
                    const existingUser = yield this.getUserByClerkId(userData.clerkId);
                    if (existingUser) {
                        console.log(`✅ Found existing user by Clerk ID: ${existingUser.id}`);
                        return existingUser.id;
                    }
                }
                // Create new user with provided data
                console.log(`📝 Creating user ${userId} as they don't exist...`);
                const newUserData = {
                    id: userId,
                    clerkId: (userData === null || userData === void 0 ? void 0 : userData.clerkId) || `user-${userId}-${Date.now()}`,
                    email: (userData === null || userData === void 0 ? void 0 : userData.email) || `user${userId}@buildora.dev`,
                    name: (userData === null || userData === void 0 ? void 0 : userData.name) || `User ${userId}`,
                    plan: 'free',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                yield this.db.insert(message_schema_1.users).values(newUserData);
                console.log(`✅ Created user ${userId}`);
                return userId;
            }
            catch (error) {
                console.error(`Error ensuring user ${userId} exists:`, error);
                throw new Error(`Failed to ensure user ${userId} exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
    // ============================================================================
    // PROJECT MANAGEMENT - Essential only
    // ============================================================================
    getProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error(`Error getting project by ID ${projectId}:`, error);
                return null;
            }
        });
    }
    getUserProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 Getting projects for user: ${userId}`);
                const userExists = yield this.validateUserExists(userId);
                if (!userExists) {
                    console.warn(`⚠️ User ${userId} does not exist`);
                    return [];
                }
                const projectList = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.userId, userId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
                console.log(`🔍 Found ${projectList.length} projects for user ${userId}`);
                return projectList;
            }
            catch (error) {
                console.error('Error getting user projects:', error);
                return [];
            }
        });
    }
    createProject(projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure the user exists before creating project
                yield this.ensureUserExists(projectData.userId);
                const result = yield this.db
                    .insert(message_schema_1.projects)
                    .values(Object.assign(Object.assign({}, projectData), { createdAt: new Date(), updatedAt: new Date() }))
                    .returning({ id: message_schema_1.projects.id });
                const projectId = result[0].id;
                console.log(`✅ Created new project ${projectId} for user ${projectData.userId}`);
                // Create conversation for this project
                yield this.createConversation(projectId, projectData.userId, projectData.lastSessionId);
                return projectId;
            }
            catch (error) {
                console.error('Error creating project:', error);
                throw error;
            }
        });
    }
    updateProject(projectId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set(Object.assign(Object.assign({}, updateData), { updatedAt: new Date() }))
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                console.log(`✅ Updated project ${projectId}`);
            }
            catch (error) {
                console.error(`Error updating project ${projectId}:`, error);
                throw error;
            }
        });
    }
    // ============================================================================
    // CONVERSATION MANAGEMENT - Essential only
    // ============================================================================
    createConversation(projectId, userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if conversation already exists for this project
                const existing = yield this.db
                    .select()
                    .from(message_schema_1.conversations)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.projectId, projectId))
                    .limit(1);
                if (existing.length > 0) {
                    return existing[0].id;
                }
                const newConversation = {
                    projectId,
                    userId,
                    sessionId: sessionId || null,
                    currentStep: 'analysis',
                    isActive: true,
                    lastActivity: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                const result = yield this.db
                    .insert(message_schema_1.conversations)
                    .values(newConversation)
                    .returning({ id: message_schema_1.conversations.id });
                console.log(`✅ Created conversation ${result[0].id} for project ${projectId}`);
                return result[0].id;
            }
            catch (error) {
                console.error(`Error creating conversation for project ${projectId}:`, error);
                throw error;
            }
        });
    }
    getProjectConversation(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.conversations)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.projectId, projectId))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error(`Error getting conversation for project ${projectId}:`, error);
                return null;
            }
        });
    }
    // ============================================================================
    // MESSAGE MANAGEMENT - Essential only
    // ============================================================================
    addMessage(content, messageType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectId = metadata === null || metadata === void 0 ? void 0 : metadata.projectId;
                if (!projectId) {
                    throw new Error('ProjectId is required for messages');
                }
                // Get or create conversation for this project
                let conversation = yield this.getProjectConversation(projectId);
                if (!conversation) {
                    const project = yield this.getProject(projectId);
                    if (!project) {
                        throw new Error(`Project ${projectId} not found`);
                    }
                    const conversationId = yield this.createConversation(projectId, project.userId, metadata === null || metadata === void 0 ? void 0 : metadata.sessionId);
                    conversation = yield this.db
                        .select()
                        .from(message_schema_1.conversations)
                        .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.id, conversationId))
                        .limit(1)
                        .then(results => results[0]);
                }
                // Create message with proper field mapping
                const newMessage = {
                    conversationId: conversation.id,
                    messageType,
                    // Map content to appropriate field based on message type
                    userMessage: messageType === 'user' ? content : null,
                    agentResponse: messageType === 'assistant' ? content : null,
                    functionCalled: (metadata === null || metadata === void 0 ? void 0 : metadata.functionCalled) || null,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    createdAt: new Date()
                };
                const result = yield this.db
                    .insert(message_schema_1.conversationMessages)
                    .values(newMessage)
                    .returning({ id: message_schema_1.conversationMessages.id });
                // Update conversation activity
                yield this.db
                    .update(message_schema_1.conversations)
                    .set({
                    lastActivity: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.id, conversation.id));
                // Update project message count and activity
                yield this.db
                    .update(message_schema_1.projects)
                    .set({
                    messageCount: (conversation.id), // This should be incremented properly
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                return result[0].id.toString();
            }
            catch (error) {
                console.error('Error adding message:', error);
                throw error;
            }
        });
    }
    getProjectMessages(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, limit = 50) {
            try {
                // Validate project exists
                const project = yield this.getProject(projectId);
                if (!project) {
                    return {
                        success: false,
                        error: `Project ${projectId} not found`
                    };
                }
                // Get conversation for this project
                const conversation = yield this.getProjectConversation(projectId);
                if (!conversation) {
                    return {
                        success: true,
                        data: []
                    };
                }
                // Get messages for this conversation
                const messages = yield this.db
                    .select()
                    .from(message_schema_1.conversationMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversationMessages.conversationId, conversation.id))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.conversationMessages.createdAt))
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
            }
            catch (error) {
                console.error(`Error getting messages for project ${projectId}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    getSessionMessages(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find conversations with this session ID
                const conversationsWithSession = yield this.db
                    .select()
                    .from(message_schema_1.conversations)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.sessionId, sessionId));
                if (conversationsWithSession.length === 0) {
                    return {
                        success: true,
                        data: []
                    };
                }
                // Get messages from all conversations with this session ID
                const conversationIds = conversationsWithSession.map(c => c.id);
                const messages = yield this.db
                    .select()
                    .from(message_schema_1.conversationMessages)
                    .where(conversationIds.length === 1
                    ? (0, drizzle_orm_1.eq)(message_schema_1.conversationMessages.conversationId, conversationIds[0])
                    : // For multiple conversations, would need `inArray` from drizzle-orm
                        (0, drizzle_orm_1.eq)(message_schema_1.conversationMessages.conversationId, conversationIds[0]))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.conversationMessages.createdAt));
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
            }
            catch (error) {
                console.error(`Error getting messages for session ${sessionId}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    // ============================================================================
    // INITIALIZATION - Essential only
    // ============================================================================
    initializeSessionStats(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔧 Initializing session stats for ${sessionId}`);
                // For the 4-table schema, we don't need separate session stats
                // Session tracking is handled through conversations table
            }
            catch (error) {
                console.error('Error initializing session stats:', error);
            }
        });
    }
}
exports.DrizzleMessageHistoryDB = DrizzleMessageHistoryDB;
//# sourceMappingURL=messagesummary.js.map