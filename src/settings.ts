import { App, PluginSettingTab, Setting } from "obsidian";
import Cards4Links from "./main";
import { CacheCleanupModal } from "./cache-cleanup-modal";
import { ConfirmModal } from "./confirm-modal";
import { LanguageSetting, t } from "./i18n";

export type ThumbnailPosition = "right" | "left" | "none";
export type CardView = "card" | "compact" | "minimal" | "carousel";
export type CardTheme = "default" | "light" | "dark";
export type CacheLocation = "vault-absolute" | "note-relative";

export function isThumbnailPosition(v: string): v is ThumbnailPosition {
  return v === "right" || v === "left" || v === "none";
}

export function isCardView(v: string): v is CardView {
  return v === "card" || v === "compact" || v === "minimal" || v === "carousel";
}

export function isCardTheme(v: string): v is CardTheme {
  return v === "default" || v === "light" || v === "dark";
}

export function isCacheLocation(v: string): v is CacheLocation {
  return v === "vault-absolute" || v === "note-relative";
}

export interface Cards4LinksSettings {
  language: LanguageSetting;
  enhanceDefaultPaste: boolean;
  hoverEnhance: boolean;
  hoverTooltipDurationMs: number;
  thumbnailPosition: ThumbnailPosition;
  showInMenuItem: boolean;
  enableWatched: boolean;
  defaultView: CardView;
  theme: CardTheme;
  cacheImages: boolean;
  cacheFolder: string;
  cacheLocation: CacheLocation;
  cacheTTL: number;
  cardsCreated: number;
  globalCardsCreated: number;
  welcomeShown: boolean;
  milestonesShown: number[];
  enableWatchedMigrated: boolean;
}

export const DEFAULT_SETTINGS: Cards4LinksSettings = {
  language: "auto",
  enhanceDefaultPaste: false,
  hoverEnhance: true,
  hoverTooltipDurationMs: 1500,
  thumbnailPosition: "right",
  showInMenuItem: true,
  enableWatched: true,
  defaultView: "card",
  theme: "default",
  cacheImages: false,
  cacheFolder: "cards4links-cache",
  cacheLocation: "vault-absolute",
  cacheTTL: 30,
  cardsCreated: 0,
  globalCardsCreated: 0,
  welcomeShown: false,
  milestonesShown: [],
  enableWatchedMigrated: false,
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
      .setName(t("settings.section.plugin"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.languageDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", `🌐 ${t("settings.language.auto")}`)
          .addOption("en", `🇬🇧 ${t("settings.language.en")}`)
          .addOption("it", `🇮🇹 ${t("settings.language.it")}`)
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            if (value !== "auto" && value !== "en" && value !== "it") return;
            this.plugin.setLanguage(value);
            await this.plugin.saveSettings();
            this.display();
          })
      );

    const counterSetting = new Setting(containerEl)
      .setName(t("settings.cardsCreated"))
      .setDesc(
        t("settings.cardsCreatedDesc", {
          count: this.plugin.settings.cardsCreated,
        })
      );

    counterSetting.infoEl.createDiv({
      cls: "setting-item-description",
      text: t("settings.globalCardsCreated", {
        count: this.plugin.settings.globalCardsCreated,
      }),
    });

    counterSetting.addButton((btn) =>
      btn
        .setButtonText(t("settings.resetCounter"))
        .setDestructive()
        .onClick(() => {
          new ConfirmModal(
            this.app,
            t("settings.resetCounterConfirm"),
            () => {
              void this.resetCounter();
            },
            t("settings.resetCounter")
          ).open();
        })
    );

    new Setting(containerEl)
      .setName(t("settings.section.integration"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("settings.enhancePaste"))
      .setDesc(t("settings.enhancePasteDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enhanceDefaultPaste)
          .onChange(async (value) => {
            this.plugin.settings.enhanceDefaultPaste = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.showInMenu"))
      .setDesc(t("settings.showInMenuDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInMenuItem)
          .onChange(async (value) => {
            this.plugin.settings.showInMenuItem = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.hoverEnhance"))
      .setDesc(t("settings.hoverEnhanceDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hoverEnhance)
          .onChange(async (value) => {
            this.plugin.settings.hoverEnhance = value;
            await this.plugin.saveSettings();
          })
      );

    if (this.plugin.settings.hoverEnhance) {
      new Setting(containerEl)
        .setName(t("settings.hoverDuration"))
        .setDesc(t("settings.hoverDurationDesc"))
        .addDropdown((dropdown) =>
          dropdown
            .addOption("0", t("settings.hoverDuration.0"))
            .addOption("500", t("settings.hoverDuration.500"))
            .addOption("1000", t("settings.hoverDuration.1000"))
            .addOption("1500", t("settings.hoverDuration.1500"))
            .addOption("2000", t("settings.hoverDuration.2000"))
            .addOption("3000", t("settings.hoverDuration.3000"))
            .addOption("5000", t("settings.hoverDuration.5000"))
            .setValue(String(this.plugin.settings.hoverTooltipDurationMs))
            .onChange(async (value) => {
              this.plugin.settings.hoverTooltipDurationMs = parseInt(value);
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName(t("settings.section.style"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("settings.defaultView"))
      .setDesc(t("settings.defaultViewDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("card", t("settings.view.card"))
          .addOption("compact", t("settings.view.compact"))
          .addOption("minimal", t("settings.view.minimal"))
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            if (!isCardView(value)) return;
            this.plugin.settings.defaultView = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.theme"))
      .setDesc(t("settings.themeDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default", t("settings.theme.default"))
          .addOption("light", t("settings.theme.light"))
          .addOption("dark", t("settings.theme.dark"))
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            if (!isCardTheme(value)) return;
            this.plugin.settings.theme = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.thumbnailPosition"))
      .setDesc(t("settings.thumbnailPositionDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("right", t("settings.thumbnail.right"))
          .addOption("left", t("settings.thumbnail.left"))
          .addOption("none", t("settings.thumbnail.none"))
          .setValue(this.plugin.settings.thumbnailPosition)
          .onChange(async (value) => {
            if (!isThumbnailPosition(value)) return;
            this.plugin.settings.thumbnailPosition = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.enableWatched"))
      .setDesc(t("settings.enableWatchedDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableWatched)
          .onChange(async (value) => {
            this.plugin.settings.enableWatched = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.section.cache"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("settings.cacheImages"))
      .setDesc(t("settings.cacheImagesDesc"))
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
        .setName(t("settings.cacheStorage"))
        .setDesc(t("settings.cacheStorageDesc"))
        .addDropdown((dropdown) =>
          dropdown
            .addOption("vault-absolute", t("settings.cacheLocation.vault"))
            .addOption("note-relative", t("settings.cacheLocation.note"))
            .setValue(this.plugin.settings.cacheLocation)
            .onChange(async (value) => {
              if (value !== "vault-absolute" && value !== "note-relative")
                return;
              this.plugin.settings.cacheLocation = value;
              await this.plugin.saveSettings();
              this.display();
            })
        );

      if (this.plugin.settings.cacheLocation === "vault-absolute") {
        new Setting(containerEl)
          .setName(t("settings.cacheFolder"))
          .setDesc(t("settings.cacheFolderDesc"))
          .addText((text) =>
            text
              .setValue(this.plugin.settings.cacheFolder)
              .onChange(async (value) => {
                this.plugin.settings.cacheFolder =
                  value || "cards4links-cache";
                await this.plugin.saveSettings();
              })
          );
      }

      new Setting(containerEl)
        .setName(t("settings.cacheTtl"))
        .setDesc(t("settings.cacheTtlDesc"))
        .addDropdown((dropdown) =>
          dropdown
            .addOption("7", t("settings.ttl.7"))
            .addOption("30", t("settings.ttl.30"))
            .addOption("90", t("settings.ttl.90"))
            .addOption("180", t("settings.ttl.180"))
            .addOption("0", t("settings.ttl.0"))
            .setValue(String(this.plugin.settings.cacheTTL))
            .onChange(async (value) => {
              this.plugin.settings.cacheTTL = parseInt(value);
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("settings.manageCache"))
        .setDesc(t("settings.manageCacheDesc"))
        .addButton((btn) =>
          btn
            .setButtonText(t("settings.manageCacheButton"))
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

  private async resetCounter(): Promise<void> {
    this.plugin.settings.cardsCreated = 0;
    this.plugin.settings.milestonesShown = [];
    await this.plugin.saveSettings();
    this.display();
  }
}