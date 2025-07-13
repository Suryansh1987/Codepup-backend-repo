// TailwindChangeProcessor.ts - Handles modifications to tailwind.config.ts
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
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

export class TailwindChangeProcessor {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: Anthropic, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
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
   * Main method to handle tailwind configuration changes
   */
  async handleTailwindChange(
    prompt: string,
    scope: ModificationScope,
    projectFiles: Map<string, ProjectFile>,
    modificationSummary: TailwindModificationSummary
  ): Promise<ModificationResult> {
    
    this.streamUpdate('🎨 Starting Tailwind configuration modification...');

    try {
      // Locate tailwind.config file
      const tailwindConfigPath = await this.findTailwindConfig();
      
      if (!tailwindConfigPath) {
        this.streamUpdate('⚠️ No tailwind.config file found, creating new one...');
        return await this.createNewTailwindConfig(prompt, scope, modificationSummary);
      }

      this.streamUpdate(`📁 Found tailwind config: ${tailwindConfigPath}`);

      // Read current config
      const currentConfig = await this.readTailwindConfig(tailwindConfigPath);
      
      // Generate modified config using AI
      const modifiedConfig = await this.generateModifiedConfig(prompt, currentConfig, scope.colorChanges);
      
      // Write the modified config
      await this.writeTailwindConfig(tailwindConfigPath, modifiedConfig);
      
      // Log the change
      await modificationSummary.addChange(
        'modified',
        tailwindConfigPath,
        `Updated Tailwind colors based on: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: this.countConfigChanges(currentConfig, modifiedConfig),
          reasoning: `Modified tailwind.config.ts to update theme colors`
        }
      );

      this.streamUpdate('✅ Tailwind configuration updated successfully!');

      return {
        success: true,
        selectedFiles: [tailwindConfigPath],
        addedFiles: [],
        approach: 'TAILWIND_CHANGE',
        reasoning: `Successfully updated Tailwind configuration to apply color changes: ${prompt}`,
        modificationSummary: await modificationSummary.getSummary(),
        tailwindModification: {
          configPath: tailwindConfigPath,
          changesApplied: scope.colorChanges || [],
          configUpdated: true
        }
      };

    } catch (error) {
      this.streamUpdate(`❌ Tailwind modification failed: ${error}`);
      
      await modificationSummary.addChange(
        'modified',
        'tailwind.config.ts',
        `Failed to update Tailwind config: ${error}`,
        {
          approach: 'TAILWIND_CHANGE',
          success: false,
          reasoning: `Error during tailwind.config.ts modification`
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
   * Read current tailwind config
   */
  private async readTailwindConfig(configPath: string): Promise<string> {
    const fullPath = path.join(this.reactBasePath, configPath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Generate modified config using AI
   */
  private async generateModifiedConfig(
    prompt: string,
    currentConfig: string,
    colorChanges?: ColorChange[]
  ): Promise<string> {
    
    this.streamUpdate('🤖 AI analyzing current config and generating changes...');

    const colorChangesText = colorChanges && colorChanges.length > 0 
      ? colorChanges.map(change => `${change.type}: ${change.color}`).join(', ')
      : 'extracted from prompt';

    const modificationPrompt = `
You are an expert at modifying Tailwind CSS configuration files. Your task is to modify the existing tailwind.config.ts file to implement the user's color change request while preserving the entire structure and all existing functionality.

**USER REQUEST:** "${prompt}"

**EXTRACTED COLOR CHANGES:** ${colorChangesText}

**CURRENT TAILWIND CONFIG:**
\`\`\`typescript
${currentConfig}
\`\`\`

**CRITICAL REQUIREMENTS:**
1. **PRESERVE STRUCTURE**: Keep ALL existing structure, imports, exports, and configuration options
2. **SOLID COLORS ONLY**: Use only solid hex colors like '#3b82f6', '#ffffff', '#000000' - NEVER use CSS variables like 'hsl(var(--primary))'
3. **CHANGE ONLY COLORS**: Only modify color values in the colors section, don't change anything else
4. **MAINTAIN COMPATIBILITY**: Ensure all existing color references will still work
5. **INDUSTRY APPROPRIATE**: Choose colors that make sense for the context

**COLOR MAPPING GUIDELINES:**
- If user mentions "red" → use appropriate red hex like '#ef4444', '#dc2626', or '#b91c1c'
- If user mentions "blue" → use appropriate blue hex like '#3b82f6', '#2563eb', or '#1d4ed8'  
- If user mentions "green" → use appropriate green hex like '#10b981', '#059669', or '#047857'
- If user mentions "background" → modify the 'background' color in the colors section
- If user mentions "primary" → modify the 'primary.DEFAULT' and related primary colors
- If user mentions "secondary" → modify the 'secondary.DEFAULT' and related secondary colors

**MODIFICATION STRATEGY:**
1. Identify which specific colors to change based on the user request
2. Choose appropriate hex color values that match the requested colors
3. Update ONLY the relevant color values
4. Maintain all color shades (50, 100, 200, etc.) by generating appropriate variations
5. Keep all other configuration unchanged

**IMPORTANT:** Return ONLY the complete modified tailwind.config.ts file content. Do not add explanations or comments about changes.

**RESPOND WITH ONLY THE COMPLETE MODIFIED CONFIG FILE:**
    `.trim();

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: modificationPrompt }],
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      // Extract the config from the response
      const configMatch = responseText.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/);
      
      if (configMatch && configMatch[1]) {
        return configMatch[1].trim();
      }
      
      // If no code block found, try to extract the config directly
      if (responseText.includes('export default {') || responseText.includes('module.exports =')) {
        return responseText.trim();
      }
      
      throw new Error('Could not extract modified config from AI response');
      
    } catch (error) {
      this.streamUpdate(`❌ AI config generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Write modified config to file
   */
  private async writeTailwindConfig(configPath: string, content: string): Promise<void> {
    const fullPath = path.join(this.reactBasePath, configPath);
    
    // Backup original config
    const backupPath = fullPath + '.backup';
    try {
      const originalContent = await fs.readFile(fullPath, 'utf8');
      await fs.writeFile(backupPath, originalContent, 'utf8');
      this.streamUpdate(`💾 Created backup: ${configPath}.backup`);
    } catch (error) {
      this.streamUpdate(`⚠️ Could not create backup: ${error}`);
    }
    
    // Write new config
    await fs.writeFile(fullPath, content, 'utf8');
    this.streamUpdate(`✅ Updated: ${configPath}`);
  }

  /**
   * Create new tailwind config when none exists
   */
  private async createNewTailwindConfig(
    prompt: string,
    scope: ModificationScope,
    modificationSummary: TailwindModificationSummary
  ): Promise<ModificationResult> {
    
    this.streamUpdate('📝 Creating new tailwind.config.ts file...');

    try {
      const defaultConfig = this.generateDefaultTailwindConfig(scope.colorChanges);
      const configPath = 'tailwind.config.ts';
      const fullPath = path.join(this.reactBasePath, configPath);
      
      await fs.writeFile(fullPath, defaultConfig, 'utf8');
      
      await modificationSummary.addChange(
        'created',
        configPath,
        `Created new Tailwind config with custom colors based on: "${prompt}"`,
        {
          approach: 'TAILWIND_CHANGE',
          success: true,
          linesChanged: defaultConfig.split('\n').length,
          reasoning: 'Created new tailwind.config.ts with custom colors'
        }
      );

      this.streamUpdate('✅ New tailwind.config.ts created successfully!');

      return {
        success: true,
        selectedFiles: [],
        addedFiles: [configPath],
        approach: 'TAILWIND_CHANGE',
        reasoning: `Created new Tailwind configuration with custom colors based on: ${prompt}`,
        modificationSummary: await modificationSummary.getSummary(),
        tailwindModification: {
          configPath,
          changesApplied: scope.colorChanges || [],
          configUpdated: true
        }
      };

    } catch (error) {
      this.streamUpdate(`❌ Failed to create new config: ${error}`);
      throw error;
    }
  }

  /**
   * Generate default tailwind config with custom colors
   */
  private generateDefaultTailwindConfig(colorChanges?: ColorChange[]): string {
    // Extract primary color from changes or use default
    let primaryColor = '#3b82f6';
    let secondaryColor = '#8b5cf6';
    let accentColor = '#06b6d4';
    let backgroundColor = '#ffffff';

    if (colorChanges) {
      colorChanges.forEach(change => {
        const hexColor = this.convertToHex(change.color);
        
        switch (change.type) {
          case 'primary':
            primaryColor = hexColor;
            break;
          case 'secondary':
            secondaryColor = hexColor;
            break;
          case 'accent':
            accentColor = hexColor;
            break;
          case 'background':
            backgroundColor = hexColor;
            break;
          case 'general':
            primaryColor = hexColor;
            break;
        }
      });
    }

    return `import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Base colors - SOLID COLORS ONLY
        border: "#e2e8f0",
        input: "#f1f5f9",
        ring: "${primaryColor}",
        background: "${backgroundColor}",
        foreground: "#0f172a",
        
        // Primary colors
        primary: {
          DEFAULT: "${primaryColor}",
          foreground: "#ffffff",
          50: "${this.generateShade(primaryColor, 50)}",
          100: "${this.generateShade(primaryColor, 100)}",
          200: "${this.generateShade(primaryColor, 200)}",
          300: "${this.generateShade(primaryColor, 300)}",
          400: "${this.generateShade(primaryColor, 400)}",
          500: "${primaryColor}",
          600: "${this.generateShade(primaryColor, 600)}",
          700: "${this.generateShade(primaryColor, 700)}",
          800: "${this.generateShade(primaryColor, 800)}",
          900: "${this.generateShade(primaryColor, 900)}",
        },
        
        // Secondary colors
        secondary: {
          DEFAULT: "${secondaryColor}",
          foreground: "#ffffff",
          50: "${this.generateShade(secondaryColor, 50)}",
          100: "${this.generateShade(secondaryColor, 100)}",
          200: "${this.generateShade(secondaryColor, 200)}",
          300: "${this.generateShade(secondaryColor, 300)}",
          400: "${this.generateShade(secondaryColor, 400)}",
          500: "${secondaryColor}",
          600: "${this.generateShade(secondaryColor, 600)}",
          700: "${this.generateShade(secondaryColor, 700)}",
          800: "${this.generateShade(secondaryColor, 800)}",
          900: "${this.generateShade(secondaryColor, 900)}",
        },
        
        // Accent colors
        accent: {
          DEFAULT: "${accentColor}",
          foreground: "#ffffff",
          50: "${this.generateShade(accentColor, 50)}",
          100: "${this.generateShade(accentColor, 100)}",
          200: "${this.generateShade(accentColor, 200)}",
          300: "${this.generateShade(accentColor, 300)}",
          400: "${this.generateShade(accentColor, 400)}",
          500: "${accentColor}",
          600: "${this.generateShade(accentColor, 600)}",
          700: "${this.generateShade(accentColor, 700)}",
          800: "${this.generateShade(accentColor, 800)}",
          900: "${this.generateShade(accentColor, 900)}",
        },
        
        // Status colors - KEEP THESE
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#000000",
        },
        
        // Neutral colors - KEEP THESE
        muted: {
          DEFAULT: "#f8fafc",
          foreground: "#64748b",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        
        // Gray scale - KEEP THESE
        gray: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;`;
  }

  /**
   * Convert color name to hex
   */
  private convertToHex(color: string): string {
    // If already hex, return as is
    if (color.startsWith('#')) {
      return color;
    }

    // Color name to hex mapping
    const colorMap: Record<string, string> = {
      'red': '#ef4444',
      'blue': '#3b82f6',
      'green': '#10b981',
      'yellow': '#f59e0b',
      'purple': '#8b5cf6',
      'pink': '#ec4899',
      'orange': '#f97316',
      'cyan': '#06b6d4',
      'teal': '#14b8a6',
      'lime': '#65a30d',
      'emerald': '#059669',
      'sky': '#0ea5e9',
      'indigo': '#6366f1',
      'violet': '#7c3aed',
      'fuchsia': '#d946ef',
      'rose': '#f43f5e',
      'black': '#000000',
      'white': '#ffffff',
      'gray': '#6b7280',
      'grey': '#6b7280'
    };

    return colorMap[color.toLowerCase()] || color;
  }

  /**
   * Generate color shade variations
   */
  private generateShade(baseColor: string, shade: number): string {
    // Simple shade generation - this could be more sophisticated
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    let factor: number;
    if (shade <= 500) {
      // Lighter shades
      factor = 1 + (500 - shade) / 500 * 0.8;
    } else {
      // Darker shades
      factor = 1 - (shade - 500) / 400 * 0.6;
    }

    const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
    const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
    const newB = Math.min(255, Math.max(0, Math.round(b * factor)));

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Count changes between two config strings
   */
  private countConfigChanges(oldConfig: string, newConfig: string): number {
    const oldLines = oldConfig.split('\n');
    const newLines = newConfig.split('\n');
    let changes = 0;

    const maxLength = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLength; i++) {
      if (oldLines[i] !== newLines[i]) {
        changes++;
      }
    }

    return changes;
  }
}