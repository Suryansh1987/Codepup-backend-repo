// services/filemodifier/modification-redis.ts
import { ModificationChange, ModificationSessionSummary } from './types';
import { RedisService } from '../Redis';

export class RedisModificationSummary {
  private redis: RedisService;
  private sessionId: string;

  constructor(redis: RedisService, sessionId: string) {
    this.redis = redis;
    this.sessionId = sessionId;
  }

  /**
   * Add a new modification change to the tracking
   */
  async addChange(
    type: 'modified' | 'created' | 'updated',
    file: string,
    description: string,
    options?: {
      approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
      success?: boolean;
      linesChanged?: number;
      componentsAffected?: string[];
      reasoning?: string;
    }
  ): Promise<void> {
    const change: ModificationChange = {
      type,
      file,
      description,
      timestamp: new Date().toISOString(),
      approach: options?.approach,
      success: options?.success,
      details: {
        linesChanged: options?.linesChanged,
        componentsAffected: options?.componentsAffected,
        reasoning: options?.reasoning
      }
    };

    await this.redis.addModificationChange(this.sessionId, change);
  }

  /**
   * Get all changes for this session
   */
  async getChanges(): Promise<ModificationChange[]> {
    return await this.redis.getModificationChanges(this.sessionId);
  }

  /**
   * Get a comprehensive summary of all modifications in this session
   */
  async getSummary(): Promise<string> {
    const changes = await this.getChanges();
    
    if (changes.length === 0) {
      return "No changes recorded in this session.";
    }

    const uniqueFiles = new Set(changes.map(c => c.file));
    const successfulChanges = changes.filter(c => c.success !== false);
    const failedChanges = changes.filter(c => c.success === false);
    const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);

    const summary = `
**MODIFICATION SESSION SUMMARY:**
📊 **Session Stats:**
   • Total Changes: ${changes.length}
   • Files Affected: ${uniqueFiles.size}
   • Success Rate: ${Math.round((successfulChanges.length / changes.length) * 100)}%
   • Session Duration: ${this.getSessionDuration(sessionStartTime)}

📝 **Changes Made:**
${changes.map((change, index) => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' ❌' : change.success === true ? ' ✅' : '';
  return `   ${index + 1}. ${icon} ${change.file}${status}
      ${change.description}
      ${change.approach ? `• Approach: ${change.approach}` : ''}
      ${change.details?.reasoning ? `• Strategy: ${change.details.reasoning}` : ''}`;
}).join('\n\n')}

🕐 **Timeline:**
   • Started: ${new Date(sessionStartTime).toLocaleTimeString()}
   • Completed: ${new Date().toLocaleTimeString()}

${failedChanges.length > 0 ? `
⚠️ **Issues Encountered:**
${failedChanges.map(change => `   • ${change.file}: ${change.description}`).join('\n')}
` : ''}
    `.trim();

    return summary;
  }

  /**
   * Get a contextual summary for use in AI prompts
   */
  async getContextualSummary(): Promise<string> {
    const changes = await this.getChanges();
    
    if (changes.length === 0) {
      return "";
    }

    const recentChanges = changes.slice(-5); // Last 5 changes
    const uniqueFiles = new Set(changes.map(c => c.file));
    const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);
    
    let summary = `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' (failed)' : '';
  return `• ${icon} ${change.file}${status}: ${change.description}`;
}).join('\n')}

**Session Context:**
• Total files modified: ${uniqueFiles.size}
• Primary approach: ${await this.getPrimaryApproach()}
• Session duration: ${this.getSessionDuration(sessionStartTime)}
    `.trim();

    return summary;
  }

  /**
   * Get detailed statistics about the modification session
   */
  async getDetailedStats(): Promise<ModificationSessionSummary> {
    const changes = await this.getChanges();
    const uniqueFiles = new Set(changes.map(c => c.file));
    const successfulChanges = changes.filter(c => c.success !== false);
    const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);
    
    return {
      changes: changes,
      totalFiles: uniqueFiles.size,
      totalChanges: changes.length,
      approach: await this.getPrimaryApproach(),
      sessionDuration: this.getSessionDurationMinutes(sessionStartTime),
      successRate: changes.length > 0 ? Math.round((successfulChanges.length / changes.length) * 100) : 0,
      startTime: sessionStartTime,
      endTime: new Date().toISOString()
    };
  }

  /**
   * Get changes by type
   */
  async getChangesByType(): Promise<Record<string, ModificationChange[]>> {
    const changes = await this.getChanges();
    return {
      created: changes.filter(c => c.type === 'created'),
      modified: changes.filter(c => c.type === 'modified'),
      updated: changes.filter(c => c.type === 'updated')
    };
  }

  /**
   * Get changes by file
   */
  async getChangesByFile(): Promise<Record<string, ModificationChange[]>> {
    const changes = await this.getChanges();
    const changesByFile: Record<string, ModificationChange[]> = {};
    
    changes.forEach(change => {
      if (!changesByFile[change.file]) {
        changesByFile[change.file] = [];
      }
      changesByFile[change.file].push(change);
    });
    
    return changesByFile;
  }

  /**
   * Get the most frequently modified files
   */
  async getMostModifiedFiles(limit: number = 5): Promise<Array<{ file: string; count: number; types: string[] }>> {
    const changes = await this.getChanges();
    const fileStats: Record<string, { count: number; types: Set<string> }> = {};
    
    changes.forEach(change => {
      if (!fileStats[change.file]) {
        fileStats[change.file] = { count: 0, types: new Set() };
      }
      fileStats[change.file].count++;
      fileStats[change.file].types.add(change.type);
    });
    
    return Object.entries(fileStats)
      .map(([file, stats]) => ({
        file,
        count: stats.count,
        types: Array.from(stats.types)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get a user-friendly progress update
   */
  async getProgressUpdate(): Promise<string> {
    const changes = await this.getChanges();
    
    if (changes.length === 0) {
      return "Session started - ready for modifications!";
    }

    const lastChange = changes[changes.length - 1];
    const uniqueFiles = new Set(changes.map(c => c.file)).size;
    const icon = this.getChangeIcon(lastChange);
    
    return `${icon} Latest: ${lastChange.description} | ${changes.length} changes across ${uniqueFiles} files`;
  }

  /**
   * Export session data for persistence
   */
  async exportSession(): Promise<{
    sessionId: string;
    startTime: string;
    endTime: string;
    changes: ModificationChange[];
    summary: ModificationSessionSummary;
  }> {
    const changes = await this.getChanges();
    const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);
    
    return {
      sessionId: this.sessionId,
      startTime: sessionStartTime,
      endTime: new Date().toISOString(),
      changes: changes,
      summary: await this.getDetailedStats()
    };
  }

  /**
   * Clear all changes (start fresh session)
   */
  async clear(): Promise<void> {
    await this.redis.setModificationChanges(this.sessionId, []);
    await this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
  }

  /**
   * Get the number of changes
   */
  async getChangeCount(): Promise<number> {
    const changes = await this.getChanges();
    return changes.length;
  }

  /**
   * Check if any changes have been made
   */
  async hasChanges(): Promise<boolean> {
    const changes = await this.getChanges();
    return changes.length > 0;
  }

  /**
   * Get recent changes
   */
  async getRecentChanges(limit: number = 5): Promise<ModificationChange[]> {
    const changes = await this.getChanges();
    return changes.slice(-limit);
  }

  /**
   * Get changes within a time range
   */
  async getChangesInTimeRange(startTime: string, endTime: string): Promise<ModificationChange[]> {
    const changes = await this.getChanges();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return changes.filter(change => {
      const changeTime = new Date(change.timestamp).getTime();
      return changeTime >= start && changeTime <= end;
    });
  }

  /**
   * Get success/failure statistics
   */
  async getSuccessStats(): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }> {
    const changes = await this.getChanges();
    const total = changes.length;
    const successful = changes.filter(c => c.success !== false).length;
    const failed = changes.filter(c => c.success === false).length;
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    };
  }

  // Private helper methods

  private getChangeIcon(change: ModificationChange): string {
    switch (change.type) {
      case 'created': return '📝';
      case 'modified': return '🔄';
      case 'updated': return '⚡';
      default: return '🔧';
    }
  }

  private async getPrimaryApproach(): Promise<string> {
    const changes = await this.getChanges();
    
    if (changes.length === 0) return 'None';
    
    const approaches: Record<string, number> = {};
    changes.forEach(change => {
      if (change.approach) {
        approaches[change.approach] = (approaches[change.approach] || 0) + 1;
      }
    });
    
    const sortedApproaches = Object.entries(approaches)
      .sort(([,a], [,b]) => b - a);
    
    return sortedApproaches.length > 0 ? sortedApproaches[0][0] : 'Mixed';
  }

  private getSessionDuration(sessionStartTime: string): string {
    const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  private getSessionDurationMinutes(sessionStartTime: string): number {
    const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
    return Math.floor(durationMs / 60000);
  }
}