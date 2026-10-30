local M = {}
function M.remote(via)
  if via == 'telegram' then return 'via Telegram' end
  if via == 'discord' then return 'via Discord' end
end
function M.label(via)
  return M.remote(via) or via
end
local audio = { ogg = true, oga = true, opus = true, mp3 = true, m4a = true, wav = true, flac = true, aac = true, webm = true }
local function recording(artifact)
  if type(artifact) ~= 'table' then return false end
  local extension = (artifact.path or ''):lower():match('%.([^.]+)$')
  local title = (artifact.title or ''):lower()
  return audio[extension] or title:match('^video%-note%-%d+%.mp4$') or title:match('^audio%-%d+%.bin$')
end
local function has_recording(message)
  if recording(message.artifact) then return true end
  for _, artifact in ipairs(type(message.artifacts) == 'table' and message.artifacts or {}) do
    if recording(artifact) then return true end
  end
  return false
end
local function labelled(artifact, body)
  if type(artifact) ~= 'table' or type(artifact.title) ~= 'string' then return false end
  local heading = '🎤 ' .. artifact.title
  return body:sub(1, #heading + 1) == heading .. '\n'
    or body:sub(1, #heading + #': transcription failed (') == heading .. ': transcription failed ('
end
function M.voice(message)
  local body = message.text or ''
  if message.fromKind ~= 'human' or not M.remote(message.via) or body:sub(1, #'🎤 ') ~= '🎤 ' then return nil, body end
  -- Match filename headings after accepted-file filtering, including legacy artifact fields.
  if labelled(message.artifact, body) then return nil, body end
  for _, artifact in ipairs(type(message.artifacts) == 'table' and message.artifacts or {}) do
    if labelled(artifact, body) then return nil, body end
  end
  if not has_recording(message) then return nil, body end
  if type(message.artifacts) == 'table' and #message.artifacts > 1 then return nil, body end
  local transcript = body:sub(#'🎤 ' + 1)
  if transcript == 'nothing recognised' then return '🎤 nothing recognised', '' end
  if transcript == 'not transcribed' or transcript:sub(1, #'not transcribed: ') == 'not transcribed: ' then
    return '🎤 not transcribed', transcript:sub(#'not transcribed' + 1):gsub('^: ', '')
  end
  return '🎤', transcript
end
return M
