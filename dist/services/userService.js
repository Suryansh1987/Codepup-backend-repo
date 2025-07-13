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
const message_schema_1 = require("../db/message_schema");
const drizzle_orm_1 = require("drizzle-orm");
class UserService {
    createOrUpdateUser(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if user exists
                const existingUser = yield db_1.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.clerkId, userData.clerkId))
                    .limit(1);
                if (existingUser.length > 0) {
                    // Update existing user
                    const updatedUser = yield db_1.db
                        .update(message_schema_1.users)
                        .set({
                        email: userData.email,
                        name: userData.name,
                        phoneNumber: userData.phoneNumber,
                        profileImage: userData.profileImage,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(message_schema_1.users.clerkId, userData.clerkId))
                        .returning();
                    return updatedUser[0];
                }
                else {
                    // Create new user
                    const newUser = yield db_1.db
                        .insert(message_schema_1.users)
                        .values(userData)
                        .returning();
                    return newUser[0];
                }
            }
            catch (error) {
                console.error('Error creating/updating user:', error);
                throw error;
            }
        });
    }
    getUserByClerkId(clerkId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield db_1.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.clerkId, clerkId))
                    .limit(1);
                return user[0] || null;
            }
            catch (error) {
                console.error('Error getting user:', error);
                throw error;
            }
        });
    }
    getUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield db_1.db
                    .select()
                    .from(message_schema_1.users)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.users.id, id))
                    .limit(1);
                return user[0] || null;
            }
            catch (error) {
                console.error('Error getting user by ID:', error);
                throw error;
            }
        });
    }
}
exports.default = new UserService();
//# sourceMappingURL=userService.js.map