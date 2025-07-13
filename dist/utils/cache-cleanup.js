"use strict";
// ============================================================================
// CACHE CLEANUP UTILITY: Fix Filesystem-Cache Sync Issues
// ============================================================================
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
exports.CacheCleanupUtility = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class CacheCleanupUtility {
    constructor(redis, reactBasePath) {
        this.redis = redis;
        this.reactBasePath = reactBasePath;
    }
    /**
     * Comprehensive cache cleanup and sync with filesystem
     */
    cleanupAndSyncCache(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log(`🧹 Starting comprehensive cache cleanup for session: ${sessionId}`);
            const results = {
                totalCached: 0,
                verified: 0,
                removed: 0,
                updated: 0,
                issues: []
            };
            // Get cached project files
            const projectFiles = yield this.redis.getProjectFiles(sessionId);
            if (!projectFiles || projectFiles.size === 0) {
                console.log('📭 No cached project files found');
                return results;
            }
            results.totalCached = projectFiles.size;
            console.log(`📊 Found ${results.totalCached} files in cache`);
            const validFiles = new Map();
            const filesToRemove = [];
            // Check each cached file
            for (const [relativePath, file] of projectFiles) {
                const checkResult = yield this.checkAndFixFile(relativePath, file);
                switch (checkResult.status) {
                    case 'verified':
                        validFiles.set(relativePath, checkResult.file);
                        results.verified++;
                        break;
                    case 'updated':
                        validFiles.set(relativePath, checkResult.file);
                        results.updated++;
                        console.log(`✅ Updated path for ${relativePath}: ${checkResult.newPath}`);
                        break;
                    case 'missing':
                        filesToRemove.push(relativePath);
                        results.removed++;
                        results.issues.push(`Missing: ${relativePath} (checked: ${(_a = checkResult.checkedPaths) === null || _a === void 0 ? void 0 : _a.join(', ')})`);
                        console.log(`❌ Removing missing file from cache: ${relativePath}`);
                        break;
                    case 'error':
                        results.issues.push(`Error: ${relativePath} - ${checkResult.error}`);
                        console.log(`⚠️ Error checking ${relativePath}: ${checkResult.error}`);
                        break;
                }
            }
            // Update cache with verified files only
            yield this.redis.setProjectFiles(sessionId, validFiles);
            console.log(`✅ Cache cleanup complete:`);
            console.log(`   - Total cached: ${results.totalCached}`);
            console.log(`   - Verified: ${results.verified}`);
            console.log(`   - Updated paths: ${results.updated}`);
            console.log(`   - Removed: ${results.removed}`);
            console.log(`   - Issues: ${results.issues.length}`);
            return results;
        });
    }
    /**
     * Check and fix a single cached file
     */
    checkAndFixFile(relativePath, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const checkedPaths = [];
            try {
                // First, try the stored path
                checkedPaths.push(file.path);
                if (yield this.fileExists(file.path)) {
                    // Verify file is still readable and writable
                    yield fs_1.promises.access(file.path, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                    return { status: 'verified', file };
                }
                // Try alternative paths
                const alternativePaths = this.generateAlternativePaths(relativePath, file);
                for (const altPath of alternativePaths) {
                    checkedPaths.push(altPath);
                    if (yield this.fileExists(altPath)) {
                        try {
                            yield fs_1.promises.access(altPath, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                            // Update the file object with correct path
                            const updatedFile = Object.assign(Object.assign({}, file), { path: altPath });
                            return {
                                status: 'updated',
                                file: updatedFile,
                                newPath: altPath,
                                checkedPaths
                            };
                        }
                        catch (accessError) {
                            console.log(`⚠️ Found ${altPath} but no read/write access: ${accessError}`);
                        }
                    }
                }
                return {
                    status: 'missing',
                    checkedPaths
                };
            }
            catch (error) {
                return {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    checkedPaths
                };
            }
        });
    }
    /**
     * Generate alternative paths to check for a file
     */
    generateAlternativePaths(relativePath, file) {
        var _a;
        const alternatives = [];
        // Remove 'src/' prefix variations
        const cleanRelativePath = relativePath.replace(/^src[\/\\]/, '');
        // Different base path combinations
        alternatives.push((0, path_1.join)(this.reactBasePath, relativePath), (0, path_1.join)(this.reactBasePath, cleanRelativePath), (0, path_1.join)(this.reactBasePath, 'src', cleanRelativePath));
        // File extension variations
        const extensions = ['.tsx', '.jsx', '.ts', '.js'];
        const currentExt = (_a = file.path.match(/\.(tsx?|jsx?)$/)) === null || _a === void 0 ? void 0 : _a[0];
        if (currentExt) {
            for (const ext of extensions) {
                if (ext !== currentExt) {
                    const newPath = file.path.replace(/\.(tsx?|jsx?)$/, ext);
                    alternatives.push(newPath);
                    alternatives.push((0, path_1.join)(this.reactBasePath, newPath.replace(this.reactBasePath, '')));
                }
            }
        }
        // Case variations (for case-sensitive filesystems)
        alternatives.push(file.path.toLowerCase(), file.path.toUpperCase());
        // Remove duplicates
        return [...new Set(alternatives)];
    }
    /**
     * Check if file exists
     */
    fileExists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs_1.promises.access(filePath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    /**
     * Force rebuild cache from filesystem
     */
    rebuildCacheFromFilesystem(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🔄 Force rebuilding cache from filesystem for session: ${sessionId}`);
            // Clear existing cache
            yield this.redis.setProjectFiles(sessionId, new Map());
            // This will trigger a fresh scan
            console.log(`✅ Cache cleared. Next project tree build will scan filesystem fresh.`);
        });
    }
    /**
     * Validate cache integrity
     */
    validateCacheIntegrity(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🔍 Validating cache integrity for session: ${sessionId}`);
            const projectFiles = yield this.redis.getProjectFiles(sessionId);
            const issues = [];
            let missingFiles = 0;
            if (!projectFiles) {
                return {
                    isValid: true,
                    totalFiles: 0,
                    missingFiles: 0,
                    issues: ['No cache found']
                };
            }
            for (const [relativePath, file] of projectFiles) {
                if (!(yield this.fileExists(file.path))) {
                    missingFiles++;
                    issues.push(`Missing: ${relativePath} at ${file.path}`);
                }
            }
            const isValid = missingFiles === 0;
            console.log(`📊 Cache integrity check:`);
            console.log(`   - Total files: ${projectFiles.size}`);
            console.log(`   - Missing files: ${missingFiles}`);
            console.log(`   - Is valid: ${isValid}`);
            return {
                isValid,
                totalFiles: projectFiles.size,
                missingFiles,
                issues
            };
        });
    }
    /**
     * Emergency cache reset
     */
    emergencyReset(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🚨 Emergency cache reset for session: ${sessionId}`);
            yield this.redis.clearSession(sessionId);
            console.log(`✅ Emergency reset complete. All session data cleared.`);
        });
    }
}
exports.CacheCleanupUtility = CacheCleanupUtility;
//# sourceMappingURL=cache-cleanup.js.map