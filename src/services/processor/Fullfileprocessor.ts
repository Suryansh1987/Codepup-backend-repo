// ============================================================================
// UPGRADED FULL FILE PROCESSOR - WITH TAILWIND CONFIG AUTO-SELECTION
// ============================================================================

import { join, basename, dirname, resolve, relative, isAbsolute } from 'path';
import { promises as fs } from 'fs';
import {fullFilePrompt} from '../filemodifier/template'

// ============================================================================
// ENHANCED FILE ANALYZER WITH TAILWIND CONFIG
// ============================================================================

class EnhancedFileAnalyzer {
  private anthropic: any;

  constructor(anthropic: any) {
    this.anthropic = anthropic;
  }

  async analyzeFiles(
    prompt: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<FileAnalysisResult[]> {
    
    // ALWAYS include Tailwind config for color/styling context
    const tailwindConfig = this.findTailwindConfig(projectFiles);
    
    // Create detailed file summaries
    const fileSummaries = Array.from(projectFiles.entries())
      .map(([path, file]) => {
        const purpose = this.inferFilePurpose(file);
        const preview = file.content.substring(0, 200).replace(/\n/g, ' ');
        return `${path} (${file.lines} lines) - ${purpose}\n  Preview: ${preview}...`;
      })
      .join('\n\n');
    
    const tailwindContext = tailwindConfig ? `
TAILWIND CONFIG FOUND: ${tailwindConfig.path}
TAILWIND COLORS/TOKENS:
${this.extractTailwindTokens(tailwindConfig.content)}
` : 'NO TAILWIND CONFIG FOUND';

    const analysisPrompt = `
TASK: Analyze which files need modification for the user request.

USER REQUEST: "${prompt}"

${tailwindContext}

AVAILABLE FILES:
${fileSummaries}

INSTRUCTIONS:
1. ALWAYS include tailwind.config.js/ts if it exists (for color/styling context)
2. Select ONLY files that need modification for the specific request
3. Be selective - don't modify unnecessary files
4. Focus on main components and relevant files
5. For layout changes: select all components and pages (not app.tsx unless routing)
6. For color/styling changes: select all components and pages + tailwind.config.js
7. For functionality changes: select relevant components and any config files
8. Provide clear reasoning for each selection

RESPONSE FORMAT:
Return a JSON array:
[
  {
    "filePath": "tailwind.config.js",
    "relevanceScore": 95,
    "reasoning": "Always include for styling context and available colors",
    "changeType": ["config", "styling"],
    "priority": "high"
  },
  {
    "filePath": "src/App.tsx",
    "relevanceScore": 85,
    "reasoning": "This file needs modification because...",
    "changeType": ["styling", "layout"],
    "priority": "high"
  }
]

ANALYSIS:`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return this.getFallbackFileSelection(prompt, projectFiles, tailwindConfig);
      }
      
      const analysisResults = JSON.parse(jsonMatch[0]);
      const relevantFiles: FileAnalysisResult[] = [];
      
      // Process analysis results
      for (const result of analysisResults) {
        const file = this.findFileInProject(result.filePath, projectFiles);
        if (file) {
          relevantFiles.push({
            filePath: result.filePath,
            file,
            relevanceScore: result.relevanceScore || 50,
            reasoning: result.reasoning || 'Selected by analysis',
            changeType: result.changeType || ['general'],
            priority: result.priority || 'medium'
          });
        }
      }
      
      // CRITICAL: Always ensure Tailwind config is included if it exists
      const hasTailwindConfig = relevantFiles.some(f => 
        f.filePath.includes('tailwind.config'));
      
      if (tailwindConfig && !hasTailwindConfig) {
        relevantFiles.unshift({
          filePath: tailwindConfig.path,
          file: tailwindConfig.file,
          relevanceScore: 95,
          reasoning: 'Auto-included: Essential for styling context and available colors',
          changeType: ['config', 'styling'],
          priority: 'high'
        });
      }
      
      return relevantFiles;
      
    } catch (error) {
      return this.getFallbackFileSelection(prompt, projectFiles, tailwindConfig);
    }
  }

  /**
   * FIND TAILWIND CONFIG FILE
   */
  private findTailwindConfig(projectFiles: Map<string, ProjectFile>): { path: string; file: ProjectFile; content: string } | null {
    const tailwindPatterns = [
      'tailwind.config.js',
      'tailwind.config.ts',
      'tailwind.config.mjs',
      'tailwind.config.cjs',
      'src/tailwind.config.js',
      'src/tailwind.config.ts'
    ];

    for (const pattern of tailwindPatterns) {
      const file = projectFiles.get(pattern);
      if (file) {
        return {
          path: pattern,
          file,
          content: file.content
        };
      }
    }

    // Try case-insensitive search
    for (const [path, file] of projectFiles) {
      if (path.toLowerCase().includes('tailwind.config')) {
        return {
          path,
          file,
          content: file.content
        };
      }
    }

    return null;
  }

  /**
   * EXTRACT TAILWIND TOKENS FOR CONTEXT
   */
  private extractTailwindTokens(tailwindContent: string): string {
    const tokens: string[] = [];
    
    // Extract colors
    const colorMatches = tailwindContent.match(/colors?\s*:\s*\{[^}]*\}/g);
    if (colorMatches) {
      tokens.push('COLORS:', ...colorMatches.slice(0, 3));
    }

    // Extract theme extensions
    const themeMatches = tailwindContent.match(/theme\s*:\s*\{[\s\S]*?extend\s*:\s*\{[\s\S]*?\}/);
    if (themeMatches) {
      tokens.push('THEME EXTENSIONS:', themeMatches[0].substring(0, 300) + '...');
    }

    // Extract custom utilities
    const customMatches = tailwindContent.match(/plugins\s*:\s*\[[\s\S]*?\]/);
    if (customMatches) {
      tokens.push('PLUGINS:', customMatches[0].substring(0, 200) + '...');
    }

    return tokens.length > 0 ? tokens.join('\n') : 'Standard Tailwind configuration';
  }

  private findFileInProject(filePath: string, projectFiles: Map<string, ProjectFile>): ProjectFile | null {
    // Try exact match first
    let file = projectFiles.get(filePath);
    if (file) return file;

    // Try variations
    const variations = [
      filePath.replace(/^src\//, ''),
      `src/${filePath.replace(/^src\//, '')}`,
      filePath.replace(/\\/g, '/'),
      filePath.replace(/\//g, '\\')
    ];

    for (const variation of variations) {
      file = projectFiles.get(variation);
      if (file) return file;
    }

    // Try basename matching
    const fileName = basename(filePath);
    for (const [key, value] of projectFiles) {
      if (basename(key) === fileName) {
        return value;
      }
    }

    return null;
  }

  private getFallbackFileSelection(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    tailwindConfig?: { path: string; file: ProjectFile; content: string } | null
  ): FileAnalysisResult[] {
    const relevantFiles: FileAnalysisResult[] = [];
    
    // ALWAYS include Tailwind config first if it exists
    if (tailwindConfig) {
      relevantFiles.push({
        filePath: tailwindConfig.path,
        file: tailwindConfig.file,
        relevanceScore: 95,
        reasoning: 'Auto-included: Essential for styling context and available colors',
        changeType: ['config', 'styling'],
        priority: 'high'
      });
    }
    
    // Enhanced fallback: select files based on prompt analysis
    const promptLower = prompt.toLowerCase();
    
    for (const [filePath, file] of projectFiles) {
      // Skip if already added (tailwind config)
      if (tailwindConfig && filePath === tailwindConfig.path) continue;
      
      let relevanceScore = 0;
      const changeTypes: string[] = [];
      
      // Main files get higher priority
      if (file.isMainFile || filePath.includes('App.')) {
        relevanceScore += 30;
        changeTypes.push('main');
      }
      
      // Styling-related keywords
      if (promptLower.includes('color') || promptLower.includes('style') || 
          promptLower.includes('theme') || promptLower.includes('design') ||
          promptLower.includes('background') || promptLower.includes('text')) {
        if (filePath.includes('component') || filePath.includes('page')) {
          relevanceScore += 40;
          changeTypes.push('styling');
        }
      }
      
      // Layout-related keywords
      if (promptLower.includes('layout') || promptLower.includes('grid') || 
          promptLower.includes('responsive') || promptLower.includes('flex')) {
        if (filePath.includes('component') || filePath.includes('page')) {
          relevanceScore += 40;
          changeTypes.push('layout');
        }
      }
      
      // Component-specific keywords
      if (promptLower.includes('component') || promptLower.includes('button') || 
          promptLower.includes('form') || promptLower.includes('modal')) {
        if (filePath.includes('component')) {
          relevanceScore += 50;
          changeTypes.push('component');
        }
      }

      // Navigation-related keywords
      if (promptLower.includes('nav') || promptLower.includes('header') || 
          promptLower.includes('footer') || promptLower.includes('menu')) {
        if (filePath.toLowerCase().includes('nav') || 
            filePath.toLowerCase().includes('header') || 
            filePath.toLowerCase().includes('footer')) {
          relevanceScore += 50;
          changeTypes.push('navigation');
        }
      }
      
      if (relevanceScore > 30) {
        relevantFiles.push({
          filePath,
          file,
          relevanceScore,
          reasoning: `Fallback selection based on keywords: ${changeTypes.join(', ')}`,
          changeType: changeTypes.length > 0 ? changeTypes : ['general'],
          priority: relevanceScore > 60 ? 'high' : relevanceScore > 40 ? 'medium' : 'low'
        });
      }
    }
    
    // If no files selected (except tailwind), select main files
    if (relevantFiles.length <= 1) {
      for (const [filePath, file] of projectFiles) {
        if (file.isMainFile) {
          relevantFiles.push({
            filePath,
            file,
            relevanceScore: 70,
            reasoning: 'Main application file (emergency fallback)',
            changeType: ['general'],
            priority: 'high'
          });
        }
      }
    }
    
    return relevantFiles;
  }

  private inferFilePurpose(file: ProjectFile): string {
    if (file.isMainFile) return 'Main application file';
    if (file.relativePath.includes('tailwind.config')) return 'Tailwind CSS Configuration';
    if (file.relativePath.includes('component')) return 'UI Component';
    if (file.relativePath.includes('page')) return 'Application Page';
    if (file.relativePath.includes('hook')) return 'Custom Hook';
    if (file.relativePath.includes('util')) return 'Utility Module';
    if (file.relativePath.includes('service')) return 'Service Module';
    if (file.relativePath.includes('context')) return 'Context Provider';
    return `${file.fileType} file`;
  }
}

// ============================================================================
// ENHANCED CONTENT GENERATOR WITH TAILWIND CONTEXT
// ============================================================================

class EnhancedContentGenerator {
  private anthropic: any;

  constructor(anthropic: any) {
    this.anthropic = anthropic;
  }

 async generateModifications(
  prompt: string,
  relevantFiles: FileAnalysisResult[]
): Promise<Array<{ filePath: string; modifiedContent: string }>> {
  
  // Extract Tailwind config for styling context
  const tailwindFile = relevantFiles.find(f => 
    f.filePath.includes('tailwind.config'));
  
  const tailwindContext = tailwindFile ? `
🎨 TAILWIND CONFIGURATION CONTEXT:
Available colors, themes, and custom utilities from your tailwind.config:

\`\`\`javascript
${tailwindFile.file.content}
\`\`\`

Use these custom colors and tokens when making styling changes. Prefer custom colors from the config over default Tailwind colors when available.
` : '🎨 Using standard Tailwind CSS classes.';

  const modificationPrompt = `
🚧 TASK OVERVIEW:
You are an expert TypeScript and React engineer. Modify the provided files according to the user's request while following best practices and avoiding errors related to unresolved imports, types, or external dependencies.

👤 USER REQUEST:
"${prompt}"

${tailwindContext}

🗂️ FILES TO MODIFY:

${relevantFiles.map((result, index) => `
=== FILE ${index + 1}: ${result.filePath} ===
CHANGE TYPES: ${result.changeType.join(', ')}
PRIORITY: ${result.priority}
REASONING: ${result.reasoning}

CURRENT CONTENT:
\`\`\`tsx
${result.file.content}
\`\`\`
`).join('\n')}

📏 STRICT INSTRUCTIONS:
1. Only modify the files listed above. Do NOT assume or use any files not listed.
2. If a file imports types, components, or utilities from another file that is NOT listed, you MUST:
   - Recreate the missing type locally in the file.
   - Recreate minimal versions of utilities/components **inline** inside the component or page as needed.
   - Do NOT import from unknown paths — no assumptions allowed.
3. If a type/interface is missing, define it inline at the top or near usage. Keep definitions minimal but correct.
4. Maintain TypeScript syntax correctness at all times.
5. Do not use styled-components. You MUST use **Tailwind CSS** classes for styling.
6. **USE COLORS FROM TAILWIND CONFIG**: If tailwind.config.js is provided, prioritize custom colors defined there over default Tailwind colors.
7. Keep the structure of existing components, props, and imports unless change is required by the prompt.
8. Ensure the UI remains **responsive** and **accessible**.
9. Do NOT add any new external dependencies.
10. DO NOT generate relative imports for files that are not included in the list.
11. If you must extract logic or a helper function, define it inside the same file — do NOT assume separate utility files.
12. For styling changes: Use the exact color names and custom utilities defined in tailwind.config.js when available.
13. Existing data try to preserve it.

📦 RESPONSE FORMAT:
Return each modified file in clearly marked code blocks:

\\\tsx
// FILE: ${relevantFiles[0]?.filePath}
[COMPLETE MODIFIED CONTENT]
\\\

Continue for all files. Be sure to include the FILE comment for each.
`;

  try {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [{ role: 'user', content: modificationPrompt }],
      system: fullFilePrompt
    });
   console.log("📦 Claude Token Usage:");
console.log("🔹 Input tokens:", response.usage.input_tokens);
console.log("🔹 Output tokens:", response.usage.output_tokens);
    const responseText = response.content[0]?.text || '';
    return this.extractModifiedFiles(responseText, relevantFiles);
    
  } catch (error) {
    console.error('Error generating modifications:', error);
    return [];
  }
}

  private extractModifiedFiles(
    responseText: string,
    originalFiles: FileAnalysisResult[]
  ): Array<{ filePath: string; modifiedContent: string }> {
    const modifiedFiles: Array<{ filePath: string; modifiedContent: string }> = [];
    
    // Enhanced regex to capture file paths and content
    const codeBlockRegex = /```(?:\w+)?\s*\n(?:\/\/\s*FILE:\s*(.+?)\n)?([\s\S]*?)```/g;
    let match;
    let fileIndex = 0;
    
    while ((match = codeBlockRegex.exec(responseText)) !== null) {
      let filePath = match[1]?.trim();
      const modifiedContent = match[2].trim();
      
      // If no file path in comment, use original file order
      if (!filePath && fileIndex < originalFiles.length) {
        filePath = originalFiles[fileIndex].filePath;
      }
      
      if (filePath && modifiedContent) {
        // Clean up the file path
        filePath = filePath.replace(/^["']|["']$/g, ''); // Remove quotes
        
        modifiedFiles.push({
          filePath,
          modifiedContent
        });
      }
      
      fileIndex++;
    }
    
    return modifiedFiles;
  }
}

// ============================================================================
// REST OF THE IMPLEMENTATION (keeping existing interfaces and classes)
// ============================================================================

// [Previous UpgradedPathManager class remains the same]
class UpgradedPathManager {
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(reactBasePath: string) {
    this.reactBasePath = resolve(reactBasePath.replace(/builddora/g, 'buildora'));
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  resolveFilePath(inputPath: string, ensureExists: boolean = false): string {
    let cleanPath = inputPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    cleanPath = cleanPath.replace(/^src\/src\//, 'src/');
    
    if (!cleanPath.startsWith('src/') && !isAbsolute(cleanPath)) {
      cleanPath = `src/${cleanPath}`;
    }

    const fullPath = isAbsolute(cleanPath) ? 
      resolve(cleanPath) : 
      resolve(join(this.reactBasePath, cleanPath));
    
    this.streamUpdate(`📍 Resolved file path: ${inputPath} → ${fullPath}`);
    return fullPath;
  }

  async findExistingFile(inputPath: string): Promise<string | null> {
    const searchPaths = [
      this.resolveFilePath(inputPath),
      this.resolveFilePath(`src/${inputPath.replace(/^src\//, '')}`),
      this.resolveFilePath(inputPath.replace(/^src\//, '')),
      this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.tsx'),
      this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.jsx'),
    ];

    for (const searchPath of searchPaths) {
      try {
        const stats = await fs.stat(searchPath);
        if (stats.isFile()) {
          this.streamUpdate(`📍 Found existing file: ${inputPath} → ${searchPath}`);
          return searchPath;
        }
      } catch (error) {
        // Continue searching
      }
    }

    this.streamUpdate(`❌ File not found: ${inputPath}`);
    return null;
  }

  async safeUpdateFile(filePath: string, content: string): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    try {
      const existingFilePath = await this.findExistingFile(filePath);
      
      if (!existingFilePath) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`
        };
      }
      
      const stats = await fs.stat(existingFilePath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path exists but is not a file: ${existingFilePath}`
        };
      }
      
      this.streamUpdate(`🔄 Updating existing file: ${existingFilePath}`);
      await fs.writeFile(existingFilePath, content, 'utf8');
      
      const newStats = await fs.stat(existingFilePath);
      this.streamUpdate(`✅ File updated successfully: ${existingFilePath} (${newStats.size} bytes)`);
      
      return {
        success: true,
        actualPath: existingFilePath
      };
    } catch (error) {
      this.streamUpdate(`❌ File update failed: ${error}`);
      return {
        success: false,
        error: `Failed to update file: ${error}`
      };
    }
  }

  async safeCreateFile(filePath: string, content: string): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    try {
      const fullFilePath = this.resolveFilePath(filePath);
      const directoryPath = dirname(fullFilePath);
      
      this.streamUpdate(`📁 Creating directory: ${directoryPath}`);
      await fs.mkdir(directoryPath, { recursive: true });
      
      this.streamUpdate(`💾 Writing file: ${fullFilePath}`);
      await fs.writeFile(fullFilePath, content, 'utf8');
      
      const stats = await fs.stat(fullFilePath);
      this.streamUpdate(`✅ File created successfully: ${fullFilePath} (${stats.size} bytes)`);
      
      return {
        success: true,
        actualPath: fullFilePath
      };
    } catch (error) {
      this.streamUpdate(`❌ File creation failed: ${error}`);
      return {
        success: false,
        error: `Failed to create file: ${error}`
      };
    }
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      const existingFilePath = await this.findExistingFile(filePath);
      if (!existingFilePath) {
        this.streamUpdate(`❌ File not found for reading: ${filePath}`);
        return null;
      }

      const content = await fs.readFile(existingFilePath, 'utf8');
      this.streamUpdate(`📖 Read file: ${existingFilePath} (${content.length} chars)`);
      return content;
    } catch (error) {
      this.streamUpdate(`❌ Failed to read file ${filePath}: ${error}`);
      return null;
    }
  }
}

// [Type definitions remain the same]
interface ProjectFile {
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  isMainFile: boolean;
  fileType: string;
  lastModified?: Date;
}

interface FileAnalysisResult {
  filePath: string;
  file: ProjectFile;
  relevanceScore: number;
  reasoning: string;
  changeType: string[];
  priority: 'high' | 'medium' | 'low';
}

interface ChangeRecord {
  type: string;
  file: string;
  description: string;
  success: boolean;
  details?: {
    linesChanged?: number;
    changeType?: string[];
    reasoning?: string;
  };
}

interface TokenTracker {
  logUsage(usage: any, description: string): void;
  getStats(): { totalTokens: number; estimatedCost: number };
}

// [Rest of FullFileProcessor class implementation remains the same with the enhanced analyzer and generator]
export class FullFileProcessor {
  private anthropic: any;
  private tokenTracker: TokenTracker;
  private streamCallback?: (message: string) => void;
  private basePath: string;

  private pathManager: UpgradedPathManager;
  private analyzer: EnhancedFileAnalyzer;
  private generator: EnhancedContentGenerator;

  constructor(anthropic: any, tokenTracker: TokenTracker, basePath?: string) {
    this.anthropic = anthropic;
    this.tokenTracker = tokenTracker;
    this.basePath = (basePath || process.cwd()).replace(/builddora/g, 'buildora');

    this.pathManager = new UpgradedPathManager(this.basePath);
    this.analyzer = new EnhancedFileAnalyzer(anthropic);
    this.generator = new EnhancedContentGenerator(anthropic);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.pathManager.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  async processFullFileModification(
    prompt: string,
    folderNameOrProjectFiles: string | Map<string, ProjectFile>,
    streamCallbackOrBasePath?: ((message: string) => void) | string,
    legacyStreamCallback?: (message: string) => void
  ): Promise<{
    success: boolean;
    changes?: ChangeRecord[];
    modifiedFiles?: string[];
  }> {

    this.streamUpdate('🚀 UPGRADED: Starting file modification with Tailwind config auto-selection...');

    try {
      let projectFiles: Map<string, ProjectFile>;
      let actualBasePath: string;

      if (typeof folderNameOrProjectFiles === 'string') {
        const folderName = folderNameOrProjectFiles;
        actualBasePath = this.resolveProjectPath(folderName);
        projectFiles = await this.loadProjectFiles(actualBasePath);
      } else {
        projectFiles = folderNameOrProjectFiles;
        actualBasePath = typeof streamCallbackOrBasePath === 'string' 
          ? streamCallbackOrBasePath 
          : this.basePath;
      }

      const actualCallback = typeof streamCallbackOrBasePath === 'function' 
        ? streamCallbackOrBasePath 
        : legacyStreamCallback;
      
      if (actualCallback) {
        this.setStreamCallback(actualCallback);
      }

      this.streamUpdate(`📁 Working with ${projectFiles.size} files`);
      this.streamUpdate(`📂 Base path: ${actualBasePath}`);

      this.pathManager = new UpgradedPathManager(actualBasePath);
      this.pathManager.setStreamCallback(this.streamCallback || (() => {}));

      // STEP 1: Enhanced analysis with Tailwind config auto-selection
      this.streamUpdate('🔍 Step 1: Enhanced file analysis with Tailwind config...');
      const relevantFiles = await this.analyzer.analyzeFiles(prompt, projectFiles);
      
      if (relevantFiles.length === 0) {
        this.streamUpdate('❌ No relevant files identified');
        return { success: false };
      }

      this.streamUpdate(`✅ Selected ${relevantFiles.length} files for modification`);
      relevantFiles.forEach(file => {
        const icon = file.filePath.includes('tailwind.config') ? '🎨' : '📝';
        this.streamUpdate(`   ${icon} ${file.filePath} (${file.priority} priority) - ${file.reasoning}`);
      });

      // STEP 2: Enhanced content generation with Tailwind context
      this.streamUpdate('🎨 Step 2: Enhanced content generation with Tailwind context...');
      const modifiedFiles = await this.generator.generateModifications(prompt, relevantFiles);
      
      if (modifiedFiles.length === 0) {
        this.streamUpdate('❌ No modifications generated');
        return { success: false };
      }

      this.streamUpdate(`✅ Generated ${modifiedFiles.length} file modifications`);

      // STEP 3: Apply modifications
      this.streamUpdate('💾 Step 3: Applying modifications...');
      const applyResult = await this.applyModificationsWithUpgradedMethod(
        modifiedFiles, 
        projectFiles
      );

      this.streamUpdate(`🎉 SUCCESS! Applied ${applyResult.successCount}/${modifiedFiles.length} modifications`);

      return {
        success: applyResult.successCount > 0,
        changes: applyResult.changes,
        modifiedFiles: applyResult.modifiedFiles
      };

    } catch (error) {
      this.streamUpdate(`❌ Processing failed: ${error}`);
      return { success: false };
    }
  }

  private async applyModificationsWithUpgradedMethod(
    modifiedFiles: Array<{ filePath: string; modifiedContent: string }>,
    projectFiles: Map<string, ProjectFile>
  ): Promise<{
    successCount: number;
    changes: ChangeRecord[];
    modifiedFiles: string[];
  }> {
    
    let successCount = 0;
    const changes: ChangeRecord[] = [];
    const modifiedFilePaths: string[] = [];

    for (const { filePath, modifiedContent } of modifiedFiles) {
      try {
        this.streamUpdate(`🔧 Processing: ${filePath}`);

        const updateResult = await this.pathManager.safeUpdateFile(filePath, modifiedContent);

        if (updateResult.success) {
          const existingFile = this.analyzer['findFileInProject'](filePath, projectFiles);
          if (existingFile) {
            existingFile.content = modifiedContent;
            existingFile.lines = modifiedContent.split('\n').length;
          }

          successCount++;
          modifiedFilePaths.push(filePath);

          changes.push({
            type: 'modified',
            file: filePath,
            description: 'Successfully updated with enhanced path handling',
            success: true,
            details: {
              linesChanged: modifiedContent.split('\n').length,
              changeType: ['update'],
              reasoning: 'Updated using upgraded path manager'
            }
          });

          this.streamUpdate(`✅ Successfully updated: ${updateResult.actualPath}`);

        } else {
          this.streamUpdate(`❌ Failed to update ${filePath}: ${updateResult.error}`);
          changes.push({
            type: 'failed',
            file: filePath,
            description: updateResult.error || 'Update failed',
            success: false
          });
        }

      } catch (error) {
        this.streamUpdate(`❌ Error processing ${filePath}: ${error}`);
        
        changes.push({
          type: 'failed',
          file: filePath,
          description: `Error: ${error}`,
          success: false
        });
      }
    }

    return { successCount, changes, modifiedFiles: modifiedFilePaths };
  }

  /**
   * Helper methods (enhanced)
   */
  private resolveProjectPath(folderName: string): string {
    if (isAbsolute(folderName)) {
      return folderName.replace(/builddora/g, 'buildora');
    }
    const cleanBasePath = process.cwd().replace(/builddora/g, 'buildora');
    return resolve(join(cleanBasePath, 'temp-builds', folderName));
  }

  private async loadProjectFiles(projectPath: string): Promise<Map<string, ProjectFile>> {
    const projectFiles = new Map<string, ProjectFile>();
    
    const scanDirectory = async (dir: string, baseDir: string = projectPath): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
          
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            await scanDirectory(fullPath, baseDir);
          } else if (entry.isFile() && this.isRelevantFile(entry.name)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const stats = await fs.stat(fullPath);
              
              const projectFile: ProjectFile = {
                path: fullPath,
                relativePath,
                content,
                lines: content.split('\n').length,
                isMainFile: this.isMainFile(entry.name, relativePath),
                fileType: this.determineFileType(entry.name),
                lastModified: stats.mtime
              };
              
              projectFiles.set(relativePath, projectFile);
              
            } catch (readError) {
              this.streamUpdate(`⚠️ Could not read file: ${relativePath}`);
            }
          }
        }
      } catch (error) {
        this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}`);
      }
    };
    
    await scanDirectory(projectPath);
    return projectFiles;
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipPatterns = ['node_modules', '.git', '.next', 'dist', 'build'];
    return skipPatterns.includes(name) || name.startsWith('.');
  }

  private isRelevantFile(fileName: string): boolean {
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private isMainFile(fileName: string, relativePath: string): boolean {
    return fileName === 'App.tsx' || fileName === 'App.jsx' || 
           relativePath.includes('App.') || fileName === 'index.tsx';
  }

  private determineFileType(fileName: string): string {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 'react-component';
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return 'module';
    if (fileName.endsWith('.css')) return 'stylesheet';
    if (fileName.endsWith('.json')) return 'config';
    return 'unknown';
  }

 
  async process(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void
  ) {
    this.streamUpdate('🔄 Legacy process method called');
    return this.processFullFileModification(
      prompt,
      projectFiles,
      reactBasePath,
      streamCallback
    );
  }

  /**
   * Legacy method for compatibility
   */
  async handleFullFileModification(
    prompt: string, 
    projectFiles: Map<string, ProjectFile>, 
    modificationSummary?: any
  ): Promise<boolean> {
    this.streamUpdate('🔄 Legacy handleFullFileModification called');
    const result = await this.processFullFileModification(
      prompt,
      projectFiles,
      undefined,
      (message: string) => this.streamUpdate(message)
    );
    return result.success;
  }
}