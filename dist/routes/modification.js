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
exports.initializeModificationRoutes = initializeModificationRoutes;
// routes/modification.ts - Complete Updated with Enhanced URL Manager and URL-based project resolution
const express_1 = __importDefault(require("express"));
const filemodifier_1 = require("../services/filemodifier");
const url_manager_1 = require("../db/url-manager");
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploye_frontend1_1 = require("../services/azure-deploye_frontend1");
const router = express_1.default.Router();
class StatelessConversationHelper {
    constructor(messageDB, redis) {
        this.messageDB = messageDB;
        this.redis = redis;
    }
    saveModification(sessionId, modification) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const change = {
                type: "modified",
                file: "session_modification",
                description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`,
                timestamp: new Date().toISOString(),
                prompt: modification.prompt,
                approach: modification.approach,
                filesModified: modification.filesModified || [],
                filesCreated: modification.filesCreated || [],
                success: ((_a = modification.result) === null || _a === void 0 ? void 0 : _a.success) || false,
            };
            yield this.redis.addModificationChange(sessionId, change);
        });
    }
    getEnhancedContext(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try Redis first for fast access
            const cachedContext = yield this.redis.getSessionState(sessionId, "conversation_context");
            if (cachedContext) {
                return cachedContext;
            }
            // Fall back to database
            const dbContext = yield this.messageDB.getConversationContext();
            if (dbContext) {
                // Cache for next time
                yield this.redis.setSessionState(sessionId, "conversation_context", dbContext);
                return dbContext;
            }
            return "";
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
                        modificationSuccess: msg.modificationSuccess,
                    },
                    createdAt: msg.createdAt,
                })),
                summaryCount: conversation.summaryCount,
                totalMessages: conversation.totalMessages,
            };
        });
    }
}
// URL normalization for reliable matching
function normalizeUrl(url) {
    if (!url)
        return "";
    try {
        // Remove protocol, www, trailing slashes, and query params for comparison
        let normalized = url
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .replace(/\/$/, "")
            .split("?")[0]
            .split("#")[0];
        return normalized;
    }
    catch (error) {
        console.error("Error normalizing URL:", url, error);
        return url.toLowerCase();
    }
}
// Enhanced project resolution based on deployed URL
function resolveProjectByDeployedUrl(messageDB, urlManager, userId, deployedUrl, sessionId, projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Extract project ID from URL if not provided
            let targetProjectId = projectId;
            if (!targetProjectId && deployedUrl) {
                targetProjectId = extractProjectIdFromUrl(deployedUrl);
                console.log(`📎 Extracted projectId from URL: ${targetProjectId}`);
            }
            const userProjects = yield messageDB.getUserProjects(userId);
            if (userProjects.length === 0) {
                return {
                    projectId: null,
                    project: null,
                    matchReason: "no_user_projects",
                };
            }
            // 🎯 NEW Priority 1: If projectId is provided, verify it matches the deployedUrl
            if (projectId && deployedUrl) {
                console.log(`🎯 Checking if provided projectId (${projectId}) matches deployedUrl (${deployedUrl})`);
                const specificProject = userProjects.find((p) => p.id === projectId);
                if (specificProject) {
                    if (specificProject.deploymentUrl) {
                        const normalizedTargetUrl = normalizeUrl(deployedUrl);
                        const normalizedProjectUrl = normalizeUrl(specificProject.deploymentUrl);
                        if (normalizedProjectUrl === normalizedTargetUrl) {
                            console.log(`✅ Perfect match! ProjectId ${projectId} matches deployedUrl`);
                            return {
                                projectId: specificProject.id,
                                project: specificProject,
                                matchReason: "deployed_url_match",
                            };
                        }
                        else {
                            console.log(`⚠️ ProjectId ${projectId} exists but URL doesn't match:`);
                            console.log(`  Expected: ${normalizedTargetUrl}`);
                            console.log(`  Actual: ${normalizedProjectUrl}`);
                        }
                    }
                    else {
                        console.log(`⚠️ ProjectId ${projectId} exists but has no deployment URL`);
                    }
                }
                else {
                    console.log(`⚠️ ProjectId ${projectId} not found in user's projects`);
                }
            }
            // Priority 2: Match by deployed URL only (existing logic)
            if (deployedUrl) {
                console.log(`🔍 Looking for any project with deployed URL: ${deployedUrl}`);
                const normalizedTargetUrl = normalizeUrl(deployedUrl);
                const urlMatch = userProjects.find((project) => {
                    if (!project.deploymentUrl)
                        return false;
                    const normalizedProjectUrl = normalizeUrl(project.deploymentUrl);
                    const isMatch = normalizedProjectUrl === normalizedTargetUrl;
                    if (isMatch) {
                        console.log(`✅ URL match found: ${project.deploymentUrl} -> Project: ${project.name}`);
                    }
                    return isMatch;
                });
                if (urlMatch) {
                    return {
                        projectId: urlMatch.id,
                        project: urlMatch,
                        matchReason: "deployed_url_match",
                    };
                }
                else {
                    console.log(`⚠️ No project found with deployed URL: ${deployedUrl}`);
                    console.log("Available project URLs:");
                    userProjects.forEach((p) => {
                        console.log(`  - ${p.name}: ${p.deploymentUrl || "No URL"}`);
                    });
                }
            }
            // Priority 3: If only projectId provided (no URL matching needed)
            if (projectId) {
                const specificProject = userProjects.find((p) => p.id === projectId);
                if (specificProject) {
                    console.log(`✅ Using provided projectId ${projectId} without URL verification`);
                    return {
                        projectId: specificProject.id,
                        project: specificProject,
                        matchReason: "project_id_fallback",
                    };
                }
            }
            // Priority 4: Try session-based matching as fallback
            if (sessionId) {
                const sessionProject = yield messageDB.getProjectBySessionId(sessionId);
                if (sessionProject &&
                    userProjects.find((p) => p.id === sessionProject.id)) {
                    console.log(`✅ Fallback to session project: ${sessionProject.id} (${sessionProject.name})`);
                    return {
                        projectId: sessionProject.id,
                        project: sessionProject,
                        matchReason: "session_fallback",
                    };
                }
            }
            // Priority 5: Use most recent project as last resort
            const recentProject = userProjects[0];
            console.log(`⚠️ No matches found, using most recent project: ${recentProject.name}`);
            return {
                projectId: recentProject.id,
                project: recentProject,
                matchReason: "recent_fallback",
            };
        }
        catch (error) {
            console.error("❌ Failed to resolve project by URL:", error);
            return {
                projectId: null,
                project: null,
                matchReason: "resolution_error",
            };
        }
    });
}
// FALLBACK USER RESOLUTION FUNCTION
function resolveUserId(messageDB, providedUserId, sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Priority 1: Use provided userId if valid
            if (providedUserId &&
                (yield messageDB.validateUserExists(providedUserId))) {
                return providedUserId;
            }
            // Priority 2: Get userId from session's most recent project
            if (sessionId) {
                const sessionProject = yield messageDB.getProjectBySessionId(sessionId);
                if (sessionProject && sessionProject.userId) {
                    return sessionProject.userId;
                }
            }
            // Priority 3: Get most recent user from any project
            const mostRecentUserId = yield messageDB.getMostRecentUserId();
            if (mostRecentUserId &&
                (yield messageDB.validateUserExists(mostRecentUserId))) {
                return mostRecentUserId;
            }
            // Priority 4: Create a new user with current timestamp
            const newUserId = Date.now() % 1000000;
            yield messageDB.ensureUserExists(newUserId, {
                email: `user${newUserId}@buildora.dev`,
                name: `User ${newUserId}`,
            });
            console.log(`✅ Created new user ${newUserId} as fallback`);
            return newUserId;
        }
        catch (error) {
            console.error("❌ Failed to resolve user ID:", error);
            throw new Error("Could not resolve or create user");
        }
    });
}
// Utility functions
function downloadAndExtractProject(buildId, zipUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            console.log(`[${buildId}] Downloading project from: ${zipUrl}`);
            const response = yield axios_1.default.get(zipUrl, { responseType: "stream" });
            const zipPath = path_1.default.join(__dirname, "../../temp-builds", `${buildId}-download.zip`);
            yield fs.promises.mkdir(path_1.default.dirname(zipPath), { recursive: true });
            const writer = fs.createWriteStream(zipPath);
            response.data.pipe(writer);
            yield new Promise((resolve, reject) => {
                writer.on("finish", () => resolve());
                writer.on("error", (err) => reject(err));
            });
            console.log(`[${buildId}] ZIP downloaded successfully`);
            const zip = new adm_zip_1.default(zipPath);
            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
            zip.extractAllTo(tempBuildDir, true);
            console.log(`[${buildId}] Project extracted to: ${tempBuildDir}`);
            yield fs.promises.unlink(zipPath);
            return tempBuildDir;
        }
        catch (error) {
            console.error(`[${buildId}] Failed to download and extract project:`, error);
            throw new Error(`Failed to download project: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    });
}
function cleanupTempDirectory(buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            yield fs.promises.rm(tempBuildDir, { recursive: true, force: true });
            console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
        }
        catch (error) {
            console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
        }
    });
}
// NEW: Function to write environment variables before build
function writeEnvironmentVariables(tempBuildDir, aneonKey, supabaseUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const envContent = `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${aneonKey}
`;
            const envPath = path_1.default.join(tempBuildDir, ".env");
            yield fs.promises.writeFile(envPath, envContent, "utf8");
            console.log(`✅ Environment variables written to: ${envPath}`);
        }
        catch (error) {
            console.error("❌ Failed to write environment variables:", error);
            throw new Error(`Failed to write .env file: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    });
}
function findProjectByUrl(messageDB, userId, searchUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userProjects = yield messageDB.getUserProjects(userId);
            const normalizedSearchUrl = normalizeUrl(searchUrl);
            const match = userProjects.find((project) => {
                if (!project.deploymentUrl)
                    return false;
                return normalizeUrl(project.deploymentUrl) === normalizedSearchUrl;
            });
            return match || null;
        }
        catch (error) {
            console.error("Error finding project by URL:", error);
            return null;
        }
    });
}
function extractProjectIdFromUrl(url) {
    try {
        // Example: https://myapp.com/project/123/dashboard
        const match = url.match(/\/project\/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }
    catch (_a) {
        return null;
    }
}
// Initialize routes with dependencies
function initializeModificationRoutes(anthropic, messageDB, redis, sessionManager) {
    const conversationHelper = new StatelessConversationHelper(messageDB, redis);
    const urlManager = new url_manager_1.EnhancedProjectUrlManager(messageDB);
    // STATELESS STREAMING MODIFICATION ENDPOINT WITH URL-BASED RESOLUTION
    router.post("/stream", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const { prompt, sessionId: clientSessionId, userId: providedUserId, currentUrl, deployedUrl, projectId: requestedProjectId, } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required",
            });
            return;
        }
        const sessionId = clientSessionId || sessionManager.generateSessionId();
        const buildId = (0, uuid_1.v4)();
        const secrets = yield messageDB.getProjectSecretsById(requestedProjectId);
        if (!secrets) {
            console.error(`[${buildId}] ❌ Failed to retrieve project secrets for projectId: `);
            return;
        }
        if (secrets) {
            const { aneonkey, supabaseurl } = secrets;
            console.log("Aneon Key:", aneonkey);
            console.log("Supabase URL:", supabaseurl);
        }
        else {
            console.log("No project found with that ID");
        }
        let userId;
        try {
            userId = yield resolveUserId(messageDB, providedUserId, sessionId);
            console.log(`[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`);
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to resolve user for modification",
                details: error instanceof Error ? error.message : "Unknown error",
                buildId,
                sessionId,
            });
            return;
        }
        console.log(`[${buildId}] Starting modification for user: ${userId}, session: ${sessionId}`);
        console.log(`[${buildId}] Current URL: ${currentUrl || "not provided"}`);
        console.log(`[${buildId}] Deployed URL: ${deployedUrl || "not provided"}`);
        console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true",
        });
        const sendEvent = (type, data) => {
            console.log(`📤 Sending ${type} event:`, data);
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        const cleanupTimer = setTimeout(() => {
            cleanupTempDirectory(buildId);
            sessionManager.cleanup(sessionId);
        }, 5 * 60 * 1000);
        try {
            sendEvent("progress", {
                step: 1,
                total: 16,
                message: "Initializing modification system...",
                buildId,
                sessionId,
                userId,
            });
            // ENHANCED PROJECT RESOLUTION BY DEPLOYED URL
            const { projectId: projectId, project: currentProject, matchReason, } = yield resolveProjectByDeployedUrl(messageDB, urlManager, userId, deployedUrl || currentUrl, sessionId, requestedProjectId || undefined);
            console.log(`[${buildId}] Project resolution result: ${matchReason}`);
            console.log(`[${buildId}] Target URL: ${deployedUrl || currentUrl || "none provided"}`);
            if (projectId) {
                console.log(`[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${projectId})`);
                console.log(`[${buildId}] Project URL: ${currentProject.deploymentUrl}`);
            }
            else {
                console.log(`[${buildId}] ⚠️ No existing project matched, will create new one`);
            }
            if (matchReason === "deployed_url_match") {
                sendEvent("progress", {
                    step: 2,
                    total: 16,
                    message: `✅ Found project: "${currentProject.name}" (URL match)`,
                    buildId,
                    sessionId,
                    projectId: projectId,
                    projectName: currentProject.name,
                    matchReason,
                });
            }
            else if (matchReason === "session_fallback") {
                sendEvent("progress", {
                    step: 2,
                    total: 16,
                    message: `📋 Using session project: "${currentProject.name}"`,
                    buildId,
                    sessionId,
                    projectId: projectId,
                    projectName: currentProject.name,
                    matchReason,
                });
            }
            else if (matchReason === "recent_fallback") {
                sendEvent("progress", {
                    step: 2,
                    total: 16,
                    message: `⚠️ No URL match. Using recent: "${currentProject.name}"`,
                    buildId,
                    sessionId,
                    projectId: projectId,
                    projectName: currentProject.name,
                    matchReason,
                });
            }
            else {
                sendEvent("progress", {
                    step: 2,
                    total: 16,
                    message: "No existing project found. Starting fresh...",
                    buildId,
                    sessionId,
                    matchReason,
                });
            }
            let sessionContext = yield sessionManager.getSessionContext(sessionId);
            let tempBuildDir = "";
            let userProject = currentProject;
            // Enhanced project resolution using URL manager
            if (projectId) {
                sendEvent("progress", {
                    step: 3,
                    total: 16,
                    message: `Loading project: ${projectId}...`,
                    buildId,
                    sessionId,
                });
                const projectUrls = yield urlManager.getProjectUrls({
                    projectId: projectId,
                });
                if (projectUrls && projectUrls.zipUrl) {
                    tempBuildDir = yield downloadAndExtractProject(buildId, projectUrls.zipUrl);
                    sessionContext = {
                        buildId,
                        tempBuildDir,
                        projectSummary: {
                            summary: (currentProject === null || currentProject === void 0 ? void 0 : currentProject.description) || "Project modification",
                            zipUrl: projectUrls.zipUrl,
                            buildId: projectUrls.buildId,
                        },
                        lastActivity: Date.now(),
                    };
                    yield sessionManager.saveSessionContext(sessionId, sessionContext);
                }
            }
            else {
                // Fallback logic
                sendEvent("progress", {
                    step: 3,
                    total: 16,
                    message: "No current project found. Checking Redis...",
                    buildId,
                    sessionId,
                });
                sessionContext = yield sessionManager.getSessionContext(sessionId);
                if ((_a = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _a === void 0 ? void 0 : _a.zipUrl) {
                    tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                }
                else {
                    const projectSummary = yield messageDB.getActiveProjectSummary();
                    if (projectSummary === null || projectSummary === void 0 ? void 0 : projectSummary.zipUrl) {
                        tempBuildDir = yield downloadAndExtractProject(buildId, projectSummary.zipUrl);
                        sessionContext = {
                            buildId,
                            tempBuildDir,
                            projectSummary: {
                                summary: projectSummary.summary,
                                zipUrl: projectSummary.zipUrl,
                                buildId: projectSummary.buildId,
                            },
                            lastActivity: Date.now(),
                        };
                        yield sessionManager.saveSessionContext(sessionId, sessionContext);
                    }
                    else {
                        const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                        tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                        yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                        yield fs.promises.cp(sourceTemplateDir, tempBuildDir, {
                            recursive: true,
                        });
                        sessionContext = {
                            buildId,
                            tempBuildDir,
                            lastActivity: Date.now(),
                        };
                        yield sessionManager.saveSessionContext(sessionId, sessionContext);
                    }
                }
            }
            sendEvent("progress", {
                step: 4,
                total: 16,
                message: "Project environment ready!",
                buildId,
                sessionId,
            });
            yield sessionManager.updateSessionContext(sessionId, {
                buildId,
                tempBuildDir,
                lastActivity: Date.now(),
            });
            let enhancedPrompt = prompt;
            try {
                const context = yield conversationHelper.getEnhancedContext(sessionId);
                if (context) {
                    enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
                    sendEvent("progress", {
                        step: 5,
                        total: 16,
                        message: "Loaded conversation context!",
                        buildId,
                        sessionId,
                    });
                }
            }
            catch (_f) {
                sendEvent("progress", {
                    step: 5,
                    total: 16,
                    message: "Continuing with fresh modification...",
                    buildId,
                    sessionId,
                });
            }
            const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
            fileModifier.setStreamCallback((message) => sendEvent("progress", {
                step: 7,
                total: 16,
                message,
                buildId,
                sessionId,
            }));
            sendEvent("progress", {
                step: 6,
                total: 16,
                message: "Starting intelligent modification...",
                buildId,
                sessionId,
            });
            const startTime = Date.now();
            const result = yield fileModifier.processModification(enhancedPrompt, undefined, (_b = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _b === void 0 ? void 0 : _b.summary, (summary, prompt) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const summaryId = yield messageDB.saveProjectSummary(summary, prompt, "", buildId, userId);
                    console.log(`💾 Saved project summary, ID: ${summaryId}`);
                    return summaryId;
                }
                catch (err) {
                    console.error("⚠️ Error saving summary:", err);
                    return null;
                }
            }));
            const modificationDuration = Date.now() - startTime;
            if (result.success) {
                sendEvent("progress", {
                    step: 8,
                    total: 16,
                    message: "Modification complete! Building...",
                    buildId,
                    sessionId,
                });
                try {
                    // Write environment variables before build
                    if ((secrets === null || secrets === void 0 ? void 0 : secrets.aneonkey) && (secrets === null || secrets === void 0 ? void 0 : secrets.supabaseurl)) {
                        sendEvent("progress", {
                            step: 9,
                            total: 16,
                            message: "Setting up environment variables...",
                            buildId,
                            sessionId,
                        });
                        yield writeEnvironmentVariables(tempBuildDir, secrets.aneonkey, secrets.supabaseurl);
                    }
                    const zip = new adm_zip_1.default();
                    zip.addLocalFolder(tempBuildDir);
                    const zipBuffer = zip.toBuffer();
                    const zipBlobName = `${buildId}/source.zip`;
                    const zipUrl = yield (0, azure_deploye_frontend1_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                    sendEvent("progress", {
                        step: 10,
                        total: 16,
                        message: "Building app...",
                        buildId,
                        sessionId,
                    });
                    const DistUrl = yield (0, azure_deploye_frontend1_1.triggerAzureContainerJob)(zipUrl, buildId, {
                        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                        acrName: process.env.AZURE_ACR_NAME,
                        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                    });
                    const urls = JSON.parse(DistUrl);
                    const builtZipUrl = urls.downloadUrl;
                    sendEvent("progress", {
                        step: 11,
                        total: 16,
                        message: "Deploying...",
                        buildId,
                        sessionId,
                    });
                    //@ts-ignore
                    const previewUrl = yield (0, azure_deploye_frontend1_1.runBuildAndDeploy)(builtZipUrl, buildId);
                    sendEvent("progress", {
                        step: 12,
                        total: 16,
                        message: "Updating database...",
                        buildId,
                        sessionId,
                    });
                    yield sessionManager.updateSessionContext(sessionId, {
                        projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl,
                            buildId }),
                    });
                    if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                        const projectSummary = yield messageDB.getActiveProjectSummary();
                        if (projectSummary) {
                            yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                        }
                    }
                    sendEvent("progress", {
                        step: 13,
                        total: 16,
                        message: "Updating project URLs...",
                        buildId,
                        sessionId,
                    });
                    // USE ENHANCED URL MANAGER - UPDATE EXISTING PROJECT
                    let urlResult = {
                        action: "no_project_to_update",
                        projectId: null,
                    };
                    if (projectId) {
                        try {
                            const updatedProjectId = yield urlManager.saveNewProjectUrls(sessionId, projectId, {
                                deploymentUrl: previewUrl,
                                downloadUrl: urls.downloadUrl,
                                zipUrl,
                            }, userId, {
                                name: userProject === null || userProject === void 0 ? void 0 : userProject.name,
                                description: userProject === null || userProject === void 0 ? void 0 : userProject.description,
                                framework: (userProject === null || userProject === void 0 ? void 0 : userProject.framework) || "react",
                                template: (userProject === null || userProject === void 0 ? void 0 : userProject.template) || "vite-react-ts",
                            });
                            urlResult = {
                                action: "updated",
                                projectId: updatedProjectId,
                                skipReason: null,
                            };
                            console.log(`[${buildId}] ✅ Updated existing project: ${updatedProjectId}`);
                        }
                        catch (updateError) {
                            console.error(`[${buildId}] ❌ Failed to update project URLs:`, updateError);
                            urlResult = {
                                action: "update_failed",
                                projectId: projectId,
                                error: updateError instanceof Error
                                    ? updateError.message
                                    : "Unknown error",
                            };
                        }
                    }
                    else {
                        console.warn(`[${buildId}] ⚠️ No current project ID available for update`);
                    }
                    sendEvent("progress", {
                        step: 14,
                        total: 16,
                        message: "Cleaning up...",
                        buildId,
                        sessionId,
                    });
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent("progress", {
                        step: 15,
                        total: 16,
                        message: `🎉 Live at: ${previewUrl}`,
                        buildId,
                        sessionId,
                    });
                    const totalDuration = Date.now() - startTime;
                    sendEvent("complete", {
                        success: true,
                        data: {
                            workflow: "url-based-project-resolution",
                            approach: result.approach || "UNKNOWN",
                            selectedFiles: result.selectedFiles || [],
                            addedFiles: result.addedFiles || [],
                            modifiedRanges: typeof result.modifiedRanges === "number"
                                ? result.modifiedRanges
                                : ((_c = result.modifiedRanges) === null || _c === void 0 ? void 0 : _c.length) || 0,
                            reasoning: result.reasoning,
                            modificationSummary: result.modificationSummary,
                            modificationDuration,
                            totalDuration,
                            totalFilesAffected: (((_d = result.selectedFiles) === null || _d === void 0 ? void 0 : _d.length) || 0) +
                                (((_e = result.addedFiles) === null || _e === void 0 ? void 0 : _e.length) || 0),
                            previewUrl,
                            downloadUrl: urls.downloadUrl,
                            zipUrl,
                            buildId,
                            sessionId,
                            userId,
                            projectId: urlResult.projectId || projectId,
                            projectName: userProject === null || userProject === void 0 ? void 0 : userProject.name,
                            projectAction: urlResult.action,
                            projectMatchReason: matchReason,
                            skipReason: urlResult.skipReason,
                            duplicatePrevention: "URL-based project resolution with comprehensive duplicate checking",
                            hosting: "Azure Static Web Apps",
                            features: [
                                "Global CDN",
                                "Auto SSL/HTTPS",
                                "Custom domains support",
                                "Staging environments",
                            ],
                        },
                    });
                    yield fileModifier.cleanup();
                }
                catch (buildError) {
                    console.error(`[${buildId}] Build pipeline failed:`, buildError);
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent("complete", {
                        success: true,
                        data: {
                            workflow: "url-based-project-resolution-build-error",
                            approach: result.approach || "UNKNOWN",
                            buildError: buildError instanceof Error
                                ? buildError.message
                                : "Build failed",
                            buildId,
                            sessionId,
                            userId,
                            projectId: projectId,
                            projectName: userProject === null || userProject === void 0 ? void 0 : userProject.name,
                            projectMatchReason: matchReason,
                            message: "Modification completed, but build/deploy failed",
                        },
                    });
                }
            }
            else {
                sendEvent("error", {
                    success: false,
                    error: result.error || "Modification failed",
                    approach: result.approach,
                    reasoning: result.reasoning,
                    buildId,
                    sessionId,
                    userId,
                    projectId: projectId,
                    projectName: userProject === null || userProject === void 0 ? void 0 : userProject.name,
                    projectMatchReason: matchReason,
                });
                clearTimeout(cleanupTimer);
                yield cleanupTempDirectory(buildId);
                yield fileModifier.cleanup();
            }
        }
        catch (error) {
            console.error(`[${buildId}] ❌ Error:`, error);
            clearTimeout(cleanupTimer);
            yield cleanupTempDirectory(buildId);
            sendEvent("error", {
                success: false,
                error: "Internal server error during modification",
                details: error.message,
                buildId,
                sessionId,
                userId,
            });
        }
        finally {
            res.end();
        }
    }));
    // NON-STREAMING MODIFICATION ENDPOINT WITH URL-BASED RESOLUTION
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const { prompt, sessionId: clientSessionId, userId: providedUserId, currentUrl, // NEW: Current page URL
            deployedUrl, projectId: requestedProjectId, // NEW: Deployed app URL
             } = req.body;
            if (!prompt) {
                res.status(400).json({
                    success: false,
                    error: "Prompt is required",
                });
                return;
            }
            const sessionId = clientSessionId || sessionManager.generateSessionId();
            const buildId = (0, uuid_1.v4)();
            const secrets = yield messageDB.getProjectSecretsById(requestedProjectId);
            if (!secrets) {
                console.error(`[${buildId}] ❌ Failed to retrieve project secrets for projectId: `);
                return;
            }
            if (secrets) {
                const { aneonkey, supabaseurl } = secrets;
                console.log("Aneon Key:", aneonkey);
                console.log("Supabase URL:", supabaseurl);
            }
            else {
                console.log("No project found with that ID");
            }
            let userId;
            try {
                userId = yield resolveUserId(messageDB, providedUserId, sessionId);
                console.log(`[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`);
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: "Failed to resolve user for modification",
                    details: error instanceof Error ? error.message : "Unknown error",
                    buildId,
                    sessionId,
                });
                return;
            }
            console.log(`[${buildId}] Starting non-streaming modification for user: ${userId}`);
            console.log(`[${buildId}] Current URL: ${currentUrl || "not provided"}`);
            console.log(`[${buildId}] Deployed URL: ${deployedUrl || "not provided"}`);
            const cleanupTimer = setTimeout(() => {
                cleanupTempDirectory(buildId);
                sessionManager.cleanup(sessionId);
            }, 5 * 60 * 30000);
            try {
                // ENHANCED PROJECT RESOLUTION BY DEPLOYED URL
                const { projectId: currentProjectId, project: currentProject, matchReason, } = yield resolveProjectByDeployedUrl(messageDB, urlManager, userId, deployedUrl || currentUrl, sessionId);
                console.log(`[${buildId}] Project resolution result: ${matchReason}`);
                console.log(`[${buildId}] Target URL: ${deployedUrl || currentUrl || "none provided"}`);
                if (currentProjectId) {
                    console.log(`[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${currentProjectId})`);
                    console.log(`[${buildId}] Project URL: ${currentProject.deploymentUrl}`);
                }
                else {
                    console.log(`[${buildId}] ⚠️ No existing project matched, will create new one`);
                }
                // Enhanced project resolution using URL manager
                let sessionContext = yield sessionManager.getSessionContext(sessionId);
                let tempBuildDir = "";
                let targetProject = currentProject;
                // Proper tempBuildDir assignment logic
                if (currentProjectId) {
                    console.log(`[${buildId}] Using current project ID: ${currentProjectId}`);
                    const projectUrls = yield urlManager.getProjectUrls({
                        projectId: currentProjectId,
                    });
                    if (projectUrls && projectUrls.zipUrl) {
                        tempBuildDir = yield downloadAndExtractProject(buildId, projectUrls.zipUrl);
                        targetProject = currentProject;
                        sessionContext = {
                            buildId,
                            tempBuildDir,
                            projectSummary: {
                                summary: (currentProject === null || currentProject === void 0 ? void 0 : currentProject.description) || "Project modification",
                                zipUrl: projectUrls.zipUrl,
                                buildId: projectUrls.buildId,
                            },
                            lastActivity: Date.now(),
                        };
                        yield sessionManager.saveSessionContext(sessionId, sessionContext);
                    }
                    else {
                        // Fallback if current project has no zipUrl
                        console.log(`[${buildId}] Current project ${currentProjectId} has no zipUrl, using template`);
                        const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                        tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                        yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                        yield fs.promises.cp(sourceTemplateDir, tempBuildDir, {
                            recursive: true,
                        });
                    }
                }
                else {
                    // Fallback logic - check session context first
                    sessionContext = yield sessionManager.getSessionContext(sessionId);
                    if (sessionContext &&
                        sessionContext.projectSummary &&
                        sessionContext.projectSummary.zipUrl) {
                        tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                    }
                    else {
                        // Check for active project summary
                        const projectSummary = yield messageDB.getActiveProjectSummary();
                        if (projectSummary && projectSummary.zipUrl) {
                            tempBuildDir = yield downloadAndExtractProject(buildId, projectSummary.zipUrl);
                            sessionContext = {
                                buildId,
                                tempBuildDir,
                                projectSummary: {
                                    summary: projectSummary.summary,
                                    zipUrl: projectSummary.zipUrl,
                                    buildId: projectSummary.buildId,
                                },
                                lastActivity: Date.now(),
                            };
                            yield sessionManager.saveSessionContext(sessionId, sessionContext);
                        }
                        else {
                            // Final fallback - use template
                            console.log(`[${buildId}] No existing project found, using template`);
                            const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                            tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                            yield fs.promises.cp(sourceTemplateDir, tempBuildDir, {
                                recursive: true,
                            });
                            sessionContext = {
                                buildId,
                                tempBuildDir,
                                lastActivity: Date.now(),
                            };
                            yield sessionManager.saveSessionContext(sessionId, sessionContext);
                        }
                    }
                }
                // Ensure tempBuildDir is assigned before continuing
                if (!tempBuildDir) {
                    console.error(`[${buildId}] ❌ tempBuildDir not assigned, creating fallback`);
                    const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                    tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                    yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                    yield fs.promises.cp(sourceTemplateDir, tempBuildDir, {
                        recursive: true,
                    });
                    sessionContext = {
                        buildId,
                        tempBuildDir,
                        lastActivity: Date.now(),
                    };
                    yield sessionManager.saveSessionContext(sessionId, sessionContext);
                }
                console.log(`[${buildId}] ✅ tempBuildDir assigned: ${tempBuildDir}`);
                // Update session
                yield sessionManager.updateSessionContext(sessionId, {
                    buildId,
                    tempBuildDir,
                    lastActivity: Date.now(),
                });
                // Get enhanced context
                let enhancedPrompt = prompt;
                try {
                    const context = yield conversationHelper.getEnhancedContext(sessionId);
                    if (context) {
                        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
                    }
                }
                catch (contextError) {
                    console.error("Context loading error:", contextError);
                }
                // Initialize stateless file modifier
                const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
                const startTime = Date.now();
                // Process modification
                const result = yield fileModifier.processModification(enhancedPrompt, undefined, (_a = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _a === void 0 ? void 0 : _a.summary, (summary, prompt) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const summaryId = yield messageDB.saveProjectSummary(summary, prompt, "", buildId, userId);
                        console.log(`💾 Saved project summary, ID: ${summaryId}`);
                        return summaryId;
                    }
                    catch (error) {
                        console.error("⚠️ Error saving project summary:", error);
                        return null;
                    }
                }));
                const modificationDuration = Date.now() - startTime;
                if (result.success) {
                    // Save modification to conversation history
                    try {
                        yield conversationHelper.saveModification(sessionId, {
                            prompt,
                            result,
                            approach: result.approach || "UNKNOWN",
                            filesModified: result.selectedFiles || [],
                            filesCreated: result.addedFiles || [],
                            timestamp: new Date().toISOString(),
                        });
                    }
                    catch (saveError) {
                        console.error("Failed to save modification to history:", saveError);
                    }
                    // BUILD & DEPLOY PIPELINE
                    try {
                        console.log(`[${buildId}] Starting build pipeline...`);
                        // Write environment variables before build
                        if ((secrets === null || secrets === void 0 ? void 0 : secrets.aneonkey) && (secrets === null || secrets === void 0 ? void 0 : secrets.supabaseurl)) {
                            console.log(`[${buildId}] Writing environment variables...`);
                            yield writeEnvironmentVariables(tempBuildDir, secrets.aneonkey, secrets.supabaseurl);
                        }
                        const zip = new adm_zip_1.default();
                        zip.addLocalFolder(tempBuildDir);
                        const zipBuffer = zip.toBuffer();
                        const zipBlobName = `${buildId}/source.zip`;
                        const zipUrl = yield (0, azure_deploye_frontend1_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                        // Trigger Azure Container Job
                        const DistUrl = yield (0, azure_deploye_frontend1_1.triggerAzureContainerJob)(zipUrl, buildId, {
                            resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                            acrName: process.env.AZURE_ACR_NAME,
                            storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                        });
                        const urls = JSON.parse(DistUrl);
                        const builtZipUrl = urls.downloadUrl;
                        //@ts-ignore
                        const previewUrl = yield (0, azure_deploye_frontend1_1.runBuildAndDeploy)(builtZipUrl, buildId);
                        // Update session context with new ZIP URL
                        yield sessionManager.updateSessionContext(sessionId, {
                            projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl: zipUrl, buildId: buildId }),
                        });
                        // Update database project summary
                        if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                            const projectSummary = yield messageDB.getActiveProjectSummary();
                            if (projectSummary) {
                                yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                            }
                        }
                        // USE ENHANCED URL MANAGER - UPDATE EXISTING PROJECT
                        console.log(`[${buildId}] 💾 Using Enhanced URL Manager for modification...`);
                        let urlResult = {
                            action: "no_project_to_update",
                            projectId: null,
                        };
                        if (currentProjectId) {
                            try {
                                const updatedProjectId = yield urlManager.saveNewProjectUrls(sessionId, currentProjectId, {
                                    deploymentUrl: previewUrl,
                                    downloadUrl: urls.downloadUrl,
                                    zipUrl: zipUrl,
                                }, userId, {
                                    name: targetProject === null || targetProject === void 0 ? void 0 : targetProject.name,
                                    description: targetProject === null || targetProject === void 0 ? void 0 : targetProject.description,
                                    framework: (targetProject === null || targetProject === void 0 ? void 0 : targetProject.framework) || "react",
                                    template: (targetProject === null || targetProject === void 0 ? void 0 : targetProject.template) || "vite-react-ts",
                                });
                                urlResult = {
                                    action: "updated",
                                    projectId: updatedProjectId,
                                    skipReason: null,
                                };
                                console.log(`[${buildId}] ✅ Updated existing project: ${updatedProjectId}`);
                            }
                            catch (updateError) {
                                console.error(`[${buildId}] ❌ Failed to update project URLs:`, updateError);
                                urlResult = {
                                    action: "update_failed",
                                    projectId: currentProjectId,
                                    error: updateError instanceof Error
                                        ? updateError.message
                                        : "Unknown error",
                                };
                            }
                        }
                        else {
                            console.warn(`[${buildId}] ⚠️ No current project ID available for update`);
                        }
                        // Cleanup
                        clearTimeout(cleanupTimer);
                        yield cleanupTempDirectory(buildId);
                        yield fileModifier.cleanup();
                        const totalDuration = Date.now() - startTime;
                        res.json({
                            success: true,
                            data: {
                                workflow: "url-based-project-resolution",
                                approach: result.approach || "UNKNOWN",
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === "number"
                                    ? result.modifiedRanges
                                    : ((_b = result.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0,
                                conversationContext: "Enhanced context with Redis-backed modification history",
                                reasoning: result.reasoning,
                                modificationSummary: result.modificationSummary,
                                modificationDuration: modificationDuration,
                                totalFilesAffected: (((_c = result.selectedFiles) === null || _c === void 0 ? void 0 : _c.length) || 0) +
                                    (((_d = result.addedFiles) === null || _d === void 0 ? void 0 : _d.length) || 0),
                                previewUrl: previewUrl,
                                downloadUrl: urls.downloadUrl,
                                zipUrl: zipUrl,
                                buildId: buildId,
                                sessionId: sessionId,
                                userId: userId,
                                projectId: urlResult.projectId || currentProjectId,
                                projectName: targetProject === null || targetProject === void 0 ? void 0 : targetProject.name,
                                projectAction: urlResult.action,
                                projectMatchReason: matchReason,
                                skipReason: urlResult.skipReason,
                                duplicatePrevention: "URL-based project resolution with comprehensive duplicate checking",
                                hosting: "Azure Static Web Apps",
                                features: [
                                    "Global CDN",
                                    "Auto SSL/HTTPS",
                                    "Custom domains support",
                                    "Staging environments",
                                ],
                                projectState: currentProjectId
                                    ? "existing_project_modified"
                                    : "new_project_created",
                                tempBuildDirPath: tempBuildDir,
                            },
                        });
                    }
                    catch (buildError) {
                        console.error(`[${buildId}] Build pipeline failed:`, buildError);
                        clearTimeout(cleanupTimer);
                        yield cleanupTempDirectory(buildId);
                        yield fileModifier.cleanup();
                        res.json({
                            success: true,
                            data: {
                                workflow: "url-based-project-resolution-build-error",
                                approach: result.approach || "UNKNOWN",
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === "number"
                                    ? result.modifiedRanges
                                    : ((_e = result.modifiedRanges) === null || _e === void 0 ? void 0 : _e.length) || 0,
                                buildError: buildError instanceof Error
                                    ? buildError.message
                                    : "Build failed",
                                buildId: buildId,
                                sessionId: sessionId,
                                userId: userId,
                                projectId: currentProjectId,
                                projectName: targetProject === null || targetProject === void 0 ? void 0 : targetProject.name,
                                projectMatchReason: matchReason,
                                message: "Modification completed successfully, but build/deploy failed",
                                projectState: currentProjectId
                                    ? "existing_project_modified"
                                    : "new_project_created",
                                tempBuildDirPath: tempBuildDir,
                            },
                        });
                    }
                }
                else {
                    // Save failed attempts for learning
                    try {
                        yield conversationHelper.saveModification(sessionId, {
                            prompt,
                            result,
                            approach: result.approach || "UNKNOWN",
                            filesModified: result.selectedFiles || [],
                            filesCreated: result.addedFiles || [],
                            timestamp: new Date().toISOString(),
                        });
                    }
                    catch (saveError) {
                        console.error("Failed to save failed modification to history:", saveError);
                    }
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    yield fileModifier.cleanup();
                    res.status(400).json({
                        success: false,
                        error: result.error || "Modification failed",
                        approach: result.approach,
                        reasoning: result.reasoning,
                        selectedFiles: result.selectedFiles || [],
                        workflow: "url-based-project-resolution",
                        buildId: buildId,
                        sessionId: sessionId,
                        userId: userId,
                        projectId: currentProjectId,
                        projectName: targetProject === null || targetProject === void 0 ? void 0 : targetProject.name,
                        projectMatchReason: matchReason,
                        projectState: currentProjectId
                            ? "existing_project_failed"
                            : "new_project_failed",
                        tempBuildDirPath: tempBuildDir,
                    });
                }
            }
            catch (downloadError) {
                clearTimeout(cleanupTimer);
                yield cleanupTempDirectory(buildId);
                yield sessionManager.cleanup(sessionId);
                res.status(500).json({
                    success: false,
                    error: "Failed to setup project environment",
                    details: downloadError instanceof Error
                        ? downloadError.message
                        : "Unknown error",
                    workflow: "url-based-project-resolution",
                    buildId: buildId,
                    sessionId: sessionId,
                    userId: userId,
                });
            }
        }
        catch (error) {
            const buildId = (0, uuid_1.v4)();
            const sessionId = sessionManager.generateSessionId();
            console.error(`[${buildId}] ❌ Non-streaming modification error:`, error);
            res.status(500).json({
                success: false,
                error: "Internal server error during modification",
                details: error.message,
                workflow: "url-based-project-resolution",
                buildId: buildId,
                sessionId: sessionId,
                userId: req.body.userId || "unresolved",
            });
        }
    }));
    // GET USER'S PROJECTS ENDPOINT
    router.get("/user/:userId/projects", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId: paramUserId } = req.params;
            const userId = parseInt(paramUserId);
            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    error: "Invalid user ID provided",
                });
                return;
            }
            // Ensure user exists before getting projects
            const resolvedUserId = yield resolveUserId(messageDB, userId);
            const projects = yield messageDB.getUserProjects(resolvedUserId);
            // Get additional stats using URL manager
            const stats = yield urlManager.getUserProjectStats(resolvedUserId);
            res.json({
                success: true,
                data: projects.map((project) => ({
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    status: project.status,
                    deploymentUrl: project.deploymentUrl,
                    downloadUrl: project.downloadUrl,
                    zipUrl: project.zipUrl,
                    buildId: project.buildId,
                    framework: project.framework,
                    template: project.template,
                    messageCount: project.messageCount,
                    lastMessageAt: project.lastMessageAt,
                    conversationTitle: project.conversationTitle,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                })),
                userId: resolvedUserId,
                totalProjects: projects.length,
                stats: stats,
                duplicatePrevention: "URL-based project resolution with comprehensive duplicate checking",
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to get user projects",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }));
    // GET PROJECT URLS ENDPOINT
    router.get("/project/:projectId/urls", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { projectId } = req.params;
            const projectUrls = yield urlManager.getProjectUrls({
                projectId: parseInt(projectId),
            });
            if (!projectUrls) {
                res.status(404).json({
                    success: false,
                    error: "Project not found",
                });
                return;
            }
            res.json({
                success: true,
                data: projectUrls,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to get project URLs",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }));
    // NEW: ENDPOINT TO VERIFY URL-PROJECT MAPPING
    router.get("/verify-url/:userId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId: paramUserId } = req.params;
            const { url } = req.query;
            const userId = parseInt(paramUserId);
            if (isNaN(userId) || !url) {
                res.status(400).json({
                    success: false,
                    error: "Invalid user ID or missing URL",
                });
                return;
            }
            const resolvedUserId = yield resolveUserId(messageDB, userId);
            const project = yield findProjectByUrl(messageDB, resolvedUserId, url);
            res.json({
                success: true,
                data: {
                    hasMatch: !!project,
                    project: project
                        ? {
                            id: project.id,
                            name: project.name,
                            description: project.description,
                            deploymentUrl: project.deploymentUrl,
                            framework: project.framework,
                        }
                        : null,
                    normalizedUrl: normalizeUrl(url),
                    searchUrl: url,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to verify URL-project mapping",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }));
    return router;
}
//# sourceMappingURL=modification.js.map