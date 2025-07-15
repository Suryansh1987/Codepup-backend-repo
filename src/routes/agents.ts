// routes/agents.ts (FIXED VERSION)
import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { agent1SystemPrompt } from "../defaults/starterAgentsPrompt";
import { ClaudeFunctionService } from "../services/agents/claude-function-service";
import { ConversationService } from "../services/conversation-service";
import multer from "multer";
const router = Router();

// Create an INSTANCE of the service (not static)
const claudeService = new ClaudeFunctionService();

const conversationService = new ConversationService();

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

    // console.log(`🔧 Generating design files for user ${userId}`);
    // console.log(
    //   `🎨 Final design:`,
    //   JSON.stringify(conversation.finalDesign, null, 2)
    // );

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
          stopReason: result.stopReason, // Add this to your handleFunctionCall
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

//@ts-ignore
router.post("/generate-frontend", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const conversation = await conversationService.getConversationByProject(
      projectId
    );
    if (
      !conversation ||
      !conversation.designChoices ||
      !conversation.generatedFiles
    ) {
      return res.status(400).json({
        error:
          "Missing design choices or file structure. Please complete previous steps first.",
      });
    }
    console.log("strated to extract data ");
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

    console.log(`🎨 Generating frontend for project ${projectId}`);
    console.log(`📋 File structure available:`, !!fileStructure);
    console.log(
      `🗄️ Backend files available:`,
      Object.keys(backendFiles).length
    );

    const result = await claudeService.generateFrontendFiles(
      designChoices,
      fileStructure,
      backendFiles,
      conversation.userId.toString()
    );

    if (result.success) {
      // Merge with existing files
      const allFiles = {
        ...generatedFiles,
        ...result.functionInput.files,
      };

      await conversationService.updateConversationByProject(projectId, {
        currentStep: "frontend_completed",
        generatedFiles: allFiles,
      });

      await conversationService.saveMessageByProject(projectId, {
        agentResponse: "Frontend application generated successfully!",
        functionCalled: "generate_frontend_application",
      });

      return res.json({
        success: true,
        step: "frontend_completed",
        files: result.functionInput.files,
        componentsSummary: result.functionInput.componentsSummary,
        technicalSpecs: result.functionInput.technicalSpecs,
        usageInstructions: result.functionInput.usageInstructions,
        newDependencies: result.functionInput.newDependencies || [],
        message: "Complete frontend application generated!",
        tokenused: result.tokenused,
      });
    } else {
      return res.status(500).json({
        error: "Failed to generate frontend files",
        details: result,
      });
    }
  } catch (error) {
    console.error("❌ Frontend generation error:", error);
    return res.status(500).json({
      error: "Failed to generate frontend application",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

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

export default router;
