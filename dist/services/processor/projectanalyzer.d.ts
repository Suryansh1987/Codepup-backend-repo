import { ProjectFile } from '../filemodifier/types';
import { DependencyManager } from '../filemodifier/dependancy';
export declare class ProjectAnalyzer {
    private reactBasePath;
    private streamCallback?;
    constructor(reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * ENHANCED: Real-time filesystem verification during cache building
     */
    buildProjectTree(projectFiles: Map<string, ProjectFile>, dependencyManager: DependencyManager, streamCallback?: (message: string) => void): Promise<void>;
    /**
     * ENHANCED: Analyze file with real-time filesystem verification
     */
    private analyzeFileWithVerification;
    /**
     * NEW: Verify all cached project files actually exist on filesystem
     */
    private verifyProjectFilesCache;
    /**
     * NEW: Try to find file in alternative locations
     */
    private findFileInAlternativeLocation;
    /**
     * NEW: Clean up stale cache entries
     */
    cleanupStaleCache(projectFiles: Map<string, ProjectFile>): Promise<void>;
    /**
     * NEW: Force refresh a specific file in cache
     */
    refreshFileInCache(filePath: string, projectFiles: Map<string, ProjectFile>): Promise<boolean>;
    private shouldExcludeFile;
    private isUILibraryFile;
    buildProjectSummary(projectFiles: Map<string, ProjectFile>): string;
    private extractComponentNameFromContent;
    private checkForButtons;
    private checkForSignin;
    private isMainFile;
}
