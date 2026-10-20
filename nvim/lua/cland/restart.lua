-- What survives `:restart` (ADR 0005). Neovim's terminals die with it, but the sessions live in the hub's
-- adapters: the shell writes its layout and the names of the attached sessions before it goes
-- (ExitPre with v:exitreason "restart"), and the new instance reads them back and runs the attach
-- commands again. The file lives under stdpath('state') (NVIM_APPNAME=cland-nvim), one per project.
local M = {}

M.MAX_AGE_S = 120

function M.file(root)
  local key = vim.fn.sha256(root or ''):sub(1, 16)
  return vim.fn.stdpath('state') .. '/restart/' .. key .. '.json'
end

--- Write the shell's snapshot for `root`.
function M.save(snapshot)
  local path = M.file(snapshot.root)
  vim.fn.mkdir(vim.fn.fnamemodify(path, ':h'), 'p')
  snapshot = vim.deepcopy(snapshot)
  snapshot.savedAt = os.time()
  vim.fn.writefile({ vim.json.encode(snapshot) }, path)
  return path
end

--- Read (and remove) the snapshot written for `root` within the last MAX_AGE_S seconds.
function M.take(root)
  local path = M.file(root)
  local ok, lines = pcall(vim.fn.readfile, path)
  if not ok or #lines == 0 then
    return nil
  end
  os.remove(path)
  local decoded, snap = pcall(vim.json.decode, table.concat(lines, '\n'), { luanil = { object = true, array = true } })
  if not decoded or type(snap) ~= 'table' or snap.root ~= root then
    return nil
  end
  if os.time() - (snap.savedAt or 0) > M.MAX_AGE_S then
    return nil
  end
  return snap
end

return M
