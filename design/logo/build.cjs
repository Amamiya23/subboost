// Rebuild the approved SubBoost mark and its website assets: node design/logo/build.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const out = __dirname;
const web = path.join(root, 'local/public/brand');
const colors = { ink: '#202020', paper: '#fcfcfc', canvas: '#f9f9f9', line: '#e0e0e0', muted: '#646464' };
const geometry = 'M28 32H84L160 108H228V148H160L84 224H28L124 128Z';
const svg = (body, title = 'SubBoost — 汇流', width = 256, height = width) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${title}</title>${body}</svg>\n`;
const mark = (fill = colors.ink) => `<path fill="${fill}" d="${geometry}"/>`;
const symbol = svg(mark());
const reversed = svg(mark(colors.paper));
const tile = (scale, rounded = false) => svg(
  `<rect width="256" height="256"${rounded ? ' rx="52"' : ''} fill="${colors.ink}"/>` +
  `<g transform="translate(128 128) scale(${scale}) translate(-128 -128)">${mark(colors.paper)}</g>`);
const favicon = tile(0.8, true);
// Pixel-aligned cut at 16 px: 45 degree branches and a two-pixel output bar.
const faviconSmall = svg(`<rect width="16" height="16" rx="4" fill="${colors.ink}"/><path fill="${colors.paper}" d="M3 3H6L10 7H13V9H10L6 13H3L8 8Z"/>`, 'SubBoost', 16);

async function write(name, data) { await fs.writeFile(path.join(out, name), data); }
async function png(source, width, target) {
  const data = await sharp(Buffer.from(source)).resize(width, width).png().toBuffer();
  if (target) await fs.writeFile(target, data);
  return data;
}
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    head[entry] = head[entry + 1] = size === 256 ? 0 : size;
    head.writeUInt16LE(1, entry + 4);
    head.writeUInt16LE(32, entry + 6);
    head.writeUInt32LE(data.length, entry + 8);
    head.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map(image => image.data)]);
}

function presentation() {
  const p = [];
  const text = (x, y, content, size = 18, fill = colors.ink, weight = 400) =>
    p.push(`<text x="${x}" y="${y}" font-family="Segoe UI,Microsoft YaHei,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`);
  const rect = (x, y, w, h, fill = colors.paper, radius = 16, stroke = colors.line) =>
    p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`);
  const glyph = (x, y, size, fill = colors.ink) =>
    p.push(`<g transform="translate(${x} ${y}) scale(${size / 256})">${mark(fill)}</g>`);
  const icon = (x, y, size) => {
    rect(x, y, size, size, colors.ink, size * .2, 'none');
    glyph(x + size * .1, y + size * .1, size * .8, colors.paper);
  };
  rect(0, 0, 1440, 1060, colors.canvas, 0, 'none');
  text(48, 64, 'SubBoost / 汇流', 32, colors.ink, 600);
  text(48, 100, '两路输入，一个清晰出口。', 18, colors.muted);
  rect(48, 136, 658, 300);
  rect(734, 136, 658, 300, colors.ink, 16, colors.ink);
  glyph(256, 170, 232);
  glyph(947, 170, 232, colors.paper);
  text(76, 413, '单色图形', 14, colors.muted);
  text(762, 413, '反白图形', 14, '#bbbbbb');

  const xs = [48, 504, 960], ys = [464, 752];
  for (const y of ys) for (const x of xs) rect(x, y, 432, 260);
  text(72, 501, '01 / 网站页头', 14, colors.muted);
  glyph(76, 555, 28); text(115, 576, 'SubBoost', 18, colors.ink, 600);
  text(76, 638, '我的订阅', 15); text(187, 638, '配置生成器', 15, colors.muted); text(326, 638, '模板库', 15, colors.muted);
  p.push(`<path d="M76 657H452" stroke="${colors.line}"/>`);

  text(528, 501, '02 / 登录入口', 14, colors.muted);
  glyph(606, 542, 44); text(664, 575, 'SubBoost', 25, colors.ink, 600);
  rect(548, 602, 344, 38, colors.canvas, 7); text(562, 627, '用户名', 14, colors.muted);
  rect(548, 650, 344, 38, colors.ink, 7, 'none'); text(705, 675, '登录', 14, colors.paper);

  text(984, 501, '03 / 浏览器标签', 14, colors.muted);
  rect(984, 552, 384, 52, colors.canvas, 8);
  icon(1000, 570, 16); text(1028, 583, 'SubBoost — 我的订阅', 14);
  text(1338, 583, '×', 17, colors.muted);
  rect(984, 617, 384, 38, colors.canvas, 7); text(1000, 641, 'subboost.local', 14, colors.muted);

  text(72, 789, '04 / 应用图标', 14, colors.muted);
  for (let i = 0; i < 3; i++) rect(82 + i * 112, 833, 76, 76, colors.line, 17, 'none');
  icon(194, 833, 76); text(194, 939, 'SubBoost', 15);

  text(528, 789, '05 / 头像裁切', 14, colors.muted);
  p.push(`<circle cx="720" cy="883" r="72" fill="${colors.ink}"/>`);
  // Same 70% safe-area drawing used by the maskable application asset.
  glyph(669.6, 832.6, 100.8, colors.paper);

  text(984, 789, '06 / 小尺寸', 14, colors.muted);
  for (const [x, size] of [[994, 64], [1103, 32], [1190, 24], [1271, 16]]) {
    glyph(x, 842, size); text(x, 943, `${size} px`, 13, colors.muted);
  }
  text(48, 1040, 'Radix Gray 12 · #202020     /     Radix Gray 1 · #fcfcfc', 14, colors.muted);
  return svg(p.join(''), 'SubBoost 汇流 — 网站使用预览', 1440, 1060);
}

async function main() {
  await fs.mkdir(web, { recursive: true });
  await fs.mkdir(path.join(out, 'png'), { recursive: true });
  await write('subboost-symbol.svg', symbol);
  await write('subboost-symbol-reversed.svg', reversed);
  await write('subboost-symbol-currentcolor.svg', svg(mark('currentColor')));
  await write('subboost-app-icon.svg', tile(.78));
  await write('subboost-maskable.svg', tile(.70));
  await write('subboost-favicon.svg', favicon);
  await write('subboost-favicon-16.svg', faviconSmall);
  await fs.writeFile(path.join(web, 'logo.svg'), symbol);
  await fs.writeFile(path.join(web, 'logo-reversed.svg'), reversed);
  await fs.writeFile(path.join(web, 'favicon.svg'), favicon);
  for (const size of [16, 24, 32, 48, 64, 128, 192, 256, 512, 1024]) {
    await png(symbol, size, path.join(out, 'png', `subboost-symbol-${size}.png`));
  }
  const app = await png(tile(.78), 512, path.join(web, 'icon-512.png'));
  await fs.writeFile(path.join(root, 'local/public/icon.png'), app);
  await fs.writeFile(path.join(root, 'packages/ui/assets/subboost-icon.png'), app);
  await png(tile(.78, true), 256, path.join(root, 'local/public/logo.png'));
  await png(tile(.78), 192, path.join(web, 'icon-192.png'));
  await png(tile(.70), 512, path.join(web, 'icon-maskable-512.png'));
  await png(tile(.78), 180, path.join(web, 'apple-touch-icon.png'));
  const sizes = [16, 32, 48, 256], entries = [];
  for (const size of sizes) entries.push({ size, data: await png(size === 16 ? faviconSmall : favicon, size) });
  const faviconIco = ico(entries);
  await fs.writeFile(path.join(web, 'favicon.ico'), faviconIco);
  await write('favicon.ico', faviconIco);
  const board = presentation();
  await write('preview.svg', board);
  await sharp(Buffer.from(board)).png().toFile(path.join(out, 'preview.png'));
  await fs.cp(web, path.join(out, 'web'), { recursive: true });
  console.log('Built SVG masters, PNG sizes, 4-resolution favicon, website assets and preview.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
