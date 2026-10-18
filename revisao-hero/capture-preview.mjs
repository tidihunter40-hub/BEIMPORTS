import { writeFile } from 'node:fs/promises';

const [port, desktopPath, mobilePath] = process.argv.slice(2);
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const page = targets.find((item) => item.type === 'page');
if (!page) throw new Error('No Chrome page target');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message));
  else task.resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');

async function capture(width, height, path) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 760 });
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/' });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && ['.brand img','.hero-image'].every((s) => { const img = document.querySelector(s); return img && img.complete && img.naturalWidth > 0; })",
      returnByValue: true,
    });
    ready = result.result?.value === true;
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) {
    const debug = await send('Runtime.evaluate', {
      expression: "JSON.stringify({url:location.href,state:document.readyState,images:[...document.images].slice(0,3).map(i=>({src:i.src,complete:i.complete,width:i.naturalWidth})),body:document.body?.textContent?.slice(0,120)})",
      returnByValue: true,
    });
    throw new Error(`Page images did not load for ${width}px viewport: ${debug.result?.value}`);
  }
  await send('Runtime.evaluate', { expression: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))', awaitPromise: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path, Buffer.from(screenshot.data, 'base64'));
  process.stdout.write(`${width}x${height}: ${path}\n`);
}

await capture(1672, 941, desktopPath);
await capture(390, 844, mobilePath);
socket.close();
