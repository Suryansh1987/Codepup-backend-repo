// routes/modification.ts - Only essential routes
import express, { Request, Response } from "express";
import { StatelessIntelligentFileModifier } from "../services/filemodifier";
import { StatelessSessionManager } from "./session";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
import { RedisService } from "../services/Redis";
import { EnhancedProjectUrlManager } from "../db/url-manager";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import axios from "axios";
import * as fs from "fs";
import path from "path";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  runBuildAndDeploy,
} from "../services/azure-deploye_frontend1";
import Anthropic from "@anthropic-ai/sdk";
import { 
  resolveUserId, 
  getProjectSecrets, 
  resolveProjectByDeployedUrl
} from "../utils/helper-functions";;

const router = express.Router();

// Utility functions
async function downloadAndExtractProject(buildId: string, zipUrl: string): Promise<string> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

  try {
    console.log(`[${buildId}] Downloading project from: ${zipUrl}`);
    const response = await axios.get(zipUrl, { responseType: "stream" });
    const zipPath = path.join(__dirname, "../../temp-builds", `${buildId}-download.zip`);

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
    console.error(`[${buildId}] Failed to download and extract project:`, error);
    throw new Error(`Failed to download project: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    throw new Error(`Failed to write .env file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Initialize routes
export function initializeModificationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  redis: RedisService,
  sessionManager: StatelessSessionManager
): express.Router {
  const urlManager = new EnhancedProjectUrlManager(messageDB);

  // ONLY ESSENTIAL ROUTE: Streaming modification
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

    // Get project secrets
    const secrets = await getProjectSecrets(messageDB, requestedProjectId);
    if (!secrets) {
      res.status(400).json({
        success: false,
        error: `Failed to retrieve project secrets for projectId: ${requestedProjectId}`,
      });
      return;
    }

    let userId: number;
    try {
      userId = await resolveUserId(messageDB, providedUserId, sessionId);
      console.log(`[${buildId}] Resolved user ID: ${userId}`);
    } catch (error) {
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

    const sendEvent = (type: string, data: any) => {
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
        message: "Initializing modification system...",
        buildId,
        sessionId,
        userId,
      });

      // Project resolution
      const {
        projectId: resolvedProjectId,
        project: currentProject,
        matchReason,
      } = await resolveProjectByDeployedUrl(
        messageDB,
        userId,
        deployedUrl || currentUrl,
        sessionId,
        requestedProjectId || undefined
      );

      console.log(`[${buildId}] Project resolution: ${matchReason}`);

      if (resolvedProjectId) {
        console.log(`[${buildId}] ✅ Selected project: "${currentProject.name}" (ID: ${resolvedProjectId})`);
      } else {
        console.log(`[${buildId}] ⚠️ No existing project matched`);
      }

      sendEvent("progress", {
        step: 2,
        total: 10,
        message: resolvedProjectId ? `Found project: "${currentProject.name}"` : "No project found",
        buildId,
        sessionId,
        projectId: resolvedProjectId,
        projectName: currentProject?.name,
      });

      // Setup project environment
      let tempBuildDir: string = "";
      if (resolvedProjectId) {
        const projectUrls = await urlManager.getProjectUrls({ projectId: resolvedProjectId });
        if (projectUrls && projectUrls.zipUrl) {
          tempBuildDir = await downloadAndExtractProject(buildId, projectUrls.zipUrl);
        }
      }

      // Fallback to template if no project found
      if (!tempBuildDir) {
        const sourceTemplateDir = path.join(__dirname, "../../react-base");
        tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
        await fs.promises.mkdir(tempBuildDir, { recursive: true });
        await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
      }

      sendEvent("progress", {
        step: 3,
        total: 10,
        message: "Project environment ready!",
        buildId,
        sessionId,
      });

      // Initialize file modifier
      const fileModifier = new StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
      const startTime = Date.now();

      sendEvent("progress", {
        step: 4,
        total: 10,
        message: "Starting modification...",
        buildId,
        sessionId,
      });

      // Process modification
      const result = await fileModifier.processModification(
        prompt,
        undefined,
        currentProject?.description || "Project modification",
        async () => null // No summary saving for simplicity
      );

      if (result.success) {
        sendEvent("progress", {
          step: 5,
          total: 10,
          message: "Modification complete! Building...",
          buildId,
          sessionId,
        });

        try {
          // Write environment variables
          if (secrets?.aneonkey && secrets?.supabaseurl) {
            await writeEnvironmentVariables(tempBuildDir, secrets.aneonkey, secrets.supabaseurl);
          }

          // Create and upload zip
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
            step: 6,
            total: 10,
            message: "Building app...",
            buildId,
            sessionId,
          });

          // Build and deploy
          const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
            resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
            acrName: process.env.AZURE_ACR_NAME!,
            storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
          });

          const urls = JSON.parse(DistUrl);
          const builtZipUrl = urls.downloadUrl;

          sendEvent("progress", {
            step: 7,
            total: 10,
            message: "Deploying...",
            buildId,
            sessionId,
          });

          //@ts-ignore
          const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

          sendEvent("progress", {
            step: 8,
            total: 10,
            message: "Updating project...",
            buildId,
            sessionId,
          });

          // Update project URLs if we have a project
          if (resolvedProjectId) {
            try {
              await urlManager.saveNewProjectUrls(
                sessionId,
                resolvedProjectId,
                {
                  deploymentUrl: previewUrl as string,
                  downloadUrl: urls.downloadUrl,
                  zipUrl,
                },
                userId,
                {
                  name: currentProject?.name,
                  description: currentProject?.description,
                  framework: currentProject?.framework || "react",
                  template: currentProject?.template || "vite-react-ts",
                }
              );
              console.log(`[${buildId}] ✅ Updated project ${resolvedProjectId}`);
            } catch (updateError) {
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
          await cleanupTempDirectory(buildId);

          sendEvent("progress", {
            step: 10,
            total: 10,
            message: `🎉 Live at: ${previewUrl}`,
            buildId,
            sessionId,
          });

          // Send completion event
          sendEvent("complete", {
            success: true,
            data: {
              previewUrl,
              downloadUrl: urls.downloadUrl,
              zipUrl,
              buildId,
              sessionId,
              userId,
              projectId: resolvedProjectId,
              projectName: currentProject?.name,
            },
          });

          await fileModifier.cleanup();
        } catch (buildError) {
          console.error(`[${buildId}] Build pipeline failed:`, buildError);
          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);

          sendEvent("error", {
            success: false,
            error: "Build/deploy failed",
            buildId,
            sessionId,
            userId,
          });
        }
      } else {
        sendEvent("error", {
          success: false,
          error: result.error || "Modification failed",
          buildId,
          sessionId,
          userId,
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
        error: "Internal server error",
        buildId,
        sessionId,
        userId,
      });
    } finally {
      res.end();
    }
  });

  return router;
}