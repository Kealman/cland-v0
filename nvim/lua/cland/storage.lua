-- One-time move of workbench-owned files out of the hub's shared legacy state directory.
local M = {}

function M.migrate()
  -- QA uses a separate appname and must never migrate the user's workbench state.
  if vim.env.NVIM_APPNAME ~= 'cland-nvim' then return end
  local uv = vim.uv
  local current = vim.fn.stdpath('state')
  local marker = current .. '/.legacy-state-migrated'
  if uv.fs_lstat(marker) then return end
  local old = vim.fn.fnamemodify(current, ':h') .. '/cland'
  local moved = {}
  local ok, err = pcall(function()
    vim.fn.mkdir(current, 'p')
    local function move(relative)
      local source, target = old .. '/' .. relative, current .. '/' .. relative
      local stat = uv.fs_lstat(source)
      if not stat or stat.type ~= 'file' then return end
      vim.fn.mkdir(vim.fn.fnamemodify(target, ':h'), 'p')
      -- Linking publishes without replacing a destination, including concurrent first starts.
      local linked, why, code = uv.fs_link(source, target)
      if not linked then
        if code == 'EEXIST' then return end
        error(why)
      end
      assert(uv.fs_unlink(source))
      moved[#moved + 1] = relative
    end
    move('ui.json')
    local restart = uv.fs_lstat(old .. '/restart')
    if restart and restart.type == 'directory' then
      local scan = assert(uv.fs_scandir(old .. '/restart'))
      while true do
        local name = uv.fs_scandir_next(scan)
        if not name then break end
        if name:match('%.json$') then move('restart/' .. name) end
      end
    end
    -- Existing destinations win; never retry or consume newly recreated legacy files.
    assert(vim.fn.writefile({ 'cland-nvim legacy state migration complete' }, marker) == 0)
  end)
  if #moved > 0 then
    io.stderr:write('cland-nvim: migrated ' .. table.concat(moved, ', ') .. ' from ' .. old .. ' to ' .. current .. '\n')
  end
  if not ok then io.stderr:write('cland-nvim: legacy state migration failed: ' .. tostring(err) .. '\n') end
end

return M
