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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileContentParser = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
class FileContentParser {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }
    parseFromAnalysis(analysisResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const filesContent = [];
            try {
                // Parse files to modify
                console.log(typeof analysisResult, "analysed");
                console.log(analysisResult);
                if (analysisResult.files_to_modify &&
                    analysisResult.files_to_modify.length > 0) {
                    for (const filePath of analysisResult.files_to_modify) {
                        const content = yield this.readFileContent(filePath);
                        filesContent.push({
                            path: filePath,
                            content: content,
                            type: "modify",
                            exists: content !== null,
                        });
                    }
                }
                // Parse files to create (will be empty content)
                if (analysisResult.files_to_create &&
                    analysisResult.files_to_create.length > 0) {
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
                        files_to_modify: ((_a = analysisResult.files_to_modify) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        files_to_create: ((_b = analysisResult.files_to_create) === null || _b === void 0 ? void 0 : _b.length) || 0,
                        reasoning: analysisResult.reasoning,
                        dependencies: analysisResult.dependencies,
                        notes: analysisResult.notes,
                        timestamp: new Date().toISOString(),
                    },
                };
            }
            catch (error) {
                console.error("Error parsing files:", error);
                throw error;
            }
        });
    }
    readFileContent(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullPath = path_1.default.resolve(this.projectRoot, filePath);
                // Security check: ensure the file is within the project directory
                if (!fullPath.startsWith(path_1.default.resolve(this.projectRoot))) {
                    throw new Error("Access denied: File is outside project directory");
                }
                const content = yield fs_1.promises.readFile(fullPath, "utf8");
                return content;
            }
            catch (error) {
                // Type guard for error handling
                if (error instanceof Error &&
                    "code" in error &&
                    error.code === "ENOENT") {
                    console.warn(`File not found: ${filePath}`);
                    return null; // File doesn't exist
                }
                throw error;
            }
        });
    }
    fileExists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullPath = path_1.default.resolve(this.projectRoot, filePath);
                yield fs_1.promises.access(fullPath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
}
exports.FileContentParser = FileContentParser;
//# sourceMappingURL=classes.js.map