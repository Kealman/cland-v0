import type { Client } from './harness.ts';

/** Ordinary fixture startup: connection alone does not mean its lists are installed.
 * Topic history and detail requests have their own rendered-state waits at the action site.
 * Tests intentionally holding initial snapshots must use their specific state waits instead.
 */
export async function waitInitialSnapshots(client: Client): Promise<void> {
  await client.waitScreen(s => s.includes('hub: connected'), 'connected before initial snapshots');
  await client.lua(`
    local types = { ['hub.status']=true, ['task.list']=true, ['topic.list']=true,
      ['rule.list']=true, ['session.list']=true, ['account.list']=true, ['artifact.list']=true }
    assert(vim.wait(5000, function()
      local c = require('cland').client
      if not c:connected() or c.inbox_waiters then return false end
      -- role.list is a plain request. Ordinary fixtures have configured roles;
      -- the launcher consumes their defaults once, when the role is selected.
      if #require('cland.state').S.roles == 0 then return false end
      for journal in pairs(c.snapshots) do
        if types[journal.request.type] then return false end
      end
      return true
    end), 'initial workbench snapshots have not landed')
  `);
}
