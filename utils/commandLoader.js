import fs from 'fs';
import path from 'path';
import url from 'url';

async function loadCommands(commandsDir) {
  const commands = new Map();

  if (!fs.existsSync(commandsDir)) {
    console.warn(`Commands directory not found: ${commandsDir}`);
    return commands;
  }

  const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(commandsDir, file);
    try {
      // Convert path to file URL for ESM dynamic import
      const fileUrl = url.pathToFileURL(filePath).href;
      const imported = await import(fileUrl);
      
      // Support both default and named exports
      const command = imported.default || imported;

      if (command.name && typeof command.execute === 'function') {
        commands.set(command.name.toLowerCase(), command);
        console.log(`  ↳ Loaded command: ${command.name}`);
      } else {
        console.warn(
          `  ↳ Skipped ${file}: missing "name" or "execute" property`
        );
      }
    } catch (err) {
      console.error(`  ↳ Error loading ${file}:`, err.message);
    }
  }

  console.log(`📦 Loaded ${commands.size} command(s) from ${commandsDir}`);
  return commands;
}

export { loadCommands };