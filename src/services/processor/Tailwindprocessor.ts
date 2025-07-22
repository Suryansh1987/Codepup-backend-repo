// TailwindChangeProcessor.ts - Enhanced version with design system integration
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConversationService } from '../conversation-service';
import { ModificationScope, ProjectFile, ModificationResult } from '../filemodifier/types';

export interface ColorChange {
  type: string;
  color: string;
  target?: string;
}

export interface TailwindModificationSummary {
  addChange: (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => Promise<void>;
  getSummary: () => Promise<string>;
  getMostModifiedFiles: () => Promise<Array<{ file: string; count: number }>>;
}

export interface DesignFile {
  name: string;
  content: string;
  path?: string;
}

export interface ModificationResults {
  modifiedFiles: string[];
  createdFiles: string[];
  tailwindConfigUpdated: boolean;
  indexCssUpdated: boolean;
}

export class TailwindChangeProcessor {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;
  private conversationService: ConversationService;

  constructor(anthropic: Anthropic, reactBasePath: string, conversationService: ConversationService) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.conversationService = conversationService;
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * Retrieve design system file using ConversationService
   */
  async getDesignFile(projectId: number): Promise<DesignFile | null> {
    try {
      this.streamUpdate('📋 Retrieving design system file...');
      
      const designFiles = await this.conversationService.designfile(projectId);
      
      if (designFiles && designFiles.length > 0) {
        this.streamUpdate('✅ Design system file found');
        return {
          name: designFiles[0].name,
          content: designFiles[0].content || '',
          path: designFiles[0].path
        };
      }
      
      this.streamUpdate('⚠️ No design system file found');
      return null;
    } catch (error) {
      this.streamUpdate(`❌ Error retrieving design file: ${error}`);
      return null;
    }
  }

  /**
   * Main method to handle tailwind configuration changes with design system integration
   */
  async handleTailwindChange(
    prompt: string,
    scope: ModificationScope,
    projectFiles: Map<string, ProjectFile>,
    modificationSummary: TailwindModificationSummary,
    projectId: number
  ): Promise<ModificationResult> {
    
    this.streamUpdate('🎨 Starting Tailwind configuration modification with design system...');

    try {
      // Step 1: Retrieve design system file
      let designSystemContent = '';
      const designFile = await this.getDesignFile(projectId);
      if (designFile) {
        designSystemContent = designFile.content;
        this.streamUpdate('📖 Design system loaded successfully');
      }

      // Step 2: Locate and read both target files
      const tailwindConfigPath = await this.findTailwindConfig();
      const indexCssPath = await this.findIndexCss();

      let currentTailwindConfig = '';
      let currentIndexCss = '';

      if (tailwindConfigPath) {
        currentTailwindConfig = await this.readTailwindConfig(tailwindConfigPath);
        this.streamUpdate(`📁 Found tailwind config: ${tailwindConfigPath}`);
      } else {
        this.streamUpdate('⚠️ No tailwind.config file found, will create new one');
      }

      if (indexCssPath) {
        currentIndexCss = await this.readIndexCss(indexCssPath);
        this.streamUpdate(`📁 Found index.css: ${indexCssPath}`);
      } else {
        this.streamUpdate('⚠️ No index.css file found, will create new one');
      }

      // Step 3: Generate modifications using AI with design system context
      const modifications = await this.generateEnhancedModifications(
        prompt,
        designSystemContent,
        currentTailwindConfig,
        currentIndexCss,
        scope.colorChanges
      );

      // Step 4: Apply modifications
      const results = await this.applyModifications(
        modifications,
        tailwindConfigPath,
        indexCssPath,
        modificationSummary,
        prompt
      );

      this.streamUpdate('✅ Tailwind configuration completed successfully!');

      return {
        success: true,
        selectedFiles: results.modifiedFiles,
        addedFiles: results.createdFiles,
        approach: 'TAILWIND_CHANGE',
        reasoning: `Successfully updated Tailwind configuration and styles with design system guidance: ${prompt}`,
        modificationSummary: await modificationSummary.getSummary(),
        tailwindModification: {
          configPath: tailwindConfigPath || 'tailwind.config.ts',
          changesApplied: scope.colorChanges || [],
          configUpdated: results.tailwindConfigUpdated,
        }
      };

    } catch (error) {
      this.streamUpdate(`❌ Tailwind modification failed: ${error}`);
      
      await modificationSummary.addChange(
        'modified',
        'tailwind configuration',
        `Failed to update with design system: ${error}`,
        {
          approach: 'TAILWIND_CHANGE',
          success: false,
          reasoning: `Error during tailwind modification`
        }
      );

      return {
        success: false,
        error: `Tailwind modification failed: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        approach: 'TAILWIND_CHANGE',
        reasoning: scope.reasoning || 'Tailwind modification attempt failed'
      };
    }
  }

  /**
   * Find existing tailwind config file
   */
  private async findTailwindConfig(): Promise<string | null> {
    const possiblePaths = [
      'tailwind.config.ts',
      'tailwind.config.js',
      'tailwind.config.cjs',
      'tailwind.config.mjs'
    ];

    for (const configPath of possiblePaths) {
      const fullPath = path.join(this.reactBasePath, configPath);
      try {
        await fs.access(fullPath);
        return configPath; // Return relative path
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  /**
   * Find index.css file
   */
  private async findIndexCss(): Promise<string | null> {
    const possiblePaths = [
      'src/index.css',
      'src/styles/index.css',
      'src/styles/globals.css',
      'index.css',
      'styles/globals.css',
      'app/globals.css'
    ];

    for (const cssPath of possiblePaths) {
      const fullPath = path.join(this.reactBasePath, cssPath);
      try {
        await fs.access(fullPath);
        return cssPath; // Return relative path
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  /**
   * Read current tailwind config
   */
  private async readTailwindConfig(configPath: string): Promise<string> {
    const fullPath = path.join(this.reactBasePath, configPath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Read index.css content
   */
  private async readIndexCss(cssPath: string): Promise<string> {
    const fullPath = path.join(this.reactBasePath, cssPath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Generate enhanced modifications using AI with design system context
   */
  private async generateEnhancedModifications(
    prompt: string,
    designSystemContent: string,
    currentTailwindConfig: string,
    currentIndexCss: string,
    colorChanges?: ColorChange[]
  ): Promise<{ tailwindConfig: string; indexCss: string }> {
    
    this.streamUpdate('🤖 AI analyzing design system and generating comprehensive changes...');

    const colorChangesText = colorChanges && colorChanges.length > 0 
      ? colorChanges.map(change => `${change.type}: ${change.color}`).join(', ')
      : 'extracted from prompt and design system';

    const enhancedPrompt = `
You are an expert at modifying Tailwind CSS configurations and CSS files based on design systems. Your task is to modify both the tailwind.config.ts and index.css files to implement the user's request while following the established design system guidelines.

**USER REQUEST:** "${prompt}"

**EXTRACTED COLOR CHANGES:** ${colorChangesText}

**DESIGN SYSTEM CONTEXT:**
${designSystemContent || 'No design system provided - use best practices for modern web design'}

**CURRENT TAILWIND CONFIG:**
\`\`\`typescript
${currentTailwindConfig || '// No existing config found'}
\`\`\`

**CURRENT INDEX.CSS:**
\`\`\`css
${currentIndexCss || '/* No existing CSS found */'}
\`\`\`

**CRITICAL REQUIREMENTS:**
1. **FOLLOW DESIGN SYSTEM**: Use colors, fonts, and design principles from the design system above
2. **PRESERVE STRUCTURE**: Keep ALL existing structure, imports, exports, and configuration options
3. **SOLID COLORS ONLY**: Use only solid hex colors like '#3b82f6', '#ffffff', '#000000' - NEVER use CSS variables like 'hsl(var(--primary))'
4. **COMPREHENSIVE UPDATE**: Update both tailwind.config.ts AND index.css files consistently
5. **MAINTAIN COMPATIBILITY**: Ensure all existing color references will still work
6. **DESIGN CONSISTENCY**: Ensure both files work together and follow the same design language

**MODIFICATION STRATEGY:**
1. Analyze the design system to understand the established color palette and design principles
2. Identify which specific colors to change based on the user request and design system
3. Update the Tailwind config with appropriate hex color values that match the design system
4. Update the index.css with complementary styles that enhance the design system
5. Ensure both files maintain consistency and follow modern design practices
6. Preserve all existing functionality while implementing the requested changes

**OUTPUT FORMAT:**
Provide your response in the following exact format:

TAILWIND_CONFIG_START
[Complete modified tailwind.config.ts content here]
TAILWIND_CONFIG_END

INDEX_CSS_START
[Complete modified index.css content here]
INDEX_CSS_END

**IMPORTANT:** 
- Return ONLY the complete modified file contents within the designated markers
- Do not add explanations or comments outside the file contents
- Ensure both files work together harmoniously
- Follow the design system guidelines strictly
- Use only solid hex colors, never CSS variables
    `.trim();

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        temperature: 0.1,
        messages: [{ role: 'user', content: enhancedPrompt }],
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      // Extract tailwind config
      const tailwindMatch = responseText.match(/TAILWIND_CONFIG_START\s*([\s\S]*?)\s*TAILWIND_CONFIG_END/);
      const indexCssMatch = responseText.match(/INDEX_CSS_START\s*([\s\S]*?)\s*INDEX_CSS_END/);
      
      if (!tailwindMatch || !indexCssMatch) {
        throw new Error('Could not extract both modified files from AI response');
      }
      
      return {
        tailwindConfig: tailwindMatch[1].trim(),
        indexCss: indexCssMatch[1].trim()
      };
      
    } catch (error) {
      this.streamUpdate(`❌ AI modification generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Apply modifications to both files
   */
  private async applyModifications(
    modifications: { tailwindConfig: string; indexCss: string },
    tailwindConfigPath: string | null,
    indexCssPath: string | null,
    modificationSummary: TailwindModificationSummary,
    prompt: string
  ): Promise<ModificationResults> {
    
    const results: ModificationResults = {
      modifiedFiles: [],
      createdFiles: [],
      tailwindConfigUpdated: false,
      indexCssUpdated: false
    };

    // Handle Tailwind Config
    if (tailwindConfigPath) {
      await this.writeTailwindConfig(tailwindConfigPath, modifications.tailwindConfig);
      results.modifiedFiles.push(tailwindConfigPath);
      results.tailwindConfigUpdated = true;
      
      await modificationSummary.addChange(
        'modified',
        tailwindConfigPath,
        `Updated Tailwind config with design system guidance: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: modifications.tailwindConfig.split('\n').length,
          reasoning: 'Modified tailwind.config.ts with design system integration'
        }
      );
    } else {
      // Create new tailwind config
      const newConfigPath = 'tailwind.config.ts';
      await this.writeTailwindConfig(newConfigPath, modifications.tailwindConfig);
      results.createdFiles.push(newConfigPath);
      results.tailwindConfigUpdated = true;
      
      await modificationSummary.addChange(
        'created',
        newConfigPath,
        `Created new Tailwind config with design system guidance: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: modifications.tailwindConfig.split('\n').length,
          reasoning: 'Created new tailwind.config.ts with design system integration'
        }
      );
    }

    // Handle Index CSS
    if (indexCssPath) {
      await this.writeIndexCss(indexCssPath, modifications.indexCss);
      results.modifiedFiles.push(indexCssPath);
      results.indexCssUpdated = true;
      
      await modificationSummary.addChange(
        'modified',
        indexCssPath,
        `Updated index.css with design system guidance: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: modifications.indexCss.split('\n').length,
          reasoning: 'Modified index.css with design system integration'
        }
      );
    } else {
      // Create new index.css
      const newCssPath = 'src/index.css';
      await this.writeIndexCss(newCssPath, modifications.indexCss);
      results.createdFiles.push(newCssPath);
      results.indexCssUpdated = true;
      
      await modificationSummary.addChange(
        'created',
        newCssPath,
        `Created new index.css with design system guidance: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: modifications.indexCss.split('\n').length,
          reasoning: 'Created new index.css with design system integration'
        }
      );
    }

    return results;
  }

  /**
   * Write modified config to file with backup
   */
  private async writeTailwindConfig(configPath: string, content: string): Promise<void> {
    const fullPath = path.join(this.reactBasePath, configPath);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Backup original config if it exists
    try {
      const originalContent = await fs.readFile(fullPath, 'utf8');
      const backupPath = fullPath + '.backup';
      await fs.writeFile(backupPath, originalContent, 'utf8');
      this.streamUpdate(`💾 Created backup: ${configPath}.backup`);
    } catch (error) {
      // File doesn't exist, no backup needed
      this.streamUpdate(`📝 Creating new file: ${configPath}`);
    }
    
    // Write new config
    await fs.writeFile(fullPath, content, 'utf8');
    this.streamUpdate(`✅ Updated: ${configPath}`);
  }

  /**
   * Write modified CSS to file with backup
   */
  private async writeIndexCss(cssPath: string, content: string): Promise<void> {
    const fullPath = path.join(this.reactBasePath, cssPath);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Backup original CSS if it exists
    try {
      const originalContent = await fs.readFile(fullPath, 'utf8');
      const backupPath = fullPath + '.backup';
      await fs.writeFile(backupPath, originalContent, 'utf8');
      this.streamUpdate(`💾 Created backup: ${cssPath}.backup`);
    } catch (error) {
      // File doesn't exist, no backup needed
      this.streamUpdate(`📝 Creating new file: ${cssPath}`);
    }
    
    // Write new CSS
    await fs.writeFile(fullPath, content, 'utf8');
    this.streamUpdate(`✅ Updated: ${cssPath}`);
  }
}