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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeConversationRoutes = initializeConversationRoutes;
// routes/conversation.ts - Conversation and history management routes
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// Enhanced Conversation Helper using existing services + Redis state
class StatelessConversationHelper {
    constructor(messageDB, redis, sessionManager) {
        this.messageDB = messageDB;
        this.redis = redis;
        this.sessionManager = sessionManager;
    }
    saveModification(sessionId, modification) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Save to database (persistent)
            yield this.messageDB.saveModification(modification);
            // Save to Redis session state (fast access) - using proper ModificationChange interface
            const change = {
                type: 'modified', // Use proper type from your ModificationChange interface
                file: 'session_modification', // Required field
                description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`, // Required field
                timestamp: new Date().toISOString(),
                prompt: modification.prompt,
                approach: modification.approach,
                filesModified: modification.filesModified || [],
                filesCreated: modification.filesCreated || [],
                success: ((_a = modification.result) === null || _a === void 0 ? void 0 : _a.success) || false
            };
            yield this.redis.addModificationChange(sessionId, change);
        });
    }
    getEnhancedContext(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try Redis first for fast access
            const cachedContext = yield this.redis.getSessionState(sessionId, 'conversation_context');
            if (cachedContext) {
                return cachedContext;
            }
            // Fall back to database
            const dbContext = yield this.messageDB.getConversationContext();
            if (dbContext) {
                // Cache for next time
                yield this.redis.setSessionState(sessionId, 'conversation_context', dbContext);
                return dbContext;
            }
            return '';
        });
    }
    getConversationWithSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.messageDB.getRecentConversation();
            return {
                messages: conversation.messages.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    messageType: msg.messageType,
                    metadata: {
                        fileModifications: msg.fileModifications,
                        modificationApproach: msg.modificationApproach,
                        modificationSuccess: msg.modificationSuccess
                    },
                    createdAt: msg.createdAt
                })),
                summaryCount: conversation.summaryCount,
                totalMessages: conversation.totalMessages
            };
        });
    }
}
// Frontend history helper
function getRecentFrontendPrompts(messageDB_1) {
    return __awaiter(this, arguments, void 0, function* (messageDB, limit = 10) {
        try {
            const recentConversation = yield messageDB.getRecentConversation();
            const frontendPrompts = recentConversation.messages
                .filter((msg) => {
                if (!msg.reasoning)
                    return false;
                try {
                    const metadata = JSON.parse(msg.reasoning);
                    return metadata.promptType === 'frontend_generation';
                }
                catch (_a) {
                    return false;
                }
            })
                .slice(0, limit * 2)
                .reduce((acc, msg) => {
                try {
                    const metadata = JSON.parse(msg.reasoning || '{}');
                    if (metadata.requestType === 'user_prompt') {
                        const response = recentConversation.messages.find((m) => {
                            try {
                                const respMetadata = JSON.parse(m.reasoning || '{}');
                                return respMetadata.promptType === 'frontend_generation' &&
                                    respMetadata.requestType === 'claude_response' &&
                                    respMetadata.relatedUserMessageId === msg.id;
                            }
                            catch (_a) {
                                return false;
                            }
                        });
                        acc.push({
                            id: msg.id,
                            prompt: msg.content,
                            response: (response === null || response === void 0 ? void 0 : response.content) || null,
                            success: response ? JSON.parse(response.reasoning || '{}').success : false,
                            timestamp: msg.createdAt,
                            processingTime: response ? JSON.parse(response.reasoning || '{}').processingTimeMs : null,
                            tokenUsage: response ? JSON.parse(response.reasoning || '{}').tokenUsage : null,
                            contextInfo: metadata.contextInfo,
                            error: response ? JSON.parse(response.reasoning || '{}').error : null,
                            responseLength: response ? JSON.parse(response.reasoning || '{}').responseLength : null,
                            sessionId: metadata.sessionId || null // Include session info
                        });
                    }
                }
                catch (parseError) {
                    console.error('Error parsing message metadata:', parseError);
                }
                return acc;
            }, [])
                .slice(0, limit);
            return frontendPrompts;
        }
        catch (error) {
            console.error('Failed to retrieve recent frontend prompts:', error);
            return [];
        }
    });
}
function initializeConversationRoutes(messageDB, redis, sessionManager) {
    const conversationHelper = new StatelessConversationHelper(messageDB, redis, sessionManager);
    // Enhanced message creation with session tracking
    router.post("/messages", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { content, messageType, metadata, sessionId } = req.body;
            if (!content || !messageType || !['user', 'assistant'].includes(messageType)) {
                res.status(400).json({
                    success: false,
                    error: "Valid content and messageType required"
                });
                return;
            }
            // Enhance metadata with session information
            const enhancedMetadata = Object.assign(Object.assign({}, metadata), { sessionId: sessionId || sessionManager.generateSessionId(), timestamp: new Date().toISOString() });
            const messageId = yield messageDB.addMessage(content, messageType, enhancedMetadata);
            res.json({
                success: true,
                data: {
                    messageId,
                    sessionId: enhancedMetadata.sessionId,
                    message: "Message added successfully"
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to add message'
            });
        }
    }));
    // Get conversation with summary
    router.get("/conversation-with-summary", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const conversationData = yield conversationHelper.getConversationWithSummary();
            res.json({
                success: true,
                data: conversationData
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get conversation'
            });
        }
    }));
    // Get conversation stats
    router.get("/conversation-stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield messageDB.getConversationStats();
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get conversation stats'
            });
        }
    }));
    // Get all summaries
    router.get("/summaries", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const summaries = yield messageDB.getAllSummaries();
            res.json({
                success: true,
                data: summaries
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get summaries'
            });
        }
    }));
    // Clear all conversation data
    router.delete("/conversation", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield messageDB.clearAllData();
            res.json({
                success: true,
                data: { message: "All conversation data cleared successfully" }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to clear conversation data'
            });
        }
    }));
    // Get current summary
    router.get("/current-summary", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🔍 /current-summary endpoint hit');
            const summary = yield messageDB.getCurrentSummary();
            console.log('🔍 getCurrentSummary result:', summary);
            const recentConversation = yield messageDB.getRecentConversation();
            console.log('🔍 getRecentConversation result:', recentConversation);
            const summarizedCount = (summary === null || summary === void 0 ? void 0 : summary.messageCount) || 0;
            const recentCount = recentConversation.messages.length;
            const totalMessages = summarizedCount + recentCount;
            const responseData = {
                summary: (summary === null || summary === void 0 ? void 0 : summary.summary) || null,
                summarizedMessageCount: summarizedCount,
                recentMessageCount: recentCount,
                totalMessages: totalMessages,
                hasSummary: !!summary && !!summary.summary
            };
            console.log('🔍 Sending response:', responseData);
            res.json({
                success: true,
                data: responseData
            });
        }
        catch (error) {
            console.error('❌ /current-summary error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get current summary'
            });
        }
    }));
    // Fix conversation stats
    router.post("/fix-stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield messageDB.fixConversationStats();
            const stats = yield messageDB.getConversationStats();
            res.json({
                success: true,
                data: {
                    message: "Stats fixed successfully",
                    stats
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fix stats'
            });
        }
    }));
    // Get frontend history (enhanced with session support)
    router.get("/frontend-history", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const frontendHistory = yield getRecentFrontendPrompts(messageDB, limit);
            res.json({
                success: true,
                data: {
                    history: frontendHistory,
                    count: frontendHistory.length
                }
            });
        }
        catch (error) {
            console.error('Failed to get frontend history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve frontend generation history'
            });
        }
    }));
    // Get project status (enhanced with session support)
    router.get("/project-status", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.query;
            let projectData;
            // If session ID provided, check Redis first
            if (sessionId) {
                const sessionContext = yield sessionManager.getSessionContext(sessionId);
                if (sessionContext && sessionContext.projectSummary) {
                    projectData = sessionContext.projectSummary;
                }
            }
            // Fall back to database
            if (!projectData) {
                projectData = yield messageDB.getActiveProjectSummary();
            }
            if (projectData) {
                res.json({
                    success: true,
                    data: {
                        hasProject: true,
                        projectId: projectData.id,
                        summary: projectData.summary,
                        zipUrl: projectData.zipUrl,
                        buildId: projectData.buildId,
                        sessionId: sessionId || null,
                        status: 'ready_for_modification',
                        source: sessionId && projectData ? 'redis_session' : 'database'
                    }
                });
            }
            else {
                res.json({
                    success: true,
                    data: {
                        hasProject: false,
                        sessionId: sessionId || null,
                        status: 'awaiting_first_generation'
                    }
                });
            }
        }
        catch (error) {
            console.error('Failed to get project status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get project status'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=conversation.js.map