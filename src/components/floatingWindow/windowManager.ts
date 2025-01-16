import DynamicOutlinePlugin from "main";
import { HeadingCache, MarkdownView } from "obsidian";
import { BUTTON_CLASS } from "../buttonManager";
import { InputWithClear } from "./inputField";

export { WindowManager };

class WindowManager {
	private _lastScrollPosition: number = 0;

	private _saveScrollPosition(container: HTMLElement) {
		this._lastScrollPosition = container.scrollTop;
	}

	private _restoreScrollPosition(container: HTMLElement) {
		if (this._lastScrollPosition > 0) {
			container.scrollTop = this._lastScrollPosition;
		}
	}

	private _scrollToHighlightedHeading(windowContainer: HTMLElement) {
		const highlightedItem = windowContainer.querySelector("li.highlight") as HTMLElement;
		if (!highlightedItem) return;

		// 计算滚动位置，使高亮项在视图中间偏上位置
		const containerHeight = windowContainer.clientHeight;
		const itemTop = highlightedItem.offsetTop;
		const itemHeight = highlightedItem.clientHeight;
		
		// 将高亮项滚动到容器的 1/3 处，这样上方和下方都能看到一些内容
		const targetScrollTop = itemTop - containerHeight / 3;

		// 使用即时滚动，移除平滑效果
		windowContainer.scrollTop = targetScrollTop;
	}

	private _createWindowHTML(plugin: DynamicOutlinePlugin): HTMLDivElement {
		// Create main element
		const mainElement: HTMLDivElement = createEl("div", {
			attr: {
				id: "dynamic-outline",
			},
		});

		const searchContainer: HTMLDivElement = mainElement.createEl("div", {
			cls: "dynamic-outline-search-container",
		});
		new InputWithClear(searchContainer, plugin);

		const contentElement: HTMLDivElement = mainElement.createEl("div", {
			cls: "dynamic-outline-content-container",
		});
		contentElement.createEl("ul", {});

		return mainElement;
	}

	private _createWindowListElement(heading: HeadingCache): HTMLLIElement {
		const liElement: HTMLLIElement = createEl("li", {
			attr: {
				"data-heading-line": heading.position.start.line,
			},
		});
		const aElement = createEl("a", {
			cls: `heading-level-${heading.level}`,
			text: heading.heading,
		});
		liElement.append(aElement);

		return liElement;
	}

	createWindowInView(
		view: MarkdownView,
		headings: HeadingCache[],
		plugin: DynamicOutlinePlugin
	): HTMLElement {
		const windowContainer: HTMLDivElement = this._createWindowHTML(plugin);
		this.updateWindowWithHeadings(windowContainer, headings, view, plugin);

		// Should probably move it to the `_createWindowHTML`
		const inputField: HTMLInputElement | null =
			windowContainer.querySelector("input");
		if (inputField) {
			plugin.registerDomEvent(inputField, "input", () => {
				// 保存搜索前的滚动位置
				this._saveScrollPosition(windowContainer);

				const value: string = inputField.value.toLowerCase();
				const outlineItems = windowContainer.querySelectorAll("li");
				outlineItems?.forEach((item: HTMLLIElement) => {
					if (item.textContent?.toLowerCase().includes(value)) {
						item.classList.remove("outline-item-hidden");
					} else {
						item.classList.add("outline-item-hidden");
					}
				});

				// 恢复滚动位置
				requestAnimationFrame(() => {
					this._restoreScrollPosition(windowContainer);
				});
			});
		}
		view.contentEl.append(windowContainer);

		if (plugin.settings.autofocusSearchOnOpen) {
			inputField?.focus();
		}

		// 大纲视图打开时，高亮当前标题并滚动到对应位置
		if (plugin.settings.highlightCurrentHeading) {
			plugin.highlightCurrentHeading();
			// 等待 DOM 更新后滚动到高亮项
			requestAnimationFrame(() => {
				this._scrollToHighlightedHeading(windowContainer);
			});
		}

		const button: HTMLButtonElement | null =
			plugin.buttonManager.getButtonFromLeaf(view.leaf);
		button?.classList.add("button-active");

		// Add visible class after a small delay to trigger transition
		setTimeout(() => {
			windowContainer.classList.add("visible");
		}, 0);

		return windowContainer;
	}

	updateWindowWithHeadings(
		windowContainer: HTMLElement,
		headings: HeadingCache[],
		view: MarkdownView | null,
		plugin: DynamicOutlinePlugin
	) {
		const ulElement: HTMLUListElement | null =
			windowContainer.querySelector("ul");
		if (!ulElement) return;

		ulElement.empty();

		headings?.forEach((heading) => {
			const liElement = this._createWindowListElement(heading);
			ulElement.append(liElement);

			liElement.onclick = () => {
				// @ts-ignore: TS2345
				view.leaf.openFile(view.file, {
					eState: { line: heading.position.start.line },
				});

				if (plugin.settings.resetSearchFieldOnHeadingClick) {
					const inputField: HTMLInputElement | null =
						windowContainer.querySelector("input");
					if (inputField) {
						inputField.value = "";
						const inputEvent = new Event("input", {
							bubbles: true,
							cancelable: true,
						});
						inputField.dispatchEvent(inputEvent);
						inputField.focus();
					}
				}

				// 点击后只更新高亮状态，不滚动大纲视图
				setTimeout(() => {
					if (plugin.settings.highlightCurrentHeading) {
						plugin.highlightCurrentHeading();
					}
				}, 100);
			};
		});
	}

	handleFileOpen(plugin: DynamicOutlinePlugin): void {
		const view: MarkdownView | null =
			plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const windowContainer: HTMLElement | null | undefined =
			this.getWindowFromView(view);
		const headings: HeadingCache[] | null =
			plugin.headingsManager.getHeadingsForView(view, plugin);
		if (!headings || headings.length < plugin.settings.minimumHeadings) {
			if (windowContainer) {
				this.hideWindowFromView(view);
			}
		} else {
			if (!windowContainer) {
				this.createWindowInView(view, headings, plugin);
			}
		}

		// this.updateWindowWithHeadings(windowContainer, headings, view, plugin);
	}

	// updateWindowInView(
	// 	view: MarkdownView | null,
	// 	headings: HeadingCache[],
	// 	plugin: DynamicOutlinePlugin
	// ) {
	// 	this.hideWindowFromView(view);
	// 	this.displayWindowInView(view, headings, plugin);
	// }

	getWindowFromView(
		view: MarkdownView | null
	): HTMLElement | null | undefined {
		const container: HTMLElement | null | undefined =
			view?.contentEl.querySelector("#dynamic-outline");
		return container;
	}

	// I don't like that I have to pass all 3 arguments just to close the window
	// When the window is closed, the button should be unpressed
	hideWindow(
		container: HTMLElement | null,
		button?: HTMLButtonElement | null
	): void {
		if (container) {
			container.classList.remove("visible");
			// Remove container after transition
			setTimeout(() => {
				container.remove();
			}, 200); // Match the transition duration in CSS
		}
		button?.classList.remove("button-active");
	}

	hideWindowFromView(view: MarkdownView | null): void {
		const container: HTMLElement | null | undefined =
			this.getWindowFromView(view);
		const button: HTMLButtonElement | null | undefined =
			view?.containerEl.querySelector(`button.${BUTTON_CLASS}`);

		container?.remove();
		button?.classList.remove("button-active");
	}
}
