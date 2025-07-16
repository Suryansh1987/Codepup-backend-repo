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
exports.ConversationService = void 0;
const db_1 = require("../db"); // Your drizzle db instance
const drizzle_orm_1 = require("drizzle-orm");
const message_schema_1 = require("../db/message_schema");
class ConversationService {
    // Create new conversation for a project
    createConversation(userId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if conversation already exists for this project
            const existing = yield this.getConversationByProject(projectId);
            if (existing) {
                throw new Error("Conversation already exists for this project");
            }
            const [conversation] = yield db_1.db
                .insert(message_schema_1.conversations)
                .values({
                userId: parseInt(userId),
                projectId: projectId,
                currentStep: "analysis",
            })
                .returning();
            return conversation;
        });
    }
    // Get conversation by projectId (primary way)
    getConversationByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield db_1.db
                .select()
                .from(message_schema_1.conversations)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.projectId, projectId))
                .limit(1);
            return conversation[0] || null;
        });
    }
    // Get conversation by userId (for backward compatibility)
    getConversation(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield db_1.db
                .select()
                .from(message_schema_1.conversations)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.userId, parseInt(userId)))
                .orderBy(message_schema_1.conversations.createdAt)
                .limit(1);
            return conversation[0] || null;
        });
    }
    // Get all conversations for a user (across all projects)
    getUserConversations(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield db_1.db
                .select()
                .from(message_schema_1.conversations)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.userId, parseInt(userId)))
                .orderBy(message_schema_1.conversations.createdAt);
        });
    }
    // Update conversation by projectId
    updateConversationByProject(projectId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const [updated] = yield db_1.db
                .update(message_schema_1.conversations)
                .set(Object.assign(Object.assign({}, updates), { updatedAt: new Date() }))
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversations.projectId, projectId))
                .returning();
            return updated;
        });
    }
    // Save message by projectId
    saveMessageByProject(projectId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.getConversationByProject(projectId);
            if (!conversation)
                throw new Error("Conversation not found for project");
            const [message] = yield db_1.db
                .insert(message_schema_1.conversationMessages)
                .values(Object.assign({ conversationId: conversation.id }, data))
                .returning();
            return message;
        });
    }
    // Get conversation messages by projectId
    getMessagesByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.getConversationByProject(projectId);
            if (!conversation)
                return [];
            return yield db_1.db
                .select()
                .from(message_schema_1.conversationMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationMessages.conversationId, conversation.id))
                .orderBy(message_schema_1.conversationMessages.createdAt);
        });
    }
}
exports.ConversationService = ConversationService;
//# sourceMappingURL=conversation-service.js.map