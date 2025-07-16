import { type Project, type NewProject } from "../db/message_schema";
declare class ProjectService {
    createProject(projectData: NewProject): Promise<Project>;
    getProjectsByUserId(userId: number): Promise<Project[]>;
    getReadyProjectsByUserId(userId: number): Promise<Project[]>;
    getProjectById(projectId: number): Promise<Project | null>;
    updateProject(projectId: number, updates: Partial<Project>): Promise<Project>;
    deleteProject(projectId: number): Promise<boolean>;
    getProjectBySessionId(sessionId: string): Promise<Project | null>;
    updateProjectSession(projectId: number, sessionId: string): Promise<void>;
    incrementMessageCount(projectId: number): Promise<void>;
    getProjectStats(projectId: number): Promise<{
        messageCount: number;
        lastActivity: Date | null;
        status: string;
    } | null>;
    searchProjects(userId: number, searchTerm: string): Promise<Project[]>;
}
declare const _default: ProjectService;
export default _default;
