import { App, PluginSettingTab, Setting } from "obsidian";
import Cards4Links from "./main";
import { CacheCleanupModal } from "./cache-cleanup-modal";

export type ThumbnailPosition = "right" | "left" | "none";
export type CardView = "card" | "compact" | "minimal";
export type CardTheme = "default" | "light" | "dark";
export type CacheLocation = "vault-absolute" | "note-relative";

export function isThumbnailPosition(v: string): v is ThumbnailPosition {
  return v === "right" || v === "left" || v === "none";
}

export function isCardView(v: string): v is CardView {
  return v === "card" || v === "compact" || v === "minimal";
}

export function isCardTheme(v: string): v is CardTheme {
  return v === "default" || v === "light" || v === "dark";
}

export function isCacheLocation(v: string): v is CacheLocation {
  return v === "vault-absolute" || v === "note-relative";
}

export interface Cards4LinksSettings {
  enhanceDefaultPaste: boolean;
  thumbnailPosition: ThumbnailPosition;
  showInMenuItem: boolean;
  enableWatched: boolean;
  defaultView: CardView;
  theme: CardTheme;
  cacheImages: boolean;
  cacheFolder: string;
  cacheLocation: CacheLocation;
  cacheTTL: number;
}

export const DEFAULT_SETTINGS: Cards4LinksSettings = {
  enhanceDefaultPaste: false,
  thumbnailPosition: "right",
  showInMenuItem: true,
  enableWatched: false,
  defaultView: "card",
  theme: "default",
  cacheImages: false,
  cacheFolder: "cards4links-cache",
  cacheLocation: "vault-absolute",
  cacheTTL: 30,
};

export class Cards4LinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: Cards4Links
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enhance default paste")
      .setDesc(
        "Automatically fetch metadata when pasting a URL with the default paste command"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enhanceDefaultPaste)
          .onChange(async (value) => {
            this.plugin.settings.enhanceDefaultPaste = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Thumbnail position")
      .setDesc("Where to show the thumbnail image in the card")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("right", "Right")
          .addOption("left", "Left")
          .addOption("none", "No thumbnail")
          .setValue(this.plugin.settings.thumbnailPosition)
          .onChange(async (value) => {
            if (!isThumbnailPosition(value)) return;
            this.plugin.settings.thumbnailPosition = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show commands in menu item")
      .setDesc("Add paste/enhance commands to the right-click context menu")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInMenuItem)
          .onChange(async (value) => {
            this.plugin.settings.showInMenuItem = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable watched/read checkbox")
      .setDesc(
        "Show a checkbox on cards to track watched (video) or read (article) status"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableWatched)
          .onChange(async (value) => {
            this.plugin.settings.enableWatched = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default card view")
      .setDesc("Default view style for newly created cards")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("card", "Card")
          .addOption("compact", "Compact")
          .addOption("minimal", "Minimal")
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            if (!isCardView(value)) return;
            this.plugin.settings.defaultView = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Card theme")
      .setDesc("Override card colors (default follows Obsidian theme)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default", "Default")
          .addOption("light", "Light")
          .addOption("dark", "Dark")
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            if (!isCardTheme(value)) return;
            this.plugin.settings.theme = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Cache images locally")
      .setDesc("Download card images to the vault for offline access")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.cacheImages)
          .onChange(async (value) => {
            this.plugin.settings.cacheImages = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.cacheImages) {
      new Setting(containerEl)
        .setName("Cache storage")
        .setDesc("Store images in a global vault folder or next to each note")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("vault-absolute", "Global folder")
            .addOption("note-relative", "Per note")
            .setValue(this.plugin.settings.cacheLocation)
            .onChange(async (value) => {
              if (value !== "vault-absolute" && value !== "note-relative") return;
              this.plugin.settings.cacheLocation = value;
              await this.plugin.saveSettings();
              this.display();
            })
        );

      if (this.plugin.settings.cacheLocation === "vault-absolute") {
        new Setting(containerEl)
          .setName("Cache folder name")
          .setDesc("Folder path for cached images (vault root)")
          .addText((text) =>
            text
              .setValue(this.plugin.settings.cacheFolder)
              .onChange(async (value) => {
                this.plugin.settings.cacheFolder = value || "cards4links-cache";
                await this.plugin.saveSettings();
              })
          );
      }

      new Setting(containerEl)
        .setName("Cache TTL")
        .setDesc("How long before re-downloading a cached image")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("7", "7 days")
            .addOption("30", "30 days")
            .addOption("90", "90 days")
            .addOption("180", "180 days")
            .addOption("0", "Never expire")
            .setValue(String(this.plugin.settings.cacheTTL))
            .onChange(async (value) => {
              this.plugin.settings.cacheTTL = parseInt(value);
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Manage cache")
        .setDesc("View cache contents and clean up files")
        .addButton((btn) =>
          btn
            .setButtonText("Manage cache…")
            .onClick(() => {
              const modal = new CacheCleanupModal(
                this.plugin.app,
                this.plugin
              );
              modal.open();
            })
        );
    }
  }
}
