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
exports.initializeRedisRoutes = initializeRedisRoutes;
// routes/redis.ts - Redis health and stats routes
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
function initializeRedisRoutes(redis) {
    // Redis health check
    router.get("/health", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield redis.getStats();
            const isConnected = yield redis.isConnected();
            res.json({
                success: true,
                data: {
                    connected: isConnected,
                    stats: stats,
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get Redis health status',
                connected: false
            });
        }
    }));
    // Redis stats and memory info
    router.get("/stats", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield redis.getStats();
            res.json({
                success: true,
                data: Object.assign(Object.assign({}, stats), { timestamp: new Date().toISOString() })
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get Redis stats'
            });
        }
    }));
    // Check if Redis has project files for a session
    router.get("/session/:sessionId/files", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.params;
            const hasFiles = yield redis.hasProjectFiles(sessionId);
            if (hasFiles) {
                const projectFiles = yield redis.getProjectFiles(sessionId);
                const fileCount = projectFiles ? projectFiles.size : 0;
                res.json({
                    success: true,
                    data: {
                        sessionId,
                        hasFiles: true,
                        fileCount,
                        message: `Session ${sessionId} has ${fileCount} cached files`
                    }
                });
            }
            else {
                res.json({
                    success: true,
                    data: {
                        sessionId,
                        hasFiles: false,
                        fileCount: 0,
                        message: `No cached files found for session ${sessionId}`
                    }
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to check session files'
            });
        }
    }));
    // Get modification changes for a session
    router.get("/session/:sessionId/modifications", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.params;
            const changes = yield redis.getModificationChanges(sessionId);
            res.json({
                success: true,
                data: {
                    sessionId,
                    modificationCount: changes.length,
                    modifications: changes,
                    message: `Found ${changes.length} modifications for session ${sessionId}`
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get session modifications'
            });
        }
    }));
    // Clear session data
    router.delete("/session/:sessionId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.params;
            yield redis.clearSession(sessionId);
            res.json({
                success: true,
                data: {
                    sessionId,
                    message: `Session ${sessionId} data cleared successfully`
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to clear session data'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=redis-stats.js.map