// Enhanced Project URL Manager - Updated for new schema with proper duplicate prevention
import { DrizzleMessageHistoryDB } from "../db/messagesummary";

export class EnhancedProjectUrlManager {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

  /**
   * Main method to save or update project URLs with comprehensive identification and duplicate prevention
   */

  /**
   * Resolve user ID with proper fallback strategies
   */
  private async resolveUserId(
    providedUserId?: number,
    sessionId?: string
  ): Promise<number> {
    try {
      // Priority 1: Use provided userId if valid
      if (
        providedUserId &&
        (await this.messageDB.validateUserExists(providedUserId))
      ) {
        return providedUserId;
      }

      // Priority 2: Get userId from session's most recent project
      if (sessionId) {
        const sessionProject = await this.messageDB.getProjectBySessionId(
          sessionId
        );
        if (sessionProject && sessionProject.userId) {
          // Validate the user still exists
          if (await this.messageDB.validateUserExists(sessionProject.userId)) {
            return sessionProject.userId;
          }
        }
      }

      // Priority 3: Get most recent user from any project
      const mostRecentUserId = await this.messageDB.getMostRecentUserId();
      if (
        mostRecentUserId &&
        (await this.messageDB.validateUserExists(mostRecentUserId))
      ) {
        return mostRecentUserId;
      }

      // Priority 4: Create a new user with current timestamp
      const newUserId = Date.now() % 1000000;
      await this.messageDB.ensureUserExists(newUserId, {
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

  /**
   * Comprehensive duplicate checking with multiple criteria
   */
  private async comprehensiveDuplicateCheck(
    sessionId: string,
    buildId: string,
    zipUrl: string,
    userId: number
  ): Promise<{ isDuplicate: boolean; project?: any; reason?: string }> {
    try {
      console.log(`🔍 Running comprehensive duplicate check...`);

      // Check 1: Exact sessionId match
      let project = await this.messageDB.getProjectBySessionId(sessionId);
      if (project) {
        return {
          isDuplicate: true,
          project,
          reason: `sessionId ${sessionId}`,
        };
      }

      // Check 2: Exact buildId match
      project = await this.messageDB.getProjectByBuildId(buildId);
      if (project) {
        return {
          isDuplicate: true,
          project,
          reason: `buildId ${buildId}`,
        };
      }

      // Check 3: Exact zipUrl match
      if (zipUrl) {
        const projects = await this.messageDB.getUserProjects(userId);
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
      const userProjects = await this.messageDB.getUserProjects(userId);
      if (userProjects.length > 0) {
        const mostRecent = userProjects[0];
        const timeDiff =
          new Date().getTime() - new Date(mostRecent.createdAt).getTime();

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
    } catch (error) {
      console.error("Error in comprehensive duplicate check:", error);
      return { isDuplicate: false };
    }
  }

  /**
   * Check if project needs URL update
   */
  private needsUrlUpdate(
    project: any,
    newUrls: { deploymentUrl: string; downloadUrl: string; zipUrl: string },
    newBuildId: string,
    newSessionId: string
  ): boolean {
    return (
      project.deploymentUrl !== newUrls.deploymentUrl ||
      project.downloadUrl !== newUrls.downloadUrl ||
      project.zipUrl !== newUrls.zipUrl ||
      project.buildId !== newBuildId ||
      project.lastSessionId !== newSessionId
    );
  }

  /**
   * Find project for modification with comprehensive fallback strategies
   */
  private async findProjectForModification(
    sessionId: string,
    userId: number
  ): Promise<any> {
    try {
      console.log(
        `🔍 Finding project for modification - Session: ${sessionId}, User: ${userId}`
      );

      // Priority 1: Find by sessionId (most recent session activity)
      let project = await this.messageDB.getProjectBySessionId(sessionId);
      if (project && project.userId === userId) {
        console.log(`✅ Found project by sessionId: ${project.id}`);
        return project;
      }

      // Priority 2: Find most recent project by userId
      const userProjects = await this.messageDB.getUserProjects(userId);
      if (userProjects.length > 0) {
        project = userProjects[0]; // Most recent by updatedAt
        console.log(`✅ Found most recent user project: ${project.id}`);
        return project;
      }

      console.log(`❌ No existing project found for modification`);
      return null;
    } catch (error) {
      console.error("Error finding project for modification:", error);
      return null;
    }
  }

  /**
   * Get project by ID with error handling
   */

  /**
   * Update existing project with new URLs and metadata
   */
  private async updateExistingProject(
    projectId: number,
    buildId: string,
    urls: { deploymentUrl: string; downloadUrl: string; zipUrl: string },
    sessionId: string,
    prompt?: string
  ): Promise<void> {
    try {
      console.log(`📊 Updating existing project ${projectId} with new URLs`);

      // Update project URLs and metadata according to your schema
      await this.messageDB.updateProjectUrls(projectId, {
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
        await this.messageDB.updateProjectTitle(projectId, {
          conversationTitle: conversationTitle.substring(0, 255), // Respect varchar limit
          updatedAt: new Date(),
        });
      }

      // Increment message count safely
      try {
        await this.messageDB.incrementProjectMessageCount(sessionId);
      } catch (incrementError) {
        console.warn("Failed to increment message count:", incrementError);
        // Don't fail the whole operation for this
      }

      console.log(`✅ Successfully updated project ${projectId}`);
    } catch (error) {
      console.error(`Error updating project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Create new project safely with comprehensive error handling and transaction-like behavior
   */

  /**
   * Emergency method to find recently created project
   */
  private async findRecentlyCreatedProject(
    userId: number,
    buildId: string,
    sessionId: string
  ): Promise<any> {
    try {
      const userProjects = await this.messageDB.getUserProjects(userId);

      // Look for project created in last 5 minutes with matching criteria
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      return userProjects.find(
        (project) =>
          new Date(project.createdAt) > fiveMinutesAgo &&
          (project.buildId === buildId || project.lastSessionId === sessionId)
      );
    } catch (error) {
      console.error("Error in emergency project search:", error);
      return null;
    }
  }

  /**
   * Generate a smart project name from prompt
   */
  private generateProjectName(prompt?: string, buildId?: string): string {
    if (!prompt) {
      return `Project ${buildId?.slice(0, 8) || "Unknown"}`;
    }

    // Extract meaningful words from prompt
    const words = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter(
        (word) =>
          ![
            "create",
            "build",
            "make",
            "generate",
            "website",
            "app",
            "application",
          ].includes(word)
      )
      .slice(0, 3);

    if (words.length > 0) {
      const name = words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return name.substring(0, 255); // Respect varchar limit
    }

    return `Project ${buildId?.slice(0, 8) || "Unknown"}`;
  }

  /**
   * Generate project description from prompt
   */
  private generateProjectDescription(prompt?: string): string {
    if (!prompt) {
      return "Auto-generated project";
    }

    // Truncate and clean the prompt for description (text field, so no strict limit but be reasonable)
    return prompt.length > 500 ? prompt.substring(0, 497) + "..." : prompt;
  }

  /**
   * Public method to get project URLs by various identifiers
   */
  async getProjectUrls(identifier: {
    projectId?: number;
    sessionId?: string;
    buildId?: string;
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
        project = await this.getProjectById(identifier.projectId);
      } else if (identifier.sessionId) {
        project = await this.messageDB.getProjectBySessionId(
          identifier.sessionId
        );
      } else if (identifier.buildId) {
        project = await this.messageDB.getProjectByBuildId(identifier.buildId);
      } else if (identifier.userId) {
        const userProjects = await this.messageDB.getUserProjects(
          identifier.userId
        );
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

  /**
   * Simple method for generation route (no complex duplicate checking needed for new projects)
   */
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
      console.log(
        `🔍 [DEBUG] Looking for existing project with ID: ${projectId}`
      );
      const existingProject = await this.getProjectById(projectId);

      if (existingProject) {
        console.log(`🔄 [DEBUG] Found existing project:`, {
          id: existingProject.id,
          name: existingProject.name,
          userId: existingProject.userId,
          status: existingProject.status,
        });

        // Update only the existing record
        console.log(
          `🔄 [DEBUG] Updating existing project ${existingProject.id}...`
        );
        await this.messageDB.updateProject(existingProject.id, {
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

        console.log(
          `✅ [DEBUG] Successfully updated project ${existingProject.id}`
        );
        return existingProject.id;
      } else {
        console.error(
          `❌ [DEBUG] No project found with projectId: ${projectId}`
        );
        console.error(
          `❌ [DEBUG] This should NEVER happen in generation route!`
        );

        // Let's check what projects exist for this user
        const userProjects = await this.messageDB.getUserProjects(userId);
        console.log(
          `🔍 [DEBUG] User ${userId} has ${userProjects.length} projects:`
        );
        userProjects.forEach((project, index) => {
          console.log(
            `  ${index + 1}. Project ${project.id}: "${
              project.name
            }" (Status: ${project.status})`
          );
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

  // ALSO: Check if getProjectById is working correctly
  async getProjectById(projectId: number): Promise<any> {
    try {
      console.log(
        `🔍 [DEBUG] getProjectById called with projectId: ${projectId}`
      );

      // Use the getProject method from messageDB
      const project = await this.messageDB.getProject(projectId);

      console.log(
        `🔍 [DEBUG] getProjectById result:`,
        project
          ? {
              id: project.id,
              name: project.name,
              userId: project.userId,
              status: project.status,
            }
          : "NULL"
      );

      return project;
    } catch (error) {
      console.error(
        `❌ [DEBUG] Error getting project by ID ${projectId}:`,
        error
      );
      return null;
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
        lastActivity:
          userProjects.length > 0 ? userProjects[0].lastMessageAt : null,
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

  /**
   * Clean up old projects for a user (keep only latest N projects)
   */
  async cleanupUserProjects(
    userId: number,
    keepLatest: number = 10
  ): Promise<number> {
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
          await this.messageDB.updateProjectStatus(project.id, "archived");
          deletedCount++;
        } catch (deleteError) {
          console.error(
            `Failed to archive project ${project.id}:`,
            deleteError
          );
        }
      }

      console.log(
        `✅ Archived ${deletedCount} old projects for user ${userId}`
      );
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up user projects:", error);
      return 0;
    }
  }
}
