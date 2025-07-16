// ============================================================================
// UPGRADED FULL FILE PROCESSOR - WITH DATABASE CONTEXT & DATA PRESERVATION
// ============================================================================

import { join, basename, dirname, resolve, relative, isAbsolute } from 'path';
import { promises as fs } from 'fs';

class EnhancedFileAnalyzer {
  private anthropic: any;

  constructor(anthropic: any) {
    this.anthropic = anthropic;
  }

  async analyzeFiles(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    messageDB?: any,
    projectId?: number
  ): Promise<FileAnalysisResult[]> {
    
    // 🔥 NEW: Get project structure context from database (like Component Generator)
    const projectStructureContext = await this.getProjectStructureContext(messageDB, projectId);
    
    // 🔥 NEW: MANDATORY Supabase schema context (like Component Generator)
    const supabaseSchemaContext = this.getSupabaseSchemaContext(projectFiles);
    
    // ALWAYS include Tailwind config for color/styling context
    const tailwindConfig = this.findTailwindConfig(projectFiles);
    
    // Create detailed file summaries with data preservation awareness
    const fileSummaries = Array.from(projectFiles.entries())
      .map(([path, file]) => {
        const purpose = this.inferFilePurpose(file);
        const dataElements = this.extractDataElements(file);
        const preview = file.content.substring(0, 200).replace(/\n/g, ' ');
        return `${path} (${file.lines} lines) - ${purpose}
  Data Elements: ${dataElements.join(', ') || 'None'}
  Preview: ${preview}...`;
      })
      .join('\n\n');
    
    const tailwindContext = tailwindConfig ? `
🎨 TAILWIND CONFIG FOUND: ${tailwindConfig.path}
TAILWIND COLORS/TOKENS:
${this.extractTailwindTokens(tailwindConfig.content)}
` : '⚠️ NO TAILWIND CONFIG FOUND';

    const analysisPrompt = `
🎯 TASK: Enhanced file analysis with database context and data preservation awareness.

USER REQUEST: "${prompt}"

${projectStructureContext ? `
🏢 PROJECT STRUCTURE CONTEXT FROM DATABASE:
${projectStructureContext}

📊 BUSINESS INTELLIGENCE: This context provides insight into the overall project architecture, business logic, and component relationships.
` : ''}

${supabaseSchemaContext}

${tailwindContext}

📁 AVAILABLE FILES:
${fileSummaries}

🔍 ENHANCED ANALYSIS INSTRUCTIONS:

**STEP 1: FUNCTIONALITY DETECTION**
Analyze the user request for these capabilities:
- 🎨 STYLING: colors, themes, design, layout changes, visual updates
- 📊 DATA DISPLAY: showing data from database, lists, tables, cards
- 🛒 SHOPPING: e-commerce features, cart, products, checkout
- 🔐 AUTHENTICATION: login, signup, user management, protected routes
- 🏗️ LAYOUT: structural changes, responsive design, component arrangement
- 📱 UI COMPONENTS: buttons, forms, modals, navigation elements
- ⚙️ FUNCTIONALITY: business logic, interactions, state management

**STEP 2: DATA PRESERVATION ANALYSIS**
🚨 CRITICAL: Identify files containing:
- Hard-coded data arrays, objects, mock data
- State variables with initial values
- Product listings, user profiles, testimonials
- Configuration objects, menu items, feature lists
- Any existing content that should be preserved

**STEP 3: DATABASE CONTEXT REQUIREMENTS**
Based on detected functionality, determine if database context is needed:
- Data display operations → Include supabase files for schema awareness
- Shopping features → Include cart context + database schema
- Authentication → Include auth context + user schema
- Pure styling → Focus on visual files only

**STEP 4: FILE SELECTION STRATEGY**
1. ALWAYS include tailwind.config.js/ts if exists (for styling context)
2. Include database/context files if functionality requires them
3. Select ONLY files that need modification for the specific request
4. For layout changes: select all affected components and pages
5. For color/styling: select visual components + tailwind config
6. For data display: select components + relevant database context

RESPONSE FORMAT (JSON):
[
  {
    "filePath": "tailwind.config.js",
    "relevanceScore": 95,
    "reasoning": "Always include for styling context and available colors",
    "changeType": ["config", "styling"],
    "priority": "high",
    "dataPreservation": false,
    "databaseContextNeeded": false,
    "existingDataElements": []
  },
  {
    "filePath": "src/components/ProductGrid.tsx",
    "relevanceScore": 90,
    "reasoning": "Contains product data that must be preserved during layout changes",
    "changeType": ["layout-structural", "data-preservation"],
    "priority": "high",
    "dataPreservation": true,
    "databaseContextNeeded": true,
    "existingDataElements": ["products array", "product categories", "mock pricing"]
  }
]

🚨 CRITICAL REQUIREMENTS:
- Always identify files with existing data that must be preserved
- Flag when database context is needed for proper integration
- Classify change types to guide generation strategy
- Prioritize based on user request impact and data sensitivity

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
      
      // Process analysis results with enhanced metadata
      for (const result of analysisResults) {
        const file = this.findFileInProject(result.filePath, projectFiles);
        if (file) {
          relevantFiles.push({
            filePath: result.filePath,
            file,
            relevanceScore: result.relevanceScore || 50,
            reasoning: result.reasoning || 'Selected by analysis',
            changeType: result.changeType || ['general'],
            priority: result.priority || 'medium',
            dataPreservation: result.dataPreservation || false,
            databaseContextNeeded: result.databaseContextNeeded || false,
            existingDataElements: result.existingDataElements || []
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
          priority: 'high',
          dataPreservation: false,
          databaseContextNeeded: false,
          existingDataElements: []
        });
      }
      
      return relevantFiles;
      
    } catch (error) {
      return this.getFallbackFileSelection(prompt, projectFiles, tailwindConfig);
    }
  }

  // 🔥 NEW: Get project structure context from database
  private async getProjectStructureContext(messageDB?: any, projectId?: number): Promise<string> {
    if (!projectId || !messageDB) {
      return '';
    }

    try {
      const structure = await messageDB.getProjectStructure(projectId);
      
      if (structure) {
        return typeof structure === 'string' ? structure : JSON.stringify(structure);
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  // 🔥 NEW: Generate Supabase schema context (MANDATORY like Component Generator)
  private getSupabaseSchemaContext(projectFiles: Map<string, ProjectFile>): string {
    const supabaseFiles = Array.from(projectFiles.entries())
      .filter(([path, file]) => 
        path.startsWith('supabase/') && 
        (file.fileType === 'migration-table' || file.fileType === 'migration-sql' || file.fileType === 'schema')
      )
      .sort(([pathA], [pathB]) => pathA.localeCompare(pathB));

    if (supabaseFiles.length === 0) {
      return `
🗄️ **DATABASE SCHEMA CONTEXT:**
❌ No Supabase migration files found.

⚠️ **IMPORTANT:** Without database schema, modifications involving data will use mock data only.
Assume standard e-commerce schema: products(id, name, price), users(id, email), cart_items(id, user_id, product_id, quantity).
`;
    }

    const schemaAnalysis = supabaseFiles.map(([path, file]) => {
      const tables = this.extractTableInfo(file.content);
      return {
        file: path,
        content: file.content.slice(0, 1500),
        tables: tables
      };
    });

    const allTables = schemaAnalysis.flatMap(s => s.tables);
    
    return `
🗄️ **DATABASE SCHEMA CONTEXT:**
✅ Found ${supabaseFiles.length} schema files with ${allTables.length} tables.

📋 **AVAILABLE TABLES & COLUMNS:**
${allTables.map(table => `
- ${table.name}: ${table.columns.join(', ')}`).join('')}

🚨 **DATA MODIFICATION RULES:**
- NEVER modify actual database data
- ONLY use existing column names from schema above
- For new mock data: Follow existing data patterns and schema constraints
- Preserve all existing hard-coded data arrays and objects
- Add mock data only when explicitly requested or for demonstrations

📝 **SCHEMA FILES:**
${schemaAnalysis.map(s => `
=== ${s.file} ===
${s.content}${s.content.length >= 1500 ? '\n... (truncated)' : ''}
`).join('\n')}
`;
  }

  // 🔥 NEW: Extract table information from SQL
  private extractTableInfo(sqlContent: string): Array<{name: string, columns: string[]}> {
    const tables: Array<{name: string, columns: string[]}> = [];
    
    const tableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
    
    let match;
    while ((match = tableRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      
      const columnMatches = tableBody.match(/^\s*(\w+)\s+/gm);
      const columns = columnMatches 
        ? columnMatches.map(col => col.trim().split(/\s+/)[0]).filter(Boolean)
        : [];
      
      tables.push({
        name: tableName,
        columns: columns.slice(0, 10)
      });
    }
    
    return tables;
  }

  // 🔥 NEW: Extract data elements from file content
  private extractDataElements(file: ProjectFile): string[] {
    const content = file.content;
    const dataElements: string[] = [];
    
    // Look for arrays and objects that might contain data
    const arrayMatches = content.match(/const\s+\w+\s*=\s*\[[\s\S]*?\]/g);
    if (arrayMatches) {
      arrayMatches.forEach(match => {
        const varName = match.match(/const\s+(\w+)/)?.[1];
        if (varName) dataElements.push(`${varName} array`);
      });
    }
    
    // Look for object definitions
    const objectMatches = content.match(/const\s+\w+\s*=\s*\{[\s\S]*?\}/g);
    if (objectMatches) {
      objectMatches.forEach(match => {
        const varName = match.match(/const\s+(\w+)/)?.[1];
        if (varName) dataElements.push(`${varName} object`);
      });
    }
    
    // Look for useState with initial values
    const stateMatches = content.match(/useState\s*\([^)]*\)/g);
    if (stateMatches) {
      stateMatches.forEach((match, index) => {
        if (!match.includes('useState()') && !match.includes('useState("")') && !match.includes('useState(null)')) {
          dataElements.push(`state variable ${index + 1}`);
        }
      });
    }
    
    return dataElements;
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
        priority: 'high',
        dataPreservation: false,
        databaseContextNeeded: false,
        existingDataElements: []
      });
    }
    
    // Enhanced fallback: select files based on prompt analysis
    const promptLower = prompt.toLowerCase();
    
    for (const [filePath, file] of projectFiles) {
      // Skip if already added (tailwind config)
      if (tailwindConfig && filePath === tailwindConfig.path) continue;
      
      let relevanceScore = 0;
      const changeTypes: string[] = [];
      const dataElements = this.extractDataElements(file);
      const hasData = dataElements.length > 0;
      
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
          changeTypes.push('layout-structural');
          if (hasData) changeTypes.push('data-preservation');
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
          priority: relevanceScore > 60 ? 'high' : relevanceScore > 40 ? 'medium' : 'low',
          dataPreservation: hasData,
          databaseContextNeeded: promptLower.includes('data') || promptLower.includes('database'),
          existingDataElements: dataElements
        });
      }
    }
    
    // If no files selected (except tailwind), select main files
    if (relevantFiles.length <= 1) {
      for (const [filePath, file] of projectFiles) {
        if (file.isMainFile) {
          const dataElements = this.extractDataElements(file);
          relevantFiles.push({
            filePath,
            file,
            relevanceScore: 70,
            reasoning: 'Main application file (emergency fallback)',
            changeType: ['general'],
            priority: 'high',
            dataPreservation: dataElements.length > 0,
            databaseContextNeeded: false,
            existingDataElements: dataElements
          });
        }
      }
    }
    
    return relevantFiles;
  }

  private inferFilePurpose(file: ProjectFile): string {
    if (file.isMainFile) return 'Main application file';
    if (file.relativePath.includes('tailwind.config')) return 'Tailwind CSS Configuration';
    if (file.relativePath.includes('supabase')) return 'Database Migration/Schema';
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
// ENHANCED CONTENT GENERATOR WITH DATA PRESERVATION & NEW PROMPT
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
    
    // Extract database context files
    const databaseFiles = relevantFiles.filter(f => 
      f.databaseContextNeeded || f.filePath.startsWith('supabase/'));
    
    // Extract files with data that needs preservation
    const dataPreservationFiles = relevantFiles.filter(f => f.dataPreservation);

    const tailwindContext = tailwindFile ? `
🎨 TAILWIND CONFIGURATION CONTEXT:
Available colors, themes, and custom utilities:

\`\`\`javascript
${tailwindFile.file.content}
\`\`\`

Use these custom colors and tokens when making styling changes.
` : '🎨 Using standard Tailwind CSS classes.';

    const databaseContext = databaseFiles.length > 0 ? `
🗄️ DATABASE CONTEXT:
${databaseFiles.map(f => f.file.content.slice(0, 1000)).join('\n---\n')}

🚨 CRITICAL: Only use existing database columns. Never modify actual data.
` : '';

    const dataPreservationContext = dataPreservationFiles.length > 0 ? `
📊 DATA PRESERVATION REQUIREMENTS:
${dataPreservationFiles.map(f => `
File: ${f.filePath}
Existing Data Elements: ${f.existingDataElements.join(', ')}
Change Types: ${f.changeType.join(', ')}
`).join('\n')}

🚨 ABSOLUTE REQUIREMENT: PRESERVE ALL EXISTING DATA
- Keep all arrays, objects, and variables with their current values
- Maintain all hard-coded content, product listings, user data
- Only modify styling, layout, or structure as requested
- Add new mock data ONLY if explicitly requested
- Never remove or alter existing data without explicit user request
` : '';

    // 🔥 NEW: Complete custom prompt replacing fullFilePrompt
    const modificationPrompt = `
🎯 ENHANCED FILE MODIFICATION TASK:
You are an expert TypeScript and React engineer. Modify files according to the user's request while following strict data preservation and enhancement guidelines.

👤 USER REQUEST:
"${prompt}"

${tailwindContext}

${databaseContext}

${dataPreservationContext}

🗂️ FILES TO MODIFY:

${relevantFiles.map((result, index) => `
=== FILE ${index + 1}: ${result.filePath} ===
CHANGE TYPES: ${result.changeType.join(', ')}
PRIORITY: ${result.priority}
REASONING: ${result.reasoning}
DATA PRESERVATION: ${result.dataPreservation ? 'REQUIRED ⚠️' : 'Not needed ✅'}
DATABASE CONTEXT: ${result.databaseContextNeeded ? 'Required 🗄️' : 'Not needed ✅'}
EXISTING DATA: ${result.existingDataElements.join(', ') || 'None'}

CURRENT CONTENT:
\`\`\`tsx
${result.file.content}
\`\`\`
`).join('\n')}

🚨 CRITICAL MODIFICATION RULES:

**DATA PRESERVATION (HIGHEST PRIORITY):**
1. NEVER modify, remove, or alter existing data arrays, objects, or variables
2. PRESERVE all hard-coded content: product listings, user profiles, testimonials, menu items
3. KEEP all existing useState initial values, configuration objects, mock data
4. MAINTAIN all existing content, text, descriptions, and data structures
5. Only ADD new mock data if explicitly requested by user
6. NEVER assume data should be changed - when in doubt, preserve it

**MODIFICATION GUIDELINES:**
1. For STYLING changes: Update classes, colors, spacing while preserving all content
2. For LAYOUT changes: Rearrange components, change structure while keeping all data
3. For FUNCTIONALITY: Add new features while preserving existing functionality and data
4. For DATABASE integration: Add queries/operations while keeping existing mock data as fallback

**TECHNICAL REQUIREMENTS:**
1. Generate COMPLETE file content - no "rest stays the same" comments allowed
2. Include ALL existing imports, exports, functions, and components
3. Maintain TypeScript syntax correctness and all type definitions
4. Use ONLY Tailwind CSS for styling (no styled-components)
5. Ensure responsive design and accessibility standards
6. Handle errors gracefully with fallbacks to existing data

**STYLING EXCELLENCE:**
1. Use colors from Tailwind config when available
2. Maintain visual consistency across components
3. Implement modern design patterns and micro-interactions
4. Ensure mobile-first responsive design

**DATABASE INTEGRATION:**
1. Use proper Supabase syntax with error handling
2. Only reference existing database columns from schema
3. Implement loading states and error boundaries
4. Keep existing mock data as fallback

**FORBIDDEN ACTIONS:**
❌ Never remove existing data arrays or objects
❌ Never modify hard-coded product/user/content data
❌ Never use "rest of the code stays the same" comments
❌ Never assume database data without schema confirmation
❌ Never remove existing functionality or components
❌ Never change data structure without explicit request

📦 RESPONSE FORMAT:
Return each COMPLETE modified file in clearly marked code blocks:

\`\`\`tsx
// FILE: ${relevantFiles[0]?.filePath}
[COMPLETE MODIFIED CONTENT WITH ALL DATA PRESERVED]
\`\`\`

Continue for all files. Include FILE comment for each. Every file must be complete and functional.

🎯 SUCCESS CRITERIA:
✅ All existing data preserved exactly as is
✅ User request implemented correctly
✅ All files complete and functional
✅ Modern, responsive design with Tailwind
✅ Proper error handling and TypeScript types
✅ No placeholder comments or incomplete sections
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 8000,
        temperature: 0.1,
        messages: [{ role: 'user', content: modificationPrompt }]
        // 🔥 REMOVED: system: fullFilePrompt
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

// Enhanced interfaces with new properties
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
  dataPreservation: boolean;  // 🔥 NEW
  databaseContextNeeded: boolean;  // 🔥 NEW
  existingDataElements: string[];  // 🔥 NEW
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

// ============================================================================
// MAIN FULL FILE PROCESSOR CLASS (Same interface, enhanced implementation)
// ============================================================================

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
    legacyStreamCallback?: (message: string) => void,
    messageDB?: any,
    projectId?: number
  ): Promise<{
    success: boolean;
    changes?: ChangeRecord[];
    modifiedFiles?: string[];
  }> {

    this.streamUpdate('🚀 ENHANCED: Starting file modification with database context & data preservation...');

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

      // STEP 1: Enhanced analysis with database context & data preservation
      this.streamUpdate('🔍 Step 1: Enhanced analysis with database context & data preservation...');
      const relevantFiles = await this.analyzer.analyzeFiles(prompt, projectFiles, messageDB, projectId);
      
      if (relevantFiles.length === 0) {
        this.streamUpdate('❌ No relevant files identified');
        return { success: false };
      }

      this.streamUpdate(`✅ Selected ${relevantFiles.length} files for modification`);
      relevantFiles.forEach(file => {
        const icon = file.filePath.includes('tailwind.config') ? '🎨' : 
                    file.filePath.startsWith('supabase/') ? '🗄️' : 
                    file.dataPreservation ? '📊' : '📝';
        this.streamUpdate(`   ${icon} ${file.filePath} (${file.priority} priority) - ${file.reasoning}`);
        if (file.dataPreservation) {
          this.streamUpdate(`      🚨 Data Preservation Required: ${file.existingDataElements.join(', ')}`);
        }
      });

      // STEP 2: Enhanced content generation with data preservation
      this.streamUpdate('🎨 Step 2: Enhanced content generation with data preservation...');
      const modifiedFiles = await this.generator.generateModifications(prompt, relevantFiles);
      
      if (modifiedFiles.length === 0) {
        this.streamUpdate('❌ No modifications generated');
        return { success: false };
      }

      this.streamUpdate(`✅ Generated ${modifiedFiles.length} file modifications with data preservation`);

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
            description: 'Successfully updated with enhanced data preservation',
            success: true,
            details: {
              linesChanged: modifiedContent.split('\n').length,
              changeType: ['update'],
              reasoning: 'Updated using enhanced analyzer with data preservation'
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
   * Helper methods (same as original)
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

  /**
   * Legacy compatibility methods (same signatures)
   */
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