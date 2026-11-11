// Static-Pages offline account surface: no Node `/api`, passwordless guest.
// Verifies the account dialog does not expose online-only password/recovery/
// session controls, that the offline note is visible, and that sign-out leads
// to a passwordless local sign-in screen which returns to the same operator and
// stash. Zero `/api` traffic and zero browser errors are required.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};

async function staticServer() {
  const server = createServer(async (req, res) => {
    try {
      if (new URL(req.url, 'http://127.0.0.1').pathname.startsWith('/api/')) {
        res.writeHead(404, {'content-type': 'application/json'});
        res.end(JSON.stringify({error: 'Static Pages has no raid API'}));
        return;
      }
      const requested = req.url.split('?')[0] === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
      const file = resolve(ROOT, '.' + requested);
      if (file !== ROOT && !file.startsWith(ROOT + '/')) throw new Error('path escape');
      const content = await readFile(file);
      res.writeHead(200, {'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache'});
      res.end(content);
    } catch {
      res.writeHead(404, {'content-type': 'text/plain'});
      res.end('Not found');
    }
  });
  await new Promise((ready, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ready);
  });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1');
  await page.wait('document.body.dataset.raidTransport===\'offline\'');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  const start = await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(),p=rt.store.profile(rt.account);
    return {usernameFromApi:rt.session.username,items:p.items.length};
  })()`);

  // The account dialog exists offline but must not offer password, recovery-code
  // or server session controls that can only fail with 501.
  assert.equal(await page.evaluate("document.getElementById('accountOpen').hidden"), false, 'the offline base exposes the Account control');
  await page.evaluate("document.getElementById('accountOpen').click()");
  await page.wait("document.getElementById('accountDialog').open");
  const dialog = await page.evaluate(`(()=>{const d=document.getElementById('accountDialog');return {
    noteVisible:!document.getElementById('offlineAccountNote').hidden,
    note:document.getElementById('offlineAccountNote').textContent,
    securityHidden:document.getElementById('onlineAccountSecurity').hidden,
    signOutVisible:getComputedStyle(document.getElementById('accountSignOut')).display!=='none',
    passwordFormHidden:document.getElementById('passwordForm').closest('#onlineAccountSecurity').hidden,
    codesFormHidden:document.getElementById('codesForm').closest('#onlineAccountSecurity').hidden,
    identity:document.getElementById('securityIdentity').textContent,
  }})()`);
  assert.equal(dialog.noteVisible, true, 'the offline account note is visible');
  assert.match(dialog.note, /stored on this device/i, 'the note explains local storage');
  assert.match(dialog.note, /no password, recovery codes or server/i, 'the note states offline account security is unavailable');
  assert.equal(dialog.securityHidden, true, 'online-only account security controls are hidden offline');
  assert.equal(dialog.passwordFormHidden, true, 'password changes are unavailable offline');
  assert.equal(dialog.codesFormHidden, true, 'recovery codes are unavailable offline');
  assert.equal(dialog.signOutVisible, true, 'local sign-out remains available');
  assert.match(dialog.identity, /offline/i, 'the identity line labels the offline session');

  // Signing out must show a passwordless local sign-in screen, not the online
  // password/recovery form.
  await page.evaluate("document.getElementById('accountSignOut').click()");
  await page.wait("document.getElementById('auth').hidden===false");
  const auth = await page.evaluate(`(()=>{const pw=document.querySelector('#login [name=password]');return {
    noteVisible:!document.getElementById('offlineAuthNote').hidden,
    note:document.getElementById('offlineAuthNote').textContent,
    passwordHidden:!!pw.closest('label').hidden,
    passwordRequired:pw.required,
    registerHidden:document.getElementById('register').hidden,
    recoverHidden:document.getElementById('recoverOpen').hidden,
    submit:document.querySelector('#login button[type=submit]').textContent,
  }})()`);
  assert.equal(auth.noteVisible, true, 'the offline sign-in note is visible');
  assert.match(auth.note, /no password is needed/i, 'the sign-in note explains the passwordless session');
  assert.equal(auth.passwordHidden, true, 'the password field is hidden offline');
  assert.equal(auth.passwordRequired, false, 'the hidden password field cannot block form submission');
  assert.equal(auth.registerHidden, true, 'registration is the same local operation and stays hidden');
  assert.equal(auth.recoverHidden, true, 'recovery codes are unavailable offline');
  assert.match(auth.submit, /offline/i, 'the submit button reads Continue offline');

  // Sign back in with only a name. The guest account and its stash must be the
  // same local operator, and the base must return.
  await page.evaluate(`document.querySelector('#login [name=username]').value=${JSON.stringify(start.usernameFromApi)}`);
  await page.evaluate("document.querySelector('#login button[type=submit]').click()");
  await page.wait("!document.getElementById('base').hidden && document.getElementById('auth').hidden");
  const back = await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime(),p=rt.store.profile(rt.account);return {
    authHidden:document.getElementById('auth').hidden,baseVisible:!document.getElementById('base').hidden,
    accountOpenVisible:!document.getElementById('accountOpen').hidden,
    username:p.username,items:p.items.length,activeDeployment:p.activeDeployment,
  }})()`);
  assert.equal(back.authHidden, true, 'signing in hides the offline auth screen');
  assert.equal(back.baseVisible, true, 'signing in returns to the base');
  assert.equal(back.accountOpenVisible, true, 'the account control returns after sign-in');
  assert.equal(back.username, start.usernameFromApi, 'the same local guest operator is reused');
  assert.equal(back.items, start.items, 'the stash survives an offline sign-out/sign-in');

  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'the offline account surface must not call the Node API',
  );
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    offlineAccountNote: true,
    onlineSecurityHidden: true,
    passwordlessSignIn: true,
    reusedOperator: back.username,
    stashItems: back.items,
    noApiTraffic: true,
    browserErrors: [],
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
