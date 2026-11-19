import test from 'node:test';
import assert from 'node:assert/strict';
import {Visibility} from '../src/hub/visibility.ts';

test('a synchronous publication shares item layers and preserves the legacy task frame',()=>{
  let reads=0;
  const rows=[{id:'R-1',kind:'release',state:'open',parent:null},
    {id:'T-2',kind:'task',state:'open',status:'planned',parent:'R-1'}];
  const visibility=new Visibility({items:()=>{reads++;return rows;}});
  const project=visibility.projector();
  const first=project({type:'task',id:'T-2',item:rows[1],layers:{} as Record<string,string>});
  const second=project({type:'task',id:'R-1',item:rows[0],layers:{} as Record<string,string>});
  assert.deepEqual(first,{type:'task',id:'T-2',item:{...rows[1],layer:'watch'},layers:{'R-1':'background','T-2':'watch'}});
  assert.deepEqual(second.layers,first.layers);
  assert.equal(reads,1,'one item inventory read for the synchronous publication');
  rows[1]!.status='in progress';
  const next=visibility.frame({type:'task',id:'T-2',item:rows[1],layers:{} as Record<string,string>});
  assert.equal(next.layers['T-2'],'now','a new publication reads the newer item state');
  assert.equal(reads,2);
});
