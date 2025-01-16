import { MarkdownView, setIcon, WorkspaceLeaf, Plugin } from "obsidian";
import DynamicOutlinePlugin from "main";

export { BUTTON_CLASS, ButtonManager };

const LUCID_ICON_NAME = "list";
const BUTTON_CLASS = "dynamic-outline-button";

class ButtonManager {
	private hideTimeout: number | null = null;

	private clearHideTimeout() {
		if (this.hideTimeout) {
			window.clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}

	private _createButtonHTML(): HTMLButtonElement {
		const button: HTMLButtonElement = createEl("button", {
			cls: `clickable-icon view-action ${BUTTON_CLASS}`,
			attr: {
				"aria-label": "Toggle Dynamic Outline",
			},
		});
		setIcon(button, LUCID_ICON_NAME);
		return button;
	}

	private _handleButtonClick(
		event: MouseEvent,
		plugin: Plugin
	) {
		const button = event.target as HTMLButtonElement;
		const markdownView: MarkdownView | null =
			(plugin as DynamicOutlinePlugin).getActiveMarkdownView();

		if (!markdownView) return;

		const windowContainer: HTMLElement | null | undefined =
			(plugin as DynamicOutlinePlugin).windowManager.getWindowFromView(markdownView);

		if (!windowContainer) {
			(plugin as DynamicOutlinePlugin).windowManager.createWindowInView(
				markdownView,
				(plugin as DynamicOutlinePlugin).headingsManager.getHeadingsForView(markdownView, plugin as DynamicOutlinePlugin),
				plugin as DynamicOutlinePlugin
			);
		} else {
			(plugin as DynamicOutlinePlugin).windowManager.hideWindow(windowContainer, button);
		}
	}

	private _handleButtonHover(
		event: MouseEvent,
		plugin: Plugin,
		isEnter: boolean
	) {
		const button = event.target as HTMLButtonElement;
		const markdownView: MarkdownView | null =
			(plugin as DynamicOutlinePlugin).getActiveMarkdownView();

		if (!markdownView) return;

		const windowContainer: HTMLElement | null | undefined =
			(plugin as DynamicOutlinePlugin).windowManager.getWindowFromView(markdownView);

		if (isEnter) {
			this.clearHideTimeout();

			if (!windowContainer) {
				const container = (plugin as DynamicOutlinePlugin).windowManager.createWindowInView(
					markdownView,
					(plugin as DynamicOutlinePlugin).headingsManager.getHeadingsForView(markdownView, plugin as DynamicOutlinePlugin),
					plugin as DynamicOutlinePlugin
				);

				plugin.registerDomEvent(
					container,
					"mouseenter",
					() => {
						this.clearHideTimeout();
					}
				);

				plugin.registerDomEvent(
					container,
					"mouseleave",
					() => {
						this.clearHideTimeout();
						this.hideTimeout = window.setTimeout(() => {
							if (!button.matches(":hover")) {
								(plugin as DynamicOutlinePlugin).windowManager.hideWindow(container, button);
							}
						}, 200);
					}
				);
			}
		} else if (!isEnter && windowContainer) {
			this.clearHideTimeout();
			this.hideTimeout = window.setTimeout(() => {
				const container = (plugin as DynamicOutlinePlugin).windowManager.getWindowFromView(markdownView);
				if (container && !container.matches(":hover")) {
					(plugin as DynamicOutlinePlugin).windowManager.hideWindow(container, button);
				}
			}, 200);
		}
	}

	addButtonToLeaf(leaf: WorkspaceLeaf, plugin: Plugin) {
		if (this.getButtonFromLeaf(leaf)) return;

		const markdownActionButtons: HTMLElement | null =
			leaf.view.containerEl.querySelector("div.view-actions");
		if (!markdownActionButtons) return;

		const newButton: HTMLButtonElement = this._createButtonHTML();
		markdownActionButtons.insertBefore(
			newButton,
			markdownActionButtons.firstChild
		);

		// Register hover events
		plugin.registerDomEvent(
			newButton,
			"mouseenter",
			(event: MouseEvent) => this._handleButtonHover(event, plugin, true)
		);

		plugin.registerDomEvent(
			newButton,
			"mouseleave",
			(event: MouseEvent) => this._handleButtonHover(event, plugin, false)
		);

		// Register click event
		plugin.registerDomEvent(
			newButton,
			"click",
			(event: MouseEvent) => this._handleButtonClick(event, plugin)
		);

		return newButton;
	}

	addButtonToLeaves(plugin: Plugin) {
		(plugin as DynamicOutlinePlugin).app.workspace.onLayoutReady(() => {
			const markdownLeaves: WorkspaceLeaf[] =
				(plugin as DynamicOutlinePlugin).getAllMarkdownLeaves();
			markdownLeaves.forEach((leaf) => {
				this.addButtonToLeaf(leaf, plugin);
			});
		});
	}

	getButtonFromLeaf(leaf: WorkspaceLeaf): HTMLButtonElement | null {
		return leaf.view.containerEl.querySelector(`button.${BUTTON_CLASS}`);
	}

	removeButtonFromLeaf(leaf: WorkspaceLeaf) {
		this.getButtonFromLeaf(leaf)?.remove();
	}

	removeButtonFromLeaves(plugin: Plugin) {
		const markdowns = (plugin as DynamicOutlinePlugin).getAllMarkdownLeaves();
		markdowns.forEach((md) => {
			this.removeButtonFromLeaf(md);
		});
	}
}
