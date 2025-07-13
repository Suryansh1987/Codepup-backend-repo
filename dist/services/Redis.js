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
exports.RedisService = void 0;
// services/redis.ts - FIXED VERSION WITH PROPER TYPE COMPATIBILITY
const ioredis_1 = __importDefault(require("ioredis"));
class RedisService {
    constructor(redisUrl) {
        this.DEFAULT_TTL = 3600; // 1 hour
        this.PROJECT_FILES_TTL = 7200; // 2 hours
        this.SESSION_TTL = 1800; // 30 minutes
        this.redis = new ioredis_1.default(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });
        this.redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
        this.redis.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });
    }
    // ==============================================================
    // PROJECT FILES CACHE METHODS - FIXED
    // ==============================================================
    /**
     * Store project files map for a session
     */
    setProjectFiles(sessionId, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `project_files:${sessionId}`;
            // FIXED: Better serialization handling
            const serializedData = {};
            for (const [filePath, file] of projectFiles.entries()) {
                serializedData[filePath] = Object.assign(Object.assign({}, file), { 
                    // Ensure all required fields are present
                    name: file.name || '', path: file.path || '', relativePath: file.relativePath || '', content: file.content || '', lines: file.lines || 0, size: file.size || 0, snippet: file.snippet || '', componentName: file.componentName || null, hasButtons: file.hasButtons || false, hasSignin: file.hasSignin || false, isMainFile: file.isMainFile || false });
            }
            const data = JSON.stringify(serializedData);
            yield this.redis.setex(key, this.PROJECT_FILES_TTL, data);
        });
    }
    /**
     * Get project files map for a session - FIXED
     */
    getProjectFiles(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `project_files:${sessionId}`;
            const data = yield this.redis.get(key);
            if (!data)
                return null;
            try {
                const parsed = JSON.parse(data);
                const projectFiles = new Map();
                //@ts-ignore
                for (const [filePath, fileData] of Object.entries(parsed)) {
                    const file = fileData;
                    //@ts-ignore
                    const projectFile = {
                        name: file.name || '',
                        path: file.path || '',
                        relativePath: file.relativePath || '',
                        content: file.content || '',
                        lines: file.lines || 0,
                        size: file.size || 0,
                        snippet: file.snippet || '',
                        componentName: file.componentName || null,
                        hasButtons: Boolean(file.hasButtons),
                        hasSignin: Boolean(file.hasSignin),
                        isMainFile: Boolean(file.isMainFile)
                    };
                    projectFiles.set(filePath, projectFile);
                }
                return projectFiles;
            }
            catch (error) {
                console.error('Error parsing project files from Redis:', error);
                return null;
            }
        });
    }
    /**
     * Check if project files exist for session
     */
    hasProjectFiles(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `project_files:${sessionId}`;
            return (yield this.redis.exists(key)) === 1;
        });
    }
    /**
     * Add or update a single project file - FIXED
     */
    updateProjectFile(sessionId, filePath, projectFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `project_files:${sessionId}`;
            const existingData = yield this.redis.get(key);
            let projectFiles = {};
            if (existingData) {
                try {
                    projectFiles = JSON.parse(existingData);
                }
                catch (error) {
                    console.error('Error parsing existing project files:', error);
                }
            }
            // FIXED: Ensure proper serialization
            projectFiles[filePath] = {
                name: projectFile.name || '',
                path: projectFile.path || '',
                relativePath: projectFile.relativePath || '',
                content: projectFile.content || '',
                lines: projectFile.lines || 0,
                size: projectFile.size || 0,
                snippet: projectFile.snippet || '',
                componentName: projectFile.componentName || null,
                hasButtons: Boolean(projectFile.hasButtons),
                hasSignin: Boolean(projectFile.hasSignin),
                isMainFile: Boolean(projectFile.isMainFile)
            };
            yield this.redis.setex(key, this.PROJECT_FILES_TTL, JSON.stringify(projectFiles));
        });
    }
    setModificationChanges(sessionId, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `mod_changes:${sessionId}`;
            // FIXED: Ensure proper serialization of changes
            const serializedChanges = changes.map(change => ({
                type: change.type,
                file: change.file,
                description: change.description,
                timestamp: change.timestamp,
                approach: change.approach || undefined,
                success: change.success !== undefined ? Boolean(change.success) : undefined,
                details: change.details ? {
                    linesChanged: change.details.linesChanged || undefined,
                    componentsAffected: change.details.componentsAffected || undefined,
                    reasoning: change.details.reasoning || undefined
                } : undefined
            }));
            yield this.redis.setex(key, this.SESSION_TTL, JSON.stringify(serializedChanges));
        });
    }
    /**
     * Get modification changes for a session - FIXED
     */
    getModificationChanges(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `mod_changes:${sessionId}`;
            const data = yield this.redis.get(key);
            if (!data)
                return [];
            try {
                const parsed = JSON.parse(data);
                // FIXED: Proper reconstruction of ModificationChange objects
                return parsed.map((change) => ({
                    type: change.type,
                    file: change.file,
                    description: change.description,
                    timestamp: change.timestamp,
                    approach: change.approach || undefined,
                    success: change.success !== undefined ? Boolean(change.success) : undefined,
                    details: change.details ? {
                        linesChanged: change.details.linesChanged || undefined,
                        componentsAffected: change.details.componentsAffected || undefined,
                        reasoning: change.details.reasoning || undefined
                    } : undefined
                }));
            }
            catch (error) {
                console.error('Error parsing modification changes from Redis:', error);
                return [];
            }
        });
    }
    /**
     * Add a single modification change - FIXED TYPE COMPATIBILITY
     */
    addModificationChange(sessionId, change) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.getModificationChanges(sessionId);
            existing.push(change);
            yield this.setModificationChanges(sessionId, existing);
        });
    }
    /**
     * Set session start time
     */
    setSessionStartTime(sessionId, startTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `session_start:${sessionId}`;
            yield this.redis.setex(key, this.SESSION_TTL, startTime);
        });
    }
    /**
     * Get session start time
     */
    getSessionStartTime(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `session_start:${sessionId}`;
            const startTime = yield this.redis.get(key);
            return startTime || new Date().toISOString();
        });
    }
    setASTAnalysis(filePath, fileHash, astNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `ast_analysis:${fileHash}`;
            const data = {
                filePath,
                astNodes,
                timestamp: Date.now()
            };
            yield this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(data));
        });
    }
    getASTAnalysis(fileHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `ast_analysis:${fileHash}`;
            const data = yield this.redis.get(key);
            if (!data)
                return null;
            try {
                const parsed = JSON.parse(data);
                return {
                    filePath: parsed.filePath,
                    astNodes: parsed.astNodes
                };
            }
            catch (error) {
                console.error('Error parsing AST analysis from Redis:', error);
                return null;
            }
        });
    }
    setSessionState(sessionId, key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const redisKey = `session:${sessionId}:${key}`;
            yield this.redis.setex(redisKey, this.SESSION_TTL, JSON.stringify(value));
        });
    }
    /**
     * Get session state data
     */
    getSessionState(sessionId, key) {
        return __awaiter(this, void 0, void 0, function* () {
            const redisKey = `session:${sessionId}:${key}`;
            const data = yield this.redis.get(redisKey);
            if (!data)
                return null;
            try {
                return JSON.parse(data);
            }
            catch (error) {
                console.error(`Error parsing session state ${key} from Redis:`, error);
                return null;
            }
        });
    }
    /**
     * Delete session state data
     */
    deleteSessionState(sessionId, key) {
        return __awaiter(this, void 0, void 0, function* () {
            const redisKey = `session:${sessionId}:${key}`;
            yield this.redis.del(redisKey);
        });
    }
    /**
     * Clear all session data
     */
    clearSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pattern = `*${sessionId}*`;
            const keys = yield this.redis.keys(pattern);
            if (keys.length > 0) {
                yield this.redis.del(...keys);
            }
        });
    }
    // ==============================================================
    // BUILD CACHE METHODS
    // ==============================================================
    /**
     * Cache build results
     */
    setBuildCache(buildId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `build:${buildId}`;
            yield this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(data));
        });
    }
    /**
     * Get build results
     */
    getBuildCache(buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `build:${buildId}`;
            const data = yield this.redis.get(key);
            if (!data)
                return null;
            try {
                return JSON.parse(data);
            }
            catch (error) {
                console.error('Error parsing build cache from Redis:', error);
                return null;
            }
        });
    }
    // ==============================================================
    // UTILITY METHODS
    // ==============================================================
    /**
     * Generate file hash for caching
     */
    generateFileHash(content) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(content).digest('hex');
    }
    /**
     * Extend TTL for a key
     */
    extendTTL(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, ttl = this.DEFAULT_TTL) {
            yield this.redis.expire(key, ttl);
        });
    }
    /**
     * Check if Redis is connected
     */
    isConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.ping();
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     * Get memory usage stats - FIXED
     */
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.call('info', 'memory');
                const keyCount = yield this.redis.dbsize();
                return {
                    memoryUsage: info,
                    keyCount,
                    connected: true
                };
            }
            catch (error) {
                return {
                    memoryUsage: null,
                    keyCount: 0,
                    connected: false,
                    error: error.message
                };
            }
        });
    }
    /**
     * Close Redis connection
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.quit();
        });
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=Redis.js.map