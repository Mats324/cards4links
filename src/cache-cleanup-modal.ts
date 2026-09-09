import { App, Modal, Notice } from "obsidian";
import Cards4Links from "./main";
import { t } from "./i18n";
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
  if (days < 1) return t("cache.age.today");
  if (days === 1) return t("cache.age.oneDay");
  if (days < 30) return t("cache.age.days", { days });
  const months = Math.floor(days / 30);
  return months === 1
    ? t("cache.age.oneMonth")
    : t("cache.age.months", { months });
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

    contentEl.createEl("h2", { text: t("cache.title") });

    this.container = contentEl.createDiv();
    this.container.setText(t("cache.scanning"));

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
      this.container.setText(t("cache.scanning"));
      return;
    }

    const totalSize = this.rows.reduce((s, r) => s + r.entry.size, 0);
    const expiredCount = this.rows.filter((r) => r.expired).length;
    const orphanCount = this.rows.filter((r) => !r.referenced).length;

    // Summary
    const summaryEl = this.container.createDiv({ cls: "cards4links-cache-summary" });
    summaryEl.createSpan({
      text: t("cache.summary", {
        count: this.rows.length,
        size: fmtSize(totalSize),
      }),
    });
    if (expiredCount > 0) {
      summaryEl.createSpan({
        text: t("cache.summaryExpired", { count: expiredCount }),
      });
    }

    // Action buttons
    const actionsEl = this.container.createDiv({ cls: "cards4links-cache-actions" });
    actionsEl.createEl("button", { text: t("cache.selectAll"), cls: "clickable-icon" })
      .addEventListener("click", () => {
        this.rows.forEach((r) => (r.checked = true));
        this.render();
      });
    if (expiredCount > 0) {
      actionsEl.createEl("button", { text: t("cache.selectExpired"), cls: "clickable-icon" })
        .addEventListener("click", () => {
          this.rows.forEach((r) => (r.checked = r.expired));
          this.render();
        });
    }
    if (orphanCount > 0) {
      actionsEl.createEl("button", { text: t("cache.selectOrphans"), cls: "clickable-icon" })
        .addEventListener("click", () => {
          this.rows.forEach((r) => (r.checked = !r.referenced));
          this.render();
        });
    }
    actionsEl.createEl("button", { text: t("cache.deselectAll"), cls: "clickable-icon" })
      .addEventListener("click", () => {
        this.rows.forEach((r) => (r.checked = false));
        this.render();
      });

    // Table
    const table = this.container.createEl("table", { cls: "cards4links-cache-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "" });
    headerRow.createEl("th", { text: t("cache.headerFile") });
    headerRow.createEl("th", { text: t("cache.headerSize") });
    headerRow.createEl("th", { text: t("cache.headerAge") });
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
        statusTd.createSpan({ text: t("cache.orphan"), cls: "cards4links-cache-orphan" });
      } else if (row.expired) {
        statusTd.createSpan({ text: t("cache.expired"), cls: "cards4links-cache-expired" });
      } else {
        statusTd.createSpan({ text: t("cache.ok"), cls: "cards4links-cache-ok" });
      }
    }

    // Delete button
    const deleteBtn = this.container.createEl("button", {
      cls: "mod-cta",
      text: t("cache.deleteSelected"),
    });
    deleteBtn.addEventListener("click", async () => {
      const selected = this.rows.filter((r) => r.checked);
      if (selected.length === 0) {
        new Notice(t("notice.noFilesSelected"));
        return;
      }
      const filenames = selected.map((r) => r.entry.filename);
      await deleteFiles(this.app, this.folder, filenames);
      this.rows = this.rows.filter((r) => !r.checked);
      new Notice(t("notice.deletedFiles", { count: filenames.length }));
      this.render();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
