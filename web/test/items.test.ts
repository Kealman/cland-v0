// Web: copied tracker -> real scratch hub -> snapshot/deltas -> rendered explorer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { webFixture, pageUntil } from './harness.ts';
import { cland, connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { seedTree } from './items-fixture.ts';

test('the Items tree reads the copied live tracker snapshot', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await cp(resolve(import.meta.dirname, '../../.cland/tasks'), join(root, '.cland/tasks'), { recursive: true });
    await seedTree(root);
  } });
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.waitFor();
    const release = tree.locator('[data-object-id="R-377"]');
    await release.waitFor();
    assert.match(await release.textContent() ?? '', /v0.2/);
    assert.equal(await release.getAttribute('aria-expanded'), 'true');
    const epic = tree.locator('[data-object-id="E-416"]');
    await epic.waitFor();
    assert.equal(await epic.locator('[role="meter"]').count(), 1);
    assert.match(await epic.textContent() ?? '', /S1/);
    for (const key of [':categories', ':unscheduled', ':releases']) {
      assert.equal(await tree.locator(`[data-tree-key="${key}"]`).getAttribute('aria-expanded'), 'false');
    }
    await epic.click();
    await page.keyboard.press('l');
    await tree.getByText('tree, card and layout', { exact: true }).waitFor();
    await tree.locator('[data-object-id="T-1071"]').waitFor();
    const output = resolve(import.meta.dirname, '../test-results');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, 'items-tree.png') });
  });
  await t.test('CLI status deltas reorder a focused task and change its hub roll-up', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.getByLabel('Release', { exact: true }).selectOption('R-900000');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      const epic = tree.locator('[data-object-id="E-900001"]');
      assert.match(await tree.locator('[data-tree-key=":direct:R-900000"]').textContent() ?? '', /Direct tasks.*\(1\)/);
      const epics = await tree.locator('[data-object-id^="E-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id')));
      assert.deepEqual(epics.slice(-2), ['E-900027', 'E-900026'], 'done epics follow live epics in close order');
      await epic.click();
      await page.keyboard.press('l');
      await tree.getByText('First stage', { exact: true }).waitFor();
      const task = tree.locator('[data-object-id="T-900002"]');
      await task.click();
      assert.match(await task.textContent() ?? '', /review r2/);
      assert.match(await task.textContent() ?? '', /0\/2/);
      assert.match(await task.textContent() ?? '', /rank 5/);
      assert.equal(await task.locator('[title="Ordinal"]').textContent(), '1');
      const before = await tree.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id')));
      // The durable boundary is the changed row plus the ancestor meter, not the CLI reply.
      const changed = task.locator('[title="Closed"]').waitFor();
      const ancestor = epic.locator('[role="meter"][aria-valuenow="2"]').waitFor();
      void changed.catch(() => {}); void ancestor.catch(() => {});
      const result = await cland(fixture.root, 'task', 'edit', 'T-900002', '--status', 'done', '--json');
      assert.equal(result.code, 0, result.stderr);
      await Promise.all([changed, ancestor]);
      assert.equal(await epic.locator('[role="meter"]').getAttribute('aria-valuenow'), '2');
      assert.equal(await task.evaluate(node => document.activeElement === node), true);
      assert.equal(await task.getAttribute('aria-selected'), 'true');
      const after = await tree.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id')));
      assert.ok(before.indexOf('T-900002') < before.indexOf('T-900003'));
      assert.ok(after.indexOf('T-900002') > after.indexOf('T-900003'));
      assert.equal(await tree.locator('[data-object-id="R-900000"] [role="meter"]').getAttribute('data-mode'), 'proportional');
      assert.equal(await epic.locator('[role="meter"]').getAttribute('data-mode'), 'cells');
      assert.deepEqual(await task.locator('[title^="reviewer ·"]').allTextContents(), ['✗ review r2'], 'status delta retains only the latest review and its original round');
      const nextVerdict = task.getByText('✓ review r3', { exact: true }).waitFor();
      void nextVerdict.catch(() => {});
      const posted = await ui.request({ type: 'task.comment', item: 'T-900002', text: 'Third source review',
        verdict: { verdict: 'review', result: 'clear', run: 'web-r3', scope: 'full', findings: [] } });
      assert.equal(posted.ok, true, posted.error);
      await nextVerdict;
      assert.deepEqual(await task.locator('[title*=" · web-r"]').allTextContents(), ['✓ review r3'], 'a subsequent verdict replaces the prior round');
    });
  });
  await t.test('claims and verifier holds arrive in the task and ancestor rows', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.getByLabel('Release', { exact: true }).selectOption('R-900000');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      const epic = tree.locator('[data-object-id="E-900001"]');
      await epic.click();
      await page.keyboard.press('l');
      for (const [name, role, tool] of [['tree-worker', 'implementer', 'task.claim'], ['tree-verifier', 'reviewer', 'task.hold']] as const) {
        const launched = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' });
        assert.equal(launched.ok, true, launched.error);
        const session = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name, role, sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId });
        t.after(() => session.close());
        await session.waitForPresence([name]);
        if (role === 'implementer') assert.equal((await ui.request({ type: 'task.edit', item: 'T-900003', assignee: name })).ok, true);
        const receipt = epic.getByText(role === 'implementer' ? name : `${role} ${name}`, { exact: true }).waitFor();
        void receipt.catch(() => {});
        const held = await session.call<{ ok: boolean; error?: string }>(tool, { id: 'T-900003' });
        assert.equal(held.ok, true, held.error);
        await receipt;
        const task = tree.locator('[data-object-id="T-900003"]');
        assert.match(await task.textContent() ?? '', new RegExp(name));
        assert.match(await epic.textContent() ?? '', new RegExp(name));
      }
    });
  });
  await t.test('category previews, physical keys, D and A persist per client', async t => {
    const sent: string[] = [];
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      const categories = tree.locator('[data-tree-key=":categories"]');
      await categories.focus();
      await page.keyboard.press('l');
      const category = tree.locator('[data-object-id="C-900060"]');
      await category.waitFor();
      assert.match(await category.textContent() ?? '', /4 open.*1 done.*idle work/);
      for (const id of ['T-900061', 'T-900062', 'T-900063', 'T-900065']) await tree.locator(`[data-object-id="${id}"]`).waitFor();
      assert.equal(await tree.locator('[data-object-id="T-900064"]').count(), 0, 'fourth open item stays behind N more');
      const more = tree.locator('[data-tree-key=":more:C-900060"]');
      assert.match(await more.textContent() ?? '', /1 more/);
      await more.focus();
      sent.length = 0;
      await page.keyboard.press('z');
      await page.keyboard.press('a');
      await tree.locator('[data-object-id="T-900064"]').waitFor();
      await page.keyboard.press('j');
      assert.equal(await tree.locator('[data-object-id="T-900064"]').evaluate(node => document.activeElement === node), true);
      await page.keyboard.press('k');
      assert.equal(await more.evaluate(node => document.activeElement === node), true);
      await page.keyboard.press('h');
      assert.equal(await more.getAttribute('aria-expanded'), 'false');
      await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'в', shiftKey: true, bubbles: true, cancelable: true })));
      await tree.locator('[data-object-id="T-900065"]').waitFor({ state: 'detached' });
      await tree.getByText('D hides 1 done', { exact: true }).waitFor();
      assert.deepEqual(sent, [], 'local folds and filters send no hub requests');
      await page.reload();
      await category.waitFor();
      assert.equal(await categories.getAttribute('aria-expanded'), 'true');
      assert.equal(await more.getAttribute('aria-expanded'), 'false');
      assert.equal(await tree.locator('[data-object-id="T-900065"]').count(), 0);
      await tree.getByText('D hides 1 done', { exact: true }).waitFor();
      await page.keyboard.press('Shift+D');
      await tree.locator('[data-object-id="T-900065"]').waitFor();
      const releases = tree.locator('[data-tree-key=":releases"]');
      await releases.focus();
      await page.keyboard.press('l');
      assert.equal(await tree.locator('[data-object-id="R-900090"]').count(), 0);
      await page.keyboard.press('Shift+A');
      await tree.locator('[data-object-id="R-900090"]').waitFor();
      await page.reload();
      await tree.locator('[data-object-id="R-900090"]').waitFor();
      assert.equal(await releases.getAttribute('aria-expanded'), 'true');
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      const help = page.getByRole('dialog', { name: 'Items keys' });
      for (const action of ['tree-next','tree-previous','tree-open','tree-close','tree-toggle','tree-done','tree-archive']) {
        assert.equal(await help.locator(`[data-key-action="${action}"]`).count(), 1);
      }
      assert.equal(await help.locator('[data-key-action="tree-toggle"] kbd').textContent(), 'za');
    }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(String(event.payload)))); });
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      assert.equal(await page.locator('[data-tree-key=":categories"]').getAttribute('aria-expanded'), 'false', 'another client has independent folds');
      assert.equal(await page.getByRole('button', { name: 'D · Done shown', exact: true }).getAttribute('aria-pressed'), 'false');
      assert.equal(await page.getByRole('button', { name: 'A · Archive hidden', exact: true }).getAttribute('aria-pressed'), 'false');
    });
  });
});

test('a delta rebuilds the 300-item browser tree within 15 ms', async t => {
  const { seedItem } = await import('./items-fixture.ts');
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-1', 'release', 'Scale release', { version: '1.0.0' });
    await seedItem(root, 'E-2', 'epic', 'Scale epic', { parent: 'R-1' });
    for (let n = 3; n <= 300; n++) await seedItem(root, `T-${n}`, 'task', `Scale task ${n}`, { parent: 'E-2', status: 'planned' });
  } });
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-2"]').click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-300"]').waitFor();
    const task = tree.locator('[data-object-id="T-3"]');
    const changed = tree.locator('[data-object-id="T-3"][data-status="in progress"]').waitFor();
    const ancestor = pageUntil(page, () => document.querySelector('[data-object-id="E-2"] [title="in progress"]')?.textContent === '◐ 1', 'epic work count after the status delta');
    const releaseAncestor = pageUntil(page, () => document.querySelector('[data-object-id="R-1"] [title="in progress"]')?.textContent === '◐ 1', 'release work count after the status delta');
    void changed.catch(() => {}); void ancestor.catch(() => {}); void releaseAncestor.catch(() => {});
    await page.evaluate(() => {
      performance.clearMeasures('cland.items.rebuild');
      const capture = { entries: [] as Array<{ start: number; duration: number; items: number }>, observer: null as PerformanceObserver | null };
      capture.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.name === 'cland.items.rebuild') capture.entries.push({ start: entry.startTime, duration: entry.duration, items: (entry as PerformanceMeasure).detail.items });
      });
      capture.observer.observe({ type: 'measure' });
      Object.defineProperty(window, '__treeTimingCapture', { value: capture, configurable: true });
    });
    const result = await cland(fixture.root, 'task', 'edit', 'T-3', '--status', 'in progress', '--json');
    assert.equal(result.code, 0, result.stderr);
    await Promise.all([changed, ancestor, releaseAncestor]);
    assert.equal(await task.getAttribute('data-status'), 'in progress');
    assert.match(await tree.locator('[data-object-id="E-2"]').textContent() ?? '', /◐ 1/);
    assert.match(await tree.locator('[data-object-id="R-1"]').textContent() ?? '', /◐ 1/);
    const { measurements, observed } = await page.evaluate(() => {
      const capture = (window as unknown as { __treeTimingCapture: { entries: Array<{ start: number; duration: number; items: number }>; observer: PerformanceObserver } }).__treeTimingCapture;
      const project = (entry: PerformanceEntry) => ({ start: entry.startTime, duration: entry.duration, items: (entry as PerformanceMeasure).detail.items as number });
      capture.entries.push(...capture.observer.takeRecords().filter(entry => entry.name === 'cland.items.rebuild').map(project));
      capture.observer.disconnect();
      Reflect.deleteProperty(window, '__treeTimingCapture');
      return { measurements: performance.getEntriesByName('cland.items.rebuild').map(project), observed: capture.entries };
    });
    assert.ok(measurements.length > 0, 'the completed status/ancestor transition has rebuild receipts');
    assert.deepEqual(measurements, observed, 'no earlier rebuild was erased by a subsequent faster rebuild');
    assert.ok(measurements.every(entry => entry.items === 300), JSON.stringify(measurements));
    assert.ok(measurements.every(entry => entry.duration < 15), JSON.stringify(measurements));
    assert.equal(await tree.locator('[data-object-id]').count(), 300);
    t.diagnostic(`300-item synchronous model rebuilds after CLI delta: ${JSON.stringify(measurements)} ms; excludes setup, transport and React DOM commit`);
  });
});

test('closed epic children arrive through bounded pages and remain current after close and reconnect', async t => {
  const {seedItem}=await import('./items-fixture.ts');
  const fixture=await webFixture(t,{prepare:async root=>{
    await seedItem(root,'R-1','release','Paged release',{version:'1.0.0'});
    await seedItem(root,'E-2','epic','Paged epic',{parent:'R-1'});
    await seedItem(root,'T-3','task','Closing child',{parent:'E-2',status:'planned'});
    for(let n=4;n<=108;n++) await seedItem(root,`T-${n}`,'task',`Archived child ${n}`,{parent:'E-2',state:'closed',status:'done'});
  }});
  const ui=await connectUi(t,fixture.hub.discovery);
  const sent:Array<Record<string,unknown>>=[],received:Array<Record<string,unknown>>=[];
  await fixture.pageCase(t,async page=>{
    await page.keyboard.press('2');
    const tree=page.getByRole('tree',{name:'Items tree'});
    const epic=tree.locator('[data-object-id="E-2"]');
    await epic.click();await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-108"]').waitFor();
    assert.equal(await tree.locator('[data-object-id^="T-"]').count(),106);
    assert.ok(sent.filter(f=>f.type==='task.list'&&f.parent==='E-2').length>=2);
    const snapshot=received.find(f=>f.type==='snapshot'&&f.domain==='items')!;
    assert.equal((snapshot.value as {items:Array<{state:string;kind:string}>}).items.filter(i=>i.kind==='task'&&i.state==='closed').length,0);
    const closed=tree.locator('[data-object-id="T-3"][data-status="done"]').waitFor();void closed.catch(()=>{});
    assert.equal((await ui.request({type:'task.edit',item:'T-3',state:'closed'})).ok,true);await closed;
    assert.equal(await tree.locator('[data-object-id^="T-"]').count(),106);
    await page.reload();await tree.locator('[data-object-id="T-108"]').waitFor();
    assert.equal(await tree.locator('[data-object-id^="T-"]').count(),106);
  },page=>{ page.on('websocket',socket=>{
    socket.on('framesent',event=>sent.push(JSON.parse(String(event.payload))));
    socket.on('framereceived',event=>received.push(JSON.parse(String(event.payload))));
  }); });
});

test('hidden done rows retain hub stage and total counts without loading closed pages', async t=>{
  const {seedItem}=await import('./items-fixture.ts');
  const {withPlan}=await import('../../hub/src/tracker/plan.ts');
  const {TrackerIndex}=await import('../../hub/src/tracker/index-db.ts');
  const fixture=await webFixture(t,{prepare:async root=>{
    await seedItem(root,'R-1','release','Count release',{version:'1.0.0'});
    await seedItem(root,'E-2','epic','Count epic',{parent:'R-1'},withPlan('## Summary\n\nComplete counts.',{
      stages:[{name:'Partially merged',qa:{scope:'none',when:'per-item'},lanes:[['T-3','T-4','T-5']]}],
    }));
    await seedItem(root,'E-6','epic','Closed count epic',{parent:'R-1',state:'closed'});
    for(const n of [3,4,5]) await seedItem(root,`T-${n}`,'task',`Count child ${n}`,{parent:'E-2',state:n<5?'closed':'open',status:n<5?'done':'planned'});
    const index=new TrackerIndex(join(root,'.cland/hub.db'));
    index.recordMerge('T-3',{branch:'t/landed',tip:'a'.repeat(40),commit:'a'.repeat(40),base:'dev'});index.close();
  }});
  const ui=await connectUi(t,fixture.hub.discovery);
  const sent:Array<Record<string,unknown>>=[];
  await fixture.pageCase(t,async page=>{
    await page.keyboard.press('2');
    await page.getByRole('button',{name:'D · Done shown',exact:true}).click();
    const tree=page.getByRole('tree',{name:'Items tree'});
    await tree.locator('[data-object-id="E-2"]').click();await page.keyboard.press('l');
    const stage=tree.getByText('Partially merged',{exact:true}).locator('..');
    await stage.waitFor();
    assert.match(await stage.textContent()??'',/1\/3 merged/);
    assert.match(await stage.textContent()??'',/in work/);
    assert.equal(await tree.locator('[data-object-id="T-3"]').count(),0);
    assert.equal(await tree.locator('[data-object-id="T-4"]').count(),0);
    assert.equal(sent.filter(f=>f.type==='task.list'&&f.parent==='E-2').length,0,'D-hidden counts do not fetch closed child pages');
    await page.getByText('3 done hidden',{exact:true}).waitFor();
    const changed=page.getByText('2 done hidden',{exact:true}).waitFor();void changed.catch(()=>{});
    assert.equal((await ui.request({type:'task.edit',item:'T-4',state:'open',status:'planned'})).ok,true);await changed;
    assert.match(await stage.textContent()??'',/1\/3 merged/);
    assert.match(await stage.textContent()??'',/in work/);
    assert.equal(sent.filter(f=>f.type==='task.list'&&f.parent==='E-2').length,0);
  },page=>{page.on('websocket',socket=>socket.on('framesent',event=>sent.push(JSON.parse(String(event.payload)))));});
});

test('closed container pages restore nested archives once and preserve unloaded release progress',async t=>{
  const {seedItem}=await import('./items-fixture.ts');
  const fixture=await webFixture(t,{prepare:async root=>{
    await seedItem(root,'R-1','release','Container release',{version:'1.0.0'});
    await seedItem(root,'E-2','epic','Open container',{parent:'R-1'});
    for(let n=10;n<115;n++) await seedItem(root,`E-${n}`,'epic',`Closed container ${n}`,{parent:'R-1',state:'closed'});
    await seedItem(root,'T-200','task','Nested archived task',{parent:'E-114',state:'closed',status:'done'});
    await seedItem(root,'R-300','release','Closed root',{version:'0.1.0',state:'closed'});
    await seedItem(root,'E-301','epic','Archived root epic',{parent:'R-300',state:'closed'});
    await seedItem(root,'T-302','task','Archived root task',{parent:'E-301',state:'closed',status:'done'});
  }});
  const sent:Array<Record<string,unknown>>=[],received:Array<Record<string,unknown>>=[];
  await fixture.pageCase(t,async page=>{
    await page.keyboard.press('2');
    const tree=page.getByRole('tree',{name:'Items tree'});
    const release=tree.locator('[data-object-id="R-1"]');
    await release.waitFor();
    assert.match(await release.textContent()??'',/105\/106/);
    assert.equal(await tree.locator('[data-object-id="E-114"]').count(),0);
    const snapshot=received.find(f=>f.type==='snapshot'&&f.domain==='items')!;
    assert.deepEqual((snapshot.value as {items:Array<{id:string}>}).items.map(i=>i.id).sort(),['E-2','R-1']);
    assert.equal(sent.filter(f=>f.type==='task.list'&&f.parent==='R-1').length,0);
    const last=tree.locator('[data-object-id="E-114"]');
    const lastVisible=last.waitFor();void lastVisible.catch(()=>{});
    await page.getByRole('button',{name:'D · Done hidden',exact:true}).click();
    await lastVisible;
    assert.ok(sent.filter(f=>f.type==='task.list'&&f.parent==='R-1').length>=2);
    assert.equal(await tree.locator('[data-object-id^="E-"]').count(),106);
    assert.match(await release.textContent()??'',/105\/106/);
    const childVisible=tree.locator('[data-object-id="T-200"]').waitFor();void childVisible.catch(()=>{});
    await last.click();await page.keyboard.press('l');
    await childVisible;
    assert.match(await last.textContent()??'',/1\/1/);
    await tree.locator('[data-tree-key=":releases"]').focus();await page.keyboard.press('l');
    const root=tree.locator('[data-object-id="R-300"]');
    const rootVisible=root.waitFor();void rootVisible.catch(()=>{});
    await page.getByRole('button',{name:'A · Archive hidden',exact:true}).click();
    await rootVisible;
    const epic=tree.locator('[data-object-id="E-301"]');
    const epicVisible=epic.waitFor();void epicVisible.catch(()=>{});
    await root.click();await page.keyboard.press('l');
    await epicVisible;
    const archivedChild=tree.locator('[data-object-id="T-302"]').waitFor();void archivedChild.catch(()=>{});
    await epic.click();await page.keyboard.press('l');
    await archivedChild;
    const ids=await tree.locator('[data-object-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-object-id')));
    assert.equal(ids.length,new Set(ids).size,'one rendered row per identity across snapshot and nested pages');
    await page.reload();await tree.locator('[data-object-id="T-302"]').waitFor();
    assert.equal(await tree.locator('[data-object-id="T-302"]').count(),1);
  },async page=>{
    await page.addInitScript(()=>{if(!localStorage.getItem('cland.ui.items.v1')) localStorage.setItem('cland.ui.items.v1',JSON.stringify({tree:{hideDone:true,open:{}}}));});
    page.on('websocket',socket=>{
      socket.on('framesent',event=>sent.push(JSON.parse(String(event.payload))));
      socket.on('framereceived',event=>received.push(JSON.parse(String(event.payload))));
    });
  });
});
