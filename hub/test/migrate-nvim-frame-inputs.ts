// One-time deterministic recording metadata migration; no producer or native calls.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FRAME_FIXTURES, FRAME_SLICES, frameRecordingInput, parseRecordings, recordingKey, serializeRecordings, type Recording } from '../../nvim/test/frame-fixtures.ts';

const fixtureRoot=new URL('../../nvim/test/fixtures/',import.meta.url);
const source=process.argv[2] ? pathToFileURL(resolve(process.argv[2])+'/') : fixtureRoot;
for (const path of [FRAME_FIXTURES,...(await readdir(FRAME_SLICES)).sort().map(file=>new URL(file,FRAME_SLICES))]) {
  const before=parseRecordings(await readFile(new URL(relative(fileURLToPath(fixtureRoot),fileURLToPath(path)),source),'utf8'));
  const after: Record<string,Recording>={};
  for(const record of Object.values(before)) {
    const input=frameRecordingInput(record.input);
    if(record.operation==='frame') assert.equal(JSON.stringify((input as Record<string,unknown>).frame),JSON.stringify((record.input as Record<string,unknown>).frame),'captured frame bytes are unchanged');
    const key=recordingKey(record.operation,input);
    if(after[key]) assert.deepEqual(after[key]!.output,record.output,'normalization must not collapse different wire frames');
    after[key]={...record,input};
  }
  const outputs=(records:Record<string,Recording>)=>[...new Set(Object.values(records).map(r=>JSON.stringify(r.output)))].sort();
  assert.deepEqual(outputs(after),outputs(before),'every distinct output byte string is preserved');
  await writeFile(path,serializeRecordings(after));
  console.log(`${path.pathname.split('/').at(-1)}: records ${Object.keys(before).length} -> ${Object.keys(after).length}; duplicates collapsed ${Object.keys(before).length-Object.keys(after).length}; output bytes unchanged`);
}
