-- Asks (spec 4.5, Main.dc.html, #33): the card an ask shows in its thread, and answering it. The same actions
-- serve the card and the inbox: `1`–`9` answer with that option (`topic.answer`), `i` opens the topic's composer
-- for a free answer, which the next Enter sends as the answer. The hub records the answer as the human's message
-- with `answer_to`; the thread shows it under the card.
local api = vim.api
local state = require('cland.state')

local M = {}

--- The words and colour of an ask's state, for the card's header.
M.STATE = {
  open = { '▲ waiting for you', 'ClandAmber' },
  answered = { '✓ answered', 'ClandGreen' },
  withdrawn = { 'withdrawn', 'ClandDim' },
  cancelled = { 'cancelled', 'ClandDim' },
}

--- The card's lines under its message header: {text, group, option} entries. `option` is the option a line
--- shows (1-based). The question itself is the message's text; the card shows it first.
function M.lines(card, question)
  local out = {}
  local open = card.state == 'open'
  local bar = open and 'ClandAmber' or 'ClandDim'
  out[#out + 1] = { ' ┃ ' .. (question or card.question or ''), open and 'ClandBold' or nil, nil, bar }
  for i, o in ipairs(card.options or {}) do
    local chosen = card.state == 'answered' and card.option == i
    local text = ' ┃ ' .. (chosen and '✓ ' or '') .. i .. '  ' .. o
    local group = chosen and 'ClandGreen' or (open and nil or 'ClandDim')
    out[#out + 1] = { text, group, i, bar }
  end
  if open then
    out[#out + 1] = { ' ┃ ' .. (card.free ~= false and '1-9 answers · free answer: i' or '1-9 answers'), 'ClandFaint', nil, bar }
  elseif card.state == 'answered' then
    out[#out + 1] = { ' ┃ ' .. (card.option and ('answered with ' .. card.option) or 'answered in your words'), 'ClandDim', nil, bar }
  else
    out[#out + 1] = { ' ┃ ' .. card.state .. (card.state == 'withdrawn' and ': the topic was resolved' or ': the topic or its item closed'), 'ClandDim', nil, bar }
  end
  return out
end

local function client()
  return require('cland.views').client
end

--- Answer ask `ask` (an inbox row or a card: {id, topic, options}) with option `n`.
function M.answer(ask, n, done)
  local c = client()
  if not (c and c:connected()) then
    return state.say('topic.answer: the hub is not connected', 'ClandRedBar')
  end
  if ask.options and #ask.options > 0 and not ask.options[n] then
    return state.say(('option %d is not one of 1-%d'):format(n, #ask.options), 'ClandAmberBar')
  end
  c:request({ type = 'topic.answer', ask = ask.id, option = n }, function(err)
    if err then
      return state.say('not answered: ' .. tostring(err), 'ClandRedBar')
    end
    state.answered(ask.id)
    state.say(('answered with %d%s'):format(n, ask.options and ask.options[n] and (': ' .. ask.options[n]) or ''))
    if done then
      done()
    end
  end)
end

--- A free answer to `ask` ({id, topic, question}): the topic's thread in the centre, its composer in Insert mode,
--- and the next Enter sends the text as the answer.
function M.free(ask)
  if ask.free == false then
    return state.say('this ask takes one of its options: 1-' .. #(ask.options or {}), 'ClandAmberBar')
  end
  local tv = require('cland.views').topic(ask.topic)
  tv.composer:answer_to(ask.id, ask.question)
  require('cland.layout').show({ kind = 'thread', id = ask.topic }, { insert = true })
end

--- `1`–`9` and `i` on `buf`: `ask_at(row)` names the open ask on that row ({id, topic, question, options, free}),
--- or nil. Off an ask, `1`–`9` stay counts and `i` calls `otherwise` (when given) or says what it is for.
function M.keys(buf, ask_at, otherwise)
  for n = 1, 9 do
    vim.keymap.set('n', tostring(n), function()
      local a = ask_at(api.nvim_win_get_cursor(0)[1])
      if a then
        vim.schedule(function()
          M.answer(a, n)
        end)
        return ''
      end
      return tostring(n)
    end, { buffer = buf, expr = true, nowait = true, silent = true, desc = 'cland: answer the ask with option ' .. n })
  end
  vim.keymap.set('n', 'i', function()
    local a = ask_at(api.nvim_win_get_cursor(0)[1])
    if a then
      return M.free(a)
    end
    if otherwise then
      return otherwise()
    end
    state.say('i types a free answer: put the cursor on an ask')
  end, { buffer = buf, nowait = true, silent = true, desc = 'cland: a free answer to the ask' })
end

return M
