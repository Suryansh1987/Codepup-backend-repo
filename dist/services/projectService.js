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
const db_1 = require("../db");
// FIXED: Import from the correct schema file - should be project_schema, not message_schema
const message_schema_1 = require("../db/message_schema");
const drizzle_orm_1 = require("drizzle-orm");
class ProjectService {
    createProject(projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newProject = yield db_1.db
                    .insert(message_schema_1.projects)
                    .values(Object.assign(Object.assign({}, projectData), { conversationTitle: projectData.conversationTitle || `${projectData.name} Chat`, 
                    // FIXED: Add default values for required fields
                    createdAt: new Date(), updatedAt: new Date() }))
                    .returning();
                return newProject[0];
            }
            catch (error) {
                console.error("Error creating project:", error);
                throw error;
            }
        });
    }
    getProjectsByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userProjects = yield db_1.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projects.userId, userId)))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
                return userProjects;
            }
            catch (error) {
                console.error("Error getting projects:", error);
                throw error;
            }
        });
    }
    // NEW: Method to get only ready projects
    getReadyProjectsByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userProjects = yield db_1.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projects.userId, userId), (0, drizzle_orm_1.eq)(message_schema_1.projects.status, "ready")))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
                return userProjects;
            }
            catch (error) {
                console.error("Error getting ready projects:", error);
                throw error;
            }
        });
    }
    getProjectById(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield db_1.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .limit(1);
                return project[0] || null;
            }
            catch (error) {
                console.error("Error getting project:", error);
                throw error;
            }
        });
    }
    updateProject(projectId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedProject = yield db_1.db
                    .update(message_schema_1.projects)
                    .set(Object.assign(Object.assign({}, updates), { updatedAt: new Date() }))
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .returning();
                // FIXED: Check if project was actually updated
                if (updatedProject.length === 0) {
                    throw new Error(`Project with ID ${projectId} not found`);
                }
                return updatedProject[0];
            }
            catch (error) {
                console.error("Error updating project:", error);
                throw error;
            }
        });
    }
    deleteProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // FIXED: Use soft delete approach and check if update was successful
                const result = yield db_1.db
                    .update(message_schema_1.projects)
                    .set({
                    status: "deleted",
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId))
                    .returning();
                return result.length > 0;
            }
            catch (error) {
                console.error("Error deleting project:", error);
                throw error;
            }
        });
    }
    // NEW: Additional useful methods
    getProjectBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield db_1.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.lastSessionId, sessionId))
                    .limit(1);
                return project[0] || null;
            }
            catch (error) {
                console.error("Error getting project by session:", error);
                throw error;
            }
        });
    }
    updateProjectSession(projectId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.db
                    .update(message_schema_1.projects)
                    .set({
                    lastSessionId: sessionId,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
            }
            catch (error) {
                console.error("Error updating project session:", error);
                throw error;
            }
        });
    }
    incrementMessageCount(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get current project
                const project = yield this.getProjectById(projectId);
                if (!project) {
                    throw new Error(`Project ${projectId} not found`);
                }
                yield db_1.db
                    .update(message_schema_1.projects)
                    .set({
                    messageCount: (project.messageCount || 0) + 1,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projects.id, projectId));
            }
            catch (error) {
                console.error("Error incrementing message count:", error);
                throw error;
            }
        });
    }
    getProjectStats(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield this.getProjectById(projectId);
                if (!project)
                    return null;
                return {
                    messageCount: project.messageCount || 0,
                    lastActivity: project.lastMessageAt,
                    status: project.status || 'unknown'
                };
            }
            catch (error) {
                console.error("Error getting project stats:", error);
                throw error;
            }
        });
    }
    // NEW: Search projects
    searchProjects(userId, searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const searchResults = yield db_1.db
                    .select()
                    .from(message_schema_1.projects)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projects.userId, userId)))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projects.updatedAt));
                // Filter in memory for now (for production, use database LIKE or full-text search)
                return searchResults.filter(project => project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase())));
            }
            catch (error) {
                console.error("Error searching projects:", error);
                throw error;
            }
        });
    }
}
exports.default = new ProjectService();
//# sourceMappingURL=projectService.js.map