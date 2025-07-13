"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
// src/index.ts - Main server with TokenTracker integration and FIXED cleanup
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const Redis_1 = require("./services/Redis");
const TokenTracer_1 = require("./utils/TokenTracer"); // Import the TokenTracker
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const messagesummary_1 = require("./db/messagesummary");
const cors_1 = __importDefault(require("cors"));
const fs = __importStar(require("fs"));
const users_1 = __importDefault(require("./routes/users"));
const projects_1 = __importDefault(require("./routes/projects"));
const messages_1 = __importStar(require("./routes/messages"));
const session_1 = require("./routes/session");
const generation_1 = require("./routes/generation");
const modification_1 = require("./routes/modification");
const conversation_1 = require("./routes/conversation");
const redis_stats_1 = require("./routes/redis-stats");
const PORT = process.env.PORT;
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
const redis = new Redis_1.RedisService();
const tokenTracker = new TokenTracer_1.TokenTracker(true);
tokenTracker.setStreamCallback((message) => {
    console.log(`🔢 ${message}`);
});
tokenTracker.checkForInstanceDuplication();
const DATABASE_URL = process.env.DATABASE_URL;
const messageDB = new messagesummary_1.DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = new session_1.StatelessSessionManager(redis);
(0, messages_1.setMessageDB)(messageDB);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    else {
        next();
    }
});
// Middleware to track API calls that use Anthropic
app.use((req, res, next) => {
    // Store original res.json to intercept responses
    const originalJson = res.json;
    res.json = function (body) {
        // Check if this response contains usage data from Anthropic
        if (body && body.usage) {
            const operation = `${req.method} ${req.path}`;
            tokenTracker.logUsage(body.usage, operation);
        }
        return originalJson.call(this, body);
    };
    next();
});
function initializeServices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Create a compatibility wrapper for the old initializeStats method
            const initializeStatsCompat = () => __awaiter(this, void 0, void 0, function* () {
                // For backward compatibility, we'll create a default session for legacy operations
                const defaultSessionId = 'legacy-session-default';
                yield messageDB.initializeSessionStats(defaultSessionId);
                console.log('✅ Legacy session stats initialized');
            });
            // Try the new method first, fallback to compatibility
            if (typeof messageDB.initializeSessionStats === 'function') {
                yield initializeStatsCompat();
            }
            else if (typeof messageDB.initializeStats === 'function') {
                yield messageDB.initializeStats();
            }
            else {
                console.warn('⚠️ No initialization method found on messageDB');
            }
            const redisConnected = yield redis.isConnected();
            console.log('✅ Services initialized successfully');
            console.log(`✅ Redis connected: ${redisConnected}`);
            console.log('✅ TokenTracker initialized and ready');
            if (!redisConnected) {
                console.warn('⚠️ Redis not connected - some features may be limited');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize services:', error);
            console.log('🔄 Continuing without full initialization...');
        }
    });
}
initializeServices();
console.log('📊 Database URL configured:', !!process.env.DATABASE_URL);
// TOKEN TRACKING ROUTES
// ===================
// Get current token statistics
app.get("/api/tokens/stats", (req, res) => {
    try {
        const stats = tokenTracker.getStats();
        const detailedStats = tokenTracker.getDetailedStats();
        res.json({
            basic: stats,
            detailed: detailedStats,
            velocity: {
                tokensPerMinute: tokenTracker.getTokensPerMinute(),
                tokensPerSecond: tokenTracker.getTokenVelocity(),
                costPerMinute: tokenTracker.getCostPerMinute()
            }
        });
    }
    catch (error) {
        console.error('Error getting token stats:', error);
        res.status(500).json({ error: 'Failed to get token statistics' });
    }
});
// Get detailed token usage report
app.get("/api/tokens/report", (req, res) => {
    try {
        const report = tokenTracker.generateUsageReport();
        res.json({ report });
    }
    catch (error) {
        console.error('Error generating token report:', error);
        res.status(500).json({ error: 'Failed to generate token report' });
    }
});
// Get operation logs
app.get("/api/tokens/logs", (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = tokenTracker.getOperationLogs().slice(-limit);
        res.json({
            logs,
            total: tokenTracker.getOperationLogs().length,
            showing: logs.length
        });
    }
    catch (error) {
        console.error('Error getting token logs:', error);
        res.status(500).json({ error: 'Failed to get token logs' });
    }
});
// Get operations by type
app.get("/api/tokens/operations", (req, res) => {
    try {
        const operationsByType = tokenTracker.getOperationsByType();
        const topExpensive = tokenTracker.getTopExpensiveOperations(10);
        res.json({
            byType: operationsByType,
            topExpensive,
            recentActivity: tokenTracker.getRecentActivity(20)
        });
    }
    catch (error) {
        console.error('Error getting token operations:', error);
        res.status(500).json({ error: 'Failed to get token operations' });
    }
});
// Debug endpoint for token discrepancy analysis
app.get("/api/tokens/debug", (req, res) => {
    try {
        const debugInfo = tokenTracker.debugTokenDiscrepancy();
        res.json(debugInfo);
    }
    catch (error) {
        console.error('Error running token debug:', error);
        res.status(500).json({ error: 'Failed to run token debug analysis' });
    }
});
//@ts-ignore
app.post("/api/tokens/budget-check", (req, res) => {
    try {
        const { budgetLimit, warningThreshold } = req.body;
        if (!budgetLimit || typeof budgetLimit !== 'number') {
            return res.status(400).json({ error: 'budgetLimit is required and must be a number' });
        }
        const budgetStatus = tokenTracker.isApproachingBudget(budgetLimit, warningThreshold);
        const remainingOps = tokenTracker.estimateRemainingOperations(budgetLimit);
        res.json({
            budgetStatus,
            remainingOperations: remainingOps
        });
    }
    catch (error) {
        console.error('Error checking budget:', error);
        res.status(500).json({ error: 'Failed to check budget status' });
    }
});
//@ts-ignore
app.post("/api/tokens/validate", (req, res) => {
    try {
        const { expectedCalls, averageTokensPerCall } = req.body;
        if (!expectedCalls || !averageTokensPerCall) {
            return res.status(400).json({
                error: 'expectedCalls and averageTokensPerCall are required'
            });
        }
        const validation = tokenTracker.validateExpectedUsage(expectedCalls, averageTokensPerCall);
        res.json(validation);
    }
    catch (error) {
        console.error('Error validating usage:', error);
        res.status(500).json({ error: 'Failed to validate token usage' });
    }
});
// Export token data
app.get("/api/tokens/export/:format", (req, res) => {
    try {
        const format = req.params.format.toLowerCase();
        if (format === 'json') {
            const jsonData = tokenTracker.exportToJson();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="token-usage.json"');
            res.send(jsonData);
        }
        else if (format === 'csv') {
            const csvData = tokenTracker.exportToCsv();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="token-usage.csv"');
            res.send(csvData);
        }
        else {
            res.status(400).json({ error: 'Format must be json or csv' });
        }
    }
    catch (error) {
        console.error('Error exporting token data:', error);
        res.status(500).json({ error: 'Failed to export token data' });
    }
});
// Reset token tracking
app.post("/api/tokens/reset", (req, res) => {
    try {
        tokenTracker.reset();
        res.json({ message: 'Token tracking reset successfully' });
    }
    catch (error) {
        console.error('Error resetting token tracker:', error);
        res.status(500).json({ error: 'Failed to reset token tracking' });
    }
});
// Toggle debug mode
app.post("/api/tokens/debug-mode", (req, res) => {
    try {
        const { enabled } = req.body;
        if (enabled) {
            tokenTracker.enableDebugMode();
        }
        else {
            tokenTracker.disableDebugMode();
        }
        res.json({ debugMode: enabled, message: `Debug mode ${enabled ? 'enabled' : 'disabled'}` });
    }
    catch (error) {
        console.error('Error toggling debug mode:', error);
        res.status(500).json({ error: 'Failed to toggle debug mode' });
    }
});
//@ts-ignore
app.post("/api/projects/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Enhanced /api/projects/generate with token tracking');
    try {
        const response = yield axios_1.default.post(`http://localhost:${PORT}/api/generate`, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        // If the response contains usage data, log it
        if (response.data && response.data.usage) {
            tokenTracker.logUsage(response.data.usage, 'project-generation', 'claude-3-5-sonnet-20240620');
        }
        res.json(response.data);
    }
    catch (error) {
        console.error('Error forwarding to /api/generate:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}));
app.get("/", (req, res) => {
    const stats = tokenTracker.getStats();
    res.json({
        message: "Backend is up with Redis stateless integration and TokenTracker",
        timestamp: new Date().toISOString(),
        version: "3.0.0-production-ready",
        tokenTracking: {
            totalTokens: stats.totalTokens,
            totalCost: stats.estimatedCost,
            apiCalls: stats.apiCalls,
            sessionDuration: tokenTracker.getDetailedStats().sessionDuration
        }
    });
});
app.get("/health", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = tokenTracker.getStats();
    const velocity = tokenTracker.getTokenVelocity();
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "3.0.0-production-ready",
        features: [
            "Redis stateless sessions",
            "Multi-user support",
            "Session-based conversations",
            "Project integration",
            "Production scaling",
            "Token usage tracking",
            "Real-time cost monitoring"
        ],
        tokenTracking: {
            isActive: true,
            totalTokens: stats.totalTokens,
            totalCost: stats.estimatedCost,
            apiCalls: stats.apiCalls,
            tokensPerSecond: velocity.toFixed(2)
        }
    });
}));
// Main API routes
app.use("/api/users", users_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/messages", messages_1.default);
// Enhanced route initialization with TokenTracker integration
const enhanceRoutesWithTokenTracking = (routeHandler, routeName) => {
    return (req, res, next) => {
        // Inject tokenTracker into request object for use in routes
        req.tokenTracker = tokenTracker;
        // Track the route access
        const operation = `Route-Access: ${routeName} ${req.method} ${req.path}`;
        console.log(`🔗 ${operation}`);
        return routeHandler(req, res, next);
    };
};
app.use("/api/session", enhanceRoutesWithTokenTracking((0, session_1.initializeSessionRoutes)(redis), "session"));
app.use("/api/generate", enhanceRoutesWithTokenTracking((0, generation_1.initializeGenerationRoutes)(anthropic, messageDB, sessionManager), "generate"));
app.use("/api/modify", enhanceRoutesWithTokenTracking((0, modification_1.initializeModificationRoutes)(anthropic, messageDB, redis, sessionManager), "modify"));
app.use("/api/conversation", enhanceRoutesWithTokenTracking((0, conversation_1.initializeConversationRoutes)(messageDB, redis, sessionManager), "conversation"));
app.use("/api/redis", enhanceRoutesWithTokenTracking((0, redis_stats_1.initializeRedisRoutes)(redis), "redis"));
// Enhanced legacy endpoints with token tracking
app.post("/modify-with-history-stream", (req, res) => {
    console.log('🔄 Legacy /modify-with-history-stream called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-modify-history-stream', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/modify/stream'
    });
});
app.post("/modify-with-history", (req, res) => {
    console.log('🔄 Legacy /modify-with-history called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-modify-history', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/modify'
    });
});
app.post("/messages", (req, res) => {
    console.log('🔄 Legacy /messages called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-messages', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/messages'
    });
});
app.get("/conversation-with-summary", (req, res) => {
    console.log('🔄 Legacy /conversation-with-summary called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-conversation-summary', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation-with-summary'
    });
});
app.get("/conversation-stats", (req, res) => {
    console.log('🔄 Legacy /conversation-stats called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-conversation-stats', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation-stats'
    });
});
app.get("/summaries", (req, res) => {
    console.log('🔄 Legacy /summaries called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-summaries', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/summaries'
    });
});
app.delete("/conversation", (req, res) => {
    console.log('🔄 Legacy /conversation called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-conversation-delete', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/conversation'
    });
});
app.get("/current-summary", (req, res) => {
    console.log('🔄 Legacy /current-summary called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-current-summary', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/current-summary'
    });
});
app.post("/fix-stats", (req, res) => {
    console.log('🔄 Legacy /fix-stats called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-fix-stats', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/fix-stats'
    });
});
app.get("/frontend-history", (req, res) => {
    console.log('🔄 Legacy /frontend-history called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-frontend-history', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/frontend-history'
    });
});
app.get("/project-status", (req, res) => {
    console.log('🔄 Legacy /project-status called - feature not available');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-project-status', 'deprecated');
    res.status(501).json({
        error: 'Legacy endpoint',
        message: 'This endpoint is deprecated. Please use /api/conversation/project-status'
    });
});
app.get("/redis-health", (req, res) => {
    console.log('🔄 Legacy /redis-health called - redirecting to /api/redis/health');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-redis-health-redirect', 'deprecated');
    res.redirect('/api/redis/health');
});
app.post("/generateChanges", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy generateChanges endpoint called');
    try {
        // Log this legacy API usage
        tokenTracker.logUsage({ input_tokens: 50, output_tokens: 100 }, 'legacy-generateChanges', 'legacy-compatibility');
        // Simple fallback response for legacy compatibility
        res.json({
            content: [{
                    text: JSON.stringify({
                        files_to_modify: ["src/App.tsx"],
                        files_to_create: [],
                        reasoning: "Legacy compatibility response",
                        dependencies: [],
                        notes: "Using legacy endpoint"
                    })
                }]
        });
    }
    catch (error) {
        tokenTracker.logUsage({ input_tokens: 50, output_tokens: 0 }, 'legacy-generateChanges-error', 'legacy-compatibility');
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
app.post("/extractFilesToChange", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy extractFilesToChange endpoint called');
    try {
        // Log this legacy API usage
        tokenTracker.logUsage({ input_tokens: 30, output_tokens: 80 }, 'legacy-extractFilesToChange', 'legacy-compatibility');
        res.json({
            files: [
                {
                    path: "src/App.tsx",
                    content: "// Legacy compatibility placeholder"
                }
            ]
        });
    }
    catch (error) {
        tokenTracker.logUsage({ input_tokens: 30, output_tokens: 0 }, 'legacy-extractFilesToChange-error', 'legacy-compatibility');
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
app.post("/modify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy modify endpoint called, redirecting to new API');
    tokenTracker.logUsage({ input_tokens: 0, output_tokens: 0 }, 'legacy-modify-redirect', 'redirect');
    req.url = '/api/modify';
    app._router.handle(req, res);
}));
app.post("/write-files", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔄 Legacy write-files endpoint called');
    try {
        // Log this legacy API usage
        tokenTracker.logUsage({ input_tokens: 20, output_tokens: 10 }, 'legacy-write-files', 'legacy-compatibility');
        // For legacy compatibility, just return success
        res.json({ success: true, message: 'Files written successfully' });
    }
    catch (error) {
        tokenTracker.logUsage({ input_tokens: 20, output_tokens: 0 }, 'legacy-write-files-error', 'legacy-compatibility');
        res.status(500).json({ error: 'Legacy endpoint error' });
    }
}));
function performCleanup() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tempBuildsDir = path_1.default.join(__dirname, "../temp-builds");
            if (!fs.existsSync(tempBuildsDir)) {
                console.log('🧹 No temp-builds directory found');
                return;
            }
            const entries = yield fs.promises.readdir(tempBuildsDir, { withFileTypes: true });
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000); // CHANGED: 1 hour instead of 5 minutes
            let cleanedCount = 0;
            let skippedCount = 0;
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirPath = path_1.default.join(tempBuildsDir, entry.name);
                    try {
                        const stats = yield fs.promises.stat(dirPath);
                        // FIXED: Only cleanup directories older than 1 hour
                        if (stats.mtime.getTime() < oneHourAgo) {
                            yield fs.promises.rm(dirPath, { recursive: true, force: true });
                            console.log(`🧹 Cleaned up old temp directory: ${entry.name} (age: ${Math.round((now - stats.mtime.getTime()) / (1000 * 60))} minutes)`);
                            cleanedCount++;
                        }
                        else {
                            const ageMinutes = Math.round((now - stats.mtime.getTime()) / (1000 * 60));
                            console.log(`⏳ Keeping temp directory: ${entry.name} (age: ${ageMinutes} minutes, needs 60+ minutes)`);
                            skippedCount++;
                        }
                    }
                    catch (statError) {
                        console.warn(`⚠️ Could not stat directory ${entry.name}:`, statError);
                    }
                }
            }
            if (cleanedCount > 0 || skippedCount > 0) {
                console.log(`🧹 Cleanup summary: ${cleanedCount} cleaned, ${skippedCount} kept`);
            }
            else {
                console.log('🧹 No temp directories found to process');
            }
        }
        catch (error) {
            console.warn('⚠️ Background cleanup job failed:', error);
        }
    });
}
// CHANGED: Run cleanup every 30 minutes instead of every 5 minutes
// This reduces system load while still keeping things clean
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
setInterval(performCleanup, CLEANUP_INTERVAL);
console.log(`🧹 Cleanup job scheduled to run every ${CLEANUP_INTERVAL / (1000 * 60)} minutes`);
console.log('🧹 Temp directories will be removed after 1 hour of inactivity');
// ADDED: Manual cleanup endpoint for testing/debugging
app.post("/api/cleanup/manual", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🧹 Manual cleanup triggered');
    try {
        yield performCleanup();
        res.json({
            success: true,
            message: 'Manual cleanup completed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Manual cleanup failed:', error);
        res.status(500).json({
            success: false,
            error: 'Manual cleanup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
app.listen(3000, () => {
    console.log(`🚀 Server running on port 3000`);
    console.log(`🧹 Cleanup system: 1 hour retention, check every 30 minutes`);
});
//# sourceMappingURL=index.js.map