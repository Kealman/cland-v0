-- Focus keys are single chords in every mode. Layouts affect Normal-mode letters only;
-- the pinned TUI does not use kitty's base-layout alternate for Ctrl chords.
local M = {}

-- One langmap option string per layout, including uppercase and punctuation. Commas and
-- semicolons in the target alphabet need escaping for the option's list/pair syntax.
local layouts = {
  ru = [[йцукенгшщзхъфывапролджэячсмитьбюёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ;qwertyuiop[]asdfghjkl\;'zxcvbnm\,.`QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>~]],
}

function M.layouts(names)
  local options, unknown = {}, {}
  for _, name in ipairs(names) do
    if layouts[name] then options[#options + 1] = layouts[name]
    else unknown[#unknown + 1] = name end
  end
  vim.o.langmap = table.concat(options, ',')
  -- Mapped RHS keys are already English; only what the human types is translated.
  vim.o.langremap = false
  if #unknown > 0 then
    require('cland.state').say('unknown keys.layouts: ' .. table.concat(unknown, ', ') .. ' (supported: ru)', 'ClandAmberBar')
  end
end

function M.focus(direction)
  vim.cmd.wincmd(direction)
  local kind = vim.bo.buftype
  if kind == 'terminal' or kind == 'prompt' then vim.cmd.startinsert() end
end

function M.setup()
  for _, direction in ipairs({ 'h', 'j', 'k', 'l' }) do
    local lhs = '<C-' .. direction .. '>'
    local command = "<Cmd>lua require('cland.keys').focus('" .. direction .. "')<CR>"
    local opts = { silent = true, nowait = true, desc = 'cland: focus ' .. direction }
    vim.keymap.set('n', lhs, command, opts)
    vim.keymap.set({ 'i', 's', 't', 'x', 'o' }, lhs, '<C-\\><C-n>' .. command, opts)
    vim.keymap.set('c', lhs, '<C-c>' .. command, opts)
  end
  vim.keymap.set('t', '<C-\\>', '<C-\\><C-n>', { silent = true, nowait = true, desc = 'cland: leave Terminal mode' })
end

return M
