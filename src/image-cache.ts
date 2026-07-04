import { App, TFile, requestUrl } from "obsidian";
import type { CacheLocation } from "./settings";

export interface CacheEntry {
  filename: string;
  originalUrl: string;
  cachedAt: string;
  size: number;
}

export interface Manifest {
  version: number;
  files: CacheEntry[];
}

function extension(url: string): string {
  const match = url.match(/\.(jpe?g|png|gif|webp|bmp|svg|ico)(\?|#|$)/i);
  return match ? match[1].toLowerCase() : "jpg";
}

export async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash.slice(0, 8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}.${extension(url)}`;
}

export async function downloadImage(url: string): Promise<ArrayBuffer> {
  const res = await requestUrl(url);
  return res.arrayBuffer;
}

export function getCacheFolderPath(
  activeFile: TFile | null,
  location: CacheLocation,
  folderName: string
): string {
  if (location === "note-relative" && activeFile) {
    const parent = activeFile.parent;
    return parent ? `${parent.path}/${folderName}` : folderName;
  }
  return folderName;
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const existing = app.vault.getFolderByPath(path);
  if (existing) return;
  await app.vault.createFolder(path);
}

const MANIFEST_FILE = "_manifest.json";

export async function getManifest(app: App, folder: string): Promise<Manifest> {
  const file = app.vault.getAbstractFileByPath(`${folder}/${MANIFEST_FILE}`);
  if (!file || !(file instanceof TFile)) {
    return { version: 1, files: [] };
  }
  try {
    const content = await app.vault.read(file);
    return JSON.parse(content) as Manifest;
  } catch {
    return { version: 1, files: [] };
  }
}

export async function saveManifest(
  app: App,
  folder: string,
  manifest: Manifest
): Promise<void> {
  const path = `${folder}/${MANIFEST_FILE}`;
  const existing = app.vault.getAbstractFileByPath(path);
  const content = JSON.stringify(manifest, null, 2);
  if (existing && existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(path, content);
  }
}

export async function addToManifest(
  app: App,
  folder: string,
  entry: CacheEntry
): Promise<void> {
  const manifest = await getManifest(app, folder);
  const idx = manifest.files.findIndex((f) => f.filename === entry.filename);
  if (idx >= 0) {
    manifest.files[idx] = entry;
  } else {
    manifest.files.push(entry);
  }
  await saveManifest(app, folder, manifest);
}

export async function removeFromManifest(
  app: App,
  folder: string,
  filenames: string[]
): Promise<void> {
  const manifest = await getManifest(app, folder);
  manifest.files = manifest.files.filter(
    (f) => !filenames.includes(f.filename)
  );
  await saveManifest(app, folder, manifest);
}

export async function deleteFiles(
  app: App,
  folder: string,
  filenames: string[]
): Promise<void> {
  for (const name of filenames) {
    if (name === MANIFEST_FILE) continue;
    const path = `${folder}/${name}`;
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      await app.vault.delete(file);
    }
  }
  await removeFromManifest(app, folder, filenames);
}

export async function resolveResourceUrl(
  app: App,
  localPath: string
): Promise<string | null> {
  const file = app.vault.getAbstractFileByPath(localPath);
  if (!file || !(file instanceof TFile)) return null;
  return app.vault.getResourcePath(file);
}

export async function scanReferences(app: App): Promise<Set<string>> {
  const refs = new Set<string>();
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    const regex = /imageLocal:\s*(\S+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      refs.add(match[1]);
    }
  }
  return refs;
}

export function isExpired(
  entry: CacheEntry,
  ttlDays: number
): boolean {
  if (ttlDays <= 0) return false;
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  return age > ttlDays * 86400000;
}
