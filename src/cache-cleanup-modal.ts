import { App, Modal, Notice } from "obsidian";
import Cards4Links from "./main";
import {
  getManifest,
  deleteFiles,
  scanReferences,
  getCacheFolderPath,
  isExpired,
  CacheEntry,
} from "./image-cache";

interface DisplayRow {
  entry: CacheEntry;
  checked: boolean;
  referenced: boolean;
  expired: boolean;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtAge(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000
  );
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

export class CacheCleanupModal extends Modal {
  private rows: DisplayRow[] = [];
  private folder = "";
  private loading = true;
  private container!: HTMLElement;

  constructor(
    app: App,
    private plugin: Cards4Links
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.addClass("cards4links-modal");
    contentEl.empty();

    contentEl.createEl("h2", { text: "Cache Cleanup" });

    this.container = contentEl.createDiv();
    this.container.setText("Scanning cache…");

    await this.loadData();
    this.render();
  }

  private async loadData(): Promise<void> {
    this.folder = getCacheFolderPath(
      this.app.workspace.getActiveFile(),
      this.plugin.settings.cacheLocation,
      this.plugin.settings.cacheFolder
    );

    const manifest = await getManifest(this.app, this.folder);
    const refs = await scanReferences(this.app);
    const ttl = this.plugin.settings.cacheTTL;

    this.rows = manifest.files.map((entry) => ({
      entry,
      checked: false,
      referenced: refs.has(entry.filename) || refs.has(`${this.folder}/${entry.filename}`),
      expired: isExpired(entry, ttl),
    }));
    this.loading = false;
  }

  private render(): void {
    this.container.empty();

    if (this.loading) {
      this.container.setText("Scanning cache…");
      return;
    }

    const totalSize = this.rows.reduce((s, r) => s + r.entry.size, 0);
    const expiredCount = this.rows.filter((r) => r.expired).length;
    const orphanCount = this.rows.filter((r) => !r.referenced).length;

    // Summary
    const summaryEl = this.container.createDiv({ cls: "cards4links-cache-summary" });
    summaryEl.createSpan({
      text: `${this.rows.length} files — ${fmtSize(totalSize)}`,
    });
    if (expiredCount > 0) {
      summaryEl.createSpan({
        text: ` — ${expiredCount} expired`,
      });
    }

    // Action buttons
    const actionsEl = this.container.createDiv({ cls: "cards4links-cache-actions" });
    actionsEl.createEl("button", { text: "Select all", cls: "clickable-icon" })
      .addEventListener("click", () => {
        this.rows.forEach((r) => (r.checked = true));
        this.render();
      });
    if (expiredCount > 0) {
      actionsEl.createEl("button", { text: "Select expired", cls: "clickable-icon" })
        .addEventListener("click", () => {
          this.rows.forEach((r) => (r.checked = r.expired));
          this.render();
        });
    }
    if (orphanCount > 0) {
      actionsEl.createEl("button", { text: "Select orphans", cls: "clickable-icon" })
        .addEventListener("click", () => {
          this.rows.forEach((r) => (r.checked = !r.referenced));
          this.render();
        });
    }
    actionsEl.createEl("button", { text: "Deselect all", cls: "clickable-icon" })
      .addEventListener("click", () => {
        this.rows.forEach((r) => (r.checked = false));
        this.render();
      });

    // Table
    const table = this.container.createEl("table", { cls: "cards4links-cache-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "" });
    headerRow.createEl("th", { text: "File" });
    headerRow.createEl("th", { text: "Size" });
    headerRow.createEl("th", { text: "Age" });
    headerRow.createEl("th", { text: "" });

    const tbody = table.createEl("tbody");
    for (const row of this.rows) {
      const tr = tbody.createEl("tr");
      tr.addClass("cards4links-cache-row");

      const cbTd = tr.createEl("td");
      const cb = cbTd.createEl("input", { attr: { type: "checkbox" } });
      cb.checked = row.checked;
      cb.addEventListener("change", () => {
        row.checked = cb.checked;
      });

      tr.createEl("td", { text: row.entry.filename });

      tr.createEl("td", { text: fmtSize(row.entry.size) });

      tr.createEl("td", { text: fmtAge(row.entry.cachedAt) });

      const statusTd = tr.createEl("td");
      if (!row.referenced) {
        statusTd.createSpan({ text: "orphan", cls: "cards4links-cache-orphan" });
      } else if (row.expired) {
        statusTd.createSpan({ text: "expired", cls: "cards4links-cache-expired" });
      } else {
        statusTd.createSpan({ text: "ok", cls: "cards4links-cache-ok" });
      }
    }

    // Delete button
    const deleteBtn = this.container.createEl("button", {
      cls: "mod-cta",
      text: "Delete selected",
    });
    deleteBtn.addEventListener("click", async () => {
      const selected = this.rows.filter((r) => r.checked);
      if (selected.length === 0) {
        new Notice("No files selected");
        return;
      }
      const filenames = selected.map((r) => r.entry.filename);
      await deleteFiles(this.app, this.folder, filenames);
      this.rows = this.rows.filter((r) => !r.checked);
      new Notice(`Deleted ${filenames.length} file(s)`);
      this.render();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
