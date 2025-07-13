// This file contains helper functions for Azure deployment
// fuck this
import { BlobServiceClient } from "@azure/storage-blob";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
const execPromise = promisify(exec);
import { ContainerAppsAPIClient } from "@azure/arm-appcontainers";
import { DefaultAzureCredential } from "@azure/identity";
import axios from "axios";

// Upload files to Azure Blob Storage
export async function uploadToAzureBlob(
  connectionString: string, // Keep for backward compatibility
  containerName: string,
  blobName: string,
  data: Buffer
): Promise<string> {
  let blobServiceClient: BlobServiceClient;

  // In production, use managed identity
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_MANAGED_IDENTITY === "true"
  ) {
    const credential = new DefaultAzureCredential();
    const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
    blobServiceClient = new BlobServiceClient(
      `https://${storageAccountName}.blob.core.windows.net`,
      credential
    );
  } else {
    // In development, use connection string
    blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
  }

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(data, data.length);
  return blockBlobClient.url;
}
// Trigger Azure Container App Job to build the project

export async function triggerAzureContainerJob(
  sourceZipUrl: string,
  buildId: string,
  config: {
    resourceGroup: string;
    containerAppEnv: string;
    acrName: string;
    storageConnectionString: string;
    storageAccountName: string;
    supabaseToken?: string;
    databaseUrl?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }
): Promise<string> {
  const buildJobName = `build-${buildId.substring(0, 8)}`;

  // Get access token
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(
    "https://management.azure.com/.default"
  );

  const baseUrl = `https://management.azure.com/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${config.resourceGroup}/providers/Microsoft.App/jobs/${buildJobName}`;

  const headers = {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
  };

  try {
    // ✅ Correct secrets with proper names
    const secrets = [
      {
        name: "acr-password",
        value: process.env.ACR_PASSWORD,
      },
      {
        name: "storage-connection-string",
        value: config.storageConnectionString,
      },
    ];

    // Add Supabase secrets if provided
    if (config.supabaseToken) {
      secrets.push({
        name: "supabase-token",
        value: config.supabaseToken,
      });
    }
    if (config.databaseUrl) {
      secrets.push({
        name: "database-url",
        value: config.databaseUrl,
      });
    }

    // ✅ Correct environment variables with proper secret references
    const envVars = [
      { name: "SOURCE_ZIP_URL", value: sourceZipUrl },
      { name: "BUILD_ID", value: buildId },
      {
        name: "STORAGE_CONNECTION_STRING",
        secretRef: "storage-connection-string", // ✅ Correct secret name
      },
      {
        name: "STORAGE_ACCOUNT_NAME",
        value: config.storageAccountName,
      },
    ];

    // Add Supabase environment variables if provided
    if (config.supabaseToken) {
      envVars.push({
        name: "SUPABASE_TOKEN",
        secretRef: "supabase-token", // ✅ Correct secret name
      });
    }
    if (config.databaseUrl) {
      envVars.push({
        name: "DATABASE_URL",
        secretRef: "database-url", // ✅ Correct secret name
      });
    }
    if (config.supabaseUrl) {
      envVars.push({
        name: "VITE_SUPABASE_URL",
        value: config.supabaseUrl,
      });
    }
    if (config.supabaseAnonKey) {
      envVars.push({
        name: "VITE_SUPABASE_ANON_KEY",
        value: config.supabaseAnonKey,
      });
    }

    const jobDefinition = {
      location: "eastus",
      properties: {
        environmentId: `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${config.resourceGroup}/providers/Microsoft.App/managedEnvironments/${config.containerAppEnv}`,
        configuration: {
          triggerType: "Manual",
          replicaTimeout: 1800, // 30 minutes
          replicaRetryLimit: 1,
          manualTriggerConfig: {
            parallelism: 1,
            replicaCompletionCount: 1,
          },
          registries: [
            {
              server: `${config.acrName}.azurecr.io`,
              username: process.env.ACR_USERNAME,
              passwordSecretRef: "acr-password",
            },
          ],
          secrets: secrets, // ✅ Use the correct secrets array
        },
        template: {
          containers: [
            {
              image: `${config.acrName}.azurecr.io/react-builder:m7`, // ✅ Use your latest image
              name: "react-builder",
              resources: {
                cpu: 2.0,
                memory: "4.0Gi",
              },
              env: envVars, // ✅ Use the correct env vars array
            },
          ],
        },
      },
    };

    console.log(`[${buildId}] Creating job with Supabase support...`);

    // Create job
    const createResponse = await axios.put(
      `${baseUrl}?api-version=2023-05-01`,
      jobDefinition,
      { headers }
    );
    console.log(
      `[${buildId}] Job created successfully:`,
      createResponse.status
    );
    // Start the job
    const startResponse = await axios.post(
      `${baseUrl}/start?api-version=2023-05-01`,
      {},
      { headers }
    );
    console.log(`[${buildId}] Job started:`, startResponse.status);

    // Monitor execution
    let buildCompleted = false;
    let attempts = 0;
    let lastExecutionName = "";

    while (attempts < 45 && !buildCompleted) {
      // Increased to 45 attempts (7.5 minutes)
      await new Promise((resolve) => setTimeout(resolve, 10000));

      try {
        const response = await axios.get(
          `${baseUrl}/executions?api-version=2023-05-01`,
          { headers }
        );

        const executions = response.data.value;
        if (executions && executions.length > 0) {
          const execution = executions[0];
          const executionName = execution.name;
          const status = execution.properties.status;
          const startTime = execution.properties.startTime;
          const endTime = execution.properties.endTime;

          console.log(
            `[${buildId}] Build job status: ${status} (attempt ${
              attempts + 1
            }/45)`
          );
          console.log(`[${buildId}] Execution: ${executionName}`);
          console.log(`[${buildId}] Start time: ${startTime}`);
          if (endTime) console.log(`[${buildId}] End time: ${endTime}`);

          if (status === "Succeeded") {
            console.log(`[${buildId}] ✅ Build completed successfully!`);
            buildCompleted = true;
          } else if (status === "Failed") {
            // Get logs for debugging
            console.error(`[${buildId}] ❌ Build job failed`);
            if (execution.properties.error) {
              console.error(
                `[${buildId}] Error details:`,
                execution.properties.error
              );
            }
            throw new Error(`Build job failed. Check logs for details.`);
          }
        } else {
          console.log(`[${buildId}] No executions found yet...`);
        }
      } catch (monitorError) {
        console.error(
          `[${buildId}] Error monitoring job:`,
          //@ts-ignore
          monitorError.response?.data || monitorError.message
        );
      }

      attempts++;
    }

    if (!buildCompleted) {
      throw new Error(
        `Build job timed out after ${attempts} attempts (${
          attempts * 10
        } seconds)`
      );
    }

    // Clean up
    try {
      await axios.delete(`${baseUrl}?api-version=2023-05-01`, { headers });
      console.log(`[${buildId}] Job cleaned up successfully`);
    } catch (cleanupError) {
      console.warn(
        `[${buildId}] Warning: Could not clean up job:`,
        //@ts-ignore
        cleanupError.message
      );
    }

    const downloadUrl = `https://${config.storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`;
    console.log(`[${buildId}] Final download URL: ${downloadUrl}`);

    return JSON.stringify({ downloadUrl });
  } catch (error: any) {
    console.error(`[${buildId}] Job execution failed:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config?.url,
    });
    throw error;
  }
}

// Enhanced logging function
async function getContainerLogs(
  baseJobUrl: string,
  executionName: string,
  headers: any,
  buildId: string
): Promise<void> {
  try {
    console.log(
      `[${buildId}] 📋 Fetching execution details for: ${executionName}`
    );

    // First, get the execution details to check status
    const executionUrl = `${baseJobUrl}/executions/${executionName}?api-version=2023-05-01`;

    const executionResponse = await axios.get(executionUrl, {
      headers,
      timeout: 10000,
    });

    if (executionResponse.data) {
      console.log(
        `[${buildId}] Execution Status:`,
        executionResponse.data.properties?.status
      );
      console.log(
        `[${buildId}] Start Time:`,
        executionResponse.data.properties?.startTime
      );
      console.log(
        `[${buildId}] End Time:`,
        executionResponse.data.properties?.endTime
      );

      // Log any error details if available
      if (executionResponse.data.properties?.error) {
        console.error(
          `[${buildId}] Execution Error:`,
          executionResponse.data.properties.error
        );
      }
    }

    // Note: Direct container logs aren't available via REST API
    // You need to query Log Analytics or use Azure CLI
    console.log(`[${buildId}] 📋 To view container logs, use Azure CLI:`);
    console.log(
      `az containerapp job logs show --name ${buildId.substring(
        0,
        8
      )} --resource-group ${process.env.AZURE_RESOURCE_GROUP} --type console`
    );
  } catch (error: any) {
    console.warn(`[${buildId}] ⚠️ Could not fetch execution details:`, {
      message: error.message,
      status: error.response?.status,
    });
  }
}
export async function deployToSWA(
  zipUrl: string,
  buildId: string
): Promise<{ previewUrl: string; downloadUrl: string }> {
  console.log(`[${buildId}] Starting SWA deployment from ZIP: ${zipUrl}`);

  const tempDir = path.join(__dirname, "../../temp", buildId);
  const tempZipPath = path.join(tempDir, "build.zip");
  const extractDir = path.join(tempDir, "extract");

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    console.log(`[${buildId}] Downloading ZIP...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: ${response.statusText}`);
    }
    const zipBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));

    console.log(`[${buildId}] Extracting ZIP...`);
    await fs.promises.mkdir(extractDir, { recursive: true });

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(extractDir, true);

    const swaConfig = {
      navigationFallback: {
        rewrite: "/index.html",
        exclude: ["/assets/*", "/*.{css,js,ico,png,jpg,jpeg,gif,svg,json}"],
      },
      mimeTypes: {
        ".json": "application/json",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
      },
      responseOverrides: {
        "404": {
          rewrite: "/index.html",
        },
      },
    };

    await fs.promises.writeFile(
      path.join(extractDir, "staticwebapp.config.json"),
      JSON.stringify(swaConfig, null, 2)
    );

    console.log(`[${buildId}] Files to deploy:`);
    const files = await fs.promises.readdir(extractDir);
    console.log(files);

    // Generate unique environment name
    const shortId = buildId
      .substring(0, 6)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const timestamp = Date.now().toString().slice(-4);
    const previewEnvName = `pr${shortId}${timestamp}`;

    console.log(
      `[${buildId}] Deploying to SWA preview environment: ${previewEnvName}...`
    );
    const deployCommand = `npx @azure/static-web-apps-cli@latest deploy "${extractDir}" --deployment-token "${process.env.AZURE_SWA_DEPLOYMENT_TOKEN}" --env "${previewEnvName}" --verbose`;

    const { stdout, stderr } = await execPromise(deployCommand, {
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    console.log(`[${buildId}] SWA Deploy output:`, stdout);
    if (stderr) {
      console.error(`[${buildId}] SWA Deploy stderr:`, stderr);
    }

    console.log(`[${buildId}] Waiting for deployment to propagate...`);
    await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

    // Construct the preview URL with the correct pattern
    const defaultHostname = process.env.AZURE_SWA_DEFAULT_HOSTNAME || "";
    const parts = defaultHostname.replace("https://", "").split(".");
    const appName = parts[0]; // "kind-smoke-0feea4310"
    const location = parts[1]; // "6"

    // Preview URLs include the region name (centralus)
    const previewUrl = `https://${appName}-${previewEnvName}.centralus.${location}.azurestaticapps.net`;

    console.log(`[${buildId}] Preview URL: ${previewUrl}`);

    return {
      previewUrl,
      downloadUrl: zipUrl,
    };
  } finally {
    // Cleanup
    console.log(`[${buildId}] Cleaning up temporary files...`);
    await fs.promises
      .rm(tempDir, { recursive: true, force: true })
      .catch(() => {});
  }
}

export async function runBuildAndDeploy(
  zipUrl: string,
  buildId: string,
  envVars: Record<string, string>
) {
  console.log(`[${buildId}] Starting vercel deployment from ZIP: ${zipUrl}`);

  const tempDir = path.join(__dirname, "../../temp", buildId);
  const tempZipPath = path.join(tempDir, "build.zip");
  const extractDir = path.join(tempDir, "extract");
  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    console.log(`[${buildId}] Downloading ZIP...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: ${response.statusText}`);
    }

    const zipBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));

    console.log(`[${buildId}] Extracting ZIP...`);
    await fs.promises.mkdir(extractDir, { recursive: true });

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(extractDir, true);

    // Add vercel.json configuration
    const vercelConfig = {
  outputDirectory: ".",
  headers: [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "ALLOWALL",
        },
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors *;",
        },
      ],
    },
  ],
  rewrites: [
    {
      source: "/(.*)",
      destination: "/index.html",
    },
  ],
};
    await fs.promises.writeFile(
      path.join(extractDir, "vercel.json"),
      JSON.stringify(vercelConfig, null, 2)
    );
    console.log("✅ Added vercel.json configuration");

    const deployedUrl = await vercelDeploy({
      outputPath: extractDir,
      envVars,
    });
    // Deploy to Vercel
    //@ts-ignore
    return deployedUrl as string;
  } catch (error) {
    console.error("❌ Build and Deploy pipeline failed:", error);
    throw error;
  } finally {
    console.log(`[${buildId}] Cleaning up temporary files...`);
    // await fs.promises
    //   .rm(tempDir, { recursive: true, force: true })
    //   .catch(() => {});
    // Clean up the ephemeral Docker image to prevent clutter
  }
}
const vercelDeploy = ({
  outputPath,
  envVars,
}: {
  outputPath: string;
  envVars?: Record<string, string>;
}) => {
  console.log(outputPath, "this is the path which the vercel with deploy ");
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("Missing required Vercel environment variables");
  }
  const envFlags = envVars
    ? Object.entries(envVars)
        .map(
          ([key, value]) =>
            `--build-env ${key}="${value}" --env ${key}="${value}"`
        )
        .join(" ")
    : "";

  const deployCommand = [
    "vercel",
    "deploy",
    `--token="${token}"`,
    "--yes",
    "--prod",
    `--cwd="${outputPath}"`,
    envFlags,
  ]
    .filter(Boolean)
    .join(" ");

  return new Promise((resolve, reject) => {
    exec(
      deployCommand,
      {
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_TOKEN: token,
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Vercel deploy failed:", stderr);
          reject(stderr);
        } else {
          console.log("✅ Vercel deploy output:", stdout);
          // Extract the final URL from the output
          const match = stdout.match(/https?:\/\/[^\s]+\.vercel\.app/);
          const deployedUrl = match ? match[0] : null;
          if (deployedUrl) {
            resolve(deployedUrl);
          } else {
            reject("❌ No URL found in Vercel output");
          }
        }
      }
    );
  });
};
// Helper function to fetch deployment info
async function fetchDeploymentInfo(
  storageAccountName: string,
  buildId: string
): Promise<any> {
  const url = `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/deployment-info.json`;
  const response = await fetch(url);
  if (!response.ok) {
    // Fallback URLs if deployment info not found
    return {
      previewUrl: `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`,
      downloadUrl: `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`,
    };
  }
  return response.json();
}
