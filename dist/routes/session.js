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
exports.StatelessSessionManager = void 0;
exports.initializeSessionRoutes = initializeSessionRoutes;
// routes/session.ts - Session management routes
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// Lightweight stateless helper using existing Redis service
class StatelessSessionManager {
    constructor(redis) {
        this.redis = redis;
    }
    generateSessionId(userContext) {
        const crypto = require('crypto');
        const base = userContext || 'default-user';
        return crypto.createHash('sha256').update(base + Date.now()).digest('hex').substring(0, 16);
    }
    saveSessionContext(sessionId, context) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.setSessionState(sessionId, 'session_context', context);
        });
    }
    getSessionContext(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.redis.getSessionState(sessionId, 'session_context');
        });
    }
    updateSessionContext(sessionId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = yield this.getSessionContext(sessionId);
            if (current) {
                const updated = Object.assign(Object.assign(Object.assign({}, current), updates), { lastActivity: Date.now() });
                yield this.saveSessionContext(sessionId, updated);
            }
        });
    }
    cacheProjectFiles(sessionId, files) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFilesMap = new Map();
            Object.entries(files).forEach(([filePath, content]) => {
                projectFilesMap.set(filePath, {
                    path: filePath,
                    content: content,
                    hash: this.redis.generateFileHash(content),
                    lastModified: Date.now(),
                    astNodes: []
                });
            });
            yield this.redis.setProjectFiles(sessionId, projectFilesMap);
        });
    }
    getCachedProjectFiles(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.redis.getProjectFiles(sessionId);
            if (!projectFiles)
                return {};
            const files = {};
            projectFiles.forEach((file, path) => {
                files[path] = file.content;
            });
            return files;
        });
    }
    cleanup(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.clearSession(sessionId);
        });
    }
}
exports.StatelessSessionManager = StatelessSessionManager;
// Initialize session manager - this will be passed from main app
let sessionManager;
function initializeSessionRoutes(redis) {
    sessionManager = new StatelessSessionManager(redis);
    // Get session status
    router.get("/status/:sessionId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.params;
            const sessionContext = yield sessionManager.getSessionContext(sessionId);
            const cachedFiles = yield sessionManager.getCachedProjectFiles(sessionId);
            const redisStats = yield redis.getStats();
            if (sessionContext) {
                res.json({
                    success: true,
                    data: {
                        sessionId: sessionId,
                        hasProject: !!sessionContext.projectSummary,
                        projectSummary: sessionContext.projectSummary,
                        cachedFileCount: Object.keys(cachedFiles).length,
                        lastActivity: sessionContext.lastActivity,
                        sessionAge: Date.now() - sessionContext.lastActivity,
                        buildId: sessionContext.buildId,
                        status: 'active',
                        redisConnected: redisStats.connected
                    }
                });
            }
            else {
                res.json({
                    success: true,
                    data: {
                        sessionId: sessionId,
                        hasProject: false,
                        status: 'not_found',
                        redisConnected: redisStats.connected
                    }
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get session status'
            });
        }
    }));
    // Create new session
    router.post("/create", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { userContext } = req.body;
            const sessionId = sessionManager.generateSessionId(userContext);
            const initialContext = {
                buildId: '',
                tempBuildDir: '',
                lastActivity: Date.now()
            };
            yield sessionManager.saveSessionContext(sessionId, initialContext);
            res.json({
                success: true,
                data: {
                    sessionId: sessionId,
                    message: 'Session created successfully'
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to create session'
            });
        }
    }));
    // Delete session
    router.delete("/:sessionId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { sessionId } = req.params;
            yield sessionManager.cleanup(sessionId);
            res.json({
                success: true,
                data: {
                    message: `Session ${sessionId} cleaned up successfully`
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to cleanup session'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=session.js.map