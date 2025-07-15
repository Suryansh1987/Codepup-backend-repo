// routes/generation.ts - Simplified for 4-table schema
import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import * as fs from "fs";
import path from "path";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  runBuildAndDeploy,
} from "../services/azure-deploy_fullstack";
import { EnhancedProjectUrlManager } from "../db/url-manager";
import {
  parseFrontendCode,
  validateTailwindConfig,
  processTailwindProject,
  generateProjectSummary,
  ParsedResult,
} from "../utils/newparser";
import Anthropic from "@anthropic-ai/sdk";
import { pro5Enhanced2, pro5Enhanced3 } from "../defaults/promt";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
import { StatelessSessionManager } from "./session";
import { resolveUserId, getProjectSecrets } from "../utils/helper-functions";

const router = express.Router();

interface FileData {
  path: string;
  content: string;
}

interface CreateProjectInput {
  userId: number;
  name: string;
  description: string;
  status: string;
  projectType: string;
  deploymentUrl: string;
  downloadUrl: string;
  zipUrl: string;
  buildId: string;
  lastSessionId: string;
  framework: string;
  template: string;
  lastMessageAt: Date;
  messageCount: number;
  supabaseurl?: string;
  aneonkey?: string;
}

interface StreamingProgressData {
  type: "progress" | "length" | "chunk" | "complete" | "error";
  buildId: string;
  sessionId: string;
  totalLength?: number;
  currentLength?: number;
  percentage?: number;
  chunk?: string;
  phase?: "generating" | "parsing" | "processing" | "deploying" | "complete";
  message?: string;
  error?: string;
}

// Helper functions
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

function sendStreamingUpdate(res: Response, data: StreamingProgressData): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function initializeGenerationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  sessionManager: StatelessSessionManager
): express.Router {
  const urlManager = new EnhancedProjectUrlManager(messageDB);

  // Streaming endpoint
 router.post("/stream", async (req: Request, res: Response): Promise<void> => {
  const {
    prompt,
    projectId,
    supabaseToken,
    databaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    userId: providedUserId,
    clerkId, // Add this to handle Clerk ID from frontend
  } = req.body;

  if (!prompt) {
    res.status(400).json({
      success: false,
      error: "Prompt is required",
    });
    return;
  }

  const buildId = uuidv4();
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

  // UPDATED USER RESOLUTION - Use Clerk ID approach
  let userId: number;
  try {
    if (clerkId) {
      // Try to find user by Clerk ID first
      const existingUser = await messageDB.getUserByClerkId(clerkId);
      if (existingUser) {
        userId = existingUser.id;
        console.log(`[${buildId}] Found user by Clerk ID: ${userId}`);
      } else {
        // Create user with Clerk ID if provided but not found
        console.log(`[${buildId}] Creating new user with Clerk ID: ${clerkId}`);
        userId = await messageDB.createUserWithClerkId({
          clerkId: clerkId,
          email: `${clerkId}@clerk.dev`,
          name: "User",
        });
        console.log(`[${buildId}] Created new user: ${userId}`);
      }
    } else if (providedUserId) {
      // Fallback to old approach if no Clerk ID
      const userExists = await messageDB.validateUserExists(providedUserId);
      if (userExists) {
        userId = providedUserId;
        console.log(`[${buildId}] Using provided user ID: ${userId}`);
      } else {
        // Create user with provided ID
        await messageDB.ensureUserExists(providedUserId);
        userId = providedUserId;
        console.log(`[${buildId}] Created user with ID: ${userId}`);
      }
    } else {
      // Last resort - create a fallback user
      const fallbackUserId = Date.now() % 1000000;
      await messageDB.ensureUserExists(fallbackUserId);
      userId = fallbackUserId;
      console.log(`[${buildId}] Created fallback user: ${userId}`);
    }

    console.log(`[${buildId}] Resolved user ID: ${userId}`);
  } catch (error) {
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

  // Rest of your code remains the same...
  console.log(`[${buildId}] Starting streaming generation for prompt: "${prompt.substring(0, 100)}..."`);
  
    const sourceTemplateDir = path.join(__dirname, "../../react-base");
    const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
    let finalProjectId: number = projectId || 0;
    let projectSaved = false;
    let accumulatedResponse = "";
    let totalLength = 0;
    const CHUNK_SIZE = 10000;

    try {
      // Save initial session context
      await sessionManager.saveSessionContext(sessionId, {
        buildId,
        tempBuildDir: "",
        lastActivity: Date.now(),
      });

      // Setup temp directory
      await fs.promises.mkdir(tempBuildDir, { recursive: true });
      await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

      sendStreamingUpdate(res, {
        type: "progress",
        buildId,
        sessionId,
        phase: "generating",
        message: "Temp directory created, starting Claude generation...",
        percentage: 5,
      });

      await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

      // Create or update project record
      if (projectId) {
        console.log(`[${buildId}] 🔄 Updating existing project ${projectId}...`);
        try {
          await messageDB.updateProject(projectId, {
            name: `Updated Project ${buildId.substring(0, 8)}`,
            description: `Updated: ${prompt.substring(0, 100)}...`,
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
          console.log(`[${buildId}] ✅ Updated existing project record: ${finalProjectId}`);
        } catch (updateError) {
          console.error(`[${buildId}] ❌ Failed to update existing project:`, updateError);
        }
      } else {
        console.log(`[${buildId}] 💾 Creating new project record...`);
        try {
          finalProjectId = await messageDB.createProject({
            userId,
            name: `Generated Project ${buildId.substring(0, 8)}`,
            description: `React project generated from prompt: ${prompt.substring(0, 100)}...`,
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
        } catch (projectError) {
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
      const frontendResult = await anthropic.messages
        .stream({
          model: "claude-sonnet-4-0",
          max_tokens: 60000,
          temperature: 1,
          system: pro5Enhanced3,
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

      const resp = await frontendResult.finalMessage();
      const claudeResponse = (resp.content[0] as any).text;

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
      let parsedResult: ParsedResult;
      try {
        console.log(`[${buildId}] 📝 Parsing generated code...`);
        parsedResult = parseFrontendCode(claudeResponse);
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
      } catch (parseError) {
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
      const processedProject = processTailwindProject(parsedResult.codeFiles);
      const {
        processedFiles,
        validationResult,
        supabaseValidation,
        tailwindConfig,
        supabaseFiles,
      } = processedProject;

      sendStreamingUpdate(res, {
        type: "progress",
        buildId,
        sessionId,
        phase: "processing",
        message: `Validation complete. Writing ${processedFiles.length} files to disk...`,
        percentage: 80,
      });

      const parsedFiles: FileData[] = processedFiles;

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
      const fileMap: { [path: string]: string } = {};

      // Write files
      for (const file of parsedFiles) {
        try {
          const fullPath = path.join(tempBuildDir, file.path);
          await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.promises.writeFile(fullPath, file.content, "utf8");
          fileMap[file.path] = file.content;
          console.log(`[${buildId}] ✅ Written: ${file.path}`);
        } catch (writeError) {
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
      await sessionManager.cacheProjectFiles(sessionId, fileMap);

      sendStreamingUpdate(res, {
        type: "progress",
        buildId,
        sessionId,
        phase: "deploying",
        message: "Files written. Creating zip and starting deployment...",
        percentage: 85,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`[${buildId}] 📦 Creating zip and uploading to Azure...`);
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

      sendStreamingUpdate(res, {
        type: "progress",
        buildId,
        sessionId,
        phase: "deploying",
        message: "Source uploaded. Building and deploying...",
        percentage: 90,
      });

      // Generate project summary
      const projectSummary = generateProjectSummary({
        codeFiles: processedFiles,
        structure: parsedResult.structure,
      });

      // Update session context
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          structure: parsedResult.structure,
          summary: projectSummary,
          validation: {
            fileStructure: validationResult,
            supabase: supabaseValidation,
            tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false,
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

      // Deploy to Azure Static Web Apps
      console.log(`[${buildId}] 🚀 Deploying to SWA...`);
      const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId, {
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

      // Save assistant response to message history
      try {
        const assistantMessageId = await messageDB.addMessage(
          JSON.stringify({
            structure: parsedResult.structure,
            summary: projectSummary,
            validation: {
              fileStructure: validationResult.isValid,
              supabase: supabaseValidation.isValid,
              tailwind: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false,
            },
          }),
          "assistant",
          {
            projectId: finalProjectId,
            sessionId: sessionId,
            userId: userId,
            functionCalled: "frontend_generation",
            buildId: buildId,
            previewUrl: previewUrl,
            downloadUrl: urls.downloadUrl,
            zipUrl: zipUrl,
          }
        );
        console.log(`[${buildId}] 💾 Saved enhanced summary to messageDB (ID: ${assistantMessageId})`);
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save summary to messageDB:`, dbError);
      }

      // Update project URLs using Enhanced URL Manager
      console.log(`[${buildId}] 💾 Using Enhanced URL Manager to save project URLs...`);
      if (finalProjectId && projectSaved) {
        try {
          await urlManager.saveNewProjectUrls(
            sessionId,
            finalProjectId,
            {
              deploymentUrl: previewUrl as string,
              downloadUrl: urls.downloadUrl,
              zipUrl: zipUrl,
            },
            userId,
            {
              name: `Generated Project ${buildId.substring(0, 8)}`,
              description: `React project with enhanced validation`,
              framework: "react",
              template: "vite-react-ts",
            }
          );
          console.log(`[${buildId}] ✅ Enhanced URL Manager - Successfully updated project ${finalProjectId}`);
        } catch (projectError) {
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
          tailwindConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false,
        },
        supabase: {
          filesFound: supabaseFiles.allSupabaseFiles.length,
          configExists: !!supabaseFiles.configFile,
          migrationCount: supabaseFiles.migrationFiles.length,
          seedFileExists: !!supabaseFiles.seedFile,
        },
        tailwind: {
          configExists: !!tailwindConfig,
          validConfig: tailwindConfig ? validateTailwindConfig(tailwindConfig.content) : false,
        },
        hosting: "Azure Static Web Apps",
        features: ["Global CDN", "Auto SSL/HTTPS", "Custom domains support", "Staging environments"],
        streamingStats: {
          totalCharacters: totalLength,
          chunksStreamed: Math.floor(totalLength / CHUNK_SIZE),
        },
      };

      res.write(
        `data: ${JSON.stringify({
          type: "result",
          buildId,
          sessionId,
          result: finalResult,
        })}\n\n`
      );

      res.end();
      console.log(`[${buildId}] ✅ Streaming build process completed successfully`);
    } catch (error) {
      console.error(`[${buildId}] ❌ Streaming build process failed:`, error);

      sendStreamingUpdate(res, {
        type: "error",
        buildId,
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Save error to messageDB
      try {
        await messageDB.addMessage(
          `Frontend generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "assistant",
          {
            projectId: finalProjectId,
            sessionId: sessionId,
            userId: userId,
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

  // Non-streaming endpoint placeholder
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    res.json({
      success: false,
      error: "Use /stream endpoint for generation",
    });
  });

  return router;
}