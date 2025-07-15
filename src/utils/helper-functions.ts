// utils/routeHelpers.ts - Essential helper functions only
import { DrizzleMessageHistoryDB } from "../db/messagesummary";

// Helper function to resolve user ID
export async function resolveUserId(
  messageDB: DrizzleMessageHistoryDB,
  providedUserId?: number,
  sessionId?: string
): Promise<number> {
  try {
    // Priority 1: Use provided userId if valid
    if (providedUserId && (await messageDB.validateUserExists(providedUserId))) {
      return providedUserId;
    }

    // Priority 2: Get most recent user from any project
    const userProjects = await messageDB.getUserProjects(1); // Try user 1 first
    if (userProjects.length > 0) {
      return userProjects[0].userId;
    }

    // Priority 3: Create a new user with current timestamp
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

// Helper function to get project secrets
export async function getProjectSecrets(
  messageDB: DrizzleMessageHistoryDB,
  projectId: number
): Promise<{
  aneonkey: string | null;
  supabaseurl: string | null;
} | null> {
  try {
    const project = await messageDB.getProject(projectId);
    if (!project) return null;

    return {
      aneonkey: project.aneonkey || null,
      supabaseurl: project.supabaseurl || null,
    };
  } catch (error) {
    console.error(`Error getting project secrets for ${projectId}:`, error);
    return null;
  }
}

// Helper function to normalize URLs
export function normalizeUrl(url: string): string {
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
export async function resolveProjectByDeployedUrl(
  messageDB: DrizzleMessageHistoryDB,
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
    const userProjects = await messageDB.getUserProjects(userId);

    if (userProjects.length === 0) {
      return {
        projectId: null,
        project: null,
        matchReason: "no_user_projects",
      };
    }

    // Priority 1: If projectId is provided, use it
    if (projectId) {
      const specificProject = userProjects.find((p) => p.id === projectId);
      if (specificProject) {
        console.log(`✅ Using provided projectId ${projectId}`);
        return {
          projectId: specificProject.id,
          project: specificProject,
          matchReason: "project_id_provided",
        };
      }
    }

    // Priority 2: Match by deployed URL
    if (deployedUrl) {
      console.log(`🔍 Looking for project with deployed URL: ${deployedUrl}`);
      const normalizedTargetUrl = normalizeUrl(deployedUrl);

      const urlMatch = userProjects.find((project) => {
        if (!project.deploymentUrl) return false;
        const normalizedProjectUrl = normalizeUrl(project.deploymentUrl);
        return normalizedProjectUrl === normalizedTargetUrl;
      });

      if (urlMatch) {
        console.log(`✅ Found project by URL: ${urlMatch.name}`);
        return {
          projectId: urlMatch.id,
          project: urlMatch,
          matchReason: "deployed_url_match",
        };
      }
    }

    // Priority 3: Use most recent project as fallback
    const recentProject = userProjects[0];
    console.log(`⚠️ Using most recent project: ${recentProject.name}`);

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