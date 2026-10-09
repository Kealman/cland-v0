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

local function slug(title)
  return (title:lower():gsub('[^%w]+', '-'):gsub('^%-+', ''):gsub('%-+$', '')):sub(1, 40)
end

local function item_file_name(item)
  return ('%s-%s.md'):format(item.id, slug(item.title or ''))
end

--- An item file as the tracker writes it (spec 4.6): frontmatter, the body, the comments.
local function item_file(item)
  local function scalar(v)
    return (v == nil or v == vim.NIL) and 'null' or tostring(v)
  end
  local function list(v)
    return '[' .. table.concat(v or {}, ', ') .. ']'
  end
  local lines = {
    '---',
    'id: ' .. item.id,
    'kind: ' .. (item.kind or 'task'),
    'title: ' .. vim.json.encode(item.title or ''),
    'state: ' .. (item.state or 'open'),
    'labels: ' .. list(item.labels),
    'assignee: ' .. scalar(item.assignee),
    'parent: ' .. scalar(item.parent),
    'blocked_by: ' .. list(item.blocked_by),
    'topic: ' .. scalar(item.topic),
    'branch: ' .. scalar(item.branch),
    'created: ' .. (item.created or STAMP),
    'updated: ' .. (item.updated or STAMP),
    '---',
  }
  if item.body and item.body ~= '' then
    vim.list_extend(lines, { '', item.body })
  end
  if item.comments and #item.comments > 0 then
    vim.list_extend(lines, { '', '## Comments' })
    for _, c in ipairs(item.comments) do
      vim.list_extend(lines, { '', ('### %s · %s'):format(c.author, c.at or STAMP), '', c.text })
    end
  end
  return table.concat(lines, '\n') .. '\n'
end

--- An item as `task.list` summarises it: what the stub hub answers with.
local function item_summary(item)
  return vim.tbl_extend('keep', vim.deepcopy(item), {
    kind = 'task',
    state = 'open',
    labels = {},
    blocked_by = {},
    created = STAMP,
    updated = STAMP,
    file = item_file_name(item),
  })
end

--- Build the fixture project under `tmp` and return its root. Where nothing may be written (no `tmp`), a
--- stub-hub case still runs: its hub holds the fixture, and the root is an empty directory outside any project.
local function build_fixture(case, tmp, hub)
  local fixture = case.fixture or {}
  local project = fixture.project or 'qa-project'
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
  local root = tmp .. '/' .. project
  vim.fn.mkdir(root .. '/.cland/tasks', 'p')
  for _, item in ipairs(fixture.items or {}) do
    write_file(root .. '/.cland/tasks/' .. item_file_name(item), item_file(item))
  end
  if fixture.roles then
    write_file(root .. '/.cland/roles.toml', fixture.roles)
  end
  if fixture.config then
    write_file(root .. '/.cland/config.toml', fixture.config)
  end
  return root, project
end

--- nvim/ (this file is nvim/lua/cland/qa.lua).
local function nvim_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h:h')
end

local function start_shell(case, root, project, hub)
  local node = vim.env.CLAND_NODE or 'node'
  local cli
  if hub == 'stub' then
    local scenario = vim.deepcopy(case.scenario or {})
    if not scenario.items and case.fixture and case.fixture.items then
      scenario.items = vim.tbl_map(item_summary, case.fixture.items)
    end
    -- the scenario goes inline: a read-only run has nowhere to write it
    vim.env.CLAND_STUB_SCENARIO_JSON = next(scenario) and vim.json.encode(scenario) or '{}'
    cli = { node, nvim_dir() .. '/test/stub-hub.ts' }
  else
    cli = { node, vim.fn.fnamemodify(nvim_dir(), ':h') .. '/hub/bin/cland.ts' }
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

  local qa = { screen = M.screen, state = M.state }

  --- Type keys as a human does (nvim_input notation: `<CR>`, `<Esc>`, `<Space>`); they are consumed before
  --- this returns. A mapping's keys go in one call: an event between two calls ends a pending mapping.
  function qa.keys(keys)
    api.nvim_input(keys)
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
