import { type User, type NewUser } from '../db/message_schema';
declare class UserService {
    createOrUpdateUser(userData: NewUser): Promise<User>;
    getUserByClerkId(clerkId: string): Promise<User | null>;
    getUserById(id: number): Promise<User | null>;
}
declare const _default: UserService;
export default _default;
