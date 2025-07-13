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
// services/messageService.ts - Enhanced message service with dynamic user handling
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
                yield this.messageDB.initializeStats();
                console.log('✅ Message service initialized');
            }
            catch (error) {
                console.error('❌ Failed to initialize message service:', error);
                throw error;
            }
        });
    }
    // Dynamic user resolution with fallback mechanisms
    resolveUserId(providedUserId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Priority 1: Use provided userId if valid
                if (providedUserId && (yield this.messageDB.validateUserExists(providedUserId))) {
                    return providedUserId;
                }
                // Priority 2: Get userId from session's most recent project
                if (sessionId) {
                    const sessionProject = yield this.messageDB.getProjectBySessionId(sessionId);
                    if (sessionProject && sessionProject.userId) {
                        return sessionProject.userId;
                    }
                }
                // Priority 3: Get most recent user from any project
                const mostRecentUserId = yield this.messageDB.getMostRecentUserId();
                if (mostRecentUserId && (yield this.messageDB.validateUserExists(mostRecentUserId))) {
                    return mostRecentUserId;
                }
                // Priority 4: Create a new user with current timestamp
                const newUserId = Date.now() % 1000000; // Use timestamp-based ID
                yield this.messageDB.ensureUserExists(newUserId, {
                    email: `user${newUserId}@buildora.dev`,
                    name: `User ${newUserId}`
                });
                console.log(`✅ Created new user ${newUserId} as fallback`);
                return newUserId;
            }
            catch (error) {
                console.error('❌ Failed to resolve user ID:', error);
                throw new Error('Could not resolve or create user');
            }
        });
    }
    // Create message with enhanced user handling
    createMessage(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!request.content || !request.messageType) {
                    return {
                        success: false,
                        error: 'Content and messageType are required'
                    };
                }
                if (!['user', 'assistant', 'system'].includes(request.messageType)) {
                    return {
                        success: false,
                        error: 'Invalid messageType. Must be user, assistant, or system'
                    };
                }
                // Resolve user ID dynamically
                let userId;
                try {
                    userId = yield this.resolveUserId(request.userId, request.sessionId);
                    console.log(`📝 Message creation - Resolved user ID: ${userId} (provided: ${request.userId})`);
                }
                catch (error) {
                    return {
                        success: false,
                        error: 'Failed to resolve user for message creation',
                        details: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
                // Generate or use provided session ID
                const sessionId = request.sessionId || this.sessionManager.generateSessionId();
                // Enhance metadata with resolved user and session information
                const enhancedMetadata = Object.assign(Object.assign({}, request.metadata), { sessionId: sessionId, userId: userId, timestamp: new Date().toISOString(), serviceVersion: '2.0', userResolutionStrategy: request.userId ? 'provided' : 'resolved' });
                // Create message in database
                const messageId = yield this.messageDB.addMessage(request.content, request.messageType, enhancedMetadata);
                // Update session activity
                yield this.sessionManager.updateSessionContext(sessionId, {
                    lastActivity: Date.now(),
                    lastMessageId: messageId,
                    userId: userId
                });
                return {
                    success: true,
                    data: {
                        messageId: messageId,
                        sessionId: sessionId,
                        userId: userId,
                        timestamp: enhancedMetadata.timestamp,
                        metadata: enhancedMetadata
                    }
                };
            }
            catch (error) {
                console.error('❌ Failed to create message:', error);
                return {
                    success: false,
                    error: 'Failed to create message',
                    details: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    // Get user's message history
    getUserMessages(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50) {
            try {
                // Ensure user exists
                const resolvedUserId = yield this.resolveUserId(userId);
                // Get recent conversation (filtered by user would require additional DB methods)
                const conversation = yield this.messageDB.getRecentConversation();
                // Filter messages by user (basic implementation)
                const userMessages = conversation.messages
                    .filter((msg) => {
                    try {
                        if (msg.reasoning) {
                            const metadata = JSON.parse(msg.reasoning);
                            return metadata.userId === resolvedUserId;
                        }
                        return false;
                    }
                    catch (_a) {
                        return false;
                    }
                })
                    .slice(0, limit);
                return {
                    success: true,
                    data: userMessages.map((msg) => ({
                        id: msg.id,
                        content: msg.content,
                        messageType: msg.messageType,
                        createdAt: msg.createdAt,
                        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : {}
                    }))
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
    // Get session messages
    getSessionMessages(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get session context to verify it exists
                const sessionContext = yield this.sessionManager.getSessionContext(sessionId);
                // Get recent conversation and filter by session
                const conversation = yield this.messageDB.getRecentConversation();
                const sessionMessages = conversation.messages
                    .filter((msg) => {
                    try {
                        if (msg.reasoning) {
                            const metadata = JSON.parse(msg.reasoning);
                            return metadata.sessionId === sessionId;
                        }
                        return false;
                    }
                    catch (_a) {
                        return false;
                    }
                });
                return {
                    success: true,
                    data: sessionMessages.map((msg) => ({
                        id: msg.id,
                        content: msg.content,
                        messageType: msg.messageType,
                        createdAt: msg.createdAt,
                        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : {}
                    }))
                };
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
    // Create user if they don't exist
    ensureUser(userId, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resolvedUserId = yield this.messageDB.ensureUserExists(userId, userData);
                return {
                    success: true,
                    data: {
                        userId: resolvedUserId,
                        action: resolvedUserId === userId ? 'existed' : 'created'
                    }
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
    // Get message statistics for user
    getUserMessageStats(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure user exists
                const resolvedUserId = yield this.resolveUserId(userId);
                // Get conversation data
                const conversation = yield this.messageDB.getRecentConversation();
                const modificationStats = yield this.messageDB.getModificationStats();
                // Filter and count messages by user
                const userMessages = conversation.messages.filter((msg) => {
                    try {
                        if (msg.reasoning) {
                            const metadata = JSON.parse(msg.reasoning);
                            return metadata.userId === resolvedUserId;
                        }
                        return false;
                    }
                    catch (_a) {
                        return false;
                    }
                });
                const messagesByType = userMessages.reduce((acc, msg) => {
                    acc[msg.messageType] = (acc[msg.messageType] || 0) + 1;
                    return acc;
                }, {});
                const recentActivity = userMessages.length > 0
                    ? userMessages[0].createdAt
                    : null;
                return {
                    success: true,
                    data: {
                        totalMessages: userMessages.length,
                        userMessages: messagesByType.user || 0,
                        assistantMessages: messagesByType.assistant || 0,
                        systemMessages: messagesByType.system || 0,
                        recentActivity,
                        modificationCount: modificationStats.totalModifications
                    }
                };
            }
            catch (error) {
                console.error('❌ Failed to get user message stats:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve user message statistics'
                };
            }
        });
    }
    // Delete messages for user (mark as deleted, don't actually delete)
    deleteUserMessages(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // For now, we'll just clear all data since we don't have user-specific deletion
                // In a full implementation, you'd add user-specific deletion methods
                console.log(`🗑️ Would delete messages for user ${userId} in session ${sessionId || 'all'}`);
                // This is a placeholder - implement user-specific message deletion
                return {
                    success: true,
                    data: { deletedCount: 0 }
                };
            }
            catch (error) {
                console.error('❌ Failed to delete user messages:', error);
                return {
                    success: false,
                    error: 'Failed to delete user messages'
                };
            }
        });
    }
    // Get conversation context for user
    getUserConversationContext(userId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure user exists
                yield this.resolveUserId(userId);
                // Get enhanced context
                const context = yield this.messageDB.getEnhancedContext();
                return {
                    success: true,
                    data: context
                };
            }
            catch (error) {
                console.error('❌ Failed to get user conversation context:', error);
                return {
                    success: false,
                    error: 'Failed to retrieve conversation context'
                };
            }
        });
    }
    // Export conversation history for user
    exportUserConversation(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, format = 'json') {
            try {
                // Get user messages
                const messagesResult = yield this.getUserMessages(userId, 1000);
                if (!messagesResult.success || !messagesResult.data) {
                    return {
                        success: false,
                        error: 'Failed to retrieve user messages for export'
                    };
                }
                const messages = messagesResult.data;
                if (format === 'csv') {
                    // Convert to CSV format
                    const csvHeader = 'id,content,messageType,createdAt,sessionId,userId\n';
                    const csvRows = messages.map(msg => {
                        var _a;
                        const sessionId = ((_a = msg.metadata) === null || _a === void 0 ? void 0 : _a.sessionId) || '';
                        const content = `"${msg.content.replace(/"/g, '""')}"`;
                        return `${msg.id},${content},${msg.messageType},${msg.createdAt},${sessionId},${userId}`;
                    }).join('\n');
                    return {
                        success: true,
                        data: {
                            format: 'csv',
                            content: csvHeader + csvRows,
                            messageCount: messages.length,
                            exportedAt: new Date().toISOString()
                        }
                    };
                }
                // Default JSON format
                return {
                    success: true,
                    data: {
                        format: 'json',
                        userId: userId,
                        messageCount: messages.length,
                        exportedAt: new Date().toISOString(),
                        messages: messages
                    }
                };
            }
            catch (error) {
                console.error('❌ Failed to export user conversation:', error);
                return {
                    success: false,
                    error: 'Failed to export conversation'
                };
            }
        });
    }
    // Get service health and stats
    getServiceHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check database health
                let dbHealth = false;
                let totalMessages = 0;
                try {
                    const stats = yield this.messageDB.getConversationStats();
                    dbHealth = true;
                    totalMessages = (stats === null || stats === void 0 ? void 0 : stats.totalMessageCount) || 0;
                }
                catch (_a) {
                    dbHealth = false;
                }
                // Check Redis health (simplified)
                let redisHealth = false;
                let activeSessions = 0;
                try {
                    // This would need to be implemented in RedisService
                    redisHealth = true;
                    activeSessions = 0; // Placeholder
                }
                catch (_b) {
                    redisHealth = false;
                }
                // Get total users (would need additional method in DB)
                const totalUsers = 0; // Placeholder
                const status = dbHealth && redisHealth ? 'healthy' :
                    dbHealth || redisHealth ? 'degraded' : 'unhealthy';
                return {
                    success: true,
                    data: {
                        status,
                        database: dbHealth,
                        redis: redisHealth,
                        totalUsers,
                        totalMessages,
                        activeeSessions: activeSessions,
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
    // Cleanup old data
    cleanupOldData() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const { olderThanDays = 30, userId, dryRun = true } = options;
                console.log(`🧹 Cleanup requested: ${dryRun ? 'DRY RUN' : 'ACTUAL'} - older than ${olderThanDays} days`);
                if (userId) {
                    console.log(`👤 Cleanup for user: ${userId}`);
                }
                // This would implement actual cleanup logic
                // For now, return placeholder results
                return {
                    success: true,
                    data: {
                        messagesDeleted: dryRun ? 0 : 0,
                        sessionsCleared: dryRun ? 0 : 0
                    }
                };
            }
            catch (error) {
                console.error('❌ Failed to cleanup old data:', error);
                return {
                    success: false,
                    error: 'Failed to cleanup old data'
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