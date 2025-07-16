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
    getProjectUrls(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let project = null;
                if (identifier.projectId) {
                    project = yield this.messageDB.getProject(identifier.projectId);
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
    saveNewProjectUrls(sessionId, projectId, urls, userId, projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                console.log(`🔍 [DEBUG] saveNewProjectUrls called with:`);
                console.log(`  - sessionId: ${sessionId}`);
                console.log(`  - projectId: ${projectId}`);
                console.log(`  - userId: ${userId}`);
                console.log(`  - deploymentUrl: ${urls.deploymentUrl}`);
                // Check if project with the same projectId already exists
                console.log(`🔍 [DEBUG] Looking for existing project with ID: ${projectId}`);
                const existingProject = yield this.messageDB.getProject(projectId);
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
                        name: (_b = (_a = projectData.name) !== null && _a !== void 0 ? _a : existingProject.name) !== null && _b !== void 0 ? _b : undefined,
                        description: (_d = (_c = projectData.description) !== null && _c !== void 0 ? _c : existingProject.description) !== null && _d !== void 0 ? _d : undefined,
                        framework: (_f = (_e = projectData.framework) !== null && _e !== void 0 ? _e : existingProject.framework) !== null && _f !== void 0 ? _f : undefined,
                        template: (_h = (_g = projectData.template) !== null && _g !== void 0 ? _g : existingProject.template) !== null && _h !== void 0 ? _h : undefined,
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
                        yield this.messageDB.updateProject(project.id, { status: "archived" });
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