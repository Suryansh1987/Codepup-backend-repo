import fs from 'fs';
import path from 'path';

/**
 * Recursively generates a tree representation of a directory.
 * @param dirPath - The root directory to start from
 * @param prefix - Indentation prefix (used for nesting)
 * @returns Formatted file tree as a string
 */
function getFileTree(dirPath: string, prefix = ''): string {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries
    .map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return `${prefix}/${entry.name}/\n` + getFileTree(fullPath, prefix + '  ');
      } else {
        return `${prefix}- ${entry.name}`;
      }
    })
    .join('\n');
}

// ✅ Update this path to your actual local directory
const projectPath = path.resolve(__dirname, '../../react-base/src');

// Generate file structure
const structure = getFileTree(projectPath);

// Optional: log it
console.log('--- Project File Structure ---\n');
console.log(structure);

// Export if you want to use it elsewhere
export { structure };