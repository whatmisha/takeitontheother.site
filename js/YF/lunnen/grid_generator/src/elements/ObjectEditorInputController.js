const TEXT_PRESETS = [
    { label: 'Brand', text: 'Lunnen — бренд компьютерной техники и аксессуаров, придуманный в Яндекс Фабрике. Сопровождает в исследованиях, работе и развлечениях.' },
    { label: 'Outer', text: 'Продвинутая линейка Lunnen Outer для исследований неизведанного. Эффективные технологии для работы с графикой или развлечений разного уровня сложностей.' },
    { label: 'Ground', text: 'Базовая линейка Lunnen Ground для решения земных задач. Всё необходимое для повседневной работы: от прочного корпуса до современных технологий.' },
    { label: 'Airis', text: 'Lunnen Airis — лёгкая линейка с мощными возможностями. Справляется с тяжёлыми задачами и расширяет границы невесомости.' },
    { label: 'Work', text: 'Серия аксессуаров для компьютерной техники Lunnen Work — подходит для работы и повседневных задач.' },
    { label: 'Изготовитель', text: 'Изготовитель: Винд Мобилити Текнолоджи (Пекин) Лимитед. Адрес: офис 11605, 13 этаж, корпус 1, дом 2, переулок Наньчжугань, район Дунчэн, Пекин, Китай. Сделано в Китае.' },
    { label: 'Маркет.Трейд', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «Маркет. Трейд». Адрес: 121099, Россия, г. Москва, Новинский б-р, д. 8. Info@lunnen.pro' },
    { label: 'Сайберстор', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «САЙБЕРСТОР». Адрес импортёра: 123112, Россия, г. Москва, вн.тер.г. Муниципальный Округ Пресненский, 1-й Красногвардейский, д. 21, стр. 1. Info@lunnen.pro' }
].map(preset => ({ ...preset, text: preset.text.replace(/ {2,}/g, ' ') }));

/**
 * Owns text-editor inputs and the remaining graphics-editor UI lifecycle.
 * Surface-aware numeric graphics inputs live in GraphicsEditorInputController.
 */
export class ObjectEditorInputController {
    constructor(host) {
        this.host = host;
    }

    roundToDecimals(value, decimals = 0) {
        return decimals > 0
            ? Number.parseFloat(value.toFixed(decimals))
            : Math.round(value);
    }

    handleTextArrow(event, property, inputId) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const block = this.host.currentEditingBlock;
        if (!block) return;

        event.preventDefault();
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const baseStep = property === 'width' ? 0.25 : 1;
        const step = event.shiftKey ? (property === 'width' ? 1 : 10) : baseStep;
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        let value = this.roundToDecimals(
            block[property],
            this.host.sliderController.getDecimalsFromStep(step)
        ) + step * direction;

        if (property === 'x') {
            value = Math.max(1, Math.min(value, context.columnCount));
            block.x = value;
            this.host.dom[inputId].value = value;
            if (block.x + block.width - 1 > context.columnCount) {
                block.width = Math.max(0.25, context.columnCount - block.x + 1);
                this.host.dom.paragraphWidthInput.value = block.width.toFixed(2);
            }
        } else if (property === 'row') {
            const contentHeight = context.frontHeight - 2 * context.margins * context.gridModule;
            const maxY = Math.floor(contentHeight / context.gridModule + 1e-9) - 1;
            const y = value * (context.rowHeight + 1);
            const constrainedY = Math.max(0, Math.min(y, maxY));
            block.row = Math.max(0, Math.floor(constrainedY / (context.rowHeight + 1)));
            block.baselineOffset = 0;
            this.host.dom[inputId].value = block.row + 1;
            if (this.host.dom.paragraphBaselineInput) {
                this.host.dom.paragraphBaselineInput.value =
                    this.host.rowBaselineToY(block.row, 0, surface) + 1;
            }
        } else if (property === 'width') {
            value = Math.round(value * 4) / 4;
            value = Math.max(0.25, Math.min(value, context.columnCount));
            block.width = value;
            this.host.dom[inputId].value = value.toFixed(2);
            const maxX = context.columnCount - block.width;
            if (block.x > maxX) {
                block.x = Math.max(1, Math.floor(maxX + 1));
            }
            block.x = Math.round(block.x);
            this.host.dom.paragraphXInput.value = block.x;
        }

        this.host.updateGrid();
    }

    initTextEditor() {
        // ===== History: focus/blur обработчики для инпутов текстовых блоков =====
        // Группируют все изменения (набор текста, стрелки) в одно действие
        const textBlockInputIds = [
            'paragraphXInput', 'paragraphRowInput', 'paragraphBaselineInput', 'paragraphWidthInput'
        ];
        textBlockInputIds.forEach(inputId => {
            const input = this.host.dom[inputId];
            if (input) {
                input.addEventListener('focus', () => {
                    this.host.historyManager.beginAction(`edit text block ${inputId}`, this.host.getStateSnapshot());
                });
                input.addEventListener('blur', () => {
                    this.host.historyManager.commitAction(this.host.getStateSnapshot());
                });
            }
        });

        // Обработчики изменений параметров
        if (this.host.dom.paragraphXInput) {
            this.host.dom.paragraphXInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    let newX = parseInt(this.host.dom.paragraphXInput.value);
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const { columnCount } = this.host.getSurfaceGridContext(surface);

                    // Ограничиваем X в зависимости от alignment
                    const alignment = this.host.currentEditingBlock.alignment || 'left';
                    if (alignment === 'right') {
                        // For right-aligned: минимум = ceil(width), максимум = columnCount
                        const minX = Math.ceil(this.host.currentEditingBlock.width);
                        newX = Math.max(minX, Math.min(newX, columnCount));
                    } else {
                        // For left-aligned: минимум = 1, максимум зависит от ширины
                        newX = Math.max(1, Math.min(newX, columnCount));
                    }

                    // Устанавливаем новое значение X
                    this.host.currentEditingBlock.x = newX;

                    // Корректируем width если блок выходит за пределы
                    if (alignment === 'right') {
                        // For right-aligned: block grows left, so max width = x
                        if (this.host.currentEditingBlock.width > this.host.currentEditingBlock.x) {
                            this.host.currentEditingBlock.width = Math.max(0.25, this.host.currentEditingBlock.x);
                            this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);
                        }
                    } else {
                        // For left-aligned: block grows right
                        // x начинается с 1, поэтому последняя занятая колонка = x + width - 1
                        if (this.host.currentEditingBlock.x + this.host.currentEditingBlock.width - 1 > columnCount) {
                            this.host.currentEditingBlock.width = Math.max(0.25, columnCount - this.host.currentEditingBlock.x + 1);
                            this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);
                        }
                    }

                    // Обновляем отображение X (на случай коррекции), округляем до целого
                    this.host.dom.paragraphXInput.value = Math.round(this.host.currentEditingBlock.x);
                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphXInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'x', 'paragraphXInput');
            });
        }

        if (this.host.dom.paragraphRowInput) {
            this.host.dom.paragraphRowInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    const newRow = parseInt(this.host.dom.paragraphRowInput.value) - 1;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed row based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции: первая строка блока должна быть
                    // в пределах контентной области. Остальное (lineHeight) может выходить за поля.
                    const maxY = maxYInBaseline - 1;

                    // Calculate Y position from row (baselineOffset всегда сбрасывается в 0)
                    const rowHeight = context.rowHeight;
                    const yPos = newRow * (rowHeight + 1);

                    // Constrain Y
                    const constrainedY = Math.max(0, Math.min(yPos, maxY));

                    // При изменении Row всегда ставим объект на первый baseline новой row
                    // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                    const rowWithGutter = rowHeight + 1;
                    const finalRow = Math.floor(constrainedY / rowWithGutter);

                    this.host.currentEditingBlock.row = Math.max(0, finalRow);
                    this.host.currentEditingBlock.baselineOffset = 0; // Всегда на первый baseline в row
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;

                    // Update baseline input if needed
                    if (this.host.dom.paragraphBaselineInput) {
                        const globalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                        this.host.dom.paragraphBaselineInput.value = globalBaseline + 1;
                    }

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphRowInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'row', 'paragraphRowInput');
            });
        }

        if (this.host.dom.paragraphBaselineInput) {
            this.host.dom.paragraphBaselineInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    const globalBaseline = parseInt(this.host.dom.paragraphBaselineInput.value) - 1;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    // Constrain baseline
                    const constrainedBaseline = Math.max(0, Math.min(globalBaseline, maxY));

                    // Преобразуем глобальный номер baseline в row и baselineOffset
                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.host.yToRowBaseline(constrainedBaseline, surface);

                    this.host.currentEditingBlock.row = Math.max(0, newRow);
                    this.host.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение (на случай коррекции)
                    const correctedGlobalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                    this.host.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphBaselineInput.addEventListener('keydown', (e) => {
                if (this.host.currentEditingBlock && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const globalBaseline = parseInt(this.host.dom.paragraphBaselineInput.value) - 1;
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    const step = e.shiftKey ? 10 : 1;
                    let newGlobalBaseline = globalBaseline + delta * step;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    newGlobalBaseline = Math.max(0, Math.min(newGlobalBaseline, maxY));

                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.host.yToRowBaseline(newGlobalBaseline, surface);
                    this.host.currentEditingBlock.row = Math.max(0, newRow);
                    this.host.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение с правильным значением
                    const correctedGlobalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                    this.host.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.paragraphWidthInput) {
            this.host.dom.paragraphWidthInput.addEventListener('change', () => {
                this.host.markAsChanged();
                if (this.host.currentEditingBlock) {
                    const newWidth = parseFloat(this.host.dom.paragraphWidthInput.value);
                    const alignment = this.host.currentEditingBlock.alignment || 'left';
                    const { columnCount } = this.host.getSurfaceGridContext(this.host.currentEditingBlock.surface || 'front');

                    // Округляем до ближайшего кратного 0.25
                    const roundedWidth = Math.round(newWidth * 4) / 4;

                    // Max width depends on alignment
                    let maxWidth;
                    if (alignment === 'right') {
                        // For right-aligned: max width = x (block grows left from column x)
                        maxWidth = this.host.currentEditingBlock.x;
                    } else {
                        // For left-aligned: max width = columns available to the right
                        maxWidth = columnCount - this.host.currentEditingBlock.x + 1;
                    }

                    this.host.currentEditingBlock.width = Math.max(0.25, Math.min(roundedWidth, maxWidth));
                    this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphWidthInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'width', 'paragraphWidthInput');
            });
        }

        // Обработчик для текстового поля - изменения применяются только при blur или Enter
        if (this.host.dom.paragraphTextArea) {
            // Обработка клавиш для принудительных переносов и неразрывных пробелов
            this.host.dom.paragraphTextArea.addEventListener('keydown', (e) => {
                // Shift+Enter или Shift+Space - принудительный перенос строки (\n)
                if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем \n в позицию курсора
                    textarea.value = text.substring(0, start) + '\n' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.host.objectEditorPanelController.updateCharacterCount();
                }
                // Option+Space (Alt+Space на Windows/Linux) - неразрывный пробел (\u00A0)
                else if (e.key === ' ' && (e.altKey || e.metaKey)) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем неразрывный пробел в позицию курсора
                    textarea.value = text.substring(0, start) + '\u00A0' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.host.objectEditorPanelController.updateCharacterCount();
                }
                // Обычный Enter без Shift - закрываем редактор
                else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.host.dom.paragraphTextArea.blur();
                }
            });

            // Применение изменений при потере фокуса
            this.host.dom.paragraphTextArea.addEventListener('blur', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.content = this.host.dom.paragraphTextArea.value;
                    this.host.objectEditorPanelController.updateCharacterCount();
                    this.host.updateGrid();
                }
            });
        }

        // Кнопки быстрой вставки текстовых пресетов
        this.initTextPresetChips();

        // Обработчик для дропдауна стиля текста
        if (this.host.dom.paragraphStyleSelect) {
            this.host.dom.paragraphStyleSelect.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.styleRef = this.host.dom.paragraphStyleSelect.value;

                    // Показываем/скрываем секцию настроек Lunnen Display
                    const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
                    if (lunnenDisplayFeaturesSection) {
                        if (this.host.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            lunnenDisplayFeaturesSection.style.display = 'block';
                        } else {
                            lunnenDisplayFeaturesSection.style.display = 'none';
                        }
                    }

                    // Показываем/скрываем Alignment Mode (для Lunnen Display не показываем)
                    const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
                    if (alignmentModeSection) {
                        if (this.host.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            alignmentModeSection.style.display = 'none';
                        } else {
                            alignmentModeSection.style.display = 'block';
                        }
                    }

                    this.host.objectNavigatorController.render();
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для дропдауна выбора поверхности (текст)
        if (this.host.dom.paragraphSurfaceSelect) {
            this.host.dom.paragraphSurfaceSelect.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.historyManager.beginAction('move text to surface', this.host.getStateSnapshot());
                    this.host.moveBlockToSurface(this.host.currentEditingBlock, this.host.dom.paragraphSurfaceSelect.value);
                    this.host.markAsChanged();
                    this.host.objectNavigatorController.render();
                    this.host.updateGrid();
                    this.host.historyManager.commitAction(this.host.getStateSnapshot());
                }
            });
        }

        // Обработчик для кнопки Hide
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            paragraphHideBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    this.host.objectNavigatorController.toggleVisibility(
                        'text',
                        this.host.currentEditingBlock.id
                    );
                    // Update button icon based on visibility
                    const block = this.host.objectDocument.textBlocks.find(
                        b => b.id === this.host.currentEditingBlock.id
                    );
                    if (block) {
                        const svg = paragraphHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }

        // Обработчик для кнопки Duplicate
        const paragraphDuplicateBtn = document.getElementById('paragraphDuplicateBtn');
        if (paragraphDuplicateBtn) {
            paragraphDuplicateBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    this.host.objectNavigatorController.duplicate(
                        'text',
                        this.host.currentEditingBlock.id
                    );
                }
            });
        }

        // Обработчик для кнопки Delete
        const paragraphDeleteBtn = document.getElementById('paragraphDeleteBtn');
        if (paragraphDeleteBtn) {
            paragraphDeleteBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    const blockId = this.host.currentEditingBlock.id;
                    const block = this.host.objectDocument.textBlocks.find(b => b.id === blockId);
                    if (block) {
                        const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');

                        // Close panel first
                        this.host.objectEditorPanelController.closeTextPanel();

                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.host.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.host.objectNavigatorController.startDelete(
                                    deleteBtn,
                                    'text',
                                    blockId,
                                    name
                                );
                            }
                        }
                    }
                }
            });
        }

        // Обработчики для режима выравнивания (Alignment Mode)
        if (this.host.dom.alignmentModeBaseline) {
            this.host.dom.alignmentModeBaseline.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeBaseline.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'baseline';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.alignmentModeXHeight) {
            this.host.dom.alignmentModeXHeight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeXHeight.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'x-height';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.alignmentModeCapHeight) {
            this.host.dom.alignmentModeCapHeight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeCapHeight.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'cap-height';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для Constrain to Grid toggle
        if (this.host.dom.paragraphLockPositionToggle) {
            this.host.dom.paragraphLockPositionToggle.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.lockPosition = this.host.dom.paragraphLockPositionToggle.checked;
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для Align Right toggle
        if (this.host.dom.paragraphAlignRightToggle) {
            this.host.dom.paragraphAlignRightToggle.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    const wasRight = this.host.currentEditingBlock.alignment === 'right';
                    const nowRight = this.host.dom.paragraphAlignRightToggle.checked;

                    // Adjust X position to keep block visually in the same place
                    if (nowRight && !wasRight) {
                        // Switching from left to right alignment
                        // X should move right by (width - 1) columns
                        // Example: X=7, width=3, left → X=9, width=3, right (occupies columns 7,8,9 in both cases)
                        const widthInColumns = Math.ceil(this.host.currentEditingBlock.width);
                        this.host.currentEditingBlock.x += (widthInColumns - 1);

                        // Update input display
                        if (this.host.dom.paragraphXInput) {
                            this.host.dom.paragraphXInput.value = this.host.currentEditingBlock.x;
                        }
                    } else if (!nowRight && wasRight) {
                        // Switching from right to left alignment
                        // X should move left by (width - 1) columns
                        const widthInColumns = Math.ceil(this.host.currentEditingBlock.width);
                        this.host.currentEditingBlock.x -= (widthInColumns - 1);

                        // Ensure X doesn't go below 1
                        this.host.currentEditingBlock.x = Math.max(1, this.host.currentEditingBlock.x);

                        // Update input display
                        if (this.host.dom.paragraphXInput) {
                            this.host.dom.paragraphXInput.value = this.host.currentEditingBlock.x;
                        }
                    }

                    this.host.currentEditingBlock.alignment = nowRight ? 'right' : 'left';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчики для Text Alignment radio buttons
        if (this.host.dom.textAlignmentLeft) {
            this.host.dom.textAlignmentLeft.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentLeft.checked) {
                    this.host.currentEditingBlock.textAlign = 'left';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.textAlignmentCenter) {
            this.host.dom.textAlignmentCenter.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentCenter.checked) {
                    this.host.currentEditingBlock.textAlign = 'center';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.textAlignmentRight) {
            this.host.dom.textAlignmentRight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentRight.checked) {
                    this.host.currentEditingBlock.textAlign = 'right';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для weight slider (Lunnen Display)
        const lunnenDisplayWeightSlider = document.getElementById('lunnenDisplayWeightSlider');
        const lunnenDisplayWeightValue = document.getElementById('lunnenDisplayWeightValue');
        if (lunnenDisplayWeightSlider && lunnenDisplayWeightValue) {
            // Обновление значения при изменении слайдера
            lunnenDisplayWeightSlider.addEventListener('input', () => {
                if (this.host.currentEditingBlock) {
                    const weight = parseInt(lunnenDisplayWeightSlider.value);
                    lunnenDisplayWeightValue.value = weight;
                    this.host.currentEditingBlock.fontWeight = weight;
                    this.host.updateGrid();
                }
            });

            // Обновление слайдера при изменении текстового поля - применяется при blur или Enter
            lunnenDisplayWeightValue.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    lunnenDisplayWeightValue.blur();
                }
            });

            lunnenDisplayWeightValue.addEventListener('blur', () => {
                if (this.host.currentEditingBlock) {
                    let weight = parseInt(lunnenDisplayWeightValue.value);
                    weight = Math.max(100, Math.min(400, weight));
                    lunnenDisplayWeightValue.value = weight;
                    lunnenDisplayWeightSlider.value = weight;
                    this.host.currentEditingBlock.fontWeight = weight;
                    this.host.updateGrid();
                }
            });
        }

        // Обработчики для OpenType features checkboxes
        const featureCheckboxes = [
            { id: 'featureSalt', key: 'salt' },
            { id: 'featureAalt', key: 'aalt' },
            { id: 'featureSs01', key: 'ss01' },
            { id: 'featureSs02', key: 'ss02' },
            { id: 'featureTnum', key: 'tnum' },
            { id: 'featureDlig', key: 'dlig' }
        ];

        featureCheckboxes.forEach(({ id, key }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (this.host.currentEditingBlock) {
                        if (!this.host.currentEditingBlock.fontFeatures) {
                            this.host.currentEditingBlock.fontFeatures = {
                                salt: false,
                                aalt: false,
                                ss01: false,
                                ss02: false,
                                tnum: false,
                                dlig: false
                            };
                        }
                        this.host.currentEditingBlock.fontFeatures[key] = checkbox.checked;
                        this.host.updateGrid();
                    }
                });
            }
        });

    }


    initTextPresetChips() {
        const container = document.getElementById('textPresetChips');
        if (!container) return;

        const plusSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        TEXT_PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'text-preset-chip';
            btn.type = 'button';
            btn.setAttribute('aria-label', `Insert text: ${preset.label}`);
            btn.innerHTML = `${plusSvg}<span>${preset.label}</span>`;

            btn.addEventListener('click', () => {
                if (!this.host.currentEditingBlock || !this.host.dom.paragraphTextArea) return;

                this.host.historyManager.beginAction(`insert text preset: ${preset.label}`, this.host.getStateSnapshot());
                this.host.markAsChanged();

                this.host.dom.paragraphTextArea.value = preset.text;
                this.host.currentEditingBlock.content = preset.text;
                this.host.objectEditorPanelController.updateCharacterCount();
                this.host.updateGrid();

                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            });

            container.appendChild(btn);
        });
    }

}
