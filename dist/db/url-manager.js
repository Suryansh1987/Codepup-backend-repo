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
exports.EnhancedProjectUrlManager = void 0;
class EnhancedProjectUrlManager {
    constructor(messageDB) {
        this.messageDB = messageDB;
    }
    /**
     * Main method to save or update project URLs with comprehensive identification and duplicate prevention
     */
    /**
     * Resolve user ID with proper fallback strategies
     */
    resolveUserId(providedUserId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Priority 1: Use provided userId if valid
                if (providedUserId &&
                    (yield this.messageDB.validateUserExists(providedUserId))) {
                    return providedUserId;
                }
                // Priority 2: Get userId from session's most recent project
                if (sessionId) {
                    const sessionProject = yield this.messageDB.getProjectBySessionId(sessionId);
                    if (sessionProject && sessionProject.userId) {
                        // Validate the user still exists
                        if (yield this.messageDB.validateUserExists(sessionProject.userId)) {
                            return sessionProject.userId;
                        }
                    }
                }
                // Priority 3: Get most recent user from any project
                const mostRecentUserId = yield this.messageDB.getMostRecentUserId();
                if (mostRecentUserId &&
                    (yield this.messageDB.validateUserExists(mostRecentUserId))) {
                    return mostRecentUserId;
                }
                // Priority 4: Create a new user with current timestamp
                const newUserId = Date.now() % 1000000;
                yield this.messageDB.ensureUserExists(newUserId, {
                    email: `user${newUserId}@buildora.dev`,
                    name: `User ${newUserId}`,
                });
                console.log(`✅ Created new user ${newUserId} as fallback`);
                return newUserId;
            }
            catch (error) {
                console.error("❌ Failed to resolve user ID:", error);
                throw new Error("Could not resolve or create user");
            }
        });
    }
    /**
     * Comprehensive duplicate checking with multiple criteria
     */
    comprehensiveDuplicateCheck(sessionId, buildId, zipUrl, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 Running comprehensive duplicate check...`);
                // Check 1: Exact sessionId match
                let project = yield this.messageDB.getProjectBySessionId(sessionId);
                if (project) {
                    return {
                        isDuplicate: true,
                        project,
                        reason: `sessionId ${sessionId}`,
                    };
                }
                // Check 2: Exact buildId match
                project = yield this.messageDB.getProjectByBuildId(buildId);
                if (project) {
                    return {
                        isDuplicate: true,
                        project,
                        reason: `buildId ${buildId}`,
                    };
                }
                // Check 3: Exact zipUrl match
                if (zipUrl) {
                    const projects = yield this.messageDB.getUserProjects(userId);
                    project = projects.find((p) => p.zipUrl === zipUrl);
                    if (project) {
                        return {
                            isDuplicate: true,
                            project,
                            reason: `zipUrl match for user ${userId}`,
                        };
                    }
                }
                // Check 4: Recent project within time window (prevent rapid duplicates)
                const userProjects = yield this.messageDB.getUserProjects(userId);
                if (userProjects.length > 0) {
                    const mostRecent = userProjects[0];
                    const timeDiff = new Date().getTime() - new Date(mostRecent.createdAt).getTime();
                    // If less than 30 seconds ago, likely a duplicate
                    if (timeDiff < 30000) {
                        return {
                            isDuplicate: true,
                            project: mostRecent,
                            reason: `recent project within 30s for user ${userId}`,
                        };
                    }
                }
                return { isDuplicate: false };
            }
            catch (error) {
                console.error("Error in comprehensive duplicate check:", error);
                return { isDuplicate: false };
            }
        });
    }
    /**
     * Check if project needs URL update
     */
    needsUrlUpdate(project, newUrls, newBuildId, newSessionId) {
        return (project.deploymentUrl !== newUrls.deploymentUrl ||
            project.downloadUrl !== newUrls.downloadUrl ||
            project.zipUrl !== newUrls.zipUrl ||
            project.buildId !== newBuildId ||
            project.lastSessionId !== newSessionId);
    }
    /**
     * Find project for modification with comprehensive fallback strategies
     */
    findProjectForModification(sessionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 Finding project for modification - Session: ${sessionId}, User: ${userId}`);
                // Priority 1: Find by sessionId (most recent session activity)
                let project = yield this.messageDB.getProjectBySessionId(sessionId);
                if (project && project.userId === userId) {
                    console.log(`✅ Found project by sessionId: ${project.id}`);
                    return project;
                }
                // Priority 2: Find most recent project by userId
                const userProjects = yield this.messageDB.getUserProjects(userId);
                if (userProjects.length > 0) {
                    project = userProjects[0]; // Most recent by updatedAt
                    console.log(`✅ Found most recent user project: ${project.id}`);
                    return project;
                }
                console.log(`❌ No existing project found for modification`);
                return null;
            }
            catch (error) {
                console.error("Error finding project for modification:", error);
                return null;
            }
        });
    }
    /**
     * Get project by ID with error handling
     */
    /**
     * Update existing project with new URLs and metadata
     */
    updateExistingProject(projectId, buildId, urls, sessionId, prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`📊 Updating existing project ${projectId} with new URLs`);
                // Update project URLs and metadata according to your schema
                yield this.messageDB.updateProjectUrls(projectId, {
                    deploymentUrl: urls.deploymentUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: urls.zipUrl,
                    buildId: buildId,
                    status: "ready",
                    lastSessionId: sessionId,
                    lastMessageAt: new Date(),
                    updatedAt: new Date(),
                });
                // Update conversation title if we have a new prompt
                if (prompt && prompt.length > 10) {
                    const conversationTitle = this.generateProjectName(prompt);
                    yield this.messageDB.updateProjectTitle(projectId, {
                        conversationTitle: conversationTitle.substring(0, 255), // Respect varchar limit
                        updatedAt: new Date(),
                    });
                }
                // Increment message count safely
                try {
                    yield this.messageDB.incrementProjectMessageCount(sessionId);
                }
                catch (incrementError) {
                    console.warn("Failed to increment message count:", incrementError);
                    // Don't fail the whole operation for this
                }
                console.log(`✅ Successfully updated project ${projectId}`);
            }
            catch (error) {
                console.error(`Error updating project ${projectId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create new project safely with comprehensive error handling and transaction-like behavior
     */
    /**
     * Emergency method to find recently created project
     */
    findRecentlyCreatedProject(userId, buildId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userProjects = yield this.messageDB.getUserProjects(userId);
                // Look for project created in last 5 minutes with matching criteria
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                return userProjects.find((project) => new Date(project.createdAt) > fiveMinutesAgo &&
                    (project.buildId === buildId || project.lastSessionId === sessionId));
            }
            catch (error) {
                console.error("Error in emergency project search:", error);
                return null;
            }
        });
    }
    /**
     * Generate a smart project name from prompt
     */
    generateProjectName(prompt, buildId) {
        if (!prompt) {
            return `Project ${(buildId === null || buildId === void 0 ? void 0 : buildId.slice(0, 8)) || "Unknown"}`;
        }
        // Extract meaningful words from prompt
        const words = prompt
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((word) => word.length > 2)
            .filter((word) => ![
            "create",
            "build",
            "make",
            "generate",
            "website",
            "app",
            "application",
        ].includes(word))
            .slice(0, 3);
        if (words.length > 0) {
            const name = words
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
            return name.substring(0, 255); // Respect varchar limit
        }
        return `Project ${(buildId === null || buildId === void 0 ? void 0 : buildId.slice(0, 8)) || "Unknown"}`;
    }
    /**
     * Generate project description from prompt
     */
    generateProjectDescription(prompt) {
        if (!prompt) {
            return "Auto-generated project";
        }
        // Truncate and clean the prompt for description (text field, so no strict limit but be reasonable)
        return prompt.length > 500 ? prompt.substring(0, 497) + "..." : prompt;
    }
    /**
     * Public method to get project URLs by various identifiers
     */
    getProjectUrls(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let project = null;
                if (identifier.projectId) {
                    project = yield this.getProjectById(identifier.projectId);
                }
                else if (identifier.sessionId) {
                    project = yield this.messageDB.getProjectBySessionId(identifier.sessionId);
                }
                else if (identifier.buildId) {
                    project = yield this.messageDB.getProjectByBuildId(identifier.buildId);
                }
                else if (identifier.userId) {
                    const userProjects = yield this.messageDB.getUserProjects(identifier.userId);
                    project = userProjects[0] || null;
                }
                if (!project) {
                    return null;
                }
                return {
                    projectId: project.id,
                    deploymentUrl: project.deploymentUrl || "",
                    downloadUrl: project.downloadUrl || "",
                    zipUrl: project.zipUrl || "",
                    buildId: project.buildId || "",
                    lastSessionId: project.lastSessionId || "",
                };
            }
            catch (error) {
                console.error("Error getting project URLs:", error);
                return null;
            }
        });
    }
    /**
     * Simple method for generation route (no complex duplicate checking needed for new projects)
     */
    saveNewProjectUrls(sessionId, projectId, urls, userId, projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 [DEBUG] saveNewProjectUrls called with:`);
                console.log(`  - sessionId: ${sessionId}`);
                console.log(`  - projectId: ${projectId}`);
                console.log(`  - userId: ${userId}`);
                console.log(`  - deploymentUrl: ${urls.deploymentUrl}`);
                // Check if project with the same projectId already exists
                console.log(`🔍 [DEBUG] Looking for existing project with ID: ${projectId}`);
                const existingProject = yield this.getProjectById(projectId);
                if (existingProject) {
                    console.log(`🔄 [DEBUG] Found existing project:`, {
                        id: existingProject.id,
                        name: existingProject.name,
                        userId: existingProject.userId,
                        status: existingProject.status,
                    });
                    // Update only the existing record
                    console.log(`🔄 [DEBUG] Updating existing project ${existingProject.id}...`);
                    yield this.messageDB.updateProject(existingProject.id, {
                        deploymentUrl: urls.deploymentUrl,
                        downloadUrl: urls.downloadUrl,
                        zipUrl: urls.zipUrl,
                        lastSessionId: sessionId,
                        name: projectData.name || existingProject.name,
                        description: projectData.description || existingProject.description,
                        framework: projectData.framework || existingProject.framework,
                        template: projectData.template || existingProject.template,
                        lastMessageAt: new Date(),
                        updatedAt: new Date(),
                    });
                    console.log(`✅ [DEBUG] Successfully updated project ${existingProject.id}`);
                    return existingProject.id;
                }
                else {
                    console.error(`❌ [DEBUG] No project found with projectId: ${projectId}`);
                    console.error(`❌ [DEBUG] This should NEVER happen in generation route!`);
                    // Let's check what projects exist for this user
                    const userProjects = yield this.messageDB.getUserProjects(userId);
                    console.log(`🔍 [DEBUG] User ${userId} has ${userProjects.length} projects:`);
                    userProjects.forEach((project, index) => {
                        console.log(`  ${index + 1}. Project ${project.id}: "${project.name}" (Status: ${project.status})`);
                    });
                    throw new Error(`No project found with projectId: ${projectId}. URL Manager only updates existing projects.`);
                }
            }
            catch (error) {
                console.error("❌ [DEBUG] Error in saveNewProjectUrls:", error);
                throw error;
            }
        });
    }
    // ALSO: Check if getProjectById is working correctly
    getProjectById(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 [DEBUG] getProjectById called with projectId: ${projectId}`);
                // Use the getProject method from messageDB
                const project = yield this.messageDB.getProject(projectId);
                console.log(`🔍 [DEBUG] getProjectById result:`, project
                    ? {
                        id: project.id,
                        name: project.name,
                        userId: project.userId,
                        status: project.status,
                    }
                    : "NULL");
                return project;
            }
            catch (error) {
                console.error(`❌ [DEBUG] Error getting project by ID ${projectId}:`, error);
                return null;
            }
        });
    }
    /**
     * Get user's project statistics
     */
    getUserProjectStats(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userProjects = yield this.messageDB.getUserProjects(userId);
                const stats = {
                    totalProjects: userProjects.length,
                    activeProjects: userProjects.filter((p) => p.status === "ready").length,
                    totalDeployments: userProjects.filter((p) => p.deploymentUrl).length,
                    lastActivity: userProjects.length > 0 ? userProjects[0].lastMessageAt : null,
                };
                return stats;
            }
            catch (error) {
                console.error("Error getting user project stats:", error);
                return {
                    totalProjects: 0,
                    activeProjects: 0,
                    totalDeployments: 0,
                    lastActivity: null,
                };
            }
        });
    }
    /**
     * Clean up old projects for a user (keep only latest N projects)
     */
    cleanupUserProjects(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, keepLatest = 10) {
            try {
                const userProjects = yield this.messageDB.getUserProjects(userId);
                if (userProjects.length <= keepLatest) {
                    return 0; // No cleanup needed
                }
                const projectsToDelete = userProjects.slice(keepLatest);
                let deletedCount = 0;
                for (const project of projectsToDelete) {
                    try {
                        // Update project status to 'archived' instead of deleting
                        yield this.messageDB.updateProjectStatus(project.id, "archived");
                        deletedCount++;
                    }
                    catch (deleteError) {
                        console.error(`Failed to archive project ${project.id}:`, deleteError);
                    }
                }
                console.log(`✅ Archived ${deletedCount} old projects for user ${userId}`);
                return deletedCount;
            }
            catch (error) {
                console.error("Error cleaning up user projects:", error);
                return 0;
            }
        });
    }
}
exports.EnhancedProjectUrlManager = EnhancedProjectUrlManager;
//# sourceMappingURL=url-manager.js.map