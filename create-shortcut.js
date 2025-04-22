const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

try {
  // Get current directory
  const currentDir = __dirname;
  
  // Create Windows shortcut
  if (process.platform === 'win32') {
    // Path to the batch file
    const batchFilePath = path.join(currentDir, 'start-browser.bat');
    
    // Ensure batch file exists
    if (!fs.existsSync(batchFilePath)) {
      console.error('start-browser.bat not found. Please create it first.');
      process.exit(1);
    }
    
    // Create a .vbs script to create the shortcut
    const vbsContent = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      strDesktop = WshShell.SpecialFolders("Desktop")
      Set oShellLink = WshShell.CreateShortcut(strDesktop & "\\Privacy Browser.lnk")
      oShellLink.TargetPath = "${batchFilePath.replace(/\\/g, '\\\\')}"
      oShellLink.WorkingDirectory = "${currentDir.replace(/\\/g, '\\\\')}"
      oShellLink.Description = "Privacy-First Browser"
      oShellLink.Save
    `;
    
    // Write and execute the VBS script
    const vbsPath = path.join(os.tmpdir(), 'create_shortcut.vbs');
    fs.writeFileSync(vbsPath, vbsContent);
    
    try {
      execSync(`cscript //nologo "${vbsPath}"`);
      console.log('Desktop shortcut created successfully!');
    } catch (error) {
      console.error('Failed to create shortcut:', error.message);
    } finally {
      // Clean up the temporary VBS file
      fs.unlinkSync(vbsPath);
    }
  } else {
    console.log('Shortcut creation is only supported on Windows');
  }
} catch (error) {
  console.error('Error:', error.message);
} 