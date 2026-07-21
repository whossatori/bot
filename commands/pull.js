import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default {
  name: 'pull',
  description: 'Pulls the latest changes from git, installs new packages if needed, and restarts the bot. (Admin only)',
  adminOnly: true,

  async execute({ channelName, botState }) {
    await botState.client.me(channelName, 'pulling...');

    try {
      let oldPackageJson = '';
      try {
        oldPackageJson = readFileSync('package.json', 'utf8');
      } catch (err) {
        console.warn('Could not read package.json:', err.message);
      }

      const { stdout } = await execAsync('git pull');

      if (stdout.includes('Already up to date.')) {
        await botState.client.me(channelName, 'up to date');
        return;
      }

      let needsPackageInstall = false;

      if (oldPackageJson) {
        try {
          const newPackageJson = readFileSync('package.json', 'utf8');
          if (oldPackageJson !== newPackageJson) {
            needsPackageInstall = true;
            await botState.client.me(channelName, 'package.json changed, installing packages...');
          }
        } catch (err) {
          console.warn('Could not compare package.json:', err.message);
        }
      }

      if (needsPackageInstall) {
        try {
          const { stdout: npmStdout, stderr: npmStderr } = await execAsync('npm install');
          console.log('NPM Install:', npmStdout);
          if (npmStderr) console.warn('NPM Install warnings:', npmStderr);
        } catch (npmError) {
          await botState.client.me(channelName, `package install failed: ${npmError.message}`);
          console.error('NPM install error:', npmError);
          return;
        }
      }

      const statusMsg = needsPackageInstall
        ? `pulled: ${getChanges(stdout)} & installed packages, restarting...`
        : `pulled: ${getChanges(stdout)}, restarting...`;

      await botState.client.me(channelName, statusMsg);

    } catch (error) {
      await botState.client.me(channelName, `pull failed: ${error.message}`);
      console.error('Pull command error:', error);
      return;
    }

    // Restart is a separate try/catch so a failure here is reported as a
    // restart failure, not lumped in with the pull/install errors above
    // (the pull already succeeded by this point). No artificial delay
    // needed before this — the awaited status message above only
    // resolves once it's actually been sent.
    try {
      // botState.config.pm2ProcessName must match the name `pm2 list`
      // shows for this bot's process.
      const { stdout: pm2Stdout, stderr: pm2Stderr } = await execAsync(`pm2 restart ${botState.config.pm2ProcessName}`);

      // This usually won't run if the restart succeeds — the process gets
      // killed and replaced before it can print anything.
      console.log('PM2 restart output:', pm2Stdout);
      if (pm2Stderr) console.warn('PM2 restart stderr:', pm2Stderr);
    } catch (error) {
      await botState.client.me(channelName, `pull succeeded but restart failed: ${error.message}`);
      console.error('Restart command error:', error);
    }
  },
};

function getChanges(stdout) {
  const lines = stdout.split('\n').filter(Boolean);
  const changeLine = lines.find((value) => /files? changed/.test(value));
  return changeLine || 'changes';
}