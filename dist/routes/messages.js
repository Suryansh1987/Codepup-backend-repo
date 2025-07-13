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
exports.setMessageDB = setMessageDB;
// routes/messages.ts - Updated to work with your existing structure
const express_1 = require("express");
const router = (0, express_1.Router)();
// This will be set when the main app initializes the routes
let messageDB = null;
// Function to initialize the message service (called from main app)
function setMessageDB(db) {
    messageDB = db;
}
// Get messages for a specific project - THIS WAS MISSING
router.get('/project/:projectId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const projectId = parseInt(req.params.projectId);
        const limit = parseInt(req.query.limit) || 50;
        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID provided'
            });
            return;
        }
        // Get project messages using the enhanced method
        const result = yield messageDB.getProjectMessages(projectId, limit);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('Get project messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Create message with project linking
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const { projectId, sessionId, role, content, userId, metadata } = req.body;
        if (!content || !role) {
            res.status(400).json({
                success: false,
                error: 'Content and role are required'
            });
            return;
        }
        // Use the enhanced addMessage method with project context
        const messageId = yield messageDB.addMessage(content, role, Object.assign({ projectId,
            sessionId,
            userId }, metadata));
        // Update project message count if projectId provided
        if (projectId) {
            yield messageDB.incrementProjectMessageCount(sessionId || `project-${projectId}`);
        }
        res.json({
            success: true,
            data: {
                messageId,
                projectId,
                sessionId
            }
        });
    }
    catch (error) {
        console.error('Message creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get messages for a specific user
router.get('/user/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const userId = parseInt(req.params.userId);
        const limit = parseInt(req.query.limit) || 50;
        if (isNaN(userId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid user ID provided'
            });
            return;
        }
        const result = yield messageDB.getUserMessages(userId, limit);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('Get user messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get messages for a specific session
router.get('/session/:sessionId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const { sessionId } = req.params;
        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }
        const result = yield messageDB.getSessionMessages(sessionId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('Get session messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Delete messages for a project
router.delete('/project/:projectId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID provided'
            });
            return;
        }
        const result = yield messageDB.deleteProjectMessages(projectId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('Delete project messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get conversation context for a project
router.get('/project/:projectId/context', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!messageDB) {
            res.status(500).json({
                success: false,
                error: 'Message service not initialized'
            });
            return;
        }
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID provided'
            });
            return;
        }
        const result = yield messageDB.getProjectConversationContext(projectId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('Get project context error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Health check
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                features: [
                    'Project message integration',
                    'Session-based messaging',
                    'User message tracking',
                    'Message context retrieval'
                ]
            }
        });
    }
    catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            success: false,
            error: 'Health check failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
exports.default = router;
//# sourceMappingURL=messages.js.map