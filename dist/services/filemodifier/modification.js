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
exports.RedisModificationSummary = void 0;
class RedisModificationSummary {
    constructor(redis, sessionId) {
        this.redis = redis;
        this.sessionId = sessionId;
    }
    /**
     * Add a new modification change to the tracking
     */
    addChange(type, file, description, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const change = {
                type,
                file,
                description,
                timestamp: new Date().toISOString(),
                approach: options === null || options === void 0 ? void 0 : options.approach,
                success: options === null || options === void 0 ? void 0 : options.success,
                details: {
                    linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                    componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                    reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                }
            };
            yield this.redis.addModificationChange(this.sessionId, change);
        });
    }
    /**
     * Get all changes for this session
     */
    getChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.redis.getModificationChanges(this.sessionId);
        });
    }
    /**
     * Get a comprehensive summary of all modifications in this session
     */
    getSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            if (changes.length === 0) {
                return "No changes recorded in this session.";
            }
            const uniqueFiles = new Set(changes.map(c => c.file));
            const successfulChanges = changes.filter(c => c.success !== false);
            const failedChanges = changes.filter(c => c.success === false);
            const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            const summary = `
**MODIFICATION SESSION SUMMARY:**
📊 **Session Stats:**
   • Total Changes: ${changes.length}
   • Files Affected: ${uniqueFiles.size}
   • Success Rate: ${Math.round((successfulChanges.length / changes.length) * 100)}%
   • Session Duration: ${this.getSessionDuration(sessionStartTime)}

📝 **Changes Made:**
${changes.map((change, index) => {
                var _a;
                const icon = this.getChangeIcon(change);
                const status = change.success === false ? ' ❌' : change.success === true ? ' ✅' : '';
                return `   ${index + 1}. ${icon} ${change.file}${status}
      ${change.description}
      ${change.approach ? `• Approach: ${change.approach}` : ''}
      ${((_a = change.details) === null || _a === void 0 ? void 0 : _a.reasoning) ? `• Strategy: ${change.details.reasoning}` : ''}`;
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
        });
    }
    /**
     * Get a contextual summary for use in AI prompts
     */
    getContextualSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            if (changes.length === 0) {
                return "";
            }
            const recentChanges = changes.slice(-5); // Last 5 changes
            const uniqueFiles = new Set(changes.map(c => c.file));
            const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            let summary = `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
                const icon = this.getChangeIcon(change);
                const status = change.success === false ? ' (failed)' : '';
                return `• ${icon} ${change.file}${status}: ${change.description}`;
            }).join('\n')}

**Session Context:**
• Total files modified: ${uniqueFiles.size}
• Primary approach: ${yield this.getPrimaryApproach()}
• Session duration: ${this.getSessionDuration(sessionStartTime)}
    `.trim();
            return summary;
        });
    }
    /**
     * Get detailed statistics about the modification session
     */
    getDetailedStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            const uniqueFiles = new Set(changes.map(c => c.file));
            const successfulChanges = changes.filter(c => c.success !== false);
            const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            return {
                changes: changes,
                totalFiles: uniqueFiles.size,
                totalChanges: changes.length,
                approach: yield this.getPrimaryApproach(),
                sessionDuration: this.getSessionDurationMinutes(sessionStartTime),
                successRate: changes.length > 0 ? Math.round((successfulChanges.length / changes.length) * 100) : 0,
                startTime: sessionStartTime,
                endTime: new Date().toISOString()
            };
        });
    }
    /**
     * Get changes by type
     */
    getChangesByType() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            return {
                created: changes.filter(c => c.type === 'created'),
                modified: changes.filter(c => c.type === 'modified'),
                updated: changes.filter(c => c.type === 'updated')
            };
        });
    }
    /**
     * Get changes by file
     */
    getChangesByFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            const changesByFile = {};
            changes.forEach(change => {
                if (!changesByFile[change.file]) {
                    changesByFile[change.file] = [];
                }
                changesByFile[change.file].push(change);
            });
            return changesByFile;
        });
    }
    /**
     * Get the most frequently modified files
     */
    getMostModifiedFiles() {
        return __awaiter(this, arguments, void 0, function* (limit = 5) {
            const changes = yield this.getChanges();
            const fileStats = {};
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
        });
    }
    /**
     * Get a user-friendly progress update
     */
    getProgressUpdate() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            if (changes.length === 0) {
                return "Session started - ready for modifications!";
            }
            const lastChange = changes[changes.length - 1];
            const uniqueFiles = new Set(changes.map(c => c.file)).size;
            const icon = this.getChangeIcon(lastChange);
            return `${icon} Latest: ${lastChange.description} | ${changes.length} changes across ${uniqueFiles} files`;
        });
    }
    /**
     * Export session data for persistence
     */
    exportSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            return {
                sessionId: this.sessionId,
                startTime: sessionStartTime,
                endTime: new Date().toISOString(),
                changes: changes,
                summary: yield this.getDetailedStats()
            };
        });
    }
    /**
     * Clear all changes (start fresh session)
     */
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.setModificationChanges(this.sessionId, []);
            yield this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
        });
    }
    /**
     * Get the number of changes
     */
    getChangeCount() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            return changes.length;
        });
    }
    /**
     * Check if any changes have been made
     */
    hasChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            return changes.length > 0;
        });
    }
    /**
     * Get recent changes
     */
    getRecentChanges() {
        return __awaiter(this, arguments, void 0, function* (limit = 5) {
            const changes = yield this.getChanges();
            return changes.slice(-limit);
        });
    }
    /**
     * Get changes within a time range
     */
    getChangesInTimeRange(startTime, endTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();
            return changes.filter(change => {
                const changeTime = new Date(change.timestamp).getTime();
                return changeTime >= start && changeTime <= end;
            });
        });
    }
    /**
     * Get success/failure statistics
     */
    getSuccessStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            const total = changes.length;
            const successful = changes.filter(c => c.success !== false).length;
            const failed = changes.filter(c => c.success === false).length;
            return {
                total,
                successful,
                failed,
                successRate: total > 0 ? Math.round((successful / total) * 100) : 0
            };
        });
    }
    // Private helper methods
    getChangeIcon(change) {
        switch (change.type) {
            case 'created': return '📝';
            case 'modified': return '🔄';
            case 'updated': return '⚡';
            default: return '🔧';
        }
    }
    getPrimaryApproach() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.getChanges();
            if (changes.length === 0)
                return 'None';
            const approaches = {};
            changes.forEach(change => {
                if (change.approach) {
                    approaches[change.approach] = (approaches[change.approach] || 0) + 1;
                }
            });
            const sortedApproaches = Object.entries(approaches)
                .sort(([, a], [, b]) => b - a);
            return sortedApproaches.length > 0 ? sortedApproaches[0][0] : 'Mixed';
        });
    }
    getSessionDuration(sessionStartTime) {
        const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }
    getSessionDurationMinutes(sessionStartTime) {
        const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
        return Math.floor(durationMs / 60000);
    }
}
exports.RedisModificationSummary = RedisModificationSummary;
//# sourceMappingURL=modification.js.map