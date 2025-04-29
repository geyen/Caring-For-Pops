// Script to create a backup of all project files
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a backup directory if it doesn't exist
const backupDir = path.join(__dirname, 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Create a file to stream archive data to
const outputFilePath = path.join(backupDir, 'caring-for-pops-backup.zip');
const output = fs.createWriteStream(outputFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Highest compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`\n✅ Backup complete! ${archive.pointer()} total bytes written.`);
  console.log(`📁 Backup file created at: ${outputFilePath}`);
  console.log(`\nYou can download this file from Replit to your local computer.`);
});

// Good practice to catch warnings
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Handle errors
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Files/directories to exclude from backup
const excludeList = [
  'node_modules',
  '.git',
  'backup',
  'caring-for-pops-backup.zip'
];

// Function to determine if a path should be excluded
const shouldExclude = (itemPath) => {
  return excludeList.some(excludeItem => 
    itemPath === excludeItem || 
    itemPath.startsWith(excludeItem + path.sep)
  );
};

// Function to recursively add directory contents to the archive
const addDirectoryToArchive = (dirPath, archivePath) => {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = path.relative(__dirname, fullPath);
    
    if (shouldExclude(relativePath)) {
      continue;
    }
    
    const stats = fs.statSync(fullPath);
    const archiveItemPath = path.join(archivePath, item);
    
    if (stats.isDirectory()) {
      // Recursively add subdirectories
      addDirectoryToArchive(fullPath, archiveItemPath);
    } else {
      // Add file to archive
      archive.file(fullPath, { name: archiveItemPath });
      console.log(`Adding to backup: ${relativePath}`);
    }
  }
};

console.log('\n📦 Creating backup of all project files...');
console.log('This may take a moment depending on the size of your project.\n');

// Add all files and directories from the root directory
addDirectoryToArchive(__dirname, '');

// Finalize the archive
archive.finalize();