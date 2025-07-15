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
// routes/modification.ts - Updated with messageDB integration and enhanced project structure
const express_1 = __importDefault(require("express"));
const filemodifier_1 = require("../services/filemodifier");
const url_manager_1 = require("../db/url-manager");
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploye_frontend1_1 = require("../services/azure-deploye_frontend1");
const helper_functions_1 = require("../utils/helper-functions");
const router = express_1.default.Router();
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
// Initialize routes
function initializeModificationRoutes(anthropic, messageDB, redis, sessionManager) {
    const urlManager = new url_manager_1.EnhancedProjectUrlManager(messageDB);
    // ENHANCED STREAMING MODIFICATION ENDPOINT WITH PROJECT STRUCTURE
    router.post("/stream", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { prompt, sessionId: clientSessionId, userId: providedUserId, currentUrl, deployedUrl, projectId: requestedProjectId, projectStructure, // NEW: Accept project structure from frontend
        clerkId, // NEW: Accept clerkId for user resolution
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
        console.log(`[${buildId}] 🚀 Starting modification with enhanced project structure support`);
        console.log(`[${buildId}] RequestedProjectId: ${requestedProjectId}`);
        console.log(`[${buildId}] Has projectStructure: ${!!projectStructure}`);
        console.log(`[${buildId}] ClerkId: ${clerkId || 'not provided'}`);
        // Get project secrets
        const secrets = yield (0, helper_functions_1.getProjectSecrets)(messageDB, requestedProjectId);
        if (!secrets) {
            res.status(400).json({
                success: false,
                error: `Failed to retrieve project secrets for projectId: ${requestedProjectId}`,
            });
            return;
        }
        let userId;
        try {
            // Enhanced user resolution with Clerk ID support
            if (clerkId) {
                const userByClerk = yield messageDB.getUserByClerkId(clerkId);
                if (userByClerk) {
                    userId = userByClerk.id;
                    console.log(`[${buildId}] Resolved user by Clerk ID: ${userId}`);
                }
                else {
                    userId = yield (0, helper_functions_1.resolveUserId)(messageDB, providedUserId, sessionId);
                    console.log(`[${buildId}] Clerk user not found, using fallback: ${userId}`);
                }
            }
            else {
                userId = yield (0, helper_functions_1.resolveUserId)(messageDB, providedUserId, sessionId);
                console.log(`[${buildId}] Resolved user ID: ${userId}`);
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to resolve user for modification",
                buildId,
                sessionId,
            });
            return;
        }
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true",
        });
        const sendEvent = (type, data) => {
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
                total: 10,
                message: "Initializing enhanced modification system...",
                buildId,
                sessionId,
                userId,
            });
            // Project resolution with enhanced structure support
            const { projectId: resolvedProjectId, project: currentProject, matchReason, } = yield (0, helper_functions_1.resolveProjectByDeployedUrl)(messageDB, userId, deployedUrl || currentUrl, sessionId, requestedProjectId || undefined);
            console.log(`[${buildId}] Project resolution: ${matchReason}`);
            if (resolvedProjectId) {
                console.log(`[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${resolvedProjectId})`);
            }
            else {
                console.log(`[${buildId}] ⚠️ No existing project matched`);
            }
            sendEvent("progress", {
                step: 2,
                total: 10,
                message: resolvedProjectId ? `Found project: "${currentProject.name}"` : "No project found",
                buildId,
                sessionId,
                projectId: resolvedProjectId,
                projectName: currentProject === null || currentProject === void 0 ? void 0 : currentProject.name,
                matchReason,
            });
            // Setup project environment
            let tempBuildDir = "";
            if (resolvedProjectId) {
                const projectUrls = yield urlManager.getProjectUrls({ projectId: resolvedProjectId });
                if (projectUrls && projectUrls.zipUrl) {
                    tempBuildDir = yield downloadAndExtractProject(buildId, projectUrls.zipUrl);
                }
            }
            // Fallback to template if no project found
            if (!tempBuildDir) {
                const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
            }
            sendEvent("progress", {
                step: 3,
                total: 10,
                message: "Project environment ready! Preparing intelligent modification...",
                buildId,
                sessionId,
            });
            // Initialize file modifier with enhanced project structure support
            const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId, undefined, // conversation context (optional)
            messageDB // Pass messageDB for enhanced project structure access
            );
            const startTime = Date.now();
            sendEvent("progress", {
                step: 4,
                total: 10,
                message: "Starting intelligent modification with project structure analysis...",
                buildId,
                sessionId,
            });
            // Enhanced processModification with project structure
            const result = yield fileModifier.processModification(prompt, projectStructure, // Pass the project structure from frontend
            (currentProject === null || currentProject === void 0 ? void 0 : currentProject.description) || "Project modification", resolvedProjectId || requestedProjectId, // Pass projectId for enhanced structure retrieval
            () => __awaiter(this, void 0, void 0, function* () { return null; }) // No summary saving for simplicity
            );
            if (result.success) {
                sendEvent("progress", {
                    step: 5,
                    total: 10,
                    message: "Modification complete! Building with enhanced structure...",
                    buildId,
                    sessionId,
                });
                try {
                    // Write environment variables
                    if ((secrets === null || secrets === void 0 ? void 0 : secrets.aneonkey) && (secrets === null || secrets === void 0 ? void 0 : secrets.supabaseurl)) {
                        sendEvent("progress", {
                            step: 5.5,
                            total: 10,
                            message: "Setting up environment variables...",
                            buildId,
                            sessionId,
                        });
                        yield writeEnvironmentVariables(tempBuildDir, secrets.aneonkey, secrets.supabaseurl);
                    }
                    // Create and upload zip
                    const zip = new adm_zip_1.default();
                    zip.addLocalFolder(tempBuildDir);
                    const zipBuffer = zip.toBuffer();
                    const zipBlobName = `${buildId}/source.zip`;
                    const zipUrl = yield (0, azure_deploye_frontend1_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                    sendEvent("progress", {
                        step: 6,
                        total: 10,
                        message: "Building enhanced app...",
                        buildId,
                        sessionId,
                    });
                    // Build and deploy
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
                        step: 7,
                        total: 10,
                        message: "Deploying enhanced project...",
                        buildId,
                        sessionId,
                    });
                    //@ts-ignore
                    const previewUrl = yield (0, azure_deploye_frontend1_1.runBuildAndDeploy)(builtZipUrl, buildId);
                    sendEvent("progress", {
                        step: 8,
                        total: 10,
                        message: "Updating project with enhanced structure...",
                        buildId,
                        sessionId,
                    });
                    // Update project URLs if we have a project
                    if (resolvedProjectId) {
                        try {
                            yield urlManager.saveNewProjectUrls(sessionId, resolvedProjectId, {
                                deploymentUrl: previewUrl,
                                downloadUrl: urls.downloadUrl,
                                zipUrl,
                            }, userId, {
                                name: currentProject === null || currentProject === void 0 ? void 0 : currentProject.name,
                                description: currentProject === null || currentProject === void 0 ? void 0 : currentProject.description,
                                framework: (currentProject === null || currentProject === void 0 ? void 0 : currentProject.framework) || "react",
                                template: (currentProject === null || currentProject === void 0 ? void 0 : currentProject.template) || "vite-react-ts",
                            });
                            console.log(`[${buildId}] ✅ Updated project ${resolvedProjectId} with enhanced structure`);
                        }
                        catch (updateError) {
                            console.error(`[${buildId}] ❌ Failed to update project:`, updateError);
                        }
                    }
                    sendEvent("progress", {
                        step: 9,
                        total: 10,
                        message: "Cleaning up...",
                        buildId,
                        sessionId,
                    });
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent("progress", {
                        step: 10,
                        total: 10,
                        message: `🎉 Enhanced project live at: ${previewUrl}`,
                        buildId,
                        sessionId,
                    });
                    // Send enhanced completion event
                    sendEvent("complete", {
                        success: true,
                        data: {
                            workflow: "enhanced-modification-with-structure",
                            approach: result.approach || 'INTELLIGENT_ANALYSIS',
                            selectedFiles: result.selectedFiles || [],
                            addedFiles: result.addedFiles || [],
                            modifiedRanges: result.modifiedRanges || 0,
                            reasoning: result.reasoning,
                            modificationSummary: result.modificationSummary,
                            previewUrl,
                            downloadUrl: urls.downloadUrl,
                            zipUrl,
                            buildId,
                            sessionId,
                            userId,
                            projectId: resolvedProjectId,
                            projectName: currentProject === null || currentProject === void 0 ? void 0 : currentProject.name,
                            projectMatchReason: matchReason,
                            hasProjectStructure: !!projectStructure,
                            enhancedFeatures: [
                                "Project structure analysis",
                                "Component-aware modifications",
                                "Intelligent file selection",
                                "Enhanced context understanding"
                            ]
                        },
                    });
                    yield fileModifier.cleanup();
                }
                catch (buildError) {
                    console.error(`[${buildId}] Build pipeline failed:`, buildError);
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent("error", {
                        success: false,
                        error: "Build/deploy failed",
                        details: buildError instanceof Error ? buildError.message : "Unknown build error",
                        buildId,
                        sessionId,
                        userId,
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
                error: "Internal server error",
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
    // NEW: Endpoint to verify URL-project mapping (from paste1.txt)
    router.get("/verify-url/:userId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId: paramUserId } = req.params;
            const { url, projectId } = req.query;
            const userId = parseInt(paramUserId);
            if (isNaN(userId) || !url) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user ID or missing URL'
                });
                return;
            }
            const resolvedUserId = yield (0, helper_functions_1.resolveUserId)(messageDB, userId);
            // Enhanced project resolution with structure info
            const { projectId: foundProjectId, project: foundProject, matchReason, } = yield (0, helper_functions_1.resolveProjectByDeployedUrl)(messageDB, resolvedUserId, url, undefined, projectId ? parseInt(projectId) : undefined);
            res.json({
                success: true,
                data: {
                    hasMatch: !!foundProject,
                    project: foundProject ? {
                        id: foundProject.id,
                        name: foundProject.name,
                        description: foundProject.description,
                        deploymentUrl: foundProject.deploymentUrl,
                        framework: foundProject.framework,
                        template: foundProject.template,
                        hasStructure: !!foundProject.generatedCode,
                    } : null,
                    matchReason,
                    searchUrl: url,
                    providedProjectId: projectId || null,
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to verify URL-project mapping',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=modification.js.map