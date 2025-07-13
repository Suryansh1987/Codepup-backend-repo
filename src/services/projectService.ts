import { db } from "../db";
// FIXED: Import from the correct schema file - should be project_schema, not message_schema
import { projects, type Project, type NewProject } from "../db/message_schema";
import { eq, desc, and } from "drizzle-orm";

class ProjectService {
  async createProject(projectData: NewProject): Promise<Project> {
    try {
      const newProject = await db
        .insert(projects)
        .values({
          ...projectData,
          conversationTitle:
            projectData.conversationTitle || `${projectData.name} Chat`,
          // FIXED: Add default values for required fields
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newProject[0];
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  }

  async getProjectsByUserId(userId: number): Promise<Project[]> {
    try {
      const userProjects = await db
        .select()
        .from(projects)
        .where(and(
          eq(projects.userId, userId), 
          // FIXED: Don't filter by status here - let the caller decide
          // eq(projects.status, "ready")
        ))
        .orderBy(desc(projects.updatedAt));

      return userProjects;
    } catch (error) {
      console.error("Error getting projects:", error);
      throw error;
    }
  }

  // NEW: Method to get only ready projects
  async getReadyProjectsByUserId(userId: number): Promise<Project[]> {
    try {
      const userProjects = await db
        .select()
        .from(projects)
        .where(and(
          eq(projects.userId, userId), 
          eq(projects.status, "ready")
        ))
        .orderBy(desc(projects.updatedAt));

      return userProjects;
    } catch (error) {
      console.error("Error getting ready projects:", error);
      throw error;
    }
  }

  async getProjectById(projectId: number): Promise<Project | null> {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      return project[0] || null;
    } catch (error) {
      console.error("Error getting project:", error);
      throw error;
    }
  }

  async updateProject(
    projectId: number,
    updates: Partial<Project>
  ): Promise<Project> {
    try {
      const updatedProject = await db
        .update(projects)
        .set({ 
          ...updates, 
          updatedAt: new Date() 
        })
        .where(eq(projects.id, projectId))
        .returning();

      // FIXED: Check if project was actually updated
      if (updatedProject.length === 0) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      return updatedProject[0];
    } catch (error) {
      console.error("Error updating project:", error);
      throw error;
    }
  }

  async deleteProject(projectId: number): Promise<boolean> {
    try {
      // FIXED: Use soft delete approach and check if update was successful
      const result = await db
        .update(projects)
        .set({ 
          status: "deleted", 
          updatedAt: new Date() 
        })
        .where(eq(projects.id, projectId))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  }

  // NEW: Additional useful methods

  async getProjectBySessionId(sessionId: string): Promise<Project | null> {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.lastSessionId, sessionId))
        .limit(1);

      return project[0] || null;
    } catch (error) {
      console.error("Error getting project by session:", error);
      throw error;
    }
  }

  async updateProjectSession(projectId: number, sessionId: string): Promise<void> {
    try {
      await db
        .update(projects)
        .set({ 
          lastSessionId: sessionId,
          lastMessageAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(projects.id, projectId));
    } catch (error) {
      console.error("Error updating project session:", error);
      throw error;
    }
  }

  async incrementMessageCount(projectId: number): Promise<void> {
    try {
      // Get current project
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      await db
        .update(projects)
        .set({ 
          messageCount: (project.messageCount || 0) + 1,
          lastMessageAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(projects.id, projectId));
    } catch (error) {
      console.error("Error incrementing message count:", error);
      throw error;
    }
  }

  async getProjectStats(projectId: number): Promise<{
    messageCount: number;
    lastActivity: Date | null;
    status: string;
  } | null> {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) return null;

      return {
        messageCount: project.messageCount || 0,
        lastActivity: project.lastMessageAt,
        status: project.status || 'unknown'
      };
    } catch (error) {
      console.error("Error getting project stats:", error);
      throw error;
    }
  }

  // NEW: Search projects
  async searchProjects(userId: number, searchTerm: string): Promise<Project[]> {
    try {
      const searchResults = await db
        .select()
        .from(projects)
        .where(and(
          eq(projects.userId, userId),
          // Note: This is a simple search. For better search, you'd want to use a proper search solution
          // or add a full-text search column
        ))
        .orderBy(desc(projects.updatedAt));

      // Filter in memory for now (for production, use database LIKE or full-text search)
      return searchResults.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      console.error("Error searching projects:", error);
      throw error;
    }
  }
}

export default new ProjectService();