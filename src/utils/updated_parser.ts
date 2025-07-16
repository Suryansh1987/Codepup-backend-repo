interface CodeFile {
  path: string;
  content: string;
}

interface StructureNode {
  [key: string]: StructureNode | string;
}

interface ParsedResult {
  codeFiles: CodeFile[];
  structure: StructureNode;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

class LLMCodeParser {
  /**
   * Unescapes JSON escaped strings
   */
  private static unescapeString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  /**
   * Extracts JSON from text, handling various formats
   */
  private static extractJsonFromText(input: string): string {
    // Try to parse the input as JSON directly first
    try {
      JSON.parse(input);
      return input;
    } catch (e) {
      // Continue with extraction methods
    }

    // Handle nested JSON structure (like your example)
    try {
      const parsed = JSON.parse(input);
      if (parsed.content && parsed.content[0] && parsed.content[0].text) {
        return this.extractJsonFromText(parsed.content[0].text);
      }
    } catch (e) {
      // Continue with other methods
    }

    // Remove markdown code blocks if present
    let cleanInput = input
      .replace(/```json\s*\n?/g, "")
      .replace(/```\s*$/g, "");

    // Find the first opening brace and last closing brace
    const firstBrace = cleanInput.indexOf("{");
    const lastBrace = cleanInput.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error("No valid JSON object found in input");
    }

    return cleanInput.substring(firstBrace, lastBrace + 1);
  }

  /**
   * Generates a file structure tree from code files
   */
  private static generateStructureTree(codeFiles: CodeFile[]): StructureNode {
    const structure: StructureNode = {};

    codeFiles.forEach((file) => {
      const pathParts = file.path.split("/");
      let current = structure;

      // Navigate/create directory structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as StructureNode;
      }

      // Set file status (you can customize this based on your needs)
      const fileName = pathParts[pathParts.length - 1];
      current[fileName] = "new"; // Default status
    });

    return structure;
  }

  /**
   * Main parsing function - matches your parseFrontendCode signature
   */
  static parseFrontendCode(input: string): ParsedResult {
    try {
      // Extract JSON from the input text
      const jsonString = this.extractJsonFromText(input);
      const data = JSON.parse(jsonString);

      // Handle different JSON structures
      let codefilesData: Record<string, string>;

      if (data.codefiles) {
        // Direct codefiles structure
        codefilesData = data.codefiles;
      } else if (data.content && data.content[0] && data.content[0].text) {
        // Nested structure - extract from content
        const innerData = JSON.parse(data.content[0].text);
        if (innerData.codefiles) {
          codefilesData = innerData.codefiles;
        } else {
          throw new Error("No codefiles found in nested structure");
        }
      } else {
        throw new Error("Missing or invalid codefiles property");
      }

      // Extract and unescape code files
      //@ts-ignore
      const codeFiles: CodeFile[] = Object.entries(codefilesData).map(
        //@ts-ignore
        ([path, content]) => ({
          path,
          content: this.unescapeString(content as string),
        })
      );

      // Generate structure tree
      const structure = this.generateStructureTree(codeFiles);

      return {
        codeFiles,
        structure,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse frontend code data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Write files to disk
   */

  /**
   * Get file by path
   */
  static getCodeFileByPath(
    codeFiles: CodeFile[],
    path: string
  ): CodeFile | null {
    return codeFiles.find((file) => file.path === path) || null;
  }

  /**
   * Get files by extension
   */
  static getFilesByExtension(
    codeFiles: CodeFile[],
    extension: string
  ): CodeFile[] {
    return codeFiles.filter((file) => file.path.endsWith(extension));
  }

  /**
   * Get files by directory
   */
  static getFilesByDirectory(
    codeFiles: CodeFile[],
    directory: string
  ): CodeFile[] {
    return codeFiles.filter((file) => file.path.startsWith(directory));
  }

  /**
   * Preview files (useful for debugging)
   */
  static previewFiles(parsedResult: ParsedResult): void {
    console.log(`\n📋 Found ${parsedResult.codeFiles.length} files:\n`);

    parsedResult.codeFiles.forEach((file, index) => {
      const size = file.content.length;
      const lines = file.content.split("\n").length;

      console.log(`${index + 1}. ${file.path}`);
      console.log(`   Size: ${size} characters, ${lines} lines`);
      console.log(`   Preview: ${file.content.substring(0, 100)}...`);
      console.log("");
    });
  }

  /**
   * Validate files (check for common issues)
   */

  /**
   * Flatten structure tree for easier navigation
   */
  static flattenStructure(
    structure: StructureNode,
    basePath: string = ""
  ): string[] {
    const paths: string[] = [];
    //@ts-ignore
    for (const [key, value] of Object.entries(structure)) {
      const currentPath = basePath ? `${basePath}/${key}` : key;

      if (typeof value === "string") {
        // This is a file
        paths.push(currentPath);
      } else if (typeof value === "object" && value !== null) {
        // This is a directory, recurse
        paths.push(...this.flattenStructure(value, currentPath));
      }
    }

    return paths;
  }

  /**
   * Get file status from structure
   */
  static getFileStatus(
    structure: StructureNode,
    filePath: string
  ): string | null {
    const pathParts = filePath.split("/");
    let current = structure;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (typeof current[part] === "object" && current[part] !== null) {
        current = current[part] as StructureNode;
      } else {
        return null; // Path doesn't exist
      }
    }

    const fileName = pathParts[pathParts.length - 1];
    const fileEntry = current[fileName];

    return typeof fileEntry === "string" ? fileEntry : null;
  }
}

// Export the main function and class
export default LLMCodeParser;
export { CodeFile, StructureNode, ParsedResult, ValidationResult };

// Usage example:
/*
import LLMCodeParser from './llm-code-parser';

// Parse the LLM response (matches your parseFrontendCode function)
const llmResponse = `your LLM response here`;
const parsedResult = LLMCodeParser.parseFrontendCode(llmResponse);

// Preview files
LLMCodeParser.previewFiles(parsedResult);

// Validate files
const validation = LLMCodeParser.validateFiles(parsedResult);
if (!validation.isValid) {
  console.log('Issues found:', validation.errors);
}

// Write files to disk
await LLMCodeParser.writeFiles(parsedResult, './my-project');

// Get specific files
const envFile = LLMCodeParser.getCodeFileByPath(parsedResult.codeFiles, '.env');
const tsFiles = LLMCodeParser.getFilesByExtension(parsedResult.codeFiles, '.ts');
const srcFiles = LLMCodeParser.getFilesByDirectory(parsedResult.codeFiles, 'src/');

// Work with structure
const allPaths = LLMCodeParser.flattenStructure(parsedResult.structure);
const fileStatus = LLMCodeParser.getFileStatus(parsedResult.structure, 'src/App.tsx');
*/