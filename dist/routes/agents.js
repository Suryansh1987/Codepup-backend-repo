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
Object.defineProperty(exports, "__esModule", { value: true });
// routes/agents.ts (FIXED VERSION)
const express_1 = require("express");
const claude_function_service_1 = require("../services/agents/claude-function-service");
const conversation_service_1 = require("../services/conversation-service");
const router = (0, express_1.Router)();
// Create an INSTANCE of the service (not static)
const claudeService = new claude_function_service_1.ClaudeFunctionService();
const conversationService = new conversation_service_1.ConversationService();
// Step 1: Initial design analysis
//@ts-ignore
router.post("/analyze", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, userId, projectId } = req.body;
        if (!prompt || !userId) {
            return res.status(400).json({ error: "prompt and userId are required" });
        }
        console.log(`🎨 Starting design analysis for user ${userId}`);
        const result = yield claudeService.analyzeDesign(prompt, userId);
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
        // console.log(`🔧 Generating design files for user ${userId}`);
        // console.log(
        //   `🎨 Final design:`,
        //   JSON.stringify(conversation.finalDesign, null, 2)
        // );
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
                    stopReason: result.stopReason, // Add this to your handleFunctionCall
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
// Get all conversations for a user (across projects)
// router.get(
//   "/user/:userId/conversations",
//   async (req: Request, res: Response) => {
//     const { userId } = req.params;
//     try {
//       const conversations = await conversationService.getUserConversations(
//         userId
//       );
//       return res.json({
//         success: true,
//         conversations: conversations.map((conv) => ({
//           projectId: conv.projectId,
//           step: conv.currentStep,
//           hasFiles: !!conv.generatedFiles,
//           lastUpdated: conv.updatedAt,
//         })),
//       });
//     } catch (error) {
//       console.error("❌ Error getting user conversations:", error);
//       return res
//         .status(500)
//         .json({ error: "Failed to get user conversations" });
//     }
//   }
// );
exports.default = router;
//# sourceMappingURL=agents.js.map