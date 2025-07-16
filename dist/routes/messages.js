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
// routes/messages.ts - Simplified with only essential endpoints
const express_1 = require("express");
const router = (0, express_1.Router)();
// This will be set when the main app initializes the routes
let messageDB = null;
// Function to initialize the message service (called from main app)
function setMessageDB(db) {
    messageDB = db;
}
// Get messages for a specific project
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
// Get messages for a specific session
exports.default = router;
//# sourceMappingURL=messages.js.map