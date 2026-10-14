/** Server-side item artwork used by the Discord /item embed. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_DIR = path.join(ROOT, 'assets', 'item-sprites');
const FRAME_DIR = path.join(ROOT, 'assets', 'tooltips', 'frames');
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique', 'Skill']);
const CLASS_FRAMES = new Set(['Adventurer', 'Berserker', 'Engineer', 'Mage', 'Pyromancer', 'Ranger', 'Reaper']);
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const fonts = [
    ['milonga-tooltip.ttf', 'Milonga'],
    ['libre-baskerville-tooltip.ttf', 'Libre Tooltip'],
    ['libre-baskerville-tooltip-bold.ttf', 'Libre Tooltip Bold'],
  ];
  for (const [file, family] of fonts) {
    const full = path.join(FONT_DIR, file);
    if (fs.existsSync(full)) GlobalFonts.registerFromPath(full, family);
  }
  fontsRegistered = true;
}

function text(value, fallback = '—') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function number(value, fallback = '—') {
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? fallback
    : String(value);
}

function spritePath(item) {
  const candidates = [item?.image, item?.id, item?.gid]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => path.basename(value).replace(/\.(png|webp|jpg|jpeg)$/i, ''))
    .flatMap((name) => [`${name}.png`, `${name}.webp`]);
  for (const candidate of candidates) {
    const full = path.join(SPRITE_DIR, candidate);
    if (full.startsWith(SPRITE_DIR) && fs.existsSync(full)) return full;
  }
  return null;
}

function framePath(item) {
  const classes = Array.isArray(item?.className ?? item?.class)
    ? (item.className ?? item.class)
    : [item?.className ?? item?.class];
  const className = classes.map((value) => String(value || '')).find((value) => CLASS_FRAMES.has(value));
  const rarity = text(item?.rarity, 'Common');
  const key = item?.type === 'Skill'
    ? 'Skill'
    : rarity === 'Unique' && className
      ? className
      : RARITIES.has(rarity) ? rarity : 'Common';
  const preferred = path.join(FRAME_DIR, `TooltipBase_${key}.png`);
  const fallback = path.join(FRAME_DIR, 'TooltipBase_Common.png');
  return fs.existsSync(preferred) ? preferred : fallback;
}

function effects(item) {
  const values = [item?.effect, item?.description, item?.extraTypes, item?.extra_types, item?.tags]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => text(value, ''))
    .filter(Boolean);
  return [...new Set(values)].join(' • ');
}

function category(item) {
  const values = [item?.type, item?.category, item?.extraTypes, item?.extra_types, item?.tags]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => text(value, ''))
    .filter(Boolean);
  return [...new Set(values)].join(', ') || '—';
}

/** @param {Record<string, any>} item */
export function itemTooltipLines(item) {
  return [
    `Damage: ${number(item?.damageMin)}${item?.damageMax != null ? `–${number(item.damageMax)}` : ''}`,
    `Stamina: ${number(item?.staminaCost ?? item?.stamina)}`,
    `Accuracy: ${number(item?.accuracy)}`,
    `Cooldown: ${number(item?.cooldown)}`,
    `Cost: ${number(item?.cost)}`,
    `Rarity: ${text(item?.rarity)}`,
    `Class: ${text(item?.className ?? item?.class)}`,
    `Category: ${category(item)}`,
    `Effects: ${effects(item)}`,
  ];
}

function wrap(ctx, value, maxWidth) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['—'];
}

/** @param {Record<string, any>} item */
export async function renderItemSpritePng(item) {
  const canvas = createCanvas(192, 192);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const file = spritePath(item);
  if (file) {
    const image = await loadImage(fs.readFileSync(file));
    const scale = Math.min(160 / image.width, 160 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, (192 - width) / 2, (192 - height) / 2, width, height);
  }
  return canvas.toBuffer('image/png');
}

/** @param {Record<string, any>} item */
export async function renderItemTooltipPng(item) {
  registerFonts();
  const frame = await loadImage(fs.readFileSync(framePath(item)));
  const width = frame.width || 582;
  const lines = itemTooltipLines(item);
  const lineHeight = 25;
  const top = 142;
  const bottom = 42;
  const height = Math.max(frame.height || 617, top + lines.length * lineHeight + bottom);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(frame, 0, 0, width, Math.min(frame.height, height));
  if (height > frame.height) {
    ctx.drawImage(frame, 0, frame.height - 4, width, height - frame.height + 4, 0, frame.height - 4, width, height - frame.height + 4);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4d6';
  ctx.font = '28px Milonga';
  ctx.fillText(text(item?.name, 'Item'), width / 2, 50);

  const icon = await renderItemSpritePng(item);
  const iconImage = await loadImage(icon);
  ctx.drawImage(iconImage, 20, 65, 76, 76);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f7e7c4';
  ctx.font = '16px Libre Tooltip';
  let y = top;
  for (const line of lines) {
    const wrapped = wrap(ctx, line, width - 56);
    for (const part of wrapped) {
      ctx.fillText(part, 28, y);
      y += lineHeight;
    }
  }
  ctx.fillStyle = '#d9bd82';
  ctx.font = '13px Libre Tooltip';
  ctx.fillText(`Backpack Battles item • ${text(item?.id)}`, 28, height - 20);
  return canvas.toBuffer('image/png');
}
