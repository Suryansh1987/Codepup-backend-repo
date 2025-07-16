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
exports.initializeAgentRoutes = initializeAgentRoutes;
// routes/agents.ts (COMPLETE VERSION with generation route integration)
const express_1 = require("express");
const claude_function_service_1 = require("../services/agents/claude-function-service");
const conversation_service_1 = require("../services/conversation-service");
const uuid_1 = require("uuid");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const azure_deploy_fullstack_1 = require("../services/azure-deploy_fullstack");
const newparser_1 = require("../utils/newparser");
const router = (0, express_1.Router)();
const updated_parser_1 = __importDefault(require("../utils/updated_parser"));
// Create an INSTANCE of the service (not static)
const claudeService = new claude_function_service_1.ClaudeFunctionService();
const conversationService = new conversation_service_1.ConversationService();
// Initialize with dependencies (should be passed from main server)
let messageDB;
let sessionManager;
// Function to initialize dependencies
function initializeAgentRoutes(anthropic, db, sessionMgr) {
    messageDB = db;
    sessionManager = sessionMgr;
    return router;
}
const CLAUDE_VISION_LIMITS = {
    maxImages: 20, // API limit: 20 images per request
    maxFileSize: 3.75 * 1024 * 1024, // 3.75 MB per image
    maxDimensions: 8000, // 8000x8000 pixels max
    optimalSize: 1.15 * 1024 * 1024, // 1.15 megapixels for best performance
    supportedFormats: ["image/jpeg", "image/png", "image/gif", "image/webp"],
};
// Memory-only storage - no file persistence
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: CLAUDE_VISION_LIMITS.maxFileSize,
        files: CLAUDE_VISION_LIMITS.maxImages,
    },
    //@ts-ignore
    fileFilter: (req, file, cb) => {
        if (CLAUDE_VISION_LIMITS.supportedFormats.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(
            //@ts-ignore
            new Error(`Unsupported format. Use: ${CLAUDE_VISION_LIMITS.supportedFormats.join(", ")}`), false);
        }
    },
});
function validateAndOptimizeImage(buffer, filename) {
    // Calculate estimated tokens (width * height / 750)
    // For a 1000x1000 image: ~1334 tokens ≈ $4.00 per 1K images
    const estimatedTokens = Math.ceil((buffer.length * 0.75) / 750); // Rough estimation
    return {
        isValid: buffer.length <= CLAUDE_VISION_LIMITS.maxFileSize,
        estimatedTokens,
        filename,
    };
}
// Helper functions for cleanup (like generation route)
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
// Step 1: Initial design analysis
router.post("/analyze", upload.array("images", CLAUDE_VISION_LIMITS.maxImages), 
//@ts-ignore
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, userId, projectId } = req.body;
        //@ts-ignore
        const files = req.files;
        if (!prompt || !userId) {
            return res
                .status(400)
                .json({ error: "prompt and userId are required" });
        }
        console.log(`🎨 Starting design analysis for user ${userId}`);
        console.log(`📸 Processing ${(files === null || files === void 0 ? void 0 : files.length) || 0} images`);
        // Process images without saving them
        const imageData = (files === null || files === void 0 ? void 0 : files.map((file) => {
            const validation = validateAndOptimizeImage(file.buffer, file.originalname);
            return {
                buffer: file.buffer,
                mimetype: file.mimetype,
                originalname: file.originalname,
                size: file.size,
                estimatedTokens: validation.estimatedTokens,
            };
        })) || [];
        console.log(`🎨 Starting design analysis for user ${userId}`);
        const result = yield claudeService.analyzeDesign(prompt, userId, imageData);
        if (result.success) {
            let conversation = yield conversationService.getConversationByProject(projectId);
            if (!conversation) {
                conversation = yield conversationService.createConversation(userId, projectId);
            }
            // Save conversation state
            yield conversationService.updateConversationByProject(projectId, {
                currentStep: result.step,
                designChoices: result.designChoices,
            });
            yield conversationService.saveMessageByProject(projectId, {
                userMessage: prompt,
                agentResponse: result.message,
                functionCalled: result.functionCalled,
            });
            return res.json({
                success: true,
                step: result.step,
                designChoices: result.designChoices,
                message: result.message,
                tokenused: result.tokenused,
            });
        }
        else {
            return res.status(500).json({
                error: "Failed to analyze design",
                details: result,
            });
        }
    }
    catch (error) {
        console.error("❌ Design analysis error:", error);
        return res.status(500).json({
            error: "Failed to analyze design",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}));
// Step 2: Handle user feedback
//@ts-ignore
router.post("/feedback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { feedback, userId, projectId } = req.body;
        if (!feedback || !userId) {
            return res
                .status(400)
                .json({ error: "feedback and userId are required" });
        }
        const conversation = yield conversationService.getConversationByProject(projectId);
        if (!conversation) {
            return res.status(400).json({
                error: "No conversation found for this project. Please start with /analyze first.",
            });
        }
        console.log(`💬 Processing feedback for user ${userId}: ${feedback}`);
        const result = yield claudeService.handleUserFeedback(feedback, conversation.userId.toString(), conversation.designChoices);
        if (result.success) {
            // 🔥 Update by projectId
            const updates = {
                currentStep: result.step,
            };
            if (result.designChoices) {
                updates.designChoices = result.designChoices;
            }
            yield conversationService.updateConversationByProject(projectId, updates);
            // Save the message
            yield conversationService.saveMessageByProject(projectId, {
                userMessage: feedback,
                agentResponse: result.message,
                functionCalled: result.functionCalled,
            });
            return res.json({
                success: true,
                step: result.step,
                designChoices: result.designChoices,
                message: result.message,
                explanation: result.explanation,
                needsMoreInfo: result.needsMoreInfo,
                question: result.question,
                readyToGenerate: result.readyToGenerate,
                tokenused: result.tokenused,
            });
        }
        else {
            return res.status(500).json({
                error: "Failed to process feedback",
                details: result,
            });
        }
    }
    catch (error) {
        console.error("❌ Feedback processing error:", error);
        return res.status(500).json({
            error: "Failed to process feedback",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}));
// Step 3: Generate design files
//@ts-ignore
router.post("/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: "projectId is required" });
        }
        const conversation = yield conversationService.getConversationByProject(projectId);
        if (!conversation || !conversation.designChoices) {
            return res.status(400).json({
                error: "No finalized design found for this project.",
            });
        }
        const result = yield claudeService.generateDesignFiles(conversation.designChoices, conversation.userId.toString());
        console.log(`📊 Generation result:`, {
            success: result.success,
            hasFiles: !!result.files,
            functionCalled: result.functionCalled,
            error: result.error,
        });
        if (result.success) {
            // 🔥 Update by projectId
            yield conversationService.updateConversationByProject(projectId, {
                currentStep: "completed",
                generatedFiles: result.files,
            });
            // Save the message
            yield conversationService.saveMessageByProject(projectId, {
                agentResponse: result.message,
                functionCalled: result.functionCalled,
            });
            return res.json({
                success: true,
                step: result.step,
                files: result.files,
                summary: result.summary,
                usageInstructions: result.usageInstructions,
                message: result.message,
                tokenused: result.tokenused,
            });
        }
        else {
            // More detailed error response
            return res.status(500).json({
                error: "Failed to generate files",
                details: {
                    message: result.message,
                    error: result.error,
                    functionCalled: result.functionCalled,
                    stopReason: result.stopReason,
                },
            });
        }
    }
    catch (error) {
        console.error("❌ File generation error:", error);
        return res.status(500).json({
            error: "Failed to generate design files",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}));
//@ts-ignore
router.get("/status/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    try {
        const conversation = yield conversationService.getConversationByProject(parseInt(projectId));
        if (!conversation) {
            return res
                .status(404)
                .json({ error: "No conversation found for this project" });
        }
        const messages = yield conversationService.getMessagesByProject(parseInt(projectId));
        return res.json({
            success: true,
            step: conversation.currentStep,
            hasDesignChoices: !!conversation.designChoices,
            hasGeneratedFiles: !!conversation.generatedFiles,
            messageCount: messages.length,
            lastUpdated: conversation.updatedAt,
        });
    }
    catch (error) {
        console.error("❌ Status error:", error);
        return res.status(500).json({ error: "Failed to get conversation status" });
    }
}));
//@ts-ignore
router.post("/plan-structure", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: "projectId is required" });
        }
        const conversation = yield conversationService.getConversationByProject(projectId);
        if (!conversation || !conversation.designChoices) {
            return res.status(400).json({
                error: "No design choices found. Please complete the design analysis first.",
            });
        }
        console.log(`📋 Planning file structure for project ${projectId}`);
        // Step 1: Generate file structure plan
        const structureResult = yield claudeService.generateFileStructurePlan(conversation.designChoices, conversation.userId.toString());
        if (!structureResult.success) {
            return res.status(500).json({
                error: "Failed to generate file structure plan",
                details: structureResult,
            });
        }
        // Step 2: Update documentation
        const docResult = yield claudeService.updateDocumentationWithStructure(conversation.designChoices, structureResult.functionInput, conversation.userId.toString());
        if (docResult.success) {
            // Update conversation
            const allFiles = Object.assign(Object.assign(Object.assign({}, conversation.generatedFiles), { fileStructure: structureResult.functionInput }), docResult.functionInput.updatedFiles);
            yield conversationService.updateConversationByProject(projectId, {
                currentStep: "structure_planned",
                generatedFiles: allFiles,
            });
            yield conversationService.saveMessageByProject(projectId, {
                agentResponse: "File structure planned and documentation updated",
                functionCalled: "plan_structure",
            });
            return res.json({
                success: true,
                step: "structure_planned",
                fileStructure: structureResult.functionInput.fileStructure,
                documentation: docResult.functionInput.updatedFiles,
                totalFileCount: structureResult.functionInput.totalFileCount,
                message: "File structure planned successfully!",
                tokenused: structureResult.tokenused + docResult.tokenused,
            });
        }
        else {
            return res.status(500).json({
                error: "Failed to update documentation",
                details: docResult,
            });
        }
    }
    catch (error) {
        console.error("❌ File structure planning error:", error);
        return res.status(500).json({
            error: "Failed to plan file structure",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}));
//@ts-ignore
router.post("/generate-backend", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: "projectId is required" });
        }
        const conversation = yield conversationService.getConversationByProject(projectId);
        if (!conversation || !conversation.designChoices) {
            return res.status(400).json({
                error: "No design choices found. Please complete the design analysis first.",
            });
        }
        // Check if file structure exists
        const generatedFiles = conversation.generatedFiles;
        if (!(generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles.fileStructure)) {
            return res.status(400).json({
                error: "No file structure found. Please run plan-structure first.",
            });
        }
        console.log(`🏗️ Generating backend files for project ${projectId}`);
        // Generate backend files using the Backend Generator Agent
        const backendResult = yield claudeService.generateBackendFiles(conversation.designChoices, generatedFiles.fileStructure, conversation.userId.toString());
        if (!backendResult.success) {
            return res.status(500).json({
                error: "Failed to generate backend files",
                details: backendResult,
            });
        }
        // Merge with existing files
        const allFiles = Object.assign(Object.assign({}, generatedFiles), backendResult.functionInput.files);
        // Update conversation with backend files
        yield conversationService.updateConversationByProject(projectId, {
            currentStep: "backend_completed",
            generatedFiles: allFiles,
        });
        // Save the message
        yield conversationService.saveMessageByProject(projectId, {
            agentResponse: "Backend files generated successfully",
            functionCalled: "generate_backend_files",
        });
        return res.json({
            success: true,
            step: "backend_completed",
            files: backendResult.functionInput.files,
            databaseSchema: backendResult.functionInput.databaseSchema,
            summary: backendResult.functionInput.summary,
            message: "Backend files generated successfully! Migration, seed data, and TypeScript types are ready.",
            tokenused: backendResult.tokenused,
            filesPaths: {
                migration: "supabase/migrations/001_initial_schema.sql",
                seed: "supabase/seed.sql",
                types: "src/types/index.ts",
            },
        });
    }
    catch (error) {
        console.error("❌ Backend generation error:", error);
        return res.status(500).json({
            error: "Failed to generate backend files",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}));
//@ts-ignore
router.get("/schema/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { projectId } = req.params;
    try {
        const conversation = yield conversationService.getConversationByProject(parseInt(projectId));
        if (!conversation) {
            return res.status(404).json({ error: "Project not found" });
        }
        const generatedFiles = conversation.generatedFiles;
        // Check if backend files exist
        const hasBackend = !!((generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles["supabase/migrations/001_initial_schema.sql"]) &&
            (generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles["supabase/seed.sql"]) &&
            (generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles["src/types/index.ts"]));
        return res.json({
            success: true,
            hasBackend,
            step: conversation.currentStep,
            //@ts-ignore
            businessType: (_a = conversation.designChoices) === null || _a === void 0 ? void 0 : _a.businessType,
            tables: ((_b = generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles.databaseSchema) === null || _b === void 0 ? void 0 : _b.tables) || [],
            relationships: ((_c = generatedFiles === null || generatedFiles === void 0 ? void 0 : generatedFiles.databaseSchema) === null || _c === void 0 ? void 0 : _c.relationships) || [],
        });
    }
    catch (error) {
        console.error("❌ Schema info error:", error);
        return res.status(500).json({ error: "Failed to get schema info" });
    }
}));
// Streaming frontend generation - from generation route pattern
//@ts-ignore
router.post("/generate-frontend", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId, supabaseUrl, supabaseAnonKey, supabaseToken, databaseUrl, userId: providedUserId, clerkId, } = req.body;
    if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
    }
    if (!supabaseUrl || !supabaseAnonKey || !supabaseToken || !databaseUrl) {
        return res.status(400).json({
            error: "All Supabase configuration fields are required (supabaseUrl, supabaseAnonKey, supabaseToken, databaseUrl)"
        });
    }
    // Initialize buildId and session here (like generation route)
    const buildId = (0, uuid_1.v4)();
    const sessionId = sessionManager.generateSessionId();
    const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
    const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
    let projectSaved = false;
    let accumulatedResponse = "";
    let totalLength = 0;
    const CHUNK_SIZE = 10000;
    // Set up Server-Sent Events for streaming
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
    });
    const sendStreamingUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    sendStreamingUpdate({
        type: "progress",
        buildId,
        sessionId,
        phase: "initializing",
        message: "Starting frontend generation...",
        percentage: 0,
    });
    try {
        // Save initial session context
        yield sessionManager.saveSessionContext(sessionId, {
            buildId,
            tempBuildDir: "",
            lastActivity: Date.now(),
        });
        // USER RESOLUTION with Clerk ID support (similar to generation route)
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
            sendStreamingUpdate({
                type: "error",
                buildId,
                sessionId,
                error: "Failed to resolve user for project generation",
            });
            res.end();
            return;
        }
        const conversation = yield conversationService.getConversationByProject(projectId);
        if (!conversation || !conversation.designChoices || !conversation.generatedFiles) {
            sendStreamingUpdate({
                type: "error",
                buildId,
                sessionId,
                error: "Missing design choices or file structure. Please complete previous steps first.",
            });
            res.end();
            return;
        }
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "initializing",
            message: "Setting up build environment...",
            percentage: 5,
        });
        // Setup temp directory
        yield fs.promises.mkdir(tempBuildDir, { recursive: true });
        yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
        console.log(`[${buildId}] ✅ Base template copied to ${tempBuildDir}`);
        yield sessionManager.updateSessionContext(sessionId, { tempBuildDir });
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "initializing",
            message: "Base template copied, writing configuration files...",
            percentage: 10,
        });
        const generatedFiles = conversation.generatedFiles;
        // Write configuration files (from old route)
        if (generatedFiles["tailwind.config.ts"]) {
            yield fs.promises.writeFile(path_1.default.join(tempBuildDir, "tailwind.config.ts"), generatedFiles["tailwind.config.ts"]);
            console.log(`[${buildId}] ✅ Written: tailwind.config.ts`);
        }
        if (generatedFiles["/src/index.css"]) {
            yield fs.promises.mkdir(path_1.default.join(tempBuildDir, "src"), { recursive: true });
            yield fs.promises.writeFile(path_1.default.join(tempBuildDir, "src/index.css"), generatedFiles["/src/index.css"]);
            console.log(`[${buildId}] ✅ Written: src/index.css`);
        }
        // Write Supabase files
        console.log(`[${buildId}] 📦 Writing Supabase files...`);
        if (generatedFiles["supabase/migrations/001_initial_schema.sql"]) {
            yield fs.promises.mkdir(path_1.default.join(tempBuildDir, "supabase/migrations"), { recursive: true });
            yield fs.promises.writeFile(path_1.default.join(tempBuildDir, "supabase/migrations/001_initial_schema.sql"), generatedFiles["supabase/migrations/001_initial_schema.sql"]);
            console.log(`[${buildId}] ✅ Written: supabase/migrations/001_initial_schema.sql`);
        }
        if (generatedFiles["supabase/seed.sql"]) {
            yield fs.promises.writeFile(path_1.default.join(tempBuildDir, "supabase/seed.sql"), generatedFiles["supabase/seed.sql"]);
            console.log(`[${buildId}] ✅ Written: supabase/seed.sql`);
        }
        if (generatedFiles["src/types/index.ts"]) {
            yield fs.promises.mkdir(path_1.default.join(tempBuildDir, "src/types"), { recursive: true });
            yield fs.promises.writeFile(path_1.default.join(tempBuildDir, "src/types/index.ts"), generatedFiles["src/types/index.ts"]);
            console.log(`[${buildId}] ✅ Written: src/types/index.ts`);
        }
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "generating",
            message: "Configuration files written, generating frontend with Claude...",
            percentage: 15,
        });
        // Extract needed data for Claude generation
        const designChoices = conversation.designChoices;
        const fileStructure = generatedFiles.fileStructure;
        const tailwindConfig = generatedFiles["tailwind.config.ts"];
        const indexCss = generatedFiles["src/index.css"];
        const backendFiles = {
            "supabase/migrations/001_initial_schema.sql": generatedFiles["supabase/migrations/001_initial_schema.sql"],
            "supabase/seed.sql": generatedFiles["supabase/seed.sql"],
            "src/types/index.ts": generatedFiles["src/types/index.ts"],
        };
        console.log(`[${buildId}] 🎨 Generating frontend for project ${projectId}`);
        // Generate frontend files with Claude
        const result = yield claudeService.generateFrontendFiles(designChoices, fileStructure, backendFiles, userId.toString(), tailwindConfig, indexCss);
        if (!result) {
            sendStreamingUpdate({
                type: "error",
                buildId,
                sessionId,
                error: "Failed to generate frontend files with Claude",
            });
            res.end();
            return;
        }
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "parsing",
            message: "Claude generation completed, parsing generated code...",
            percentage: 60,
        });
        console.log(`[${buildId}] ✅ Claude frontend generation completed`);
        // Parse the generated code using LLMCodeParser
        const claudeResponse = result.content[0].text;
        const parsedResult = updated_parser_1.default.parseFrontendCode(claudeResponse);
        if (!parsedResult || !parsedResult.codeFiles || parsedResult.codeFiles.length === 0) {
            sendStreamingUpdate({
                type: "error",
                buildId,
                sessionId,
                error: "Failed to parse generated frontend code - no code files found",
            });
            res.end();
            return;
        }
        console.log(`[${buildId}] 📝 Parsed ${parsedResult.codeFiles.length} frontend files`);
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "processing",
            message: `Parsed ${parsedResult.codeFiles.length} files, writing to disk...`,
            percentage: 70,
        });
        // Write generated files to temp directory
        let filesWritten = 0;
        const fileMap = {};
        for (const file of parsedResult.codeFiles) {
            try {
                const fullPath = path_1.default.join(tempBuildDir, file.path);
                yield fs.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                yield fs.promises.writeFile(fullPath, file.content, "utf8");
                fileMap[file.path] = file.content;
                console.log(`[${buildId}] ✅ Written: ${file.path}`);
                filesWritten++;
            }
            catch (writeError) {
                console.error(`[${buildId}] ❌ Failed to write ${file.path}:`, writeError);
                sendStreamingUpdate({
                    type: "error",
                    buildId,
                    sessionId,
                    error: `Failed to write file ${file.path}: ${writeError instanceof Error ? writeError.message : "Unknown error"}`,
                });
                res.end();
                return;
            }
        }
        // Cache files in session
        yield sessionManager.cacheProjectFiles(sessionId, fileMap);
        console.log(`[${buildId}] ✅ Successfully wrote ${filesWritten} frontend files to temp directory`);
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "building",
            message: "Files written successfully, creating build package...",
            percentage: 80,
        });
        // Create zip package similar to generation route
        const zip = new adm_zip_1.default();
        zip.addLocalFolder(tempBuildDir);
        const zipBuffer = zip.toBuffer();
        const zipBlobName = `${buildId}/source.zip`;
        const zipUrl = yield (0, azure_deploy_fullstack_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "deploying",
            message: "Source uploaded, building and deploying...",
            percentage: 85,
        });
        // Generate project summary
        const projectSummary = (0, newparser_1.generateProjectSummary)({
            codeFiles: parsedResult.codeFiles,
            structure: parsedResult.structure,
        });
        // Create enhanced project structure for description
        const structureForDescription = JSON.stringify({
            structure: parsedResult.structure,
            summary: projectSummary,
            validation: {
                fileStructure: true,
                supabase: true,
                tailwind: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig) : false,
            },
            supabaseInfo: {
                filesFound: Object.keys(backendFiles).length,
                hasConfig: true,
                migrationCount: 1,
                hasSeedFile: !!generatedFiles["supabase/seed.sql"],
            },
            metadata: {
                buildId: buildId,
                filesGenerated: parsedResult.codeFiles.length,
                generatedAt: new Date().toISOString(),
                framework: "react",
                template: "vite-react-ts"
            }
        });
        yield sessionManager.updateSessionContext(sessionId, {
            projectSummary: {
                structure: parsedResult.structure,
                summary: projectSummary,
                validation: {
                    fileStructure: true,
                    supabase: true,
                    tailwind: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig) : false,
                },
                supabaseInfo: {
                    filesFound: Object.keys(backendFiles).length,
                    hasConfig: true,
                    migrationCount: 1,
                    hasSeedFile: !!generatedFiles["supabase/seed.sql"],
                },
                zipUrl: zipUrl,
                buildId: buildId,
                filesGenerated: parsedResult.codeFiles.length,
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
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "deploying",
            message: "Build complete, deploying to Azure Static Web Apps...",
            percentage: 95,
        });
        // Deploy to Azure Static Web Apps
        console.log(`[${buildId}] 🚀 Deploying to SWA...`);
        const previewUrl = yield (0, azure_deploy_fullstack_1.runBuildAndDeploy)(builtZipUrl, buildId, {
            VITE_SUPABASE_URL: supabaseUrl,
            VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
        });
        // Update conversation with all files
        const allFiles = Object.assign(Object.assign({}, generatedFiles), { buildId: buildId, tempBuildDir: tempBuildDir });
        // Add parsed files to the conversation
        parsedResult.codeFiles.forEach(file => {
            allFiles[file.path] = file.content;
        });
        yield conversationService.updateConversationByProject(projectId, {
            currentStep: "frontend_completed",
            generatedFiles: allFiles,
        });
        yield conversationService.saveMessageByProject(projectId, {
            agentResponse: `Frontend application generated successfully! ${filesWritten} files written and deployed.`,
            functionCalled: "generate_frontend_application",
        });
        // Save assistant response to message history with structure
        try {
            const assistantMessageId = yield messageDB.addMessage(structureForDescription, // Store the enhanced structure as message content
            "assistant", {
                projectId: projectId,
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
        // Update project record with deployment URLs
        try {
            yield messageDB.updateProject(projectId, {
                deploymentUrl: previewUrl,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl,
                buildId: buildId,
                status: "ready",
                supabaseurl: supabaseUrl,
                aneonkey: supabaseAnonKey,
                // Update description with structure for frontend projects
                description: structureForDescription,
                generatedCode: parsedResult.structure,
            });
            console.log(`[${buildId}] ✅ Updated project record with deployment URLs`);
        }
        catch (updateError) {
            console.warn(`[${buildId}] Failed to update project URLs:`, updateError);
        }
        sendStreamingUpdate({
            type: "progress",
            buildId,
            sessionId,
            phase: "complete",
            message: "Deployment completed successfully!",
            percentage: 100,
        });
        // Schedule cleanup
        scheduleCleanup(buildId, 1);
        // Send final completion message
        sendStreamingUpdate({
            type: "complete",
            buildId,
            sessionId,
            phase: "complete",
            message: "Frontend generation completed successfully!",
            percentage: 100,
            totalLength: totalLength,
        });
        // Send final result
        const finalResult = {
            success: true,
            files: parsedResult.codeFiles,
            previewUrl: previewUrl,
            downloadUrl: urls.downloadUrl,
            zipUrl: zipUrl,
            buildId: buildId,
            sessionId: sessionId,
            projectId: projectId,
            structure: parsedResult.structure,
            summary: projectSummary,
            validation: {
                fileStructure: true,
                supabase: true,
                tailwindConfig: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig) : false,
            },
            supabase: {
                filesFound: Object.keys(backendFiles).length,
                configExists: true,
                migrationCount: 1,
                seedFileExists: !!generatedFiles["supabase/seed.sql"],
            },
            tailwind: {
                configExists: !!tailwindConfig,
                validConfig: tailwindConfig ? (0, newparser_1.validateTailwindConfig)(tailwindConfig) : false,
            },
            hosting: "Azure Static Web Apps",
            features: ["Global CDN", "Auto SSL/HTTPS", "Custom domains support", "Staging environments"],
            streamingStats: {
                totalCharacters: totalLength,
                chunksStreamed: Math.floor(totalLength / CHUNK_SIZE),
            },
            supabaseConfig: {
                url: supabaseUrl,
                configured: true,
                filesIncluded: ["migrations", "seed", "types"]
            }
        };
        sendStreamingUpdate({
            type: "result",
            buildId,
            sessionId,
            result: finalResult,
        });
        res.end();
        console.log(`[${buildId}] ✅ Frontend generation and deployment completed successfully`);
    }
    catch (error) {
        console.error(`[${buildId}] ❌ Frontend generation failed:`, error);
        sendStreamingUpdate({
            type: "error",
            buildId,
            sessionId,
            error: error instanceof Error ? error.message : "Unknown error occurred during frontend generation",
        });
        // Save error to messageDB
        try {
            yield messageDB.addMessage(`Frontend generation failed: ${error instanceof Error ? error.message : "Unknown error"}`, "assistant", {
                projectId: projectId,
                sessionId: sessionId,
                userId: providedUserId,
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
// Legacy streaming endpoint (keeping for compatibility)
router.get("/generate-frontend-stream/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    // Set SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
    });
    // Send initial connection message
    res.write(`data: ${JSON.stringify({
        type: "connected",
        message: "Connected to frontend generation stream",
    })}\n\n`);
    try {
        const conversation = yield conversationService.getConversationByProject(parseInt(projectId));
        if (!conversation ||
            !conversation.designChoices ||
            !conversation.generatedFiles) {
            res.write(`data: ${JSON.stringify({
                type: "error",
                message: "Missing design choices or file structure",
            })}\n\n`);
            res.end();
            return;
        }
        // Extract needed data
        const designChoices = conversation.designChoices;
        const generatedFiles = conversation.generatedFiles;
        const fileStructure = generatedFiles.fileStructure;
        const backendFiles = {
            "supabase/migrations/001_initial_schema.sql": generatedFiles["supabase/migrations/001_initial_schema.sql"],
            "supabase/seed.sql": generatedFiles["supabase/seed.sql"],
            "src/types/index.ts": generatedFiles["src/types/index.ts"],
        };
        // Send progress updates
        const progressCallback = (progress) => {
            res.write(`data: ${JSON.stringify(Object.assign({ type: "progress" }, progress))}\n\n`);
        };
        // Start generation with progress callback
        res.write(`data: ${JSON.stringify({
            type: "progress",
            stage: "Starting frontend generation...",
            filesGenerated: [],
            totalSize: 0,
        })}\n\n`);
        const result = yield claudeService.generateFrontendFilesWithProgress(designChoices, fileStructure, backendFiles, conversation.userId.toString(), progressCallback);
        if (result.success) {
            // Update database
            const allFiles = Object.assign(Object.assign({}, generatedFiles), result.functionInput.files);
            yield conversationService.updateConversationByProject(parseInt(projectId), {
                currentStep: "frontend_completed",
                generatedFiles: allFiles,
            });
            // Send completion message
            res.write(`data: ${JSON.stringify({
                type: "completed",
                files: Object.keys(result.functionInput.files),
                fileCount: Object.keys(result.functionInput.files).length,
                message: "Frontend generation completed successfully!",
            })}\n\n`);
        }
        else {
            res.write(`data: ${JSON.stringify({
                type: "error",
                message: "Frontend generation failed",
                details: result,
            })}\n\n`);
        }
    }
    catch (error) {
        res.write(`data: ${JSON.stringify({
            type: "error",
            message: "Generation error occurred",
            details: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`);
    }
    res.end();
}));
exports.default = router;
//# sourceMappingURL=agents.js.map