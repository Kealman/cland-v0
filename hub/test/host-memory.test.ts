// T2: injected memory admission policy; no processes, sockets or wall-clock waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSpawnMemory, MemoryFloorRefusal } from '../src/host/agent/memory.ts';

test('launch memory policy refuses below floor, admits exact floor and unknown non-Linux memory',async()=>{
  for(const bytes of [1200000000,1299999999]){
    await assert.rejects(requireSpawnMemory('/unused',{},async()=>bytes), error=>error instanceof MemoryFloorRefusal&&error.availableBytes===bytes&&error.floorBytes===1300000000);
  }
  await requireSpawnMemory('/unused',{},async()=>1300000000);
  await requireSpawnMemory('/unused',{},async()=>1400000000);
  await requireSpawnMemory('/unused',{},async()=>null);
});
