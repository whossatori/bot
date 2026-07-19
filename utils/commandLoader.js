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
        const key = command.name.toLowerCase();
        if (commands.has(key)) {
          console.warn(`  ↳ Warning: "${key}" is already registered, overwriting`);
        }
        commands.set(key, command);

        let aliasLog = '';
        if (Array.isArray(command.aliases) && command.aliases.length > 0) {
          for (const alias of command.aliases) {
            const aliasKey = alias.toLowerCase();
            if (commands.has(aliasKey)) {
              console.warn(`  ↳ Warning: alias "${aliasKey}" is already registered, overwriting`);
            }
            commands.set(aliasKey, command);
          }
          aliasLog = ` (aliases: ${command.aliases.join(', ')})`;
        }

        console.log(`  ↳ Loaded command: ${command.name}${aliasLog}`);
      } else {
        console.warn(
          `  ↳ Skipped ${file}: missing "name" or "execute" property`
        );
      }
    } catch (err) {
      console.error(`  ↳ Error loading ${file}:`, err.message);
    }
  }

  console.log(`📦 Loaded ${countUniqueCommands(commands)} command(s) from ${commandsDir}`);
  return commands;
}

// A command's name and all its aliases share one Map key each but point
// to the SAME command object — commands.size alone counts every alias
// as if it were its own command. This counts each loaded command once.
function countUniqueCommands(commands) {
  return new Set(commands.values()).size;
}

export { loadCommands, countUniqueCommands };