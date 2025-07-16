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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeConversationRoutes = initializeConversationRoutes;
// routes/conversation.ts - Essential routes only for simplified frontend
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
function initializeConversationRoutes(messageDB) {
    // Get project conversation messages - Used by ChatPage for loading project messages
    router.get("/messages", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { projectId } = req.query;
            if (!projectId) {
                res.status(400).json({
                    success: false,
                    error: "projectId is required"
                });
                return;
            }
            const messagesResult = yield messageDB.getProjectMessages(parseInt(projectId), 50);
            if (messagesResult.success) {
                res.json({
                    success: true,
                    data: messagesResult.data || []
                });
            }
            else {
                res.json({
                    success: false,
                    error: "Failed to retrieve messages"
                });
            }
        }
        catch (error) {
            console.error('Failed to get project messages:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get project messages'
            });
        }
    }));
    // Get basic project status - Used by ChatPage for project verification
    router.get("/project-status", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { projectId } = req.query;
            if (!projectId) {
                res.json({
                    success: true,
                    data: {
                        hasProject: false,
                        status: 'no_project'
                    }
                });
                return;
            }
            const project = yield messageDB.getProject(parseInt(projectId));
            if (project) {
                res.json({
                    success: true,
                    data: {
                        hasProject: true,
                        projectId: project.id,
                        projectName: project.name,
                        deploymentUrl: project.deploymentUrl,
                        status: project.status,
                        messageCount: project.messageCount
                    }
                });
            }
            else {
                res.json({
                    success: true,
                    data: {
                        hasProject: false,
                        status: 'project_not_found'
                    }
                });
            }
        }
        catch (error) {
            console.error('Failed to get project status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get project status'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=conversation.js.map