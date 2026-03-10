/**
 * Service action API
 * POST /api/system/services
 * Body: { name, backend, action }  action: restart | stop | start | logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ALLOWED_SERVICES_PM2 = ['classvault', 'content-vault', 'postiz-simple', 'brain'];
const ALLOWED_SERVICES_SYSTEMD = ['mission-control', 'openclaw-gateway', 'nginx'];

// Limitless Era macOS services — launchctl labels and log paths
const LAUNCHCTL_SERVICES: Record<string, { label: string; logFile: string }> = {
  'elon-gateway':   { label: 'ai.openclaw.elon.gateway', logFile: `${process.env.HOME}/.openclaw-elon/logs/gateway.log` },
  'athena-gateway': { label: 'ai.openclaw.gateway',      logFile: `${process.env.HOME}/.openclaw/logs/gateway.log` },
  'qmd-http':       { label: 'com.zico.qmd-mcp',         logFile: `${process.env.HOME}/.openclaw-elon/workspace/logs/qmd-cron.log` },
};
const ALLOWED_DOCKER_IDS_PATTERN = /^[a-f0-9]{6,64}$|^[a-zA-Z0-9_-]+$/;

async function pm2Action(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_PM2.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    // Get last 100 lines of PM2 logs
    try {
      const logFile = `/root/.pm2/logs/${name}-out.log`;
      const { stdout } = await execAsync(`tail -100 "${logFile}" 2>/dev/null || echo "No logs available"`);
      const errFile = `/root/.pm2/logs/${name}-error.log`;
      const { stdout: errOut } = await execAsync(`tail -50 "${errFile}" 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
      return `=== STDOUT (last 100 lines) ===\n${stdout}\n${errOut ? `\n=== STDERR (last 50 lines) ===\n${errOut}` : ''}`;
    } catch {
      return 'Could not retrieve logs';
    }
  }

  const { stdout, stderr } = await execAsync(`pm2 ${action} "${name}" 2>&1`);
  return stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
}

async function systemdAction(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_SYSTEMD.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`journalctl -u "${name}" -n 100 --no-pager 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`systemctl ${action} "${name}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

async function launchctlAction(name: string, action: string): Promise<string> {
  const svc = LAUNCHCTL_SERVICES[name];
  if (!svc) throw new Error(`Service "${name}" not in launchctl allowlist`);

  const uid = process.getuid ? process.getuid() : 501;
  const domain = `gui/${uid}`;

  if (action === 'logs') {
    try {
      const { stdout } = await execAsync(`tail -100 "${svc.logFile}" 2>/dev/null || echo "No log file at ${svc.logFile}"`);
      return stdout;
    } catch {
      return 'Could not retrieve logs';
    }
  }

  if (action === 'restart') {
    await execAsync(`launchctl kickstart -k ${domain}/${svc.label} 2>&1`).catch(() => {});
    return `Restarted ${svc.label}`;
  }

  if (action === 'stop') {
    const { stdout } = await execAsync(`launchctl stop ${svc.label} 2>&1`);
    return stdout || `Stopped ${svc.label}`;
  }

  if (action === 'start') {
    const { stdout } = await execAsync(`launchctl start ${svc.label} 2>&1`);
    return stdout || `Started ${svc.label}`;
  }

  throw new Error(`Unknown action "${action}"`);
}

async function tmuxAction(name: string, action: string): Promise<string> {
  const TMUX_SOCK = `${process.env.HOME}/.tmux/sock`;
  const sessionMap: Record<string, string> = {
    'mission-control': 'mission-control',
  };
  const session = sessionMap[name];
  if (!session) throw new Error(`No tmux session mapped for "${name}"`);

  if (action === 'logs') {
    const { stdout } = await execAsync(`tmux -S ${TMUX_SOCK} capture-pane -t ${session} -p 2>/dev/null | tail -100 || echo "Session not found"`);
    return stdout;
  }

  if (action === 'restart') {
    await execAsync(`tmux -S ${TMUX_SOCK} send-keys -t ${session} C-c 2>/dev/null`).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    const { stdout } = await execAsync(`tmux -S ${TMUX_SOCK} send-keys -t ${session} "npm run dev" Enter 2>/dev/null || echo "Could not restart"`);
    return stdout || 'Restart command sent';
  }

  throw new Error(`Action "${action}" not supported for tmux backend`);
}

async function dockerAction(id: string, action: string): Promise<string> {
  if (!ALLOWED_DOCKER_IDS_PATTERN.test(id)) {
    throw new Error(`Invalid container ID "${id}"`);
  }
  if (!['start', 'stop', 'restart', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`docker logs --tail 100 "${id}" 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`docker ${action} "${id}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, backend, action } = body;

    if (!name || !backend || !action) {
      return NextResponse.json({ error: 'Missing name, backend or action' }, { status: 400 });
    }

    let output = '';

    switch (backend) {
      case 'pm2':
        output = await pm2Action(name, action);
        break;
      case 'systemd':
        output = await systemdAction(name, action);
        break;
      case 'docker':
        output = await dockerAction(name, action);
        break;
      case 'launchctl':
        output = await launchctlAction(name, action);
        break;
      case 'tmux':
        output = await tmuxAction(name, action);
        break;
      default:
        return NextResponse.json({ error: `Unknown backend "${backend}"` }, { status: 400 });
    }

    return NextResponse.json({ success: true, output, action, name, backend });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[services API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
