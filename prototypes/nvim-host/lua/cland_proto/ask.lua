-- PROTOTYPE (ticket #15, workbench): answering asks (#7). An ask is a
-- message kind with options and a free answer; the answer is a message
-- carrying answer_to, sent to the asker, and it clears the topic's
-- "waiting for human". Answerable from the thread card, the inbox (1-9, i)
-- and the full-width inbox.
local state = require('cland_proto.state')
local M = {}

local function finish(a, answer_text, choice)
  a.state, a.answer, a.choice, a.answered_at = 'answered', answer_text, choice, state.now_min()
  local chat = require('cland_proto.chat')
  local item = a.item and (' on ' .. a.item) or ''
  local reply = choice and {
    ('Going with %d: %s. I will tell %s and update%s.'):format(choice, a.options[choice], a.raised_by or 'the team', item),
  } or { 'Thanks, I will take your answer from here and report back in this topic.' }
  if choice and a.options[choice] == 'ask me later' then
    reply = { 'Understood, I park the question and ask again when the real spoke is in.' }
  end
  chat.send(a.topic, answer_text, { to = a.from, answer_to = a.id, reply = reply })
end

function M.answer(id, i)
  local a = state.ask(id)
  if not a or a.state ~= 'open' or not a.options[i] then
    return
  end
  finish(a, ('%d. %s'):format(i, a.options[i]), i)
  state.say(('answered ask #%d with %d: %s'):format(a.id, i, a.options[i]), 'ClandGreen')
end

function M.answer_free(id, text)
  local a = state.ask(id)
  if not a or a.state ~= 'open' then
    return
  end
  finish(a, text, nil)
end

-- Free answer: the ask's topic opens in the centre and its composer sends
-- the next message as the answer.
function M.start_free(id)
  local a = state.ask(id)
  if not a or a.state ~= 'open' then
    return
  end
  require('cland_proto.chat').answering[a.topic] = a.id
  state.changed('free answer to ask #' .. a.id .. ' started')
  require('cland_proto.layout').focus_composer(a.topic, nil, true)
end

return M
