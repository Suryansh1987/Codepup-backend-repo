import { db } from '../db';
import { users, type User, type NewUser } from '../db/message_schema';
import { eq } from 'drizzle-orm';

class UserService {
  async createOrUpdateUser(userData: NewUser): Promise<User> {
    try {
      // Check if user exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, userData.clerkId))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user
        const updatedUser = await db
          .update(users)
          .set({
            email: userData.email,
            name: userData.name,
            phoneNumber: userData.phoneNumber,
            profileImage: userData.profileImage,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, userData.clerkId))
          .returning();

        return updatedUser[0];
      } else {
        // Create new user
        const newUser = await db
          .insert(users)
          .values(userData)
          .returning();

        return newUser[0];
      }
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      return user[0] || null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }
}

export default new UserService();