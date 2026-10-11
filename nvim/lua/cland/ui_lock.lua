-- Shared with hub/src/hub/ui-lock.ts: install a nonempty directory atomically.
-- Recover only dead owners' unique files, then rmdir, which preserves a successor.
local uv = vim.uv
local M = {}
local function remove_empty(path)
  local ok, err, code = uv.fs_rmdir(path)
  if not ok and code ~= 'ENOENT' and code ~= 'EEXIST' and code ~= 'ENOTEMPTY' then error(err) end
end

function M.acquire(path)
  local name = ('%x-%x.owner'):format(vim.fn.getpid(), uv.hrtime())
  local temporary = path .. '.' .. name .. '.tmp'
  assert(uv.fs_mkdir(temporary, 448))
  local owner = temporary .. '/' .. name
  local fd
  local installed = false
  local ok, release = pcall(function()
    fd = assert(uv.fs_open(owner, 'wx', 384))
    assert(uv.fs_write(fd, tostring(vim.fn.getpid()), 0))
    assert(uv.fs_close(fd)); fd = nil
    for _ = 1, 3 do
      local moved, err, code = uv.fs_rename(temporary, path)
      if moved then
        installed = true
        return function()
          local removed, unlink_err, unlink_code = uv.fs_unlink(path .. '/' .. name)
          if not removed and unlink_code ~= 'ENOENT' then error(unlink_err) end
          remove_empty(path)
        end
      end
      if code ~= 'EEXIST' and code ~= 'ENOTEMPTY' then error(err) end
      local scan, scan_err, scan_code = uv.fs_scandir(path)
      if not scan and scan_code ~= 'ENOENT' then error(scan_err) end
      if scan then
        local names = {}
        while true do
          local entry = uv.fs_scandir_next(scan)
          if not entry then break end
          names[#names + 1] = entry
        end
        for _, entry in ipairs(names) do
          if not entry:match('^[a-f0-9%-]+%.owner$') then return nil end
          local read_ok, lines = pcall(vim.fn.readfile, path .. '/' .. entry)
          if read_ok then
            local pid = tonumber(lines[1])
            if not pid or pid < 1 or pid ~= math.floor(pid) then return nil end
            local _, _, probe_code = uv.kill(pid, 0)
            if probe_code ~= 'ESRCH' then return nil end
            local removed, unlink_err, unlink_code = uv.fs_unlink(path .. '/' .. entry)
            if not removed and unlink_code ~= 'ENOENT' then error(unlink_err) end
          elseif uv.fs_stat(path .. '/' .. entry) then
            -- An unreadable owner cannot be proven dead.
            return nil
          end
        end
        remove_empty(path)
      end
    end
  end)
  if fd then pcall(uv.fs_close, fd) end
  if not installed then pcall(uv.fs_unlink, owner); pcall(uv.fs_rmdir, temporary) end
  if not ok then error(release) end
  return release
end

return M
