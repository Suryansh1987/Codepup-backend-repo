// routes/agents.ts (COMPLETE VERSION with generation route integration)
import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { agent1SystemPrompt } from "../defaults/starterAgentsPrompt";
import { ClaudeFunctionService } from "../services/agents/claude-function-service";
import { ConversationService } from "../services/conversation-service";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import AdmZip from "adm-zip";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  runBuildAndDeploy,
} from "../services/azure-deploy_fullstack";
import {
  parseFrontendCode,
  validateTailwindConfig,
  processTailwindProject,
  generateProjectSummary,
  ParsedResult,
} from "../utils/newparser";
import { StatelessSessionManager } from "./session";

const router = Router();
import LLMCodeParser from "../utils/updated_parser";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";

// Create an INSTANCE of the service (not static)
const claudeService = new ClaudeFunctionService();
const conversationService = new ConversationService();

// Initialize with dependencies (should be passed from main server)
let messageDB: DrizzleMessageHistoryDB;
let sessionManager: StatelessSessionManager;

// Function to initialize dependencies
export function initializeAgentRoutes(
  anthropic: Anthropic,
  db: DrizzleMessageHistoryDB,
  sessionMgr: StatelessSessionManager
): Router {
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CLAUDE_VISION_LIMITS.maxFileSize,
    files: CLAUDE_VISION_LIMITS.maxImages,
  },
  //@ts-ignore
  fileFilter: (req, file, cb) => {
    if (CLAUDE_VISION_LIMITS.supportedFormats.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        //@ts-ignore
        new Error(
          `Unsupported format. Use: ${CLAUDE_VISION_LIMITS.supportedFormats.join(
            ", "
          )}`
        ),
        false
      );
    }
  },
});

function validateAndOptimizeImage(buffer: Buffer, filename: string) {
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
async function cleanupTempDirectory(buildId: string): Promise<void> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  try {
    if (fs.existsSync(tempBuildDir)) {
      await fs.promises.rm(tempBuildDir, { recursive: true, force: true });
      console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
    }
  } catch (error) {
    console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
  }
}

function scheduleCleanup(buildId: string, delayInHours: number = 1): void {
  const delayMs = delayInHours * 60 * 60 * 1000;
  setTimeout(async () => {
    console.log(`[${buildId}] 🕐 Scheduled cleanup starting after ${delayInHours} hour(s)`);
    await cleanupTempDirectory(buildId);
  }, delayMs);
  console.log(`[${buildId}] ⏰ Cleanup scheduled for ${delayInHours} hour(s) from now`);
}

// Step 1: Initial design analysis
router.post(
  "/analyze",
  upload.array("images", CLAUDE_VISION_LIMITS.maxImages),
  //@ts-ignore
  async (req: Request, res: Response) => {
    try {
      const { prompt, userId, projectId } = req.body;
      //@ts-ignore
      const files = req.files as Express.Multer.File[];

      if (!prompt || !userId) {
        return res
          .status(400)
          .json({ error: "prompt and userId are required" });
      }
      console.log(`🎨 Starting design analysis for user ${userId}`);
      console.log(`📸 Processing ${files?.length || 0} images`);

      // Process images without saving them
      const imageData =
        files?.map((file) => {
          const validation = validateAndOptimizeImage(
            file.buffer,
            file.originalname
          );
          return {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size,
            estimatedTokens: validation.estimatedTokens,
          };
        }) || [];

      console.log(`🎨 Starting design analysis for user ${userId}`);

      const result = await claudeService.analyzeDesign(
        prompt,
        userId,
        imageData
      );

      if (result.success) {
        let conversation = await conversationService.getConversationByProject(
          projectId
        );
        if (!conversation) {
          conversation = await conversationService.createConversation(
            userId,
            projectId
          );
        }
        // Save conversation state
        await conversationService.updateConversationByProject(projectId, {
          currentStep: result.step,
          designChoices: result.designChoices,
        });
        await conversationService.saveMessageByProject(projectId, {
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
      } else {
        return res.status(500).json({
          error: "Failed to analyze design",
          details: result,
        });
      }
    } catch (error) {
      console.error("❌ Design analysis error:", error);
      return res.status(500).json({
        error: "Failed to analyze design",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Step 2: Handle user feedback
//@ts-ignore
router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const { feedback, userId, projectId } = req.body;

    if (!feedback || !userId) {
      return res
        .status(400)
        .json({ error: "feedback and userId are required" });
    }

    const conversation = await conversationService.getConversationByProject(
      projectId
    );
    if (!conversation) {
      return res.status(400).json({
        error:
          "No conversation found for this project. Please start with /analyze first.",
      });
    }

    console.log(`💬 Processing feedback for user ${userId}: ${feedback}`);

    const result = await claudeService.handleUserFeedback(
      feedback,
      conversation.userId.toString(),
      conversation.designChoices
    );

    if (result.success) {
      // 🔥 Update by projectId
      const updates: any = {
        currentStep: result.step,
      };

      if (result.designChoices) {
        updates.designChoices = result.designChoices;
      }

      await conversationService.updateConversationByProject(projectId, updates);

      // Save the message
      await conversationService.saveMessageByProject(projectId, {
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
    } else {
      return res.status(500).json({
        error: "Failed to process feedback",
        details: result,
      });
    }
  } catch (error) {
    console.error("❌ Feedback processing error:", error);
    return res.status(500).json({
      error: "Failed to process feedback",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Step 3: Generate design files
//@ts-ignore
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const conversation = await conversationService.getConversationByProject(
      projectId
    );
    if (!conversation || !conversation.designChoices) {
      return res.status(400).json({
        error: "No finalized design found for this project.",
      });
    }

    const result = await claudeService.generateDesignFiles(
      conversation.designChoices,
      conversation.userId.toString()
    );

    console.log(`📊 Generation result:`, {
      success: result.success,
      hasFiles: !!result.files,
      functionCalled: result.functionCalled,
      error: result.error,
    });

    if (result.success) {
      // 🔥 Update by projectId
      await conversationService.updateConversationByProject(projectId, {
        currentStep: "completed",
        generatedFiles: result.files,
      });

      // Save the message
      await conversationService.saveMessageByProject(projectId, {
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
    } else {
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
  } catch (error) {
    console.error("❌ File generation error:", error);
    return res.status(500).json({
      error: "Failed to generate design files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

//@ts-ignore
router.get("/status/:projectId", async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const conversation = await conversationService.getConversationByProject(
      parseInt(projectId)
    );

    if (!conversation) {
      return res
        .status(404)
        .json({ error: "No conversation found for this project" });
    }

    const messages = await conversationService.getMessagesByProject(
      parseInt(projectId)
    );

    return res.json({
      success: true,
      step: conversation.currentStep,
      hasDesignChoices: !!conversation.designChoices,
      hasGeneratedFiles: !!conversation.generatedFiles,
      messageCount: messages.length,
      lastUpdated: conversation.updatedAt,
    });
  } catch (error) {
    console.error("❌ Status error:", error);
    return res.status(500).json({ error: "Failed to get conversation status" });
  }
});

//@ts-ignore
router.post("/plan-structure", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const conversation = await conversationService.getConversationByProject(
      projectId
    );
    if (!conversation || !conversation.designChoices) {
      return res.status(400).json({
        error:
          "No design choices found. Please complete the design analysis first.",
      });
    }

    console.log(`📋 Planning file structure for project ${projectId}`);

    // Step 1: Generate file structure plan
    const structureResult = await claudeService.generateFileStructurePlan(
      conversation.designChoices,
      conversation.userId.toString()
    );

    if (!structureResult.success) {
      return res.status(500).json({
        error: "Failed to generate file structure plan",
        details: structureResult,
      });
    }

    // Step 2: Update documentation
    const docResult = await claudeService.updateDocumentationWithStructure(
      conversation.designChoices,
      structureResult.functionInput,
      conversation.userId.toString()
    );

    if (docResult.success) {
      // Update conversation
      const allFiles = {
        //@ts-ignore
        ...conversation.generatedFiles,
        fileStructure: structureResult.functionInput,
        ...docResult.functionInput.updatedFiles,
      };

      await conversationService.updateConversationByProject(projectId, {
        currentStep: "structure_planned",
        generatedFiles: allFiles,
      });

      await conversationService.saveMessageByProject(projectId, {
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
    } else {
      return res.status(500).json({
        error: "Failed to update documentation",
        details: docResult,
      });
    }
  } catch (error) {
    console.error("❌ File structure planning error:", error);
    return res.status(500).json({
      error: "Failed to plan file structure",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

//@ts-ignore
router.post("/generate-backend", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const conversation = await conversationService.getConversationByProject(
      projectId
    );
    if (!conversation || !conversation.designChoices) {
      return res.status(400).json({
        error:
          "No design choices found. Please complete the design analysis first.",
      });
    }

    // Check if file structure exists
    const generatedFiles = conversation.generatedFiles as any;
    if (!generatedFiles?.fileStructure) {
      return res.status(400).json({
        error: "No file structure found. Please run plan-structure first.",
      });
    }

    console.log(`🏗️ Generating backend files for project ${projectId}`);

    // Generate backend files using the Backend Generator Agent
    const backendResult = await claudeService.generateBackendFiles(
      conversation.designChoices,
      generatedFiles.fileStructure,
      conversation.userId.toString()
    );

    if (!backendResult.success) {
      return res.status(500).json({
        error: "Failed to generate backend files",
        details: backendResult,
      });
    }

    // Merge with existing files
    const allFiles = {
      ...generatedFiles,
      ...backendResult.functionInput.files,
    };

    // Update conversation with backend files
    await conversationService.updateConversationByProject(projectId, {
      currentStep: "backend_completed",
      generatedFiles: allFiles,
    });

    // Save the message
    await conversationService.saveMessageByProject(projectId, {
      agentResponse: "Backend files generated successfully",
      functionCalled: "generate_backend_files",
    });

    return res.json({
      success: true,
      step: "backend_completed",
      files: backendResult.functionInput.files,
      databaseSchema: backendResult.functionInput.databaseSchema,
      summary: backendResult.functionInput.summary,
      message:
        "Backend files generated successfully! Migration, seed data, and TypeScript types are ready.",
      tokenused: backendResult.tokenused,
      filesPaths: {
        migration: "supabase/migrations/001_initial_schema.sql",
        seed: "supabase/seed.sql",
        types: "src/types/index.ts",
      },
    });
  } catch (error) {
    console.error("❌ Backend generation error:", error);
    return res.status(500).json({
      error: "Failed to generate backend files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

//@ts-ignore
router.get("/schema/:projectId", async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const conversation = await conversationService.getConversationByProject(
      parseInt(projectId)
    );

    if (!conversation) {
      return res.status(404).json({ error: "Project not found" });
    }

    const generatedFiles = conversation.generatedFiles as any;

    // Check if backend files exist
    const hasBackend = !!(
      generatedFiles?.["supabase/migrations/001_initial_schema.sql"] &&
      generatedFiles?.["supabase/seed.sql"] &&
      generatedFiles?.["src/types/index.ts"]
    );

    return res.json({
      success: true,
      hasBackend,
      step: conversation.currentStep,
      //@ts-ignore
      businessType: conversation.designChoices?.businessType,
      tables: generatedFiles?.databaseSchema?.tables || [],
      relationships: generatedFiles?.databaseSchema?.relationships || [],
    });
  } catch (error) {
    console.error("❌ Schema info error:", error);
    return res.status(500).json({ error: "Failed to get schema info" });
  }
});

// Streaming frontend generation - from generation route pattern
//@ts-ignore
router.post("/generate-frontend", async (req: Request, res: Response) => {
  const {
    projectId,
    supabaseUrl,
    supabaseAnonKey,
    supabaseToken,
    databaseUrl,
    userId: providedUserId,
    clerkId,
  } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseToken || !databaseUrl) {
    return res.status(400).json({ 
      error: "All Supabase configuration fields are required (supabaseUrl, supabaseAnonKey, supabaseToken, databaseUrl)" 
    });
  }

  // Initialize buildId and session here (like generation route)
  const buildId = uuidv4();
  const sessionId = sessionManager.generateSessionId();
  const sourceTemplateDir = path.join(__dirname, "../../react-base");
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
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

  const sendStreamingUpdate = (data: any) => {
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
    await sessionManager.saveSessionContext(sessionId, {
      buildId,
      tempBuildDir: "",
      lastActivity: Date.now(),
    });

    // USER RESOLUTION with Clerk ID support (similar to generation route)
    let userId: number;
    try {
      if (clerkId) {
        const existingUser = await messageDB.getUserByClerkId(clerkId);
        if (existingUser) {
          userId = existingUser.id;
          console.log(`[${buildId}] Found user by Clerk ID: ${userId}`);
        } else {
          console.log(`[${buildId}] Creating new user with Clerk ID: ${clerkId}`);
          userId = await messageDB.createUserWithClerkId({
            clerkId: clerkId,
            email: `${clerkId}@clerk.dev`,
            name: "User",
          });
          console.log(`[${buildId}] Created new user: ${userId}`);
        }
      } else if (providedUserId) {
        const userExists = await messageDB.validateUserExists(providedUserId);
        if (userExists) {
          userId = providedUserId;
          console.log(`[${buildId}] Using provided user ID: ${userId}`);
        } else {
          await messageDB.ensureUserExists(providedUserId);
          userId = providedUserId;
          console.log(`[${buildId}] Created user with ID: ${userId}`);
        }
      } else {
        const fallbackUserId = Date.now() % 1000000;
        await messageDB.ensureUserExists(fallbackUserId);
        userId = fallbackUserId;
        console.log(`[${buildId}] Created fallback user: ${userId}`);
      }

      console.log(`[${buildId}] Resolved user ID: ${userId}`);
    } catch (error) {
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

    const conversation = await conversationService.getConversationByProject(projectId);
    
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
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
    console.log(`[${buildId}] ✅ Base template copied to ${tempBuildDir}`);

    await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

    sendStreamingUpdate({
      type: "progress",
      buildId,
      sessionId,
      phase: "initializing",
      message: "Base template copied, writing configuration files...",
      percentage: 10,
    });

    const generatedFiles = conversation.generatedFiles as any;

    // Write configuration files (from old route)
    if (generatedFiles["tailwind.config.ts"]) {
      await fs.promises.writeFile(
        path.join(tempBuildDir, "tailwind.config.ts"),
        generatedFiles["tailwind.config.ts"]
      );
      console.log(`[${buildId}] ✅ Written: tailwind.config.ts`);
    }
    
    if (generatedFiles["/src/index.css"]) {
      await fs.promises.mkdir(path.join(tempBuildDir, "src"), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempBuildDir, "src/index.css"),
        generatedFiles["/src/index.css"]
      );
      console.log(`[${buildId}] ✅ Written: src/index.css`);
    }
    
    // Write Supabase files
    console.log(`[${buildId}] 📦 Writing Supabase files...`);
    
    if (generatedFiles["supabase/migrations/001_initial_schema.sql"]) {
      await fs.promises.mkdir(path.join(tempBuildDir, "supabase/migrations"), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempBuildDir, "supabase/migrations/001_initial_schema.sql"),
        generatedFiles["supabase/migrations/001_initial_schema.sql"]
      );
      console.log(`[${buildId}] ✅ Written: supabase/migrations/001_initial_schema.sql`);
    }
    
    if (generatedFiles["supabase/seed.sql"]) {
      await fs.promises.writeFile(
        path.join(tempBuildDir, "supabase/seed.sql"),
        generatedFiles["supabase/seed.sql"]
      );
      console.log(`[${buildId}] ✅ Written: supabase/seed.sql`);
    }
    
    if (generatedFiles["src/types/index.ts"]) {
      await fs.promises.mkdir(path.join(tempBuildDir, "src/types"), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempBuildDir, "src/types/index.ts"),
        generatedFiles["src/types/index.ts"]
      );
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
      "supabase/migrations/001_initial_schema.sql":
        generatedFiles["supabase/migrations/001_initial_schema.sql"],
      "supabase/seed.sql": generatedFiles["supabase/seed.sql"],
      "src/types/index.ts": generatedFiles["src/types/index.ts"],
    };

    console.log(`[${buildId}] 🎨 Generating frontend for project ${projectId}`);

    // Generate frontend files with Claude
    const result = await claudeService.generateFrontendFiles(
      designChoices,
      fileStructure,
      backendFiles,
      userId.toString(),
      tailwindConfig,
      indexCss
    );

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
    const claudeResponse = (result.content[0] as any).text;
    const parsedResult = LLMCodeParser.parseFrontendCode(claudeResponse);
    
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
    const fileMap: { [path: string]: string } = {};

    for (const file of parsedResult.codeFiles) {
      try {
        const fullPath = path.join(tempBuildDir, file.path);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, file.content, "utf8");
        fileMap[file.path] = file.content;
        console.log(`[${buildId}] ✅ Written: ${file.path}`);
        filesWritten++;
      } catch (writeError) {
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
    await sessionManager.cacheProjectFiles(sessionId, fileMap);

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
    const zip = new AdmZip();
    zip.addLocalFolder(tempBuildDir);
    const zipBuffer = zip.toBuffer();

    const zipBlobName = `${buildId}/source.zip`;
    const zipUrl = await uploadToAzureBlob(
      process.env.AZURE_STORAGE_CONNECTION_STRING!,
      "source-zips",
      zipBlobName,
      zipBuffer
    );

    sendStreamingUpdate({
      type: "progress",
      buildId,
      sessionId,
      phase: "deploying",
      message: "Source uploaded, building and deploying...",
      percentage: 85,
    });

    // Generate project summary
    const projectSummary = generateProjectSummary({
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
        tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig) : false,
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

    await sessionManager.updateSessionContext(sessionId, {
      projectSummary: {
        structure: parsedResult.structure,
        summary: projectSummary,
        validation: {
          fileStructure: true,
          supabase: true,
          tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig) : false,
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
    const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
      resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
      containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
      acrName: process.env.AZURE_ACR_NAME!,
      storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
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
    const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId, {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
    });

    // Update conversation with all files
    const allFiles = {
      ...generatedFiles,
      buildId: buildId,
      tempBuildDir: tempBuildDir,
    };

    // Add parsed files to the conversation
    parsedResult.codeFiles.forEach(file => {
      allFiles[file.path] = file.content;
    });

    await conversationService.updateConversationByProject(projectId, {
      currentStep: "frontend_completed",
      generatedFiles: allFiles,
    });

    await conversationService.saveMessageByProject(projectId, {
      agentResponse: `Frontend application generated successfully! ${filesWritten} files written and deployed.`,
      functionCalled: "generate_frontend_application",
    });

    // Save assistant response to message history with structure
    try {
      const assistantMessageId = await messageDB.addMessage(
        structureForDescription, // Store the enhanced structure as message content
        "assistant",
        {
          projectId: projectId,
          sessionId: sessionId,
          userId: userId,
          functionCalled: "frontend_generation",
          buildId: buildId,
          previewUrl: previewUrl,
          downloadUrl: urls.downloadUrl,
          zipUrl: zipUrl,
        }
      );
      console.log(`[${buildId}] 💾 Saved enhanced structure to messageDB (ID: ${assistantMessageId})`);
    } catch (dbError) {
      console.warn(`[${buildId}] ⚠️ Failed to save structure to messageDB:`, dbError);
    }

    // Update project record with deployment URLs
    try {
      await messageDB.updateProject(projectId, {
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
    } catch (updateError) {
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
        tailwindConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig) : false,
      },
      supabase: {
        filesFound: Object.keys(backendFiles).length,
        configExists: true,
        migrationCount: 1,
        seedFileExists: !!generatedFiles["supabase/seed.sql"],
      },
      tailwind: {
        configExists: !!tailwindConfig,
        validConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig) : false,
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

  } catch (error) {
    console.error(`[${buildId}] ❌ Frontend generation failed:`, error);
    
    sendStreamingUpdate({
      type: "error",
      buildId,
      sessionId,
      error: error instanceof Error ? error.message : "Unknown error occurred during frontend generation",
    });

    // Save error to messageDB
    try {
      await messageDB.addMessage(
        `Frontend generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "assistant",
        {
          projectId: projectId,
          sessionId: sessionId,
          userId: providedUserId,
          functionCalled: "frontend_generation",
          buildId: buildId,
        }
      );
    } catch (dbError) {
      console.warn(`[${buildId}] ⚠️ Failed to save error to messageDB:`, dbError);
    }

    // Cleanup on error
    await sessionManager.cleanup(sessionId);
    await cleanupTempDirectory(buildId);
    res.end();
  }
});

// Legacy streaming endpoint (keeping for compatibility)
router.get("/generate-frontend-stream/:projectId",
  async (req: Request, res: Response) => {
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
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        message: "Connected to frontend generation stream",
      })}\n\n`
    );

    try {
      const conversation = await conversationService.getConversationByProject(
        parseInt(projectId)
      );

      if (
        !conversation ||
        !conversation.designChoices ||
        !conversation.generatedFiles
      ) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: "Missing design choices or file structure",
          })}\n\n`
        );
        res.end();
        return;
      }

      // Extract needed data
      const designChoices = conversation.designChoices;
      const generatedFiles = conversation.generatedFiles as any;
      const fileStructure = generatedFiles.fileStructure;
      const backendFiles = {
        "supabase/migrations/001_initial_schema.sql":
          generatedFiles["supabase/migrations/001_initial_schema.sql"],
        "supabase/seed.sql": generatedFiles["supabase/seed.sql"],
        "src/types/index.ts": generatedFiles["src/types/index.ts"],
      };

      // Send progress updates
      const progressCallback = (progress: any) => {
        res.write(
          `data: ${JSON.stringify({
            type: "progress",
            ...progress,
          })}\n\n`
        );
      };

      // Start generation with progress callback
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          stage: "Starting frontend generation...",
          filesGenerated: [],
          totalSize: 0,
        })}\n\n`
      );

      const result = await claudeService.generateFrontendFilesWithProgress(
        designChoices,
        fileStructure,
        backendFiles,
        conversation.userId.toString(),
        progressCallback
      );

      if (result.success) {
        // Update database
        const allFiles = {
          ...generatedFiles,
          ...result.functionInput.files,
        };

        await conversationService.updateConversationByProject(
          parseInt(projectId),
          {
            currentStep: "frontend_completed",
            generatedFiles: allFiles,
          }
        );

        // Send completion message
        res.write(
          `data: ${JSON.stringify({
            type: "completed",
            files: Object.keys(result.functionInput.files),
            fileCount: Object.keys(result.functionInput.files).length,
            message: "Frontend generation completed successfully!",
          })}\n\n`
        );
      } else {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: "Frontend generation failed",
            details: result,
          })}\n\n`
        );
      }
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Generation error occurred",
          details: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`
      );
    }

    res.end();
  }
);

export default router;