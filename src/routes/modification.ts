// routes/modification.ts - Complete Updated with Enhanced URL Manager and URL-based project resolution
import express, { Request, Response } from "express";
import { StatelessIntelligentFileModifier } from "../services/filemodifier";
import { StatelessSessionManager } from "./session";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
import { RedisService } from "../services/Redis";
import { EnhancedProjectUrlManager } from "../db/url-manager";
import { ModificationChange } from "../services/filemodifier/types";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import axios from "axios";
import * as fs from "fs";
import path from "path";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  deployToSWA,
  runBuildAndDeploy,
} from "../services/azure-deploye_frontend1";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

class StatelessConversationHelper {
  constructor(
    private messageDB: DrizzleMessageHistoryDB,
    private redis: RedisService
  ) {}

  async saveModification(sessionId: string, modification: any): Promise<void> {
    const change = {
      type: "modified" as const,
      file: "session_modification",
      description: `${modification.approach}: ${modification.prompt.substring(
        0,
        100
      )}...`,
      timestamp: new Date().toISOString(),
      prompt: modification.prompt,
      approach: modification.approach,
      filesModified: modification.filesModified || [],
      filesCreated: modification.filesCreated || [],
      success: modification.result?.success || false,
    };
    await this.redis.addModificationChange(sessionId, change);
  }

  async getEnhancedContext(sessionId: string): Promise<string> {
    // Try Redis first for fast access
    const cachedContext = await this.redis.getSessionState<string>(
      sessionId,
      "conversation_context"
    );
    if (cachedContext) {
      return cachedContext;
    }

    // Fall back to database
    const dbContext = await this.messageDB.getConversationContext();
    if (dbContext) {
      // Cache for next time
      await this.redis.setSessionState(
        sessionId,
        "conversation_context",
        dbContext
      );
      return dbContext;
    }

    return "";
  }

  async getConversationWithSummary(): Promise<any> {
    const conversation = await this.messageDB.getRecentConversation();
    return {
      messages: conversation.messages.map((msg: any) => ({
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
  }
}

// URL normalization for reliable matching
function normalizeUrl(url: string): string {
  if (!url) return "";

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
  } catch (error) {
    console.error("Error normalizing URL:", url, error);
    return url.toLowerCase();
  }
}

// Enhanced project resolution based on deployed URL
async function resolveProjectByDeployedUrl(
  messageDB: DrizzleMessageHistoryDB,
  urlManager: EnhancedProjectUrlManager,
  userId: number,
  deployedUrl?: string,
  sessionId?: string,
  projectId?: number
): Promise<{
  projectId: number | null;
  project: any | null;
  matchReason: string;
}> {
  try {
    // Extract project ID from URL if not provided
    let targetProjectId: number | null | undefined = projectId;
    if (!targetProjectId && deployedUrl) {
      targetProjectId = extractProjectIdFromUrl(deployedUrl);
      console.log(`📎 Extracted projectId from URL: ${targetProjectId}`);
    }
    const userProjects = await messageDB.getUserProjects(userId);

    if (userProjects.length === 0) {
      return {
        projectId: null,
        project: null,
        matchReason: "no_user_projects",
      };
    }

    // 🎯 NEW Priority 1: If projectId is provided, verify it matches the deployedUrl
    if (projectId && deployedUrl) {
      console.log(
        `🎯 Checking if provided projectId (${projectId}) matches deployedUrl (${deployedUrl})`
      );

      const specificProject = userProjects.find((p) => p.id === projectId);
      if (specificProject) {
        if (specificProject.deploymentUrl) {
          const normalizedTargetUrl = normalizeUrl(deployedUrl);
          const normalizedProjectUrl = normalizeUrl(
            specificProject.deploymentUrl
          );

          if (normalizedProjectUrl === normalizedTargetUrl) {
            console.log(
              `✅ Perfect match! ProjectId ${projectId} matches deployedUrl`
            );
            return {
              projectId: specificProject.id,
              project: specificProject,
              matchReason: "deployed_url_match",
            };
          } else {
            console.log(
              `⚠️ ProjectId ${projectId} exists but URL doesn't match:`
            );
            console.log(`  Expected: ${normalizedTargetUrl}`);
            console.log(`  Actual: ${normalizedProjectUrl}`);
          }
        } else {
          console.log(
            `⚠️ ProjectId ${projectId} exists but has no deployment URL`
          );
        }
      } else {
        console.log(`⚠️ ProjectId ${projectId} not found in user's projects`);
      }
    }

    // Priority 2: Match by deployed URL only (existing logic)
    if (deployedUrl) {
      console.log(
        `🔍 Looking for any project with deployed URL: ${deployedUrl}`
      );

      const normalizedTargetUrl = normalizeUrl(deployedUrl);

      const urlMatch = userProjects.find((project) => {
        if (!project.deploymentUrl) return false;

        const normalizedProjectUrl = normalizeUrl(project.deploymentUrl);
        const isMatch = normalizedProjectUrl === normalizedTargetUrl;

        if (isMatch) {
          console.log(
            `✅ URL match found: ${project.deploymentUrl} -> Project: ${project.name}`
          );
        }

        return isMatch;
      });

      if (urlMatch) {
        return {
          projectId: urlMatch.id,
          project: urlMatch,
          matchReason: "deployed_url_match",
        };
      } else {
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
        console.log(
          `✅ Using provided projectId ${projectId} without URL verification`
        );
        return {
          projectId: specificProject.id,
          project: specificProject,
          matchReason: "project_id_fallback",
        };
      }
    }

    // Priority 4: Try session-based matching as fallback
    if (sessionId) {
      const sessionProject = await messageDB.getProjectBySessionId(sessionId);
      if (
        sessionProject &&
        userProjects.find((p) => p.id === sessionProject.id)
      ) {
        console.log(
          `✅ Fallback to session project: ${sessionProject.id} (${sessionProject.name})`
        );
        return {
          projectId: sessionProject.id,
          project: sessionProject,
          matchReason: "session_fallback",
        };
      }
    }

    // Priority 5: Use most recent project as last resort
    const recentProject = userProjects[0];
    console.log(
      `⚠️ No matches found, using most recent project: ${recentProject.name}`
    );

    return {
      projectId: recentProject.id,
      project: recentProject,
      matchReason: "recent_fallback",
    };
  } catch (error) {
    console.error("❌ Failed to resolve project by URL:", error);
    return {
      projectId: null,
      project: null,
      matchReason: "resolution_error",
    };
  }
}

// FALLBACK USER RESOLUTION FUNCTION
async function resolveUserId(
  messageDB: DrizzleMessageHistoryDB,
  providedUserId?: number,
  sessionId?: string
): Promise<number> {
  try {
    // Priority 1: Use provided userId if valid
    if (
      providedUserId &&
      (await messageDB.validateUserExists(providedUserId))
    ) {
      return providedUserId;
    }

    // Priority 2: Get userId from session's most recent project
    if (sessionId) {
      const sessionProject = await messageDB.getProjectBySessionId(sessionId);
      if (sessionProject && sessionProject.userId) {
        return sessionProject.userId;
      }
    }

    // Priority 3: Get most recent user from any project
    const mostRecentUserId = await messageDB.getMostRecentUserId();
    if (
      mostRecentUserId &&
      (await messageDB.validateUserExists(mostRecentUserId))
    ) {
      return mostRecentUserId;
    }

    // Priority 4: Create a new user with current timestamp
    const newUserId = Date.now() % 1000000;
    await messageDB.ensureUserExists(newUserId, {
      email: `user${newUserId}@buildora.dev`,
      name: `User ${newUserId}`,
    });

    console.log(`✅ Created new user ${newUserId} as fallback`);
    return newUserId;
  } catch (error) {
    console.error("❌ Failed to resolve user ID:", error);
    throw new Error("Could not resolve or create user");
  }
}

// Utility functions
async function downloadAndExtractProject(
  buildId: string,
  zipUrl: string
): Promise<string> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

  try {
    console.log(`[${buildId}] Downloading project from: ${zipUrl}`);

    const response = await axios.get(zipUrl, { responseType: "stream" });
    const zipPath = path.join(
      __dirname,
      "../../temp-builds",
      `${buildId}-download.zip`
    );

    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", (err) => reject(err));
    });
    console.log(`[${buildId}] ZIP downloaded successfully`);

    const zip = new AdmZip(zipPath);
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    zip.extractAllTo(tempBuildDir, true);

    console.log(`[${buildId}] Project extracted to: ${tempBuildDir}`);

    await fs.promises.unlink(zipPath);

    return tempBuildDir;
  } catch (error) {
    console.error(
      `[${buildId}] Failed to download and extract project:`,
      error
    );
    throw new Error(
      `Failed to download project: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function cleanupTempDirectory(buildId: string): Promise<void> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  try {
    await fs.promises.rm(tempBuildDir, { recursive: true, force: true });
    console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
  } catch (error) {
    console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
  }
}

// NEW: Function to write environment variables before build
async function writeEnvironmentVariables(
  tempBuildDir: string,
  aneonKey: string,
  supabaseUrl: string
): Promise<void> {
  try {
    const envContent = `VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${aneonKey}
`;

    const envPath = path.join(tempBuildDir, ".env");
    await fs.promises.writeFile(envPath, envContent, "utf8");
    console.log(`✅ Environment variables written to: ${envPath}`);
  } catch (error) {
    console.error("❌ Failed to write environment variables:", error);
    throw new Error(
      `Failed to write .env file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
async function findProjectByUrl(
  messageDB: DrizzleMessageHistoryDB,
  userId: number,
  searchUrl: string
): Promise<any | null> {
  try {
    const userProjects = await messageDB.getUserProjects(userId);
    const normalizedSearchUrl = normalizeUrl(searchUrl);

    const match = userProjects.find((project) => {
      if (!project.deploymentUrl) return false;
      return normalizeUrl(project.deploymentUrl) === normalizedSearchUrl;
    });

    return match || null;
  } catch (error) {
    console.error("Error finding project by URL:", error);
    return null;
  }
}
function extractProjectIdFromUrl(url: string): number | null {
  try {
    // Example: https://myapp.com/project/123/dashboard
    const match = url.match(/\/project\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// Initialize routes with dependencies
export function initializeModificationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  redis: RedisService,
  sessionManager: StatelessSessionManager
): express.Router {
  const conversationHelper = new StatelessConversationHelper(messageDB, redis);
  const urlManager = new EnhancedProjectUrlManager(messageDB);

  // STATELESS STREAMING MODIFICATION ENDPOINT WITH URL-BASED RESOLUTION
  router.post("/stream", async (req: Request, res: Response): Promise<void> => {
    const {
      prompt,
      sessionId: clientSessionId,
      userId: providedUserId,
      currentUrl,
      deployedUrl,
      projectId: requestedProjectId,
    } = req.body;

    if (!prompt) {
      res.status(400).json({
        success: false,
        error: "Prompt is required",
      });
      return;
    }

    const sessionId = clientSessionId || sessionManager.generateSessionId();
    const buildId = uuidv4();

    const secrets = await messageDB.getProjectSecretsById(requestedProjectId);
    if (!secrets) {
      console.error(
        `[${buildId}] ❌ Failed to retrieve project secrets for projectId: `
      );

      return;
    }
    if (secrets) {
      const { aneonkey, supabaseurl } = secrets;

      console.log("Aneon Key:", aneonkey);
      console.log("Supabase URL:", supabaseurl);
    } else {
      console.log("No project found with that ID");
    }

    let userId: number;
    try {
      userId = await resolveUserId(messageDB, providedUserId, sessionId);
      console.log(
        `[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`
      );
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to resolve user for modification",
        details: error instanceof Error ? error.message : "Unknown error",
        buildId,
        sessionId,
      });
      return;
    }

    console.log(
      `[${buildId}] Starting modification for user: ${userId}, session: ${sessionId}`
    );
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

    const sendEvent = (type: string, data: any) => {
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
      const {
        projectId: projectId,
        project: currentProject,
        matchReason,
      } = await resolveProjectByDeployedUrl(
        messageDB,
        urlManager,
        userId,
        deployedUrl || currentUrl,
        sessionId,
        requestedProjectId || undefined
      );

      console.log(`[${buildId}] Project resolution result: ${matchReason}`);
      console.log(
        `[${buildId}] Target URL: ${
          deployedUrl || currentUrl || "none provided"
        }`
      );

      if (projectId) {
        console.log(
          `[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${projectId})`
        );
        console.log(
          `[${buildId}] Project URL: ${currentProject.deploymentUrl}`
        );
      } else {
        console.log(
          `[${buildId}] ⚠️ No existing project matched, will create new one`
        );
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
      } else if (matchReason === "session_fallback") {
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
      } else if (matchReason === "recent_fallback") {
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
      } else {
        sendEvent("progress", {
          step: 2,
          total: 16,
          message: "No existing project found. Starting fresh...",
          buildId,
          sessionId,
          matchReason,
        });
      }

      let sessionContext = await sessionManager.getSessionContext(sessionId);
      let tempBuildDir: string = "";
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
        const projectUrls = await urlManager.getProjectUrls({
          projectId: projectId,
        });
        if (projectUrls && projectUrls.zipUrl) {
          tempBuildDir = await downloadAndExtractProject(
            buildId,
            projectUrls.zipUrl
          );
          sessionContext = {
            buildId,
            tempBuildDir,
            projectSummary: {
              summary: currentProject?.description || "Project modification",
              zipUrl: projectUrls.zipUrl,
              buildId: projectUrls.buildId,
            },
            lastActivity: Date.now(),
          };
          await sessionManager.saveSessionContext(sessionId, sessionContext);
        }
      } else {
        // Fallback logic
        sendEvent("progress", {
          step: 3,
          total: 16,
          message: "No current project found. Checking Redis...",
          buildId,
          sessionId,
        });

        sessionContext = await sessionManager.getSessionContext(sessionId);

        if (sessionContext?.projectSummary?.zipUrl) {
          tempBuildDir = await downloadAndExtractProject(
            buildId,
            sessionContext.projectSummary.zipUrl
          );
        } else {
          const projectSummary = await messageDB.getActiveProjectSummary();

          if (projectSummary?.zipUrl) {
            tempBuildDir = await downloadAndExtractProject(
              buildId,
              projectSummary.zipUrl
            );
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
            await sessionManager.saveSessionContext(sessionId, sessionContext);
          } else {
            const sourceTemplateDir = path.join(__dirname, "../../react-base");
            tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
            await fs.promises.mkdir(tempBuildDir, { recursive: true });
            await fs.promises.cp(sourceTemplateDir, tempBuildDir, {
              recursive: true,
            });

            sessionContext = {
              buildId,
              tempBuildDir,
              lastActivity: Date.now(),
            };
            await sessionManager.saveSessionContext(sessionId, sessionContext);
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

      await sessionManager.updateSessionContext(sessionId, {
        buildId,
        tempBuildDir,
        lastActivity: Date.now(),
      });

      let enhancedPrompt = prompt;
      try {
        const context = await conversationHelper.getEnhancedContext(sessionId);
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
      } catch {
        sendEvent("progress", {
          step: 5,
          total: 16,
          message: "Continuing with fresh modification...",
          buildId,
          sessionId,
        });
      }

      const fileModifier = new StatelessIntelligentFileModifier(
        anthropic,
        tempBuildDir,
        sessionId
      );
      fileModifier.setStreamCallback((message) =>
        sendEvent("progress", {
          step: 7,
          total: 16,
          message,
          buildId,
          sessionId,
        })
      );

      sendEvent("progress", {
        step: 6,
        total: 16,
        message: "Starting intelligent modification...",
        buildId,
        sessionId,
      });

      const startTime = Date.now();

      const result = await fileModifier.processModification(
        enhancedPrompt,
        undefined,
        sessionContext?.projectSummary?.summary,
        async (summary, prompt) => {
          try {
            const summaryId = await messageDB.saveProjectSummary(
              summary,
              prompt,
              "",
              buildId,
              userId
            );
            console.log(`💾 Saved project summary, ID: ${summaryId}`);
            return summaryId;
          } catch (err) {
            console.error("⚠️ Error saving summary:", err);
            return null;
          }
        }
      );

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
          if (secrets?.aneonkey && secrets?.supabaseurl) {
            sendEvent("progress", {
              step: 9,
              total: 16,
              message: "Setting up environment variables...",
              buildId,
              sessionId,
            });
            await writeEnvironmentVariables(
              tempBuildDir,
              secrets.aneonkey,
              secrets.supabaseurl
            );
          }
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

          sendEvent("progress", {
            step: 10,
            total: 16,
            message: "Building app...",
            buildId,
            sessionId,
          });

          const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
            resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
            acrName: process.env.AZURE_ACR_NAME!,
            storageConnectionString:
              process.env.AZURE_STORAGE_CONNECTION_STRING!,
            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
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
          const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

          sendEvent("progress", {
            step: 12,
            total: 16,
            message: "Updating database...",
            buildId,
            sessionId,
          });

          await sessionManager.updateSessionContext(sessionId, {
            projectSummary: {
              ...sessionContext?.projectSummary,
              zipUrl,
              buildId,
            },
          });

          if (sessionContext?.projectSummary) {
            const projectSummary = await messageDB.getActiveProjectSummary();
            if (projectSummary) {
              await messageDB.updateProjectSummary(
                projectSummary.id,
                zipUrl,
                buildId
              );
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
          let urlResult: any = {
            action: "no_project_to_update",
            projectId: null,
          };

          if (projectId) {
            try {
              const updatedProjectId = await urlManager.saveNewProjectUrls(
                sessionId,
                projectId,
                {
                  deploymentUrl: previewUrl as string,
                  downloadUrl: urls.downloadUrl,
                  zipUrl,
                },
                userId,
                {
                  name: userProject?.name,
                  description: userProject?.description,
                  framework: userProject?.framework || "react",
                  template: userProject?.template || "vite-react-ts",
                }
              );

              urlResult = {
                action: "updated",
                projectId: updatedProjectId,
                skipReason: null,
              };
              console.log(
                `[${buildId}] ✅ Updated existing project: ${updatedProjectId}`
              );
            } catch (updateError) {
              console.error(
                `[${buildId}] ❌ Failed to update project URLs:`,
                updateError
              );
              urlResult = {
                action: "update_failed",
                projectId: projectId,
                error:
                  updateError instanceof Error
                    ? updateError.message
                    : "Unknown error",
              };
            }
          } else {
            console.warn(
              `[${buildId}] ⚠️ No current project ID available for update`
            );
          }

          sendEvent("progress", {
            step: 14,
            total: 16,
            message: "Cleaning up...",
            buildId,
            sessionId,
          });
          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);

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
              modifiedRanges:
                typeof result.modifiedRanges === "number"
                  ? result.modifiedRanges
                  : result.modifiedRanges?.length || 0,
              reasoning: result.reasoning,
              modificationSummary: result.modificationSummary,
              modificationDuration,
              totalDuration,
              totalFilesAffected:
                (result.selectedFiles?.length || 0) +
                (result.addedFiles?.length || 0),
              previewUrl,
              downloadUrl: urls.downloadUrl,
              zipUrl,
              buildId,
              sessionId,
              userId,
              projectId: urlResult.projectId || projectId,
              projectName: userProject?.name,
              projectAction: urlResult.action,
              projectMatchReason: matchReason,
              skipReason: urlResult.skipReason,
              duplicatePrevention:
                "URL-based project resolution with comprehensive duplicate checking",
              hosting: "Azure Static Web Apps",
              features: [
                "Global CDN",
                "Auto SSL/HTTPS",
                "Custom domains support",
                "Staging environments",
              ],
            },
          });

          await fileModifier.cleanup();
        } catch (buildError) {
          console.error(`[${buildId}] Build pipeline failed:`, buildError);
          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);

          sendEvent("complete", {
            success: true,
            data: {
              workflow: "url-based-project-resolution-build-error",
              approach: result.approach || "UNKNOWN",
              buildError:
                buildError instanceof Error
                  ? buildError.message
                  : "Build failed",
              buildId,
              sessionId,
              userId,
              projectId: projectId,
              projectName: userProject?.name,
              projectMatchReason: matchReason,
              message: "Modification completed, but build/deploy failed",
            },
          });
        }
      } else {
        sendEvent("error", {
          success: false,
          error: result.error || "Modification failed",
          approach: result.approach,
          reasoning: result.reasoning,
          buildId,
          sessionId,
          userId,
          projectId: projectId,
          projectName: userProject?.name,
          projectMatchReason: matchReason,
        });

        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);
        await fileModifier.cleanup();
      }
    } catch (error: any) {
      console.error(`[${buildId}] ❌ Error:`, error);
      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);

      sendEvent("error", {
        success: false,
        error: "Internal server error during modification",
        details: error.message,
        buildId,
        sessionId,
        userId,
      });
    } finally {
      res.end();
    }
  });

  // NON-STREAMING MODIFICATION ENDPOINT WITH URL-BASED RESOLUTION
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        prompt,
        sessionId: clientSessionId,
        userId: providedUserId,
        currentUrl, // NEW: Current page URL
        deployedUrl,
        projectId: requestedProjectId, // NEW: Deployed app URL
      } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          error: "Prompt is required",
        });
        return;
      }

      const sessionId = clientSessionId || sessionManager.generateSessionId();
      const buildId = uuidv4();

      const secrets = await messageDB.getProjectSecretsById(requestedProjectId);
      if (!secrets) {
        console.error(
          `[${buildId}] ❌ Failed to retrieve project secrets for projectId: `
        );

        return;
      }
      if (secrets) {
        const { aneonkey, supabaseurl } = secrets;

        console.log("Aneon Key:", aneonkey);
        console.log("Supabase URL:", supabaseurl);
      } else {
        console.log("No project found with that ID");
      }
      let userId: number;
      try {
        userId = await resolveUserId(messageDB, providedUserId, sessionId);
        console.log(
          `[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`
        );
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Failed to resolve user for modification",
          details: error instanceof Error ? error.message : "Unknown error",
          buildId,
          sessionId,
        });
        return;
      }

      console.log(
        `[${buildId}] Starting non-streaming modification for user: ${userId}`
      );
      console.log(`[${buildId}] Current URL: ${currentUrl || "not provided"}`);
      console.log(
        `[${buildId}] Deployed URL: ${deployedUrl || "not provided"}`
      );

      const cleanupTimer = setTimeout(() => {
        cleanupTempDirectory(buildId);
        sessionManager.cleanup(sessionId);
      }, 5 * 60 * 30000);

      try {
        // ENHANCED PROJECT RESOLUTION BY DEPLOYED URL
        const {
          projectId: currentProjectId,
          project: currentProject,
          matchReason,
        } = await resolveProjectByDeployedUrl(
          messageDB,
          urlManager,
          userId,
          deployedUrl || currentUrl,
          sessionId
        );

        console.log(`[${buildId}] Project resolution result: ${matchReason}`);
        console.log(
          `[${buildId}] Target URL: ${
            deployedUrl || currentUrl || "none provided"
          }`
        );

        if (currentProjectId) {
          console.log(
            `[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${currentProjectId})`
          );
          console.log(
            `[${buildId}] Project URL: ${currentProject.deploymentUrl}`
          );
        } else {
          console.log(
            `[${buildId}] ⚠️ No existing project matched, will create new one`
          );
        }

        // Enhanced project resolution using URL manager
        let sessionContext = await sessionManager.getSessionContext(sessionId);
        let tempBuildDir: string = "";
        let targetProject = currentProject;

        // Proper tempBuildDir assignment logic
        if (currentProjectId) {
          console.log(
            `[${buildId}] Using current project ID: ${currentProjectId}`
          );
          const projectUrls = await urlManager.getProjectUrls({
            projectId: currentProjectId,
          });
          if (projectUrls && projectUrls.zipUrl) {
            tempBuildDir = await downloadAndExtractProject(
              buildId,
              projectUrls.zipUrl
            );
            targetProject = currentProject;
            sessionContext = {
              buildId,
              tempBuildDir,
              projectSummary: {
                summary: currentProject?.description || "Project modification",
                zipUrl: projectUrls.zipUrl,
                buildId: projectUrls.buildId,
              },
              lastActivity: Date.now(),
            };
            await sessionManager.saveSessionContext(sessionId, sessionContext);
          } else {
            // Fallback if current project has no zipUrl
            console.log(
              `[${buildId}] Current project ${currentProjectId} has no zipUrl, using template`
            );
            const sourceTemplateDir = path.join(__dirname, "../../react-base");
            tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
            await fs.promises.mkdir(tempBuildDir, { recursive: true });
            await fs.promises.cp(sourceTemplateDir, tempBuildDir, {
              recursive: true,
            });
          }
        } else {
          // Fallback logic - check session context first
          sessionContext = await sessionManager.getSessionContext(sessionId);
          if (
            sessionContext &&
            sessionContext.projectSummary &&
            sessionContext.projectSummary.zipUrl
          ) {
            tempBuildDir = await downloadAndExtractProject(
              buildId,
              sessionContext.projectSummary.zipUrl
            );
          } else {
            // Check for active project summary
            const projectSummary = await messageDB.getActiveProjectSummary();

            if (projectSummary && projectSummary.zipUrl) {
              tempBuildDir = await downloadAndExtractProject(
                buildId,
                projectSummary.zipUrl
              );
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
              await sessionManager.saveSessionContext(
                sessionId,
                sessionContext
              );
            } else {
              // Final fallback - use template
              console.log(
                `[${buildId}] No existing project found, using template`
              );
              const sourceTemplateDir = path.join(
                __dirname,
                "../../react-base"
              );
              tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
              await fs.promises.mkdir(tempBuildDir, { recursive: true });
              await fs.promises.cp(sourceTemplateDir, tempBuildDir, {
                recursive: true,
              });

              sessionContext = {
                buildId,
                tempBuildDir,
                lastActivity: Date.now(),
              };
              await sessionManager.saveSessionContext(
                sessionId,
                sessionContext
              );
            }
          }
        }

        // Ensure tempBuildDir is assigned before continuing
        if (!tempBuildDir) {
          console.error(
            `[${buildId}] ❌ tempBuildDir not assigned, creating fallback`
          );
          const sourceTemplateDir = path.join(__dirname, "../../react-base");
          tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
          await fs.promises.mkdir(tempBuildDir, { recursive: true });
          await fs.promises.cp(sourceTemplateDir, tempBuildDir, {
            recursive: true,
          });

          sessionContext = {
            buildId,
            tempBuildDir,
            lastActivity: Date.now(),
          };
          await sessionManager.saveSessionContext(sessionId, sessionContext);
        }

        console.log(`[${buildId}] ✅ tempBuildDir assigned: ${tempBuildDir}`);

        // Update session
        await sessionManager.updateSessionContext(sessionId, {
          buildId,
          tempBuildDir,
          lastActivity: Date.now(),
        });

        // Get enhanced context
        let enhancedPrompt = prompt;
        try {
          const context = await conversationHelper.getEnhancedContext(
            sessionId
          );
          if (context) {
            enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
          }
        } catch (contextError) {
          console.error("Context loading error:", contextError);
        }

        // Initialize stateless file modifier
        const fileModifier = new StatelessIntelligentFileModifier(
          anthropic,
          tempBuildDir,
          sessionId
        );

        const startTime = Date.now();

        // Process modification
        const result = await fileModifier.processModification(
          enhancedPrompt,
          undefined,
          sessionContext?.projectSummary?.summary,
          async (summary: string, prompt: string) => {
            try {
              const summaryId = await messageDB.saveProjectSummary(
                summary,
                prompt,
                "",
                buildId,
                userId
              );
              console.log(`💾 Saved project summary, ID: ${summaryId}`);
              return summaryId;
            } catch (error) {
              console.error("⚠️ Error saving project summary:", error);
              return null;
            }
          }
        );

        const modificationDuration = Date.now() - startTime;

        if (result.success) {
          // Save modification to conversation history
          try {
            await conversationHelper.saveModification(sessionId, {
              prompt,
              result,
              approach: result.approach || "UNKNOWN",
              filesModified: result.selectedFiles || [],
              filesCreated: result.addedFiles || [],
              timestamp: new Date().toISOString(),
            });
          } catch (saveError) {
            console.error("Failed to save modification to history:", saveError);
          }

          // BUILD & DEPLOY PIPELINE
          try {
            console.log(`[${buildId}] Starting build pipeline...`);

            // Write environment variables before build
            if (secrets?.aneonkey && secrets?.supabaseurl) {
              console.log(`[${buildId}] Writing environment variables...`);
              await writeEnvironmentVariables(
                tempBuildDir,
                secrets.aneonkey,
                secrets.supabaseurl
              );
            }
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

            // Trigger Azure Container Job
            const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
              resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
              containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
              acrName: process.env.AZURE_ACR_NAME!,
              storageConnectionString:
                process.env.AZURE_STORAGE_CONNECTION_STRING!,
              storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
            });

            const urls = JSON.parse(DistUrl);
            const builtZipUrl = urls.downloadUrl;

            //@ts-ignore
            const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

            // Update session context with new ZIP URL
            await sessionManager.updateSessionContext(sessionId, {
              projectSummary: {
                ...sessionContext?.projectSummary,
                zipUrl: zipUrl,
                buildId: buildId,
              },
            });

            // Update database project summary
            if (sessionContext?.projectSummary) {
              const projectSummary = await messageDB.getActiveProjectSummary();
              if (projectSummary) {
                await messageDB.updateProjectSummary(
                  projectSummary.id,
                  zipUrl,
                  buildId
                );
              }
            }

            // USE ENHANCED URL MANAGER - UPDATE EXISTING PROJECT
            console.log(
              `[${buildId}] 💾 Using Enhanced URL Manager for modification...`
            );

            let urlResult: any = {
              action: "no_project_to_update",
              projectId: null,
            };

            if (currentProjectId) {
              try {
                const updatedProjectId = await urlManager.saveNewProjectUrls(
                  sessionId,
                  currentProjectId,
                  {
                    deploymentUrl: previewUrl as string,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: zipUrl,
                  },
                  userId,
                  {
                    name: targetProject?.name,
                    description: targetProject?.description,
                    framework: targetProject?.framework || "react",
                    template: targetProject?.template || "vite-react-ts",
                  }
                );

                urlResult = {
                  action: "updated",
                  projectId: updatedProjectId,
                  skipReason: null,
                };
                console.log(
                  `[${buildId}] ✅ Updated existing project: ${updatedProjectId}`
                );
              } catch (updateError) {
                console.error(
                  `[${buildId}] ❌ Failed to update project URLs:`,
                  updateError
                );
                urlResult = {
                  action: "update_failed",
                  projectId: currentProjectId,
                  error:
                    updateError instanceof Error
                      ? updateError.message
                      : "Unknown error",
                };
              }
            } else {
              console.warn(
                `[${buildId}] ⚠️ No current project ID available for update`
              );
            }

            // Cleanup
            clearTimeout(cleanupTimer);
            await cleanupTempDirectory(buildId);
            await fileModifier.cleanup();

            const totalDuration = Date.now() - startTime;

            res.json({
              success: true,
              data: {
                workflow: "url-based-project-resolution",
                approach: result.approach || "UNKNOWN",
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges:
                  typeof result.modifiedRanges === "number"
                    ? result.modifiedRanges
                    : result.modifiedRanges?.length || 0,
                conversationContext:
                  "Enhanced context with Redis-backed modification history",
                reasoning: result.reasoning,
                modificationSummary: result.modificationSummary,
                modificationDuration: modificationDuration,
                totalFilesAffected:
                  (result.selectedFiles?.length || 0) +
                  (result.addedFiles?.length || 0),
                previewUrl: previewUrl,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl,
                buildId: buildId,
                sessionId: sessionId,
                userId: userId,
                projectId: urlResult.projectId || currentProjectId,
                projectName: targetProject?.name,
                projectAction: urlResult.action,
                projectMatchReason: matchReason,
                skipReason: urlResult.skipReason,
                duplicatePrevention:
                  "URL-based project resolution with comprehensive duplicate checking",
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
          } catch (buildError) {
            console.error(`[${buildId}] Build pipeline failed:`, buildError);

            clearTimeout(cleanupTimer);
            await cleanupTempDirectory(buildId);
            await fileModifier.cleanup();

            res.json({
              success: true,
              data: {
                workflow: "url-based-project-resolution-build-error",
                approach: result.approach || "UNKNOWN",
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges:
                  typeof result.modifiedRanges === "number"
                    ? result.modifiedRanges
                    : result.modifiedRanges?.length || 0,
                buildError:
                  buildError instanceof Error
                    ? buildError.message
                    : "Build failed",
                buildId: buildId,
                sessionId: sessionId,
                userId: userId,
                projectId: currentProjectId,
                projectName: targetProject?.name,
                projectMatchReason: matchReason,
                message:
                  "Modification completed successfully, but build/deploy failed",
                projectState: currentProjectId
                  ? "existing_project_modified"
                  : "new_project_created",
                tempBuildDirPath: tempBuildDir,
              },
            });
          }
        } else {
          // Save failed attempts for learning
          try {
            await conversationHelper.saveModification(sessionId, {
              prompt,
              result,
              approach: result.approach || "UNKNOWN",
              filesModified: result.selectedFiles || [],
              filesCreated: result.addedFiles || [],
              timestamp: new Date().toISOString(),
            });
          } catch (saveError) {
            console.error(
              "Failed to save failed modification to history:",
              saveError
            );
          }

          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);
          await fileModifier.cleanup();

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
            projectName: targetProject?.name,
            projectMatchReason: matchReason,
            projectState: currentProjectId
              ? "existing_project_failed"
              : "new_project_failed",
            tempBuildDirPath: tempBuildDir,
          });
        }
      } catch (downloadError) {
        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);
        await sessionManager.cleanup(sessionId);

        res.status(500).json({
          success: false,
          error: "Failed to setup project environment",
          details:
            downloadError instanceof Error
              ? downloadError.message
              : "Unknown error",
          workflow: "url-based-project-resolution",
          buildId: buildId,
          sessionId: sessionId,
          userId: userId,
        });
      }
    } catch (error: any) {
      const buildId = uuidv4();
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
  });

  // GET USER'S PROJECTS ENDPOINT
  router.get(
    "/user/:userId/projects",
    async (req: Request, res: Response): Promise<void> => {
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
        const resolvedUserId = await resolveUserId(messageDB, userId);
        const projects = await messageDB.getUserProjects(resolvedUserId);

        // Get additional stats using URL manager
        const stats = await urlManager.getUserProjectStats(resolvedUserId);

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
          duplicatePrevention:
            "URL-based project resolution with comprehensive duplicate checking",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Failed to get user projects",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // GET PROJECT URLS ENDPOINT
  router.get(
    "/project/:projectId/urls",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { projectId } = req.params;
        const projectUrls = await urlManager.getProjectUrls({
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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Failed to get project URLs",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // NEW: ENDPOINT TO VERIFY URL-PROJECT MAPPING
  router.get(
    "/verify-url/:userId",
    async (req: Request, res: Response): Promise<void> => {
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

        const resolvedUserId = await resolveUserId(messageDB, userId);
        const project = await findProjectByUrl(
          messageDB,
          resolvedUserId,
          url as string
        );

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
            normalizedUrl: normalizeUrl(url as string),
            searchUrl: url as string,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Failed to verify URL-project mapping",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  return router;
}
