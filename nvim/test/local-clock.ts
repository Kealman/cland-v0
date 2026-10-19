// A complete client-local clock: timestamps and the production redraw timer move together.
import type { Client } from './stub-client.ts';

export async function localClock(client: Client, module: string, at: number) {
  await client.lua(`
    local module,at=...
    local clock={time=at}
    _G.local_clock=clock
    require(module).start_clock({
      now=function() return clock.time end,
      new_timer=function() return {
        start=function(_,first,interval,callback)
          assert(first==1000 and interval==1000, 'the local clock ticks once per second')
          clock.due,clock.interval,clock.tick=clock.time+first,interval,callback
        end,
        stop=function() clock.tick=nil end, close=function() end,
      } end,
    })
  `, module, at);
  return { advance: (ms: number) => client.lua(`
    local clock=_G.local_clock
    local target=clock.time+...
    while clock.tick and clock.due<=target do
      clock.time=clock.due
      clock.due=clock.due+clock.interval
      clock.tick()
    end
    clock.time=target
  `, ms) };
}
