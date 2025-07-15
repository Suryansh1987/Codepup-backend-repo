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
exports.createMessageService = createMessageService;
// services/messageService.ts - Simplified for 4-table schema
const messagesummary_1 = require("../db/messagesummary");
const Redis_1 = require("./Redis");
const session_1 = require("../routes/session");
class MessageService {
    constructor(databaseUrl, anthropic, redisUrl) {
        this.messageDB = new messagesummary_1.DrizzleMessageHistoryDB(databaseUrl, anthropic);
        this.redis = new Redis_1.RedisService(redisUrl);
        this.sessionManager = new session_1.StatelessSessionManager(this.redis);
    }
    // Initialize the service
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('✅ Message service initialized');
            }
            catch (error) {
                console.error('❌ Failed to initialize message service:', error);
                throw error;
            }
        });
    }
    // Create message - simplified for 4-table schema
    createMessage(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!request.content || !request.messageType || !request.projectId) {
                    return {
                        success: false,
                        error: 'Content, messageType, and projectId are required'
                    };
                }
                // Get project to ensure it exists and get userId
                const project = yield this.messageDB.getProject(request.projectId);
                if (!project) {
                    return {
                        success: false,
                        error: `Project ${request.projectId} not found`
                    };
                }
                const userId = request.userId || project.userId;
                // Ensure user exists
                yield this.messageDB.ensureUserExists(userId);
                // Prepare metadata
                const metadata = Object.assign(Object.assign({}, request.metadata), { projectId: request.projectId, sessionId: request.sessionId || project.lastSessionId, userId: userId, timestamp: new Date().toISOString() });
                // Create message in database
                const messageId = yield this.messageDB.addMessage(request.content, request.messageType);
                // Update project last message time
                yield this.messageDB.updateProject(request.projectId, {
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
            }
            catch (error) {
                console.error('❌ Failed to create message:', error);
                return {
                    success: false,
                    error: 'Failed to create message'
                };
            }
        });
    }
    // Get messages for a project
    getProjectMessages(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, limit = 50) {
            try {
                return yield this.messageDB.getProjectMessages(projectId, limit);
            }
            catch (error) {
                console.error('❌ Failed to get project messages:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve project messages'
                };
            }
        });
    }
    // Get messages for a session
    getSessionMessages(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.messageDB.getSessionMessages(sessionId);
            }
            catch (error) {
                console.error('❌ Failed to get session messages:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve session messages'
                };
            }
        });
    }
    // Get user's messages across all projects
    getUserMessages(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50) {
            try {
                // Ensure user exists
                yield this.messageDB.ensureUserExists(userId);
                // Get all user's projects
                const userProjects = yield this.messageDB.getUserProjects(userId);
                if (userProjects.length === 0) {
                    return {
                        success: true,
                        data: []
                    };
                }
                // Get messages from all user's projects
                const allMessages = [];
                for (const project of userProjects) {
                    const messagesResult = yield this.messageDB.getProjectMessages(project.id, limit);
                    if (messagesResult.success && messagesResult.data) {
                        // Add project info to each message
                        const messagesWithProject = messagesResult.data.map(msg => (Object.assign(Object.assign({}, msg), { projectId: project.id, projectName: project.name })));
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
            }
            catch (error) {
                console.error('❌ Failed to get user messages:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve user messages'
                };
            }
        });
    }
    // Get user's projects with message counts
    getUserProjects(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projects = yield this.messageDB.getUserProjects(userId);
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
            }
            catch (error) {
                console.error('❌ Failed to get user projects:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve user projects'
                };
            }
        });
    }
    // Create a new project
    createProject(projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectId = yield this.messageDB.createProject(Object.assign(Object.assign({}, projectData), { status: 'active', projectType: projectData.projectType || 'frontend', framework: projectData.framework || 'react', template: projectData.template || 'vite-react-ts', deploymentUrl: '', downloadUrl: '', zipUrl: '', buildId: '', lastSessionId: projectData.sessionId || '', lastMessageAt: new Date(), messageCount: 0, supabaseurl: '', aneonkey: '' }));
                return {
                    success: true,
                    data: { projectId }
                };
            }
            catch (error) {
                console.error('❌ Failed to create project:', error);
                return {
                    success: false,
                    error: 'Failed to create project'
                };
            }
        });
    }
    // Update project details
    updateProject(projectId, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.messageDB.updateProject(projectId, updateData);
                return { success: true };
            }
            catch (error) {
                console.error('❌ Failed to update project:', error);
                return {
                    success: false,
                    error: 'Failed to update project'
                };
            }
        });
    }
    // Get project details
    getProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield this.messageDB.getProject(projectId);
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
            }
            catch (error) {
                console.error('❌ Failed to get project:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve project'
                };
            }
        });
    }
    // Get conversation for a project
    getProjectConversation(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const conversation = yield this.messageDB.getProjectConversation(projectId);
                return {
                    success: true,
                    data: conversation
                };
            }
            catch (error) {
                console.error('❌ Failed to get project conversation:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve project conversation'
                };
            }
        });
    }
    // Ensure user exists
    ensureUser(userId, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resolvedUserId = yield this.messageDB.ensureUserExists(userId, userData);
                return {
                    success: true,
                    data: { userId: resolvedUserId }
                };
            }
            catch (error) {
                console.error('❌ Failed to ensure user:', error);
                return {
                    success: false,
                    error: 'Failed to ensure user exists'
                };
            }
        });
    }
    // Get service health
    getServiceHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Simple health check - try to validate a user exists
                let dbHealth = false;
                try {
                    yield this.messageDB.validateUserExists(1);
                    dbHealth = true;
                }
                catch (_a) {
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
            }
            catch (error) {
                console.error('❌ Failed to get service health:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve service health'
                };
            }
        });
    }
    // Delete project (soft delete by updating status)
    deleteProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.messageDB.updateProject(projectId, {
                    status: 'deleted'
                });
                return { success: true };
            }
            catch (error) {
                console.error('❌ Failed to delete project:', error);
                return {
                    success: false,
                    error: 'Failed to delete project'
                };
            }
        });
    }
}
// Create singleton instance
let messageServiceInstance = null;
function createMessageService(databaseUrl, anthropic, redisUrl) {
    if (!messageServiceInstance) {
        messageServiceInstance = new MessageService(databaseUrl, anthropic, redisUrl);
    }
    return messageServiceInstance;
}
exports.default = MessageService;
//# sourceMappingURL=messageService.js.map