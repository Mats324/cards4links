import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";

export class ConfirmModal extends Modal {
  private message: string;
  private confirmButtonText: string;
  private onConfirm: () => void;

  constructor(
    app: App,
    message: string,
    onConfirm: () => void,
    confirmButtonText?: string
  ) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
    this.confirmButtonText = confirmButtonText ?? t("ui.confirm");
  }

  onOpen(): void {
    this.titleEl.setText(t("modal.confirmTitle"));
    this.contentEl.createEl("p", { text: this.message });

    new Setting(this.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(this.confirmButtonText)
          .setDestructive()
          .setCta()
          .onClick(() => {
            this.confirm();
          })
      )
      .addButton((btn) =>
        btn.setButtonText(t("ui.cancel")).onClick(() => {
          this.close();
        })
      );
  }

  private confirm(): void {
    this.close();
    this.onConfirm();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}