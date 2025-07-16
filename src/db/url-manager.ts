// Simplified Enhanced Project URL Manager - Updated for 4-table schema
import { DrizzleMessageHistoryDB } from "../db/messagesummary";

export class EnhancedProjectUrlManager {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

  async getProjectUrls(identifier: {
    projectId?: number;
    userId?: number;
  }): Promise<{
    projectId: number;
    deploymentUrl: string;
    downloadUrl: string;
    zipUrl: string;
    buildId: string;
    lastSessionId: string;
  } | null> {
    try {
      let project = null;

      if (identifier.projectId) {
        project = await this.messageDB.getProject(identifier.projectId);
      } else if (identifier.userId) {
        const userProjects = await this.messageDB.getUserProjects(identifier.userId);
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
    } catch (error) {
      console.error("Error getting project URLs:", error);
      return null;
    }
  }

  async saveNewProjectUrls(
    sessionId: string,
    projectId: number,
    urls: { deploymentUrl: string; downloadUrl: string; zipUrl: string },
    userId: number,
    projectData: {
      name?: string;
      description?: string;
      framework?: string;
      template?: string;
    }
  ): Promise<number> {
    try {
      console.log(`🔍 [DEBUG] saveNewProjectUrls called with:`);
      console.log(`  - sessionId: ${sessionId}`);
      console.log(`  - projectId: ${projectId}`);
      console.log(`  - userId: ${userId}`);
      console.log(`  - deploymentUrl: ${urls.deploymentUrl}`);

      // Check if project with the same projectId already exists
      console.log(`🔍 [DEBUG] Looking for existing project with ID: ${projectId}`);
      const existingProject = await this.messageDB.getProject(projectId);

      if (existingProject) {
        console.log(`🔄 [DEBUG] Found existing project:`, {
          id: existingProject.id,
          name: existingProject.name,
          userId: existingProject.userId,
          status: existingProject.status,
        });

        // Update only the existing record
        console.log(`🔄 [DEBUG] Updating existing project ${existingProject.id}...`);
    await this.messageDB.updateProject(existingProject.id, {
  deploymentUrl: urls.deploymentUrl,
  downloadUrl: urls.downloadUrl,
  zipUrl: urls.zipUrl,
  lastSessionId: sessionId,
  name: projectData.name ?? existingProject.name ?? undefined,
  description: projectData.description ?? existingProject.description ?? undefined,
  framework: projectData.framework ?? existingProject.framework ?? undefined,
  template: projectData.template ?? existingProject.template ?? undefined,
  lastMessageAt: new Date(),
  updatedAt: new Date(),
});




        console.log(`✅ [DEBUG] Successfully updated project ${existingProject.id}`);
        return existingProject.id;
      } else {
        console.error(`❌ [DEBUG] No project found with projectId: ${projectId}`);
        console.error(`❌ [DEBUG] This should NEVER happen in generation route!`);

        // Let's check what projects exist for this user
        const userProjects = await this.messageDB.getUserProjects(userId);
        console.log(`🔍 [DEBUG] User ${userId} has ${userProjects.length} projects:`);
        userProjects.forEach((project, index) => {
          console.log(`  ${index + 1}. Project ${project.id}: "${project.name}" (Status: ${project.status})`);
        });

        throw new Error(
          `No project found with projectId: ${projectId}. URL Manager only updates existing projects.`
        );
      }
    } catch (error) {
      console.error("❌ [DEBUG] Error in saveNewProjectUrls:", error);
      throw error;
    }
  }

  /**
   * Get user's project statistics
   */
  async getUserProjectStats(userId: number): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalDeployments: number;
    lastActivity: Date | null;
  }> {
    try {
      const userProjects = await this.messageDB.getUserProjects(userId);

      const stats = {
        totalProjects: userProjects.length,
        activeProjects: userProjects.filter((p) => p.status === "ready").length,
        totalDeployments: userProjects.filter((p) => p.deploymentUrl).length,
        lastActivity: userProjects.length > 0 ? userProjects[0].lastMessageAt : null,
      };

      return stats;
    } catch (error) {
      console.error("Error getting user project stats:", error);
      return {
        totalProjects: 0,
        activeProjects: 0,
        totalDeployments: 0,
        lastActivity: null,
      };
    }
  }

  async cleanupUserProjects(userId: number, keepLatest: number = 10): Promise<number> {
    try {
      const userProjects = await this.messageDB.getUserProjects(userId);

      if (userProjects.length <= keepLatest) {
        return 0; // No cleanup needed
      }

      const projectsToDelete = userProjects.slice(keepLatest);
      let deletedCount = 0;

      for (const project of projectsToDelete) {
        try {
          // Update project status to 'archived' instead of deleting
          await this.messageDB.updateProject(project.id, { status: "archived" });
          deletedCount++;
        } catch (deleteError) {
          console.error(`Failed to archive project ${project.id}:`, deleteError);
        }
      }

      console.log(`✅ Archived ${deletedCount} old projects for user ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up user projects:", error);
      return 0;
    }
  }
}