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
// db/messagesummary.ts - Updated to use unified schema
const neon_http_1 = require("drizzle-orm/neon-http");
const serverless_1 = require("@neondatabase/serverless");
const drizzle_orm_1 = require("drizzle-orm");
// Import from unified schema (SINGLE SOURCE)
const message_schema_1 = require("./message_schema");
class DrizzleMessageHistoryDB {
    constructor(databaseUrl, anthropic) {
        this.defaultSessionId = 'default-session';
        const sqlConnection = (0, serverless_1.neon)(databaseUrl);
        this.db = (0, neon_http_1.drizzle)(sqlConnection);
        this.anthropic = anthropic;
    }
    // Additional methods to add to your DrizzleMessageHistoryDB class
    // Add these methods to your existing DrizzleMessageHistoryDB class in db/messagesummary.ts
    // Add these methods to your DrizzleMessageHistoryDB class
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
    /**
     * Update project title and conversation metadata
     */
    updateProjectTitle(projectId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set({
                    conversationTitle: updateData.conversationTitle,
                    lastMessageAt: new Date(),
                    updatedAt: updateData.updatedAt
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                console.log(`✅ Updated project ${projectId} title`);
            }
            catch (error) {
                console.error(`Error updating project ${projectId} title:`, error);
                throw error;
            }
        });
    }
    getProjectSecretsById(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .select({
                aneonkey: message_schema_1.projects.aneonkey,
                supabaseurl: message_schema_1.projects.supabaseurl,
            })
                .from(message_schema_1.projects)
                .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                .limit(1);
            return result[0];
        });
    }
    getProjectMessages(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, limit = 50) {
            try {
                // Validate project exists
                const project = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                if (project.length === 0) {
                    return {
                        success: false,
                        error: `Project ${projectId} not found`
                    };
                }
                const projectMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.projectId, projectId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt))
                    .limit(limit);
                // Also get messages from session linked to project
                const projectSessionMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, project[0].lastSessionId || `project-${projectId}`))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt))
                    .limit(limit);
                // Combine and deduplicate messages
                const allMessages = [...projectMessages, ...projectSessionMessages];
                const uniqueMessages = allMessages.filter((msg, index, self) => index === self.findIndex(m => m.id === msg.id));
                // Sort by creation date
                uniqueMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    /**
     * Get messages for a specific user
     */
    getUserMessages(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50) {
            try {
                // Validate user exists
                const userExists = yield this.validateUserExists(userId);
                if (!userExists) {
                    return {
                        success: false,
                        error: `User ${userId} not found`
                    };
                }
                // Get user's projects first
                const userProjects = yield this.getUserProjects(userId);
                const projectIds = userProjects.map(p => p.id);
                if (projectIds.length === 0) {
                    return {
                        success: true,
                        data: []
                    };
                }
                // Get messages from all user's projects
                const userMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.sql) `${message_schema_1.ciMessages.projectId} IN (${projectIds.join(',')})`)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt))
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
            }
            catch (error) {
                console.error(`Error getting messages for user ${userId}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    /**
     * Get messages for a specific session
     */
    getSessionMessages(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessionMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, sessionId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
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
    /**
     * Delete messages for a specific project
     */
    deleteProjectMessages(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate project exists
                const project = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                if (project.length === 0) {
                    return {
                        success: false,
                        error: `Project ${projectId} not found`
                    };
                }
                // Delete messages linked to this project
                const deletedCount = yield this.db
                    .delete(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.projectId, projectId));
                // Also delete messages from project session
                if (project[0].lastSessionId) {
                    yield this.db
                        .delete(message_schema_1.ciMessages)
                        .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, project[0].lastSessionId));
                }
                // Reset project message count
                yield this.db
                    .update(message_schema_1.projects)
                    .set({
                    messageCount: 0,
                    lastMessageAt: null,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                return {
                    success: true,
                    data: {
                        deletedCount,
                        projectId
                    }
                };
            }
            catch (error) {
                console.error(`Error deleting messages for project ${projectId}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    /**
     * Get conversation context for a specific project
     */
    getProjectConversationContext(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get project details
                const project = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                if (project.length === 0) {
                    return {
                        success: false,
                        error: `Project ${projectId} not found`
                    };
                }
                // Get project messages
                const messagesResult = yield this.getProjectMessages(projectId, 20);
                if (!messagesResult.success) {
                    return messagesResult;
                }
                // Get project summary if exists
                const projectSummary = yield this.db
                    .select()
                    .from(message_schema_1.projectSummaries)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.projectId, projectId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projectSummaries.createdAt))
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
            }
            catch (error) {
                console.error(`Error getting context for project ${projectId}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    /**
     * Enhanced addMessage method to support project linking
     */
    addMessage(content, messageType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = (metadata === null || metadata === void 0 ? void 0 : metadata.sessionId) || this.defaultSessionId;
            const projectId = (metadata === null || metadata === void 0 ? void 0 : metadata.projectId) || null;
            // If userId is provided in metadata, ensure they exist
            if (metadata === null || metadata === void 0 ? void 0 : metadata.userId) {
                try {
                    yield this.ensureUserExists(metadata.userId);
                }
                catch (error) {
                    console.warn(`⚠️ Failed to ensure user ${metadata.userId} exists:`, error);
                }
            }
            const newMessage = {
                sessionId,
                projectId, // ENHANCED: Link to project
                content,
                messageType,
                fileModifications: (metadata === null || metadata === void 0 ? void 0 : metadata.fileModifications) || null,
                //@ts-ignore
                modificationApproach: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationApproach) || null,
                modificationSuccess: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationSuccess) || null,
                reasoning: JSON.stringify({
                    promptType: metadata === null || metadata === void 0 ? void 0 : metadata.promptType,
                    requestType: metadata === null || metadata === void 0 ? void 0 : metadata.requestType,
                    relatedUserMessageId: metadata === null || metadata === void 0 ? void 0 : metadata.relatedUserMessageId,
                    success: metadata === null || metadata === void 0 ? void 0 : metadata.success,
                    processingTimeMs: metadata === null || metadata === void 0 ? void 0 : metadata.processingTimeMs,
                    tokenUsage: metadata === null || metadata === void 0 ? void 0 : metadata.tokenUsage,
                    responseLength: metadata === null || metadata === void 0 ? void 0 : metadata.responseLength,
                    buildId: metadata === null || metadata === void 0 ? void 0 : metadata.buildId,
                    previewUrl: metadata === null || metadata === void 0 ? void 0 : metadata.previewUrl,
                    downloadUrl: metadata === null || metadata === void 0 ? void 0 : metadata.downloadUrl,
                    zipUrl: metadata === null || metadata === void 0 ? void 0 : metadata.zipUrl,
                    userId: metadata === null || metadata === void 0 ? void 0 : metadata.userId,
                    projectId: metadata === null || metadata === void 0 ? void 0 : metadata.projectId, // Include projectId
                    error: (metadata === null || metadata === void 0 ? void 0 : metadata.success) === false ? 'Generation failed' : undefined
                }),
                projectSummaryId: (metadata === null || metadata === void 0 ? void 0 : metadata.projectSummaryId) || null,
                createdAt: new Date()
            };
            const result = yield this.db.insert(message_schema_1.ciMessages).values(newMessage).returning({ id: message_schema_1.ciMessages.id });
            const messageId = result[0].id;
            // Update conversation stats
            yield this.db.update(message_schema_1.conversationStats)
                .set({
                totalMessageCount: (0, drizzle_orm_1.sql) `${message_schema_1.conversationStats.totalMessageCount} + 1`,
                lastMessageAt: new Date(),
                lastActivity: new Date(),
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            // ENHANCED: Update project message count if linked to project
            yield this.maintainRecentMessages(sessionId);
            return messageId;
        });
    }
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
    ensureUserExists(userId, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userExists = yield this.validateUserExists(userId);
                if (userExists) {
                    return userId;
                }
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
    // NEW: Get the most recent user ID from projects (fallback when no userId provided)
    getMostRecentUserId() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const recentProjects = yield this.db
                    .select({ userId: message_schema_1.projects.userId })
                    .from(message_schema_1.projects)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt))
                    .limit(1);
                if (recentProjects.length > 0) {
                    return recentProjects[0].userId;
                }
                // If no projects exist, check for any user
                const anyUser = yield this.db
                    .select({ id: message_schema_1.users.id })
                    .from(message_schema_1.users)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.users.createdAt))
                    .limit(1);
                return anyUser.length > 0 ? anyUser[0].id : null;
            }
            catch (error) {
                console.error('Error getting most recent user ID:', error);
                return null;
            }
        });
    }
    // UPDATED: Method to get recent projects with user validation
    getRecentProjects() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            try {
                console.log(`🔍 [DEBUG] Getting ${limit} most recent projects across all users:`);
                const recentProjects = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt))
                    .limit(limit);
                console.log(`🔍 [DEBUG] Recent projects (all users):`);
                recentProjects.forEach((project, index) => {
                    console.log(`  ${index + 1}. Project ${project.id}: "${project.name}" (User: ${project.userId})`);
                    console.log(`     updatedAt: ${project.updatedAt}`);
                    console.log(`     zipUrl: ${project.zipUrl ? 'HAS_ZIP' : 'NO_ZIP'}`);
                    console.log(`     ---`);
                });
                return recentProjects;
            }
            catch (error) {
                console.error('Error getting recent projects:', error);
                return [];
            }
        });
    }
    // UPDATED: Enhanced getUserProjects method with user validation
    getUserProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 [DEBUG] Getting projects for user: ${userId}`);
                const userExists = yield this.validateUserExists(userId);
                if (!userExists) {
                    console.warn(`⚠️ User ${userId} does not exist`);
                    return [];
                }
                // Cast to any[] to avoid TypeScript issues temporarily
                const projectList = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.userId, userId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
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
            }
            catch (error) {
                console.error('Error getting user projects:', error);
                return [];
            }
        });
    }
    // Method to get all projects with their deployment URLs
    getAllProjectsWithUrls() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projects.status, 'ready'), (0, drizzle_orm_1.sql) `${message_schema_1.projects.deploymentUrl} IS NOT NULL`))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
            }
            catch (error) {
                console.error('Error getting projects with URLs:', error);
                return [];
            }
        });
    }
    getProjectBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.lastSessionId, sessionId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error('Error getting project by session ID:', error);
                return null;
            }
        });
    }
    // Method to get project by build ID
    getProjectByBuildId(buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.buildId, buildId))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt))
                    .limit(1);
                return result[0] || null;
            }
            catch (error) {
                console.error('Error getting project by build ID:', error);
                return null;
            }
        });
    }
    updateProjectUrls(projectId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set(updateData)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                console.log(`✅ Updated project ${projectId} with new URLs`);
            }
            catch (error) {
                console.error('Error updating project URLs:', error);
                throw error;
            }
        });
    }
    // UPDATED: Create new project with user validation
    // In your DrizzleMessageHistoryDB class, update these methods:
    // Update the createProject method to handle the correct field names
    // Update your DrizzleMessageHistoryDB methods to make these fields required:
    // Update the createProject method - make aneonkey and supabaseurl REQUIRED
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
                return projectId;
            }
            catch (error) {
                console.error('Error creating project:', error);
                throw error;
            }
        });
    }
    // Update the updateProject method - keep these optional for updates
    updateProject(projectId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set(updateData)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
                console.log(`✅ Updated project ${projectId}`);
            }
            catch (error) {
                console.error(`Error updating project ${projectId}:`, error);
                throw error;
            }
        });
    }
    // Method to get project with deployment history
    getProjectWithHistory(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield this.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                if (!project[0]) {
                    return null;
                }
                return Object.assign({}, project[0]);
            }
            catch (error) {
                console.error('Error getting project with history:', error);
                return null;
            }
        });
    }
    // Method to update project status
    updateProjectStatus(projectId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set({
                    status,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
            }
            catch (error) {
                console.error('Error updating project status:', error);
                throw error;
            }
        });
    }
    // Method to link session to project
    linkSessionToProject(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db
                    .update(message_schema_1.projects)
                    .set({
                    lastSessionId: sessionId,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
            }
            catch (error) {
                console.error('Error linking session to project:', error);
                throw error;
            }
        });
    }
    // Method to increment message count for project
    incrementProjectMessageCount(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield this.getProjectBySessionId(sessionId);
                if (project) {
                    yield this.db
                        .update(message_schema_1.projects)
                        .set({
                        messageCount: project.messageCount + 1,
                        lastMessageAt: new Date(),
                        updatedAt: new Date()
                    })
                        .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, project.id));
                }
            }
            catch (error) {
                console.error('Error incrementing project message count:', error);
                // Don't throw - this is not critical
            }
        });
    }
    // UPDATED: Save project summary with user context
    saveProjectSummary(summary, prompt, zipUrl, buildId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // If userId provided, ensure they exist
                if (userId) {
                    yield this.ensureUserExists(userId);
                }
                // First, mark all existing summaries as inactive for the default session
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({ isActive: false })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.isActive, true)));
                // Insert the new project summary with ZIP URL and buildId
                const [newSummary] = yield this.db.insert(message_schema_1.projectSummaries)
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
                    .returning({ id: message_schema_1.projectSummaries.id });
                console.log(`💾 Saved new project summary with ZIP URL (${zipUrl}) and ID: ${newSummary === null || newSummary === void 0 ? void 0 : newSummary.id}`);
                // Return the ID of the new summary
                return ((_a = newSummary === null || newSummary === void 0 ? void 0 : newSummary.id) === null || _a === void 0 ? void 0 : _a.toString()) || null;
            }
            catch (error) {
                console.error('Error saving project summary:', error);
                return null;
            }
        });
    }
    /**
     * Update existing project summary with new ZIP URL and buildId
     */
    updateProjectSummary(summaryId, zipUrl, buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({
                    zipUrl: zipUrl,
                    buildId: buildId,
                    lastUsedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, summaryId));
                console.log(`💾 Updated project summary ${summaryId} with new ZIP URL: ${zipUrl}`);
                return true;
            }
            catch (error) {
                console.error('Error updating project summary:', error);
                return false;
            }
        });
    }
    /**
     * Get the active project summary with ZIP URL and buildId
     */
    getActiveProjectSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db.select({
                    id: message_schema_1.projectSummaries.id,
                    summary: message_schema_1.projectSummaries.summary,
                    zipUrl: message_schema_1.projectSummaries.zipUrl,
                    buildId: message_schema_1.projectSummaries.buildId
                })
                    .from(message_schema_1.projectSummaries)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.isActive, true)))
                    .limit(1);
                if (result.length === 0) {
                    console.log('No active project summary found');
                    return null;
                }
                // Update last used time
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({ lastUsedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, result[0].id));
                console.log(`📂 Retrieved active project summary (ID: ${result[0].id})`);
                return {
                    id: result[0].id.toString(),
                    summary: result[0].summary,
                    zipUrl: result[0].zipUrl || undefined,
                    buildId: result[0].buildId || undefined
                };
            }
            catch (error) {
                console.error('Error getting active project summary:', error);
                return null;
            }
        });
    }
    /**
     * Get project summary for scope analysis
     */
    getProjectSummaryForScope() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeSummary = yield this.getActiveProjectSummary();
                if (!activeSummary) {
                    console.log('No active project summary found for scope analysis');
                    return null;
                }
                console.log(`🔍 Retrieved project summary (ID: ${activeSummary.id}) for scope analysis`);
                return activeSummary.summary;
            }
            catch (error) {
                console.error('Error retrieving project summary for scope analysis:', error);
                return null;
            }
        });
    }
    /**
     * Override the getEnhancedContext method to include project summary
     */
    getEnhancedContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the original conversation context
            const conversationContext = yield this.getConversationContext();
            // Get project summary if available
            let projectSummaryContext = '';
            try {
                const projectSummary = yield this.getProjectSummaryForScope();
                if (projectSummary) {
                    projectSummaryContext = `\n\n**PROJECT SUMMARY:**\n${projectSummary}`;
                }
            }
            catch (error) {
                console.error('Error retrieving project summary for context:', error);
            }
            // Get recent modifications
            let modificationContext = '';
            try {
                const recentMods = yield this.getRecentModifications(3);
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
            }
            catch (error) {
                console.error('Error retrieving modification history for context:', error);
            }
            // Combine all contexts
            return conversationContext + projectSummaryContext + modificationContext;
        });
    }
    /**
     * Get all project summaries
     */
    getAllProjectSummaries() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const summaries = yield this.db.select()
                    .from(message_schema_1.projectSummaries)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projectSummaries.lastUsedAt));
                return summaries;
            }
            catch (error) {
                console.error('Error retrieving all project summaries:', error);
                return [];
            }
        });
    }
    /**
     * Delete a project summary by ID
     */
    deleteProjectSummary(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.delete(message_schema_1.projectSummaries)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, id));
                console.log(`🗑️ Deleted project summary with ID: ${id}`);
                return true;
            }
            catch (error) {
                console.error(`Error deleting project summary ${id}:`, error);
                return false;
            }
        });
    }
    initializeStats() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize for default session
            const existing = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            if (existing.length === 0) {
                yield this.db.insert(message_schema_1.conversationStats).values({
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
        });
    }
    // UPDATED: Add a new message with user context
    /**
     * Save modification details for future context
     */
    saveModification(modification) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate a detailed modification summary
                const summary = this.generateModificationSummary(modification);
                // Save as a system message with detailed metadata
                yield this.addMessage(summary, 'assistant', {
                    fileModifications: modification.filesModified,
                    modificationApproach: modification.approach,
                    modificationSuccess: modification.result.success,
                    createdFiles: modification.filesCreated,
                    addedFiles: modification.result.addedFiles || []
                });
                console.log('💾 Saved modification to conversation history');
            }
            catch (error) {
                console.error('Failed to save modification record:', error);
                throw error;
            }
        });
    }
    /**
     * Generate a comprehensive modification summary
     */
    generateModificationSummary(modification) {
        var _a;
        const { prompt, approach, filesModified, filesCreated, result } = modification;
        let summary = `MODIFICATION COMPLETED:\n`;
        summary += `Request: "${prompt}"\n`;
        summary += `Approach: ${approach}\n`;
        summary += `Success: ${result.success}\n`;
        // Handle both addedFiles and createdFiles for compatibility
        const newFiles = result.addedFiles || ((_a = result.createdFiles) === null || _a === void 0 ? void 0 : _a.map(f => f.path)) || filesCreated;
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
    getRecentModifications() {
        return __awaiter(this, arguments, void 0, function* (limit = 5) {
            try {
                // Get recent modification messages
                const recentModifications = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.ciMessages.messageType, 'assistant'), (0, drizzle_orm_1.like)(message_schema_1.ciMessages.content, 'MODIFICATION COMPLETED:%')))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt))
                    .limit(limit);
                return recentModifications.map(msg => ({
                    prompt: this.extractPromptFromSummary(msg.content),
                    result: { success: msg.modificationSuccess || false },
                    approach: msg.modificationApproach || 'UNKNOWN',
                    filesModified: msg.fileModifications || [],
                    filesCreated: [], // Would need to extend schema to store this separately
                    timestamp: msg.createdAt.toISOString()
                }));
            }
            catch (error) {
                console.error('Failed to get recent modifications:', error);
                return [];
            }
        });
    }
    extractPromptFromSummary(summary) {
        const match = summary.match(/Request: "(.+?)"/);
        return match ? match[1] : 'Unknown request';
    }
    // Maintain only 5 recent messages, summarize older ones
    maintainRecentMessages() {
        return __awaiter(this, arguments, void 0, function* (sessionId = this.defaultSessionId) {
            const allMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, sessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
            if (allMessages.length > 5) {
                const recentMessages = allMessages.slice(0, 5);
                const oldMessages = allMessages.slice(5);
                if (oldMessages.length > 0) {
                    // Update the single growing summary instead of creating new ones
                    yield this.updateGrowingSummary(oldMessages, sessionId);
                }
                // Delete old messages (keep only recent 5)
                const oldMessageIds = oldMessages.map(m => m.id);
                for (const id of oldMessageIds) {
                    yield this.db.delete(message_schema_1.ciMessages).where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.id, id));
                }
            }
        });
    }
    fixConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Count actual messages for default session
                const allMessages = yield this.db.select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId));
                const messageCount = allMessages.length;
                // Count summaries for default session
                const summaries = yield this.db.select()
                    .from(message_schema_1.messageSummaries)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId));
                const summaryCount = summaries.length;
                // Get summary message count
                const latestSummary = summaries[0];
                const summarizedMessageCount = (latestSummary === null || latestSummary === void 0 ? void 0 : latestSummary.messageCount) || 0;
                // Calculate total messages
                const totalMessages = messageCount + summarizedMessageCount;
                // Update stats
                yield this.db.update(message_schema_1.conversationStats)
                    .set({
                    totalMessageCount: totalMessages,
                    summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
                    lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
                console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
            }
            catch (error) {
                console.error('Error fixing conversation stats:', error);
            }
        });
    }
    updateGrowingSummary(newMessages_1) {
        return __awaiter(this, arguments, void 0, function* (newMessages, sessionId = this.defaultSessionId) {
            // Get the existing summary
            const existingSummaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, sessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            const existingSummary = existingSummaries[0];
            // Generate new content to add to summary
            const { summary: newContent } = yield this.generateSummaryUpdate(newMessages, existingSummary === null || existingSummary === void 0 ? void 0 : existingSummary.summary);
            if (existingSummary) {
                // Update existing summary by appending new content
                yield this.db.update(message_schema_1.messageSummaries)
                    .set({
                    summary: newContent,
                    messageCount: existingSummary.messageCount + newMessages.length,
                    endTime: newMessages[0].createdAt, // Most recent time
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.id, existingSummary.id));
            }
            else {
                // Create first summary
                const newSummary = {
                    sessionId,
                    projectId: null,
                    summary: newContent,
                    messageCount: newMessages.length,
                    startTime: newMessages[newMessages.length - 1].createdAt, // Oldest
                    endTime: newMessages[0].createdAt, // Newest
                    keyTopics: ['react', 'file-modification'],
                    createdAt: new Date()
                };
                yield this.db.insert(message_schema_1.messageSummaries).values(newSummary);
            }
            // Update summary count in stats if this is the first summary
            if (!existingSummary) {
                yield this.db.update(message_schema_1.conversationStats)
                    .set({
                    summaryCount: 1,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            }
        });
    }
    // Generate updated summary using Claude
    generateSummaryUpdate(newMessages, existingSummary) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 800,
                    temperature: 0.2,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    return { summary: firstBlock.text.trim() };
                }
            }
            catch (error) {
                console.error('Error generating summary update:', error);
            }
            // Fallback
            const fallbackSummary = existingSummary
                ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
                : `React development conversation with file modifications (${newMessages.length} messages)`;
            return { summary: fallbackSummary };
        });
    }
    // Get conversation context for file modification prompts
    getConversationContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the single summary for default session
            const summaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            // Get recent messages for default session
            const recentMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
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
        });
    }
    // Get recent conversation for display
    getRecentConversation() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get recent messages for default session
            const recentMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
            // Get stats for default session
            const stats = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };
            return {
                messages: recentMessages,
                summaryCount: currentStats.summaryCount || 0,
                totalMessages: currentStats.totalMessageCount || 0
            };
        });
    }
    // Get current summary for display
    getCurrentSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const summaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            if (summaries.length > 0) {
                const summary = summaries[0];
                return {
                    summary: summary.summary,
                    messageCount: summary.messageCount
                };
            }
            return null;
        });
    }
    // Get conversation stats
    getConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            return stats[0] || null;
        });
    }
    // Get all summaries
    getAllSummaries() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt));
        });
    }
    // Clear all conversation data (for testing/reset)
    clearAllData() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.delete(message_schema_1.ciMessages);
            yield this.db.delete(message_schema_1.messageSummaries);
            yield this.db.delete(message_schema_1.projectSummaries);
            yield this.db.update(message_schema_1.conversationStats)
                .set({
                totalMessageCount: 0,
                summaryCount: 0,
                lastMessageAt: null,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
        });
    }
    // Get modification statistics
    getModificationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const modificationMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.ciMessages.messageType, 'assistant'), (0, drizzle_orm_1.like)(message_schema_1.ciMessages.content, 'MODIFICATION COMPLETED:%')));
                const stats = {
                    totalModifications: modificationMessages.length,
                    successfulModifications: modificationMessages.filter(m => m.modificationSuccess === true).length,
                    failedModifications: modificationMessages.filter(m => m.modificationSuccess === false).length,
                    mostModifiedFiles: [],
                    approachUsage: {}
                };
                // Count file modifications
                const fileCount = {};
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
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([file, count]) => ({ file, count }));
                return stats;
            }
            catch (error) {
                console.error('Failed to get modification stats:', error);
                return {
                    totalModifications: 0,
                    successfulModifications: 0,
                    failedModifications: 0,
                    mostModifiedFiles: [],
                    approachUsage: {}
                };
            }
        });
    }
    // NEW SESSION-BASED METHODS (for future use)
    /**
     * Initialize stats for a specific session (new method)
     */
    initializeSessionStats(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            if (existing.length === 0) {
                yield this.db.insert(message_schema_1.conversationStats).values({
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
        });
    }
    getProjectSessions(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessions = yield this.db.select()
                    .from(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.projectId, projectId), (0, drizzle_orm_1.eq)(message_schema_1.conversationStats.isActive, true)))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.conversationStats.lastActivity));
                return sessions.map(session => {
                    var _a, _b, _c;
                    return ({
                        sessionId: session.sessionId,
                        projectId: session.projectId,
                        hasActiveConversation: ((_a = session.totalMessageCount) !== null && _a !== void 0 ? _a : 0) > 0,
                        messageCount: (_b = session.totalMessageCount) !== null && _b !== void 0 ? _b : 0,
                        lastActivity: session.lastActivity || session.createdAt,
                        summaryExists: ((_c = session.summaryCount) !== null && _c !== void 0 ? _c : 0) > 0
                    });
                });
            }
            catch (error) {
                console.error('Error getting project sessions:', error);
                return [];
            }
        });
    }
}
exports.DrizzleMessageHistoryDB = DrizzleMessageHistoryDB;
//# sourceMappingURL=messagesummary.js.map