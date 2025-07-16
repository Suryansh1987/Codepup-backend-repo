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
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const Redis_1 = require("./services/Redis");
const TokenTracer_1 = require("./utils/TokenTracer");
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const messagesummary_1 = require("./db/messagesummary");
const cors_1 = __importDefault(require("cors"));
const fs = __importStar(require("fs"));
const users_1 = __importDefault(require("./routes/users"));
const projects_1 = __importDefault(require("./routes/projects"));
const messages_1 = __importStar(require("./routes/messages"));
const agents_1 = __importDefault(require("./routes/agents"));
const session_1 = require("./routes/session");
const generation_1 = require("./routes/generation");
const modification_1 = require("./routes/modification");
const PORT = process.env.PORT || 3000;
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
const redis = new Redis_1.RedisService();
const tokenTracker = new TokenTracer_1.TokenTracker(true);
const DATABASE_URL = process.env.DATABASE_URL;
const messageDB = new messagesummary_1.DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = new session_1.StatelessSessionManager(redis);
(0, messages_1.setMessageDB)(messageDB);
// Basic middleware
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
// Initialize services
function initializeServices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const defaultSessionId = 'legacy-session-default';
            yield messageDB.initializeSessionStats(defaultSessionId);
            const redisConnected = yield redis.isConnected();
            console.log('✅ Services initialized successfully');
            console.log(`✅ Redis connected: ${redisConnected}`);
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
// ESSENTIAL ENDPOINTS ONLY
// ========================
// Health check endpoint - used by frontend
app.get("/health", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const redisConnected = yield redis.isConnected();
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: "3.0.0-simplified",
        features: redisConnected ? [
            "Redis stateless sessions",
            "Session-based conversations",
            "Project integration"
        ] : [
            "Basic project support",
            "Message storage"
        ]
    });
}));
// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Backend is running - simplified version",
        timestamp: new Date().toISOString(),
        version: "3.0.0-simplified"
    });
});
// Main API routes - these are used by the frontend
app.use("/api/users", users_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/messages", messages_1.default);
app.use("/api/generate", (0, generation_1.initializeGenerationRoutes)(anthropic, messageDB, sessionManager));
app.use("/api/modify", (0, modification_1.initializeModificationRoutes)(anthropic, messageDB, redis, sessionManager));
app.use("/api/design", agents_1.default);
// Cleanup function for temp directories
function performCleanup() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tempBuildsDir = path_1.default.join(__dirname, "../temp-builds");
            if (!fs.existsSync(tempBuildsDir)) {
                return;
            }
            const entries = yield fs.promises.readdir(tempBuildsDir, { withFileTypes: true });
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 100000);
            let cleanedCount = 0;
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirPath = path_1.default.join(tempBuildsDir, entry.name);
                    try {
                        const stats = yield fs.promises.stat(dirPath);
                        if (stats.mtime.getTime() < oneHourAgo) {
                            yield fs.promises.rm(dirPath, { recursive: true, force: true });
                            cleanedCount++;
                        }
                    }
                    catch (statError) {
                        console.warn(`⚠️ Could not stat directory ${entry.name}:`, statError);
                    }
                }
            }
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} old temp directories`);
            }
        }
        catch (error) {
            console.warn('⚠️ Background cleanup job failed:', error);
        }
    });
}
// Run cleanup every 30 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000;
setInterval(performCleanup, CLEANUP_INTERVAL);
// Optional manual cleanup endpoint
app.post("/api/cleanup/manual", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield performCleanup();
        res.json({
            success: true,
            message: 'Manual cleanup completed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Manual cleanup failed'
        });
    }
}));
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🧹 Cleanup system: 1 hour retention, check every 30 minutes`);
});
//# sourceMappingURL=index.js.map