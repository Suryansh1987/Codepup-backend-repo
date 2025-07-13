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
exports.uploadToAzureBlob = uploadToAzureBlob;
exports.triggerAzureContainerJob = triggerAzureContainerJob;
exports.deployToSWA = deployToSWA;
exports.runBuildAndDeploy = runBuildAndDeploy;
// This file contains helper functions for Azure deployment
// fuck this
const storage_blob_1 = require("@azure/storage-blob");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
const identity_1 = require("@azure/identity");
const axios_1 = __importDefault(require("axios"));
// Upload files to Azure Blob Storage
function uploadToAzureBlob(connectionString, // Keep for backward compatibility
containerName, blobName, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let blobServiceClient;
        // In production, use managed identity
        if (process.env.NODE_ENV === "production" ||
            process.env.USE_MANAGED_IDENTITY === "true") {
            const credential = new identity_1.DefaultAzureCredential();
            const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
            blobServiceClient = new storage_blob_1.BlobServiceClient(`https://${storageAccountName}.blob.core.windows.net`, credential);
        }
        else {
            // In development, use connection string
            blobServiceClient =
                storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        }
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        yield blockBlobClient.upload(data, data.length);
        return blockBlobClient.url;
    });
}
// Trigger Azure Container App Job to build the project
function triggerAzureContainerJob(sourceZipUrl, buildId, config) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const buildJobName = `build-${buildId.substring(0, 8)}`;
        // Get access token
        const credential = new identity_1.DefaultAzureCredential();
        const token = yield credential.getToken("https://management.azure.com/.default");
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
            yield axios_1.default.put(`${baseUrl}?api-version=2023-05-01`, jobDefinition, {
                headers,
            });
            // Start the job
            yield axios_1.default.post(`${baseUrl}/start?api-version=2023-05-01`, {}, { headers });
            // Monitor execution
            let buildCompleted = false;
            let attempts = 0;
            while (attempts < 30 && !buildCompleted) {
                yield new Promise((resolve) => setTimeout(resolve, 10000));
                const response = yield axios_1.default.get(`${baseUrl}/executions?api-version=2023-05-01`, { headers });
                const executions = response.data.value;
                if (executions && executions.length > 0) {
                    const status = executions[0].properties.status;
                    console.log(`[${buildId}] Build job status: ${status}`);
                    if (status === "Succeeded") {
                        buildCompleted = true;
                    }
                    else if (status === "Failed") {
                        throw new Error("Build job failed");
                    }
                }
                attempts++;
            }
            // Clean up
            yield axios_1.default.delete(`${baseUrl}?api-version=2023-05-01`, { headers });
            const downloadUrl = `https://${config.storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`;
            return JSON.stringify({ downloadUrl });
        }
        catch (error) {
            console.error(`[${buildId}] Job execution failed:`, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    });
}
function deployToSWA(zipUrl, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] Starting SWA deployment from ZIP: ${zipUrl}`);
        const tempDir = path_1.default.join(__dirname, "../../temp", buildId);
        const tempZipPath = path_1.default.join(tempDir, "build.zip");
        const extractDir = path_1.default.join(tempDir, "extract");
        try {
            yield fs.promises.mkdir(tempDir, { recursive: true });
            console.log(`[${buildId}] Downloading ZIP...`);
            const response = yield fetch(zipUrl);
            if (!response.ok) {
                throw new Error(`Failed to download ZIP: ${response.statusText}`);
            }
            const zipBuffer = yield response.arrayBuffer();
            yield fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));
            console.log(`[${buildId}] Extracting ZIP...`);
            yield fs.promises.mkdir(extractDir, { recursive: true });
            const zip = new adm_zip_1.default(tempZipPath);
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
            yield fs.promises.writeFile(path_1.default.join(extractDir, "staticwebapp.config.json"), JSON.stringify(swaConfig, null, 2));
            console.log(`[${buildId}] Files to deploy:`);
            const files = yield fs.promises.readdir(extractDir);
            console.log(files);
            // Generate unique environment name
            const shortId = buildId
                .substring(0, 6)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");
            const timestamp = Date.now().toString().slice(-4);
            const previewEnvName = `pr${shortId}${timestamp}`;
            console.log(`[${buildId}] Deploying to SWA preview environment: ${previewEnvName}...`);
            const deployCommand = `npx @azure/static-web-apps-cli@latest deploy "${extractDir}" --deployment-token "${process.env.AZURE_SWA_DEPLOYMENT_TOKEN}" --env "${previewEnvName}" --verbose`;
            const { stdout, stderr } = yield execPromise(deployCommand, {
                env: Object.assign(Object.assign({}, process.env), { FORCE_COLOR: "0" }),
            });
            console.log(`[${buildId}] SWA Deploy output:`, stdout);
            if (stderr) {
                console.error(`[${buildId}] SWA Deploy stderr:`, stderr);
            }
            console.log(`[${buildId}] Waiting for deployment to propagate...`);
            yield new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds
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
        }
        finally {
            // Cleanup
            console.log(`[${buildId}] Cleaning up temporary files...`);
            yield fs.promises
                .rm(tempDir, { recursive: true, force: true })
                .catch(() => { });
        }
    });
}
function runBuildAndDeploy(zipUrl, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] Starting vercel deployment from ZIP: ${zipUrl}`);
        const tempDir = path_1.default.join(__dirname, "../../temp", buildId);
        const tempZipPath = path_1.default.join(tempDir, "build.zip");
        const extractDir = path_1.default.join(tempDir, "extract");
        try {
            yield fs.promises.mkdir(tempDir, { recursive: true });
            console.log(`[${buildId}] Downloading ZIP...`);
            const response = yield fetch(zipUrl);
            if (!response.ok) {
                throw new Error(`Failed to download ZIP: ${response.statusText}`);
            }
            const zipBuffer = yield response.arrayBuffer();
            yield fs.promises.writeFile(tempZipPath, Buffer.from(zipBuffer));
            console.log(`[${buildId}] Extracting ZIP...`);
            yield fs.promises.mkdir(extractDir, { recursive: true });
            const zip = new adm_zip_1.default(tempZipPath);
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
            yield fs.promises.writeFile(path_1.default.join(extractDir, "vercel.json"), JSON.stringify(vercelConfig, null, 2));
            console.log("✅ Added vercel.json configuration");
            // Deploy to Vercel
            //@ts-ignore
            return yield vercelDeploy({ outputPath: extractDir });
        }
        catch (error) {
            console.error("❌ Build and Deploy pipeline failed:", error);
            throw error;
        }
        finally {
            console.log(`[${buildId}] Cleaning up temporary files...`);
            // await fs.promises
            //   .rm(tempDir, { recursive: true, force: true })
            //   .catch(() => {});
            // Clean up the ephemeral Docker image to prevent clutter
        }
    });
}
const vercelDeploy = ({ outputPath }) => {
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
        (0, child_process_1.exec)(deployCommand, {
            encoding: "utf8",
            env: Object.assign(Object.assign({}, process.env), { VERCEL_TOKEN: token }),
        }, (err, stdout, stderr) => {
            if (err) {
                console.error("❌ Vercel deploy failed:", stderr);
                reject(stderr);
            }
            else {
                console.log("✅ Vercel deploy output:", stdout);
                // Extract the final URL from the output
                const match = stdout.match(/https?:\/\/[^\s]+\.vercel\.app/);
                const deployedUrl = match ? match[0] : null;
                if (deployedUrl) {
                    resolve(deployedUrl);
                }
                else {
                    reject("❌ No URL found in Vercel output");
                }
            }
        });
    });
};
// Helper function to fetch deployment info
function fetchDeploymentInfo(storageAccountName, buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/deployment-info.json`;
        const response = yield fetch(url);
        if (!response.ok) {
            // Fallback URLs if deployment info not found
            return {
                previewUrl: `https://${process.env.AZURE_SWA_DEFAULT_HOSTNAME}`,
                downloadUrl: `https://${storageAccountName}.blob.core.windows.net/build-outputs/${buildId}/build_${buildId}.zip`,
            };
        }
        return response.json();
    });
}
//# sourceMappingURL=azure-deploye_frontend1.js.map