-- More than 4 KiB of keys with no <Esc> or <CR> to cut at: refused before anything is typed.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the hub connected')
    qa.keys('<Esc>')
    qa.keys(('h'):rep(4095) .. 'gi')
  end,
}
