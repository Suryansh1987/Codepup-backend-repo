"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.structure = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Recursively generates a tree representation of a directory.
 * @param dirPath - The root directory to start from
 * @param prefix - Indentation prefix (used for nesting)
 * @returns Formatted file tree as a string
 */
function getFileTree(dirPath, prefix = '') {
    const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
    return entries
        .map(entry => {
        const fullPath = path_1.default.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            return `${prefix}/${entry.name}/\n` + getFileTree(fullPath, prefix + '  ');
        }
        else {
            return `${prefix}- ${entry.name}`;
        }
    })
        .join('\n');
}
// ✅ Update this path to your actual local directory
const projectPath = path_1.default.resolve(__dirname, '../../react-base/src');
// Generate file structure
const structure = getFileTree(projectPath);
exports.structure = structure;
// Optional: log it
console.log('--- Project File Structure ---\n');
console.log(structure);
//# sourceMappingURL=filetree.js.map