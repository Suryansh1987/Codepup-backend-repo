import path from "path";
import { promises as fs } from "fs";

// Type definitions
interface AnalysisResult {
  files_to_modify?: string[];
  files_to_create?: string[];
  reasoning?: string;
  dependencies?: string[];
  notes?: string;
}

interface FileContent {
  path: string;
  content: string | null;
  type: "modify" | "create";
  exists: boolean;
}

interface ParseResult {
  success: boolean;
  files: FileContent[];
  metadata: {
    total_files: number;
    files_to_modify: number;
    files_to_create: number;
    reasoning?: string;
    dependencies?: string[];
    notes?: string;
    timestamp: string;
  };
}

export class FileContentParser {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async parseFromAnalysis(
    analysisResult: AnalysisResult
  ): Promise<ParseResult> {
    const filesContent: FileContent[] = [];

    try {
      // Parse files to modify
      console.log(typeof analysisResult, "analysed");
      console.log(analysisResult);

      if (
        analysisResult.files_to_modify &&
        analysisResult.files_to_modify.length > 0
      ) {
        for (const filePath of analysisResult.files_to_modify) {
          const content = await this.readFileContent(filePath);
          filesContent.push({
            path: filePath,
            content: content,
            type: "modify",
            exists: content !== null,
          });
        }
      }

      // Parse files to create (will be empty content)
      if (
        analysisResult.files_to_create &&
        analysisResult.files_to_create.length > 0
      ) {
        for (const filePath of analysisResult.files_to_create) {
          filesContent.push({
            path: filePath,
            content: "", // Empty content for new files
            type: "create",
            exists: false,
          });
        }
      }

      return {
        success: true,
        files: filesContent,
        metadata: {
          total_files: filesContent.length,
          files_to_modify: analysisResult.files_to_modify?.length || 0,
          files_to_create: analysisResult.files_to_create?.length || 0,
          reasoning: analysisResult.reasoning,
          dependencies: analysisResult.dependencies,
          notes: analysisResult.notes,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error parsing files:", error);
      throw error;
    }
  }

  async readFileContent(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);

      // Security check: ensure the file is within the project directory
      if (!fullPath.startsWith(path.resolve(this.projectRoot))) {
        throw new Error("Access denied: File is outside project directory");
      }

      const content = await fs.readFile(fullPath, "utf8");
      return content;
    } catch (error) {
      // Type guard for error handling
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        console.warn(`File not found: ${filePath}`);
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.projectRoot, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
