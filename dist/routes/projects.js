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
const express_1 = require("express");
const projectService_1 = __importDefault(require("../services/projectService"));
const messageService_1 = require("../services/messageService");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = (0, express_1.Router)();
// Initialize message service
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || ""
});
const messageService = (0, messageService_1.createMessageService)(process.env.DATABASE_URL || "", anthropic, process.env.REDIS_URL);
// Create project
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.createProject(req.body);
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get projects by user ID
router.get("/user/:userId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield projectService_1.default.getProjectsByUserId(parseInt(req.params.userId));
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get project by ID
router.get("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.getProjectById(parseInt(req.params.projectId));
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Update project
router.put("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.updateProject(parseInt(req.params.projectId), req.body);
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Delete project
router.delete("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield projectService_1.default.deleteProject(parseInt(req.params.projectId));
        res.json({ message: "Project deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
//@ts-ignore
router.get("/:projectId/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = parseInt(req.params.projectId);
        // Get project to find the user ID
        const project = yield projectService_1.default.getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }
        // Use getUserMessages since getMessagesByProjectId doesn't exist in new service
        const result = yield messageService.getUserMessages(project.userId);
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        res.json(result.data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
//# sourceMappingURL=projects.js.map