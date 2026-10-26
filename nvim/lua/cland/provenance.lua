local M = {}
function M.remote(via)
  if via == 'telegram' then return 'via Telegram' end
  if via == 'discord' then return 'via Discord' end
end
function M.label(via)
  return M.remote(via) or via
end
return M
