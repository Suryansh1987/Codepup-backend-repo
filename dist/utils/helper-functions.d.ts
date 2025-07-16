import { DrizzleMessageHistoryDB } from "../db/messagesummary";
export declare function resolveUserId(messageDB: DrizzleMessageHistoryDB, providedUserId?: number, sessionId?: string): Promise<number>;
export declare function getProjectSecrets(messageDB: DrizzleMessageHistoryDB, projectId: number): Promise<{
    aneonkey: string | null;
    supabaseurl: string | null;
} | null>;
export declare function normalizeUrl(url: string): string;
export declare function resolveProjectByDeployedUrl(messageDB: DrizzleMessageHistoryDB, userId: number, deployedUrl?: string, sessionId?: string, projectId?: number): Promise<{
    projectId: number | null;
    project: any | null;
    matchReason: string;
}>;
