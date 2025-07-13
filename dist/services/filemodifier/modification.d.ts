import { ModificationChange, ModificationSessionSummary } from './types';
import { RedisService } from '../Redis';
export declare class RedisModificationSummary {
    private redis;
    private sessionId;
    constructor(redis: RedisService, sessionId: string);
    /**
     * Add a new modification change to the tracking
     */
    addChange(type: 'modified' | 'created' | 'updated', file: string, description: string, options?: {
        approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
        success?: boolean;
        linesChanged?: number;
        componentsAffected?: string[];
        reasoning?: string;
    }): Promise<void>;
    /**
     * Get all changes for this session
     */
    getChanges(): Promise<ModificationChange[]>;
    /**
     * Get a comprehensive summary of all modifications in this session
     */
    getSummary(): Promise<string>;
    /**
     * Get a contextual summary for use in AI prompts
     */
    getContextualSummary(): Promise<string>;
    /**
     * Get detailed statistics about the modification session
     */
    getDetailedStats(): Promise<ModificationSessionSummary>;
    /**
     * Get changes by type
     */
    getChangesByType(): Promise<Record<string, ModificationChange[]>>;
    /**
     * Get changes by file
     */
    getChangesByFile(): Promise<Record<string, ModificationChange[]>>;
    /**
     * Get the most frequently modified files
     */
    getMostModifiedFiles(limit?: number): Promise<Array<{
        file: string;
        count: number;
        types: string[];
    }>>;
    /**
     * Get a user-friendly progress update
     */
    getProgressUpdate(): Promise<string>;
    /**
     * Export session data for persistence
     */
    exportSession(): Promise<{
        sessionId: string;
        startTime: string;
        endTime: string;
        changes: ModificationChange[];
        summary: ModificationSessionSummary;
    }>;
    /**
     * Clear all changes (start fresh session)
     */
    clear(): Promise<void>;
    /**
     * Get the number of changes
     */
    getChangeCount(): Promise<number>;
    /**
     * Check if any changes have been made
     */
    hasChanges(): Promise<boolean>;
    /**
     * Get recent changes
     */
    getRecentChanges(limit?: number): Promise<ModificationChange[]>;
    /**
     * Get changes within a time range
     */
    getChangesInTimeRange(startTime: string, endTime: string): Promise<ModificationChange[]>;
    /**
     * Get success/failure statistics
     */
    getSuccessStats(): Promise<{
        total: number;
        successful: number;
        failed: number;
        successRate: number;
    }>;
    private getChangeIcon;
    private getPrimaryApproach;
    private getSessionDuration;
    private getSessionDurationMinutes;
}
