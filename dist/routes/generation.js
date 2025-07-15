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
exports.initializeGenerationRoutes = initializeGenerationRoutes;
// routes/generation.ts - Updated to store agent response structure in description
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploy_fullstack_1 = require("../services/azure-deploy_fullstack");
const url_manager_1 = require("../db/url-manager");
const newparser_1 = require("../utils/newparser");
const promt_1 = require("../defaults/promt");
const router = express_1.default.Router();
// Helper functions
function cleanupTempDirectory(buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            if (fs.existsSync(tempBuildDir)) {
                yield fs.promises.rm(tempBuildDir, { recursive: true, force: true });
                console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
            }
        }
        catch (error) {
            console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
        }
    });
}
function scheduleCleanup(buildId, delayInHours = 1) {
    const delayMs = delayInHours * 60 * 60 * 1000;
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] 🕐 Scheduled cleanup starting after ${delayInHours} hour(s)`);
        yield cleanupTempDirectory(buildId);
    }), delayMs);
    console.log(`[${buildId}] ⏰ Cleanup scheduled for ${delayInHours} hour(s) from now`);
}
function sendStreamingUpdate(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function initializeGenerationRoutes(anthropic, messageDB, sessionManager) {
    const urlManager = new url_manager_1.EnhancedProjectUrlManager(messageDB);
    // Streaming endpoint with structure storage in description
    router.post("/stream", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { prompt, projectId, supabaseToken, databaseUrl, supabaseUrl, supabaseAnonKey, userId: providedUserId, clerkId, } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required",
            });
            return;
        }
        const buildId = (0, uuid_1.v4)();
        const sessionId = sessionManager.generateSessionId();
        // Set up Server-Sent Events
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        });
        sendStreamingUpdate(res, {
            type: "progress",
            buildId,
            sessionId,
            phase: "generating",
            message: "Starting code generation...",
            percentage: 0,
        });
        // USER RESOLUTION with Clerk ID support
        let userId;
        try {
            if (clerkId) {
                const existingUser = yield messageDB.getUserByClerkId(clerkId);
                if (existingUser) {
                    userId = existingUser.id;
                    console.log(`[${buildId}] Found user by Clerk ID: ${userId}`);
                }
                else {
                    console.log(`[${buildId}] Creating new user with Clerk ID: ${clerkId}`);
                    userId = yield messageDB.createUserWithClerkId({
                        clerkId: clerkId,
                        email: `${clerkId}@clerk.dev`,
                        name: "User",
                    });
                    console.log(`[${buildId}] Created new user: ${userId}`);
                }
            }
            else if (providedUserId) {
                const userExists = yield messageDB.validateUserExists(providedUserId);
                if (userExists) {
                    userId = providedUserId;
                    console.log(`[${buildId}] Using provided user ID: ${userId}`);
                }
                else {
                    yield messageDB.ensureUserExists(providedUserId);
                    userId = providedUserId;
                    console.log(`[${buildId}] Created user with ID: ${userId}`);
                }
            }
            else {
                const fallbackUserId = Date.now() % 1000000;
                yield messageDB.ensureUserExists(fallbackUserId);
                userId = fallbackUserId;
                console.log(`[${buildId}] Created fallback user: ${userId}`);
            }
            console.log(`[${buildId}] Resolved user ID: ${userId}`);
        }
        catch (error) {
            console.error(`[${buildId}] Failed to resolve user:`, error);
            sendStreamingUpdate(res, {
                type: "error",
                buildId,
                sessionId,
                error: "Failed to resolve user for project generation",
            });
            res.end();
            return;
        }
        console.log(`[${buildId}] Starting streaming generation for prompt: "${prompt.substring(0, 100)}..."`);
        const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        let finalProjectId = projectId || 0;
        let projectSaved = false;
        let accumulatedResponse = "";
        let totalLength = 0;
        const CHUNK_SIZE = 10000;
        try {
            // Save initial session context
            yield sessionManager.saveSessionContext(sessionId, {
                buildId,
                tempBuildDir: "",
                lastActivity: Date.now(),
            });
            // Setup temp directory
            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
            yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "generating",
                message: "Temp directory created, starting Claude generation...",
                percentage: 5,
            });
            yield sessionManager.updateSessionContext(sessionId, { tempBuildDir });
            // Create or update project record
            if (projectId) {
                console.log(`[${buildId}] 🔄 Updating existing project ${projectId}...`);
                try {
                    yield messageDB.updateProject(projectId, {
                        name: `Updated Project ${buildId.substring(0, 8)}`,
                        // DON'T update description during regeneration - it contains the original structure
                        status: "regenerating",
                        buildId: buildId,
                        lastSessionId: sessionId,
                        framework: "react",
                        template: "vite-react-ts",
                        lastMessageAt: new Date(),
                        updatedAt: new Date(),
                        supabaseurl: supabaseUrl,
                        aneonkey: supabaseAnonKey,
                    });
                    finalProjectId = projectId;
                    projectSaved = true;
                    console.log(`[${buildId}] ✅ Updated existing project record: ${finalProjectId} (description preserved)`);
                }
                catch (updateError) {
                    console.error(`[${buildId}] ❌ Failed to update existing project:`, updateError);
                }
            }
            else {
                console.log(`[${buildId}] 💾 Creating new project record (will update description with structure)...`);
                try {
                    finalProjectId = yield messageDB.createProject({
                        userId,
                        name: `Generated Project ${buildId.substring(0, 8)}`,
                        description: `React project generated from prompt: ${prompt.substring(0, 100)}...`, // Temporary description
                        status: "generating",
                        projectType: "generated",
                        deploymentUrl: "",
                        downloadUrl: "",
                        zipUrl: "",
                        buildId: buildId,
                        lastSessionId: sessionId,
                        framework: "react",
                        template: "vite-react-ts",
                        lastMessageAt: new Date(),
                        messageCount: 0,
                        supabaseurl: supabaseUrl,
                        aneonkey: supabaseAnonKey,
                    });
                    projectSaved = true;
                    console.log(`[${buildId}] ✅ Created new project record: ${finalProjectId}`);
                }
                catch (projectError) {
                    console.error(`[${buildId}] ❌ Failed to create project record:`, projectError);
                }
            }
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "generating",
                message: "Project record created, generating code with Claude...",
                percentage: 10,
            });
            console.log(`[${buildId}] 🚀 Generating frontend code with streaming...`);
            // Generate code with streaming
            const frontendResult = yield anthropic.messages
                .stream({
                model: "claude-sonnet-4-0",
                max_tokens: 60000,
                temperature: 1,
                system: promt_1.pro5Enhanced3,
                messages: [
                    {
                        role: "user",
                        content: [{ type: "text", text: prompt }],
                    },
                ],
            })
                .on("text", (text) => {
                accumulatedResponse += text;
                totalLength += text.length;
                sendStreamingUpdate(res, {
                    type: "length",
                    buildId,
                    sessionId,
                    currentLength: totalLength,
                    percentage: Math.min(10 + (totalLength / 50000) * 60, 70),
                });
                if (totalLength > 0 && totalLength % CHUNK_SIZE === 0) {
                    const chunkStart = totalLength - CHUNK_SIZE;
                    const chunk = accumulatedResponse.substring(chunkStart, totalLength);
                    sendStreamingUpdate(res, {
                        type: "chunk",
                        buildId,
                        sessionId,
                        chunk: chunk,
                        currentLength: totalLength,
                        totalLength: totalLength,
                    });
                }
                console.log(`[${buildId}] Generated ${totalLength} characters...`);
            });
            const resp = yield frontendResult.finalMessage();
            const claudeResponse = resp.content[0].text;
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "parsing",
                message: `Code generation completed (${totalLength} characters). Parsing files...`,
                percentage: 70,
                totalLength: totalLength,
            });
            console.log(`[${buildId}] ✅ Code generation completed with ${totalLength} characters`);
            // Parse generated files
            let parsedResult;
            try {
                console.log(`[${buildId}] 📝 Parsing generated code...`);
                parsedResult = (0, newparser_1.parseFrontendCode)(claudeResponse);
                console.log(`[${buildId}] ✅ Code parsing successful`);
                console.log(`[${buildId}] 📊 Parsed ${parsedResult.codeFiles.length} files`);
                sendStreamingUpdate(res, {
                    type: "progress",
                    buildId,
                    sessionId,
                    phase: "processing",
                    message: `Parsed ${parsedResult.codeFiles.length} files. Processing and validating...`,
                    percentage: 75,
                });
            }
            catch (parseError) {
                console.error(`[${buildId}] ❌ Enhanced parser failed`);
                sendStreamingUpdate(res, {
                    type: "error",
                    buildId,
                    sessionId,
                    error: `Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
                });
                res.end();
                return;
            }
            // Process files
            console.log(`[${buildId}] 🔧 Processing files with enhanced validation...`);
            const processedProject = (0, newparser_1.processTailwindProject)(parsedResult.codeFiles);
            const { processedFiles, validationResult, supabaseValidation, tailwindConfig, supabaseFiles, } = processedProject;
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "processing",
                message: `Validation complete. Writing ${processedFiles.length} files to disk...`,
                percentage: 80,
            });
            const parsedFiles = processedFiles;
            if (!parsedFiles || parsedFiles.length === 0) {
                sendStreamingUpdate(res, {
                    type: "error",
                    buildId,
                    sessionId,
                    error: "No files generated from Claude response",
                });
                res.end();
                return;
            }
            console.log(`[${buildId}] 💾 Writing ${parsedFiles.length} files...`);
            const fileMap = {};
            // Write files
            for (const file of parsedFiles) {
                try {
                    const fullPath = path_1.default.join(tempBuildDir, file.path);
                    yield fs.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                    yield fs.promises.writeFile(fullPath, file.content, "utf8");
                    fileMap[file.path] = file.content;
                    console.log(`[${buildId}] ✅ Written: ${file.path}`);
                }
                catch (writeError) {
                    console.error(`[${buildId}] ❌ Failed to write ${file.path}:`, writeError);
                    sendStreamingUpdate(res, {
                        type: "error",
                        buildId,
                        sessionId,
                        error: `Failed to write file ${file.path}: ${writeError}`,
                    });
                    res.end();
                    return;
                }
            }
            // Cache files in session
            yield sessionManager.cacheProjectFiles(sessionId, fileMap);
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "deploying",
                message: "Files written. Creating zip and starting deployment...",
                percentage: 85,
            });
            yield new Promise((resolve) => setTimeout(resolve, 2000));
            console.log(`[${buildId}] 📦 Creating zip and uploading to Azure...`);
            const zip = new adm_zip_1.default();
            zip.addLocalFolder(tempBuildDir);
            const zipBuffer = zip.toBuffer();
            const zipBlobName = `${buildId}/source.zip`;
            const zipUrl = yield (0, azure_deploy_fullstack_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "deploying",
                message: "Source uploaded. Building and deploying...",
                percentage: 90,
            });
            // Generate project summary
            const projectSummary = (0, newparser_1.generateProjectSummary)({
                codeFiles: processedFiles,
                structure: parsedResult.structure,
            });
            // Create enhanced project structure for description
            const structureForDescription = JSON.stringify({
                structure: parsedResult.structure,
                summary: projectSummary,
                validation: {
                    fileStructure: validationResult.isValid,
                    supabase: supabaseValidation.isValid,
                    tailwind: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig.content) : false,
                },
                supabaseInfo: {
                    filesFound: supabaseFiles.allSupabaseFiles.length,
                    hasConfig: !!supabaseFiles.configFile,
                    migrationCount: supabaseFiles.migrationFiles.length,
                    hasSeedFile: !!supabaseFiles.seedFile,
                },
                metadata: {
                    buildId: buildId,
                    filesGenerated: parsedFiles.length,
                    generatedAt: new Date().toISOString(),
                    framework: "react",
                    template: "vite-react-ts"
                }
            });
            // Update session context
            yield sessionManager.updateSessionContext(sessionId, {
                projectSummary: {
                    structure: parsedResult.structure,
                    summary: projectSummary,
                    validation: {
                        fileStructure: validationResult,
                        supabase: supabaseValidation,
                        tailwind: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig.content) : false,
                    },
                    supabaseInfo: {
                        filesFound: supabaseFiles.allSupabaseFiles.length,
                        hasConfig: !!supabaseFiles.configFile,
                        migrationCount: supabaseFiles.migrationFiles.length,
                        hasSeedFile: !!supabaseFiles.seedFile,
                    },
                    zipUrl: zipUrl,
                    buildId: buildId,
                    filesGenerated: parsedFiles.length,
                },
            });
            // Trigger Azure Container Job
            console.log(`[${buildId}] 🔧 Triggering Azure Container Job...`);
            const DistUrl = yield (0, azure_deploy_fullstack_1.triggerAzureContainerJob)(zipUrl, buildId, {
                resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                acrName: process.env.AZURE_ACR_NAME,
                storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                supabaseToken: supabaseToken,
                databaseUrl: databaseUrl,
                supabaseUrl: supabaseUrl,
                supabaseAnonKey: supabaseAnonKey,
            });
            const urls = JSON.parse(DistUrl);
            const builtZipUrl = urls.downloadUrl;
            // Deploy to Azure Static Web Apps
            console.log(`[${buildId}] 🚀 Deploying to SWA...`);
            const previewUrl = yield (0, azure_deploy_fullstack_1.runBuildAndDeploy)(builtZipUrl, buildId, {
                VITE_SUPABASE_URL: supabaseUrl,
                VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
            });
            sendStreamingUpdate(res, {
                type: "progress",
                buildId,
                sessionId,
                phase: "complete",
                message: "Deployment complete!",
                percentage: 100,
            });
            // Save assistant response to message history with structure
            try {
                const assistantMessageId = yield messageDB.addMessage(structureForDescription, // Store the enhanced structure as message content
                "assistant", {
                    projectId: finalProjectId,
                    sessionId: sessionId,
                    userId: userId,
                    functionCalled: "frontend_generation",
                    buildId: buildId,
                    previewUrl: previewUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: zipUrl,
                });
                console.log(`[${buildId}] 💾 Saved enhanced structure to messageDB (ID: ${assistantMessageId})`);
            }
            catch (dbError) {
                console.warn(`[${buildId}] ⚠️ Failed to save structure to messageDB:`, dbError);
            }
            // CRITICAL: Update project description with agent response structure (for new projects only)
            if (finalProjectId && projectSaved && !projectId) {
                try {
                    console.log(`[${buildId}] 📝 Updating project description with agent response structure...`);
                    yield messageDB.updateProject(finalProjectId, {
                        description: structureForDescription, // Store the structure in description
                        generatedCode: parsedResult.structure, // Also store in generatedCode field
                        status: "ready", // Update status to ready after successful generation
                    });
                    console.log(`[${buildId}] ✅ Project description updated with structure data`);
                }
                catch (descriptionError) {
                    console.error(`[${buildId}] ❌ Failed to update project description:`, descriptionError);
                }
            }
            // Update project URLs using Enhanced URL Manager
            console.log(`[${buildId}] 💾 Using Enhanced URL Manager to save project URLs...`);
            if (finalProjectId && projectSaved) {
                try {
                    yield urlManager.saveNewProjectUrls(sessionId, finalProjectId, {
                        deploymentUrl: previewUrl,
                        downloadUrl: urls.downloadUrl,
                        zipUrl: zipUrl,
                    }, userId, {
                        name: `Generated Project ${buildId.substring(0, 8)}`,
                        // For new projects, the description will be the structure
                        // For existing projects, keep the original description with structure
                        description: !projectId ? structureForDescription : undefined, // Only update for new projects
                        framework: "react",
                        template: "vite-react-ts",
                    });
                    console.log(`[${buildId}] ✅ Enhanced URL Manager - Successfully updated project ${finalProjectId}`);
                }
                catch (projectError) {
                    console.error(`[${buildId}] ❌ Enhanced URL Manager failed:`, projectError);
                }
            }
            // Schedule cleanup
            scheduleCleanup(buildId, 1);
            // Send final completion message
            sendStreamingUpdate(res, {
                type: "complete",
                buildId,
                sessionId,
                phase: "complete",
                message: "Generation completed successfully!",
                percentage: 100,
                totalLength: totalLength,
            });
            // Send the final result
            const finalResult = {
                success: true,
                files: parsedFiles,
                previewUrl: previewUrl,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl,
                buildId: buildId,
                sessionId: sessionId,
                projectId: finalProjectId,
                structure: parsedResult.structure,
                summary: projectSummary,
                validation: {
                    fileStructure: validationResult,
                    supabase: supabaseValidation,
                    tailwindConfig: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig.content) : false,
                },
                supabase: {
                    filesFound: supabaseFiles.allSupabaseFiles.length,
                    configExists: !!supabaseFiles.configFile,
                    migrationCount: supabaseFiles.migrationFiles.length,
                    seedFileExists: !!supabaseFiles.seedFile,
                },
                tailwind: {
                    configExists: !!tailwindConfig,
                    validConfig: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig.content) : false,
                },
                hosting: "Azure Static Web Apps",
                features: ["Global CDN", "Auto SSL/HTTPS", "Custom domains support", "Staging environments"],
                streamingStats: {
                    totalCharacters: totalLength,
                    chunksStreamed: Math.floor(totalLength / CHUNK_SIZE),
                },
                structureStoredInDescription: !projectId, // Indicates if structure was stored in description
            };
            res.write(`data: ${JSON.stringify({
                type: "result",
                buildId,
                sessionId,
                result: finalResult,
            })}\n\n`);
            res.end();
            console.log(`[${buildId}] ✅ Streaming build process completed successfully`);
        }
        catch (error) {
            console.error(`[${buildId}] ❌ Streaming build process failed:`, error);
            sendStreamingUpdate(res, {
                type: "error",
                buildId,
                sessionId,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            // Save error to messageDB
            try {
                yield messageDB.addMessage(`Frontend generation failed: ${error instanceof Error ? error.message : "Unknown error"}`, "assistant", {
                    projectId: finalProjectId,
                    sessionId: sessionId,
                    userId: userId,
                    functionCalled: "frontend_generation",
                    buildId: buildId,
                });
            }
            catch (dbError) {
                console.warn(`[${buildId}] ⚠️ Failed to save error to messageDB:`, dbError);
            }
            // Cleanup on error
            yield sessionManager.cleanup(sessionId);
            yield cleanupTempDirectory(buildId);
            res.end();
        }
    }));
    // Non-streaming endpoint placeholder
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        res.json({
            success: false,
            error: "Use /stream endpoint for generation",
        });
    }));
    return router;
}
//# sourceMappingURL=generation.js.map