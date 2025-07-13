// ============================================================================
// CACHE CLEANUP UTILITY: Fix Filesystem-Cache Sync Issues
// ============================================================================

import { RedisService } from '../services/Redis';
import { ProjectFile } from '../services/filemodifier/types';
import { promises as fs } from 'fs';
import { join } from 'path';

export class CacheCleanupUtility {
  private redis: RedisService;
  private reactBasePath: string;

  constructor(redis: RedisService, reactBasePath: string) {
    this.redis = redis;
    this.reactBasePath = reactBasePath;
  }

  /**
   * Comprehensive cache cleanup and sync with filesystem
   */
  async cleanupAndSyncCache(sessionId: string): Promise<{
    totalCached: number;
    verified: number;
    removed: number;
    updated: number;
    issues: string[];
  }> {
    console.log(`🧹 Starting comprehensive cache cleanup for session: ${sessionId}`);
    
    const results = {
      totalCached: 0,
      verified: 0,
      removed: 0,
      updated: 0,
      issues: [] as string[]
    };

    // Get cached project files
    const projectFiles = await this.redis.getProjectFiles(sessionId);
    
    if (!projectFiles || projectFiles.size === 0) {
      console.log('📭 No cached project files found');
      return results;
    }

    results.totalCached = projectFiles.size;
    console.log(`📊 Found ${results.totalCached} files in cache`);

    const validFiles = new Map<string, ProjectFile>();
    const filesToRemove: string[] = [];

    // Check each cached file
    for (const [relativePath, file] of projectFiles) {
      const checkResult = await this.checkAndFixFile(relativePath, file);
      
      switch (checkResult.status) {
        case 'verified':
          validFiles.set(relativePath, checkResult.file!);
          results.verified++;
          break;
        case 'updated':
          validFiles.set(relativePath, checkResult.file!);
          results.updated++;
          console.log(`✅ Updated path for ${relativePath}: ${checkResult.newPath}`);
          break;
        case 'missing':
          filesToRemove.push(relativePath);
          results.removed++;
          results.issues.push(`Missing: ${relativePath} (checked: ${checkResult.checkedPaths?.join(', ')})`);
          console.log(`❌ Removing missing file from cache: ${relativePath}`);
          break;
        case 'error':
          results.issues.push(`Error: ${relativePath} - ${checkResult.error}`);
          console.log(`⚠️ Error checking ${relativePath}: ${checkResult.error}`);
          break;
      }
    }

    // Update cache with verified files only
    await this.redis.setProjectFiles(sessionId, validFiles);
    
    console.log(`✅ Cache cleanup complete:`);
    console.log(`   - Total cached: ${results.totalCached}`);
    console.log(`   - Verified: ${results.verified}`);
    console.log(`   - Updated paths: ${results.updated}`);
    console.log(`   - Removed: ${results.removed}`);
    console.log(`   - Issues: ${results.issues.length}`);

    return results;
  }

  /**
   * Check and fix a single cached file
   */
  private async checkAndFixFile(relativePath: string, file: ProjectFile): Promise<{
    status: 'verified' | 'updated' | 'missing' | 'error';
    file?: ProjectFile;
    newPath?: string;
    checkedPaths?: string[];
    error?: string;
  }> {
    const checkedPaths: string[] = [];

    try {
      // First, try the stored path
      checkedPaths.push(file.path);
      if (await this.fileExists(file.path)) {
        // Verify file is still readable and writable
        await fs.access(file.path, fs.constants.R_OK | fs.constants.W_OK);
        return { status: 'verified', file };
      }

      // Try alternative paths
      const alternativePaths = this.generateAlternativePaths(relativePath, file);
      
      for (const altPath of alternativePaths) {
        checkedPaths.push(altPath);
        if (await this.fileExists(altPath)) {
          try {
            await fs.access(altPath, fs.constants.R_OK | fs.constants.W_OK);
            
            // Update the file object with correct path
            const updatedFile: ProjectFile = {
              ...file,
              path: altPath
            };
            
            return { 
              status: 'updated', 
              file: updatedFile, 
              newPath: altPath,
              checkedPaths 
            };
          } catch (accessError) {
            console.log(`⚠️ Found ${altPath} but no read/write access: ${accessError}`);
          }
        }
      }

      return { 
        status: 'missing', 
        checkedPaths 
      };

    } catch (error) {
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        checkedPaths 
      };
    }
  }

  /**
   * Generate alternative paths to check for a file
   */
  private generateAlternativePaths(relativePath: string, file: ProjectFile): string[] {
    const alternatives: string[] = [];
    
    // Remove 'src/' prefix variations
    const cleanRelativePath = relativePath.replace(/^src[\/\\]/, '');
    
    // Different base path combinations
    alternatives.push(
      join(this.reactBasePath, relativePath),
      join(this.reactBasePath, cleanRelativePath),
      join(this.reactBasePath, 'src', cleanRelativePath),
    );

    // File extension variations
    const extensions = ['.tsx', '.jsx', '.ts', '.js'];
    const currentExt = file.path.match(/\.(tsx?|jsx?)$/)?.[0];
    
    if (currentExt) {
      for (const ext of extensions) {
        if (ext !== currentExt) {
          const newPath = file.path.replace(/\.(tsx?|jsx?)$/, ext);
          alternatives.push(newPath);
          alternatives.push(join(this.reactBasePath, newPath.replace(this.reactBasePath, '')));
        }
      }
    }

    // Case variations (for case-sensitive filesystems)
    alternatives.push(
      file.path.toLowerCase(),
      file.path.toUpperCase()
    );

    // Remove duplicates
    return [...new Set(alternatives)];
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Force rebuild cache from filesystem
   */
  async rebuildCacheFromFilesystem(sessionId: string): Promise<void> {
    console.log(`🔄 Force rebuilding cache from filesystem for session: ${sessionId}`);
    
    // Clear existing cache
    await this.redis.setProjectFiles(sessionId, new Map());
    
    // This will trigger a fresh scan
    console.log(`✅ Cache cleared. Next project tree build will scan filesystem fresh.`);
  }

  /**
   * Validate cache integrity
   */
  async validateCacheIntegrity(sessionId: string): Promise<{
    isValid: boolean;
    totalFiles: number;
    missingFiles: number;
    issues: string[];
  }> {
    console.log(`🔍 Validating cache integrity for session: ${sessionId}`);
    
    const projectFiles = await this.redis.getProjectFiles(sessionId);
    const issues: string[] = [];
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
      if (!await this.fileExists(file.path)) {
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
  }

  /**
   * Emergency cache reset
   */
  async emergencyReset(sessionId: string): Promise<void> {
    console.log(`🚨 Emergency cache reset for session: ${sessionId}`);
    
    await this.redis.clearSession(sessionId);
    
    console.log(`✅ Emergency reset complete. All session data cleared.`);
  }
}