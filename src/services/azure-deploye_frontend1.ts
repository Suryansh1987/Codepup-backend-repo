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
    // Create the job with correct API version
    const jobDefinition = {
      location: "eastus", // Match the actual location
      properties: {
        environmentId: `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${config.resourceGroup}/providers/Microsoft.App/managedEnvironments/${config.containerAppEnv}`,
        configuration: {
          triggerType: "Manual",
          replicaTimeout: 900,
          replicaRetryLimit: 0,
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
          secrets: [
            {
              name: "acr-password",
              value: process.env.ACR_PASSWORD,
            },
          ],
        },
        template: {
          containers: [
            {
              image: `${config.acrName}.azurecr.io/react-builder:m2`,
              name: "react-builder",
              resources: {
                cpu: 2.0,
                memory: "4.0Gi",
              },
              env: [
                { name: "SOURCE_ZIP_URL", value: sourceZipUrl },
                { name: "BUILD_ID", value: buildId },
                {
                  name: "STORAGE_CONNECTION_STRING",
                  value: config.storageConnectionString,
                },
                {
                  name: "STORAGE_ACCOUNT_NAME",
                  value: config.storageAccountName,
                },
              ],
            },
          ],
        },
      },
    };

    // Use correct API version (2023-05-01)
    await axios.put(`${baseUrl}?api-version=2023-05-01`, jobDefinition, {
      headers,
    });

    // Start the job
    await axios.post(
      `${baseUrl}/start?api-version=2023-05-01`,
      {},
      { headers }
    );

    // Monitor execution
    let buildCompleted = false;
    let attempts = 0;

    while (attempts < 30 && !buildCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const response = await axios.get(
        `${baseUrl}/executions?api-version=2023-05-01`,
        { headers }
      );

      const executions = response.data.value;
      if (executions && executions.length > 0) {
        const status = executions[0].properties.status;
        console.log(`[${buildId}] Build job status: ${status}`);

        if (status === "Succeeded") {
          buildCompleted = true;
        } else if (status === "Failed") {
          throw new Error("Build job failed");
        }
      }
      attempts++;
    }

    // Clean up
    await axios.delete(`${baseUrl}?api-version=2023-05-01`, { headers });

    const downloadUrl = `https://${config.storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`;

    return JSON.stringify({ downloadUrl });
  } catch (error: any) {
    console.error(
      `[${buildId}] Job execution failed:`,
      error.response?.data || error.message
    );
    throw error;
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

export async function runBuildAndDeploy(zipUrl: string, buildId: string) {
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

    // Deploy to Vercel
    //@ts-ignore
    return await vercelDeploy({ outputPath: extractDir });
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
const vercelDeploy = ({ outputPath }: { outputPath: string }) => {
  console.log(outputPath, "this is the path which the vercel with deploy ");
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("Missing required Vercel environment variables");
  }

  const deployCommand = [
    "vercel",
    "deploy",
    `--token="${token}"`,
    "--yes",
    "--prod",
    `--cwd="${outputPath}"`,
  ].join(" ");

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