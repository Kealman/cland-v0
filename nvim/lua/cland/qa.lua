-- cland's QA lane inside Neovim (spec 4.10, #57): the Lua QA API a scripted case drives the workbench
-- with, and the runner `cland --headless --qa <case.lua>` starts through nvim/init.lua (CLAND_QA_CASE).
--
-- A case is a Lua file returning a table:
--   title     one line saying what the case checks
--   hub       'stdio' (the real hub as a child, `cland hub serve --stdio --no-listen`; the default) or
--             'stub' (the stub hub, nvim/test/stub-hub.ts); `--hub` on the command line wins
--   fixture   the project the case runs against, built in the temp dir, never the live one:
--             project (its name), items (a list of items), roles and config (the text of
--             `.cland/roles.toml` and `.cland/config.toml`)
--   scenario  the stub hub's scenario: processes, presence, adapters, topics, messages, inbox, roles, …
--             (the fixture's items are its items unless it names its own)
--   run       function(qa): the case, driving the workbench through the API below
--
-- The case runs as a coroutine. Keys typed with nvim_input() are consumed by Neovim's main loop only, never
-- while Lua is running (vim.wait() included), so `keys` and `wait_for` hand control back to the main loop
-- and go on from a scheduled callback, the way an RPC client's requests arrive between keys.
local api = vim.api
local uv = vim.uv

local M = {}

--- The grid every case sees: the smallest size the design is drawn for.
M.COLUMNS = 160
M.LINES = 45
M.DEFAULT_TIMEOUT_MS = 5000
--- How long `wait_for` lets events arrive (vim.wait) before it lets the main loop take typed keys again.
local SLICE_MS = 30
--- `keys` hands Neovim at most this many bytes at a time (its input buffer holds 16 KiB), lets the main
--- loop read them for a few milliseconds, and gives up after that many pauses with nothing taken (about 5 s).
local KEYS_CHUNK = 4096
local KEYS_PAUSE_MS = 5
local MAX_STALLED = 1000

--- The chunks `keys` sends `keys` in, or nil and why it cannot. A pause between two chunks ends whatever
--- command or mapping is pending, in any mode, so a long sequence is cut only right after `<Esc>` or `<CR>`,
--- where none is: the latest such cut within KEYS_CHUNK bytes. A stretch longer than that with neither is
--- refused before anything is typed.
local function chunks_of(keys)
  if #keys <= KEYS_CHUNK then
    return { keys }
  end
  -- where each `<Esc>` or `<CR>` ends: the places a cut is safe
  local cuts = {}
  local i = 1
  while i <= #keys do
    local notation = keys:match('^<[^<>%s]+>', i)
    local key = notation or keys:match('^[%z\1-\127\194-\244][\128-\191]*', i)
    i = i + #key
    local name = notation and notation:lower()
    if name == '<esc>' or name == '<cr>' then
      cuts[#cuts + 1] = i - 1
    end
  end
  local out, from, k = {}, 0, 1
  while #keys - from > KEYS_CHUNK do
    local cut
    while cuts[k] and cuts[k] - from <= KEYS_CHUNK do
      if cuts[k] > from then
        cut = cuts[k]
      end
      k = k + 1
    end
    if not cut then
      return nil,
        ('keys: %d bytes from byte %d on hold no <Esc> or <CR> within %d bytes, the most typed at once; put an <Esc> or a <CR> where the mode is known, or split the keys over several qa.keys calls'):format(
          #keys - from,
          from + 1,
          KEYS_CHUNK
        )
    end
    out[#out + 1] = keys:sub(from + 1, cut)
    from = cut
  end
  out[#out + 1] = keys:sub(from + 1)
  return out
end
local RESULT_MARK = 'CLAND-QA-RESULT '
local STAMP = '2026-01-01T00:00:00.000Z'

-- The screen and the state ------------------------------------------------------------------------------

--- The grid as text: one line per screen row, trailing blanks cut.
function M.screen()
  vim.cmd('redraw')
  local rows = {}
  for r = 1, vim.o.lines do
    local cells = {}
    for c = 1, vim.o.columns do
      cells[#cells + 1] = vim.fn.screenstring(r, c)
    end
    rows[#rows + 1] = (table.concat(cells):gsub('%s+$', ''))
  end
  return table.concat(rows, '\n')
end

--- What the client knows, as plain data: the hub connection, the sessions with their states, the roles, the
--- topics with their statuses, the open asks, the items, and what the shell shows.
function M.state()
  local state = require('cland.state')
  local S = state.S
  local sessions = {}
  for _, s in ipairs(state.sessions()) do
    sessions[#sessions + 1] = { name = s.name, role = s.role, label = s.label, harness = s.harness, model = s.model, state = s.state, status = s.status, live = s.live, launched = s.launched, item = s.item }
  end
  local coordinator = state.coordinator()
  return vim.deepcopy({
    project = S.project,
    root = S.root,
    hub = { state = S.hub.state, detail = S.hub.detail },
    mode = api.nvim_get_mode().mode,
    view = S.ui.view,
    panels = { left = S.ui.left, right = S.ui.right, dock = S.ui.dock },
    sessions = sessions,
    coordinator = coordinator and coordinator.name or nil,
    roles = S.roles,
    topics = S.topics,
    asks = S.inbox.asks,
    needs_you = state.needs_you(),
    items = S.items,
  })
end

local function write_file(path, text)
  local f, err = io.open(path, 'w')
  if not f then
    error(('cannot write %s: %s'):format(path, tostring(err)), 0)
  end
  f:write(text)
  f:close()
end

--- Write the grid as `<path>.screen.txt` and the state as `<path>.state.json`; returns the two files.
--- `:Cland qa dump <path>` does this in any run.
function M.dump(path)
  local files = { path .. '.screen.txt', path .. '.state.json' }
  vim.fn.mkdir(vim.fn.fnamemodify(path, ':h'), 'p')
  write_file(files[1], M.screen() .. '\n')
  write_file(files[2], vim.json.encode(M.state()) .. '\n')
  return files
end

--- A result raised out of the case: FAIL (an expectation), INCONCLUSIVE (a wait that timed out), BLOCKED
--- (the run cannot go on; an error in the case's own Lua is BLOCKED too, with its traceback).
local function ends(result, message)
  error({ qa = result, message = message }, 0)
end

local function blocked(message)
  ends('BLOCKED', message)
end

-- The fixture project -------------------------------------------------------------------------------------

--- nvim/ (this file is nvim/lua/cland/qa.lua).
local function nvim_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h:h')
end

--- The `cland` command of this repository, as a list.
local function cland_cli()
  return { vim.env.CLAND_NODE or 'node', vim.fn.fnamemodify(nvim_dir(), ':h') .. '/hub/bin/cland.ts' }
end

--- An item as `task.list` summarises it: what the stub hub answers with. Its file name is for show only: the
--- stub hub has no files (the stdio hub's are named by the tracker).
local function item_summary(item)
  local slug = (item.title or ''):lower():gsub('[^%w]+', '-'):gsub('^%-+', ''):gsub('%-+$', ''):sub(1, 40)
  return vim.tbl_extend('keep', vim.deepcopy(item), {
    kind = 'task',
    state = 'open',
    labels = {},
    blocked_by = {},
    created = STAMP,
    updated = STAMP,
    file = ('%s-%s.md'):format(item.id, slug),
  })
end

--- Build the fixture project under `tmp` and return its root and its name. The files are written by `cland
--- --qa-fixture`, with the tracker's own writer, and only inside `tmp`. Where nothing may be written (no
--- `tmp`), a stub-hub case still runs: its hub holds the fixture, and the root is an empty directory outside
--- any project.
local function build_fixture(case, tmp, hub)
  local fixture = case.fixture or {}
  local project = fixture.project or 'qa-project'
  -- what the fixture names becomes paths: refused here, under either hub, before anything is written
  if type(project) ~= 'string' or not project:match('^[%w][%w%._%-]*$') then
    blocked(('the fixture\'s project "%s" is not a plain directory name'):format(tostring(project)))
  end
  for _, item in ipairs(fixture.items or {}) do
    if type(item.id) ~= 'string' or not item.id:match('^T%-[1-9]%d*$') then
      blocked(('the fixture\'s item id "%s" is not T-<n>'):format(tostring(item.id)))
    end
  end
  if tmp == '' then
    if hub ~= 'stub' then
      blocked('no temp dir to build the fixture project in: a read-only run takes a stub-hub case (--hub stub)')
    end
    for _, dir in ipairs({ '/var/empty', '/' }) do
      if vim.fn.isdirectory(dir) == 1 then
        return dir, project
      end
    end
  end
  local spec = vim.json.encode({ dir = tmp, project = project, items = fixture.items or {}, roles = fixture.roles, config = fixture.config })
  local done = vim.system(vim.list_extend(cland_cli(), { '--qa-fixture' }), { stdin = spec, text = true }):wait()
  if done.code ~= 0 then
    blocked('the fixture project was not built: ' .. vim.trim(done.stderr ~= '' and done.stderr or done.stdout))
  end
  return vim.trim(done.stdout), project
end

local function start_shell(case, root, project, hub)
  local cli
  if hub == 'stub' then
    local scenario = vim.deepcopy(case.scenario or {})
    if not scenario.items and case.fixture and case.fixture.items then
      scenario.items = vim.tbl_map(item_summary, case.fixture.items)
    end
    -- the scenario goes inline: a read-only run has nowhere to write it
    vim.env.CLAND_STUB_SCENARIO_JSON = next(scenario) and vim.json.encode(scenario) or '{}'
    cli = { vim.env.CLAND_NODE or 'node', nvim_dir() .. '/test/stub-hub.ts' }
  else
    cli = cland_cli()
  end
  require('cland').start({ root = root, transport = 'stdio', cli = cli, serve_args = { '--no-listen' } })
  require('cland.state').S.project = project
end

-- The runner ----------------------------------------------------------------------------------------------

--- Run the case CLAND_QA_CASE names and quit: the result goes to stdout as one marked JSON line, with the last
--- screen and state as files in CLAND_QA_OUT, else inline.
function M.run()
  local path = vim.env.CLAND_QA_CASE
  local out = vim.env.CLAND_QA_OUT or ''
  local name = vim.env.CLAND_QA_NAME or vim.fn.fnamemodify(path, ':t:r')
  local hub = (vim.env.CLAND_QA_HUB or '') ~= '' and vim.env.CLAND_QA_HUB or nil
  vim.o.columns = M.COLUMNS
  vim.o.lines = M.LINES
  vim.o.swapfile = false
  -- one process with no socket: the server Neovim starts by default is stopped
  for _, server in ipairs(vim.fn.serverlist()) do
    pcall(vim.fn.serverstop, server)
  end

  local co
  local finished = false
  local files, dumps = {}, {}

  local function finish(result, message)
    if finished then
      return
    end
    finished = true
    local evidence
    local ok, err = pcall(function()
      if out ~= '' then
        vim.list_extend(files, M.dump(out .. '/' .. name))
        evidence = files
      else
        evidence = { screen = M.screen(), state = M.state() }
        if next(dumps) then
          evidence.dumps = dumps
        end
      end
    end)
    if not ok then
      evidence = out ~= '' and files or vim.empty_dict()
      message = (message and (message .. '\n') or '') .. 'the last screen was not dumped: ' .. tostring(err)
      result = result == 'PASS' and 'BLOCKED' or result
    end
    io.stdout:write(RESULT_MARK .. vim.json.encode({ result = result, message = message, hub = hub, evidence = evidence }) .. '\n')
    io.stdout:flush()
    -- where :qall is refused (the command-line window, a locked text), leave anyway
    if not pcall(vim.cmd, 'qall!') then
      os.exit(0)
    end
  end

  local function resume()
    if finished then
      return
    end
    local ok, err = coroutine.resume(co)
    if not ok then
      if type(err) == 'table' and err.qa then
        return finish(err.qa, err.message)
      end
      return finish('BLOCKED', debug.traceback(co, tostring(err)))
    end
    if coroutine.status(co) == 'dead' then
      finish('PASS')
    end
  end

  --- Back to Neovim's main loop, which takes the typed keys before it runs this callback.
  local function settle()
    vim.schedule(resume)
    coroutine.yield()
  end

  --- Back to the main loop for `ms` milliseconds.
  local function pause(ms)
    vim.defer_fn(resume, ms)
    coroutine.yield()
  end

  local qa = { screen = M.screen, state = M.state }

  --- Type keys as a human does (nvim_input notation: `<CR>`, `<Esc>`, `<Space>`); they are consumed before
  --- this returns. A mapping's keys go in one call: an event between two calls ends a pending mapping.
  function qa.keys(keys)
    -- nvim_input() takes what its input buffer has room for, whole keys only, and says how many bytes that
    -- was. A buffer filled to the brim takes nothing more, even once read (Neovim 0.12), so a long sequence
    -- goes in chunks well under its size, with a pause for the main loop to read each
    local chunks, why = chunks_of(keys)
    if not chunks then
      blocked(why)
    end
    for n, chunk in ipairs(chunks) do
      local stalled = 0
      while chunk ~= '' do
        local taken = api.nvim_input(chunk)
        chunk = chunk:sub(taken + 1)
        stalled = taken > 0 and 0 or stalled + 1
        if stalled > MAX_STALLED then
          blocked(('keys: Neovim takes no more input, %d bytes were not typed'):format(#chunk))
        end
        if chunk ~= '' or n < #chunks then
          pause(KEYS_PAUSE_MS)
        end
      end
    end
    settle()
  end

  --- Wait until `predicate()` is truthy and return its value; after `timeout` ms the case is INCONCLUSIVE.
  function qa.wait_for(predicate, timeout, what)
    timeout = timeout or M.DEFAULT_TIMEOUT_MS
    local deadline = uv.hrtime() + timeout * 1e6
    while true do
      settle()
      -- the predicate's own error is raised here, not from inside vim.wait
      local ok, value = true, nil
      vim.wait(SLICE_MS, function()
        ok, value = pcall(predicate)
        return not ok or (value and true or false)
      end, 10)
      if not ok then
        error(value, 0)
      end
      if value then
        return value
      end
      if uv.hrtime() >= deadline then
        ends('INCONCLUSIVE', ('wait_for timed out after %d ms%s'):format(timeout, what and (': ' .. what) or ''))
      end
    end
  end

  --- The case FAILs with `message` unless `condition` is truthy.
  function qa.expect(condition, message)
    if not condition then
      ends('FAIL', message or 'an expectation failed')
    end
    return condition
  end

  --- Dump the grid and the state under `path` now: files in --out (or at an absolute path), else kept
  --- inline in the result's evidence under that name.
  function qa.dump(dump_path)
    if dump_path:sub(1, 1) ~= '/' then
      if out == '' then
        dumps[dump_path] = { screen = M.screen(), state = M.state() }
        return {}
      end
      dump_path = out .. '/' .. dump_path
    end
    local written = M.dump(dump_path)
    vim.list_extend(files, written)
    return written
  end

  co = coroutine.create(function()
    local chunk, load_err = loadfile(path)
    if not chunk then
      blocked('the case does not load: ' .. tostring(load_err))
    end
    local case = chunk()
    if type(case) ~= 'table' or type(case.run) ~= 'function' then
      blocked('a case returns a table with a run(qa) function')
    end
    hub = hub or case.hub or 'stdio'
    if hub ~= 'stdio' and hub ~= 'stub' then
      blocked(('the case names the hub "%s": it is stdio or stub'):format(tostring(hub)))
    end
    local root, project = build_fixture(case, vim.env.CLAND_QA_TMP or '', hub)
    qa.root = root
    start_shell(case, root, project, hub)
    settle()
    case.run(qa)
  end)
  vim.schedule(resume)
end

return M
