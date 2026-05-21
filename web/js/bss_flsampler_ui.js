import { app } from "../../../scripts/app.js";

// --- BSS Premium UI: Luxury Matte & Smart Widgets (v1.3.0) ---
// Создает изысканный, минималистичный дизайн в стиле премиальной аудиоаппаратуры для FLSampler.
// 100% корректное отзывчивое управление слайдерами (полоса на всю ширину по низу виджета).
// Никаких лишних разделителей в бэкграунде. 14px "воздуха" внизу ноды для гравировки.

// Инъекция глобальных стилей для мгновенного скрытия тултипов во время перетаскивания и регулировки
const style = document.createElement("style");
style.textContent = `
    .bss-dragging-active .comfy-tooltip,
    .bss-dragging-active .comfy-help-tooltip,
    .bss-dragging-active .litegraph-tooltip,
    .bss-dragging-active [tooltip] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
    }
`;
document.head.appendChild(style);

// Отслеживание клика мыши по всему окну для перетаскивания
window.addEventListener("pointerdown", () => {
    document.body.classList.add("bss-dragging-active");
}, { capture: true, passive: true });

window.addEventListener("pointerup", () => {
    document.body.classList.remove("bss-dragging-active");
}, { capture: true, passive: true });

window.addEventListener("pointercancel", () => {
    document.body.classList.remove("bss-dragging-active");
}, { capture: true, passive: true });

// Функция для полной блокировки и скрытия тултипов у виджета
function setupPremiumTooltipHandler(widget) {
    if (widget.tooltip !== undefined) {
        widget.tooltip = null;
    }
    Object.defineProperty(widget, "tooltip", {
        get() {
            return null;
        },
        set(val) {},
        configurable: true,
        enumerable: true
    });
}

// Функция для полного удаления всех тултипов у ноды (виджеты, входы, выходы)
function removeAllNodeTooltips(node) {
    if (node.widgets) {
        node.widgets.forEach(w => {
            setupPremiumTooltipHandler(w);
        });
    }
    if (node.inputs) {
        node.inputs.forEach(input => {
            input.tooltip = null;
        });
    }
    if (node.outputs) {
        node.outputs.forEach(output => {
            output.tooltip = null;
        });
    }
}

// Функция для форматирования числовых значений с правильной точностью
function formatDisplayValue(value, widget) {
    if (typeof value !== "number") return value;

    const name = String(widget?.name || "").toLowerCase();

    // Бронебойная проверка: для всех ключевых параметров гарантируем вывод сотых долей
    if (
        name.includes("threshold") ||
        name.includes("factor") ||
        name.includes("percent") ||
        name.includes("scale") ||
        name.includes("denoise") ||
        name.includes("cfg") ||
        name.includes("sharpness") ||
        name.includes("inertia") ||
        (widget?.options?.step !== undefined && widget.options.step < 0.1)
    ) {
        return value.toFixed(2);
    }

    // Для остальных параметров определяем точность по шагу
    const step = widget?.options?.step;
    if (typeof step === "number" && step > 0) {
        const stepStr = String(step);
        const dotIdx = stepStr.indexOf(".");
        if (dotIdx !== -1) {
            const precision = stepStr.length - dotIdx - 1;
            return value.toFixed(precision);
        }
    }

    // Если число не целое, выводим 2 знака по умолчанию
    if (!Number.isInteger(value)) {
        return value.toFixed(2);
    }

    return String(value);
}

// Применение премиум стилей к ноде
function applyBssLuxuryStyles(node) {
    node.bgcolor = "#0f0f0eff";     // Глубокий ультра-темный матовый графит
    node.color = "#0f0f0eff";       // Синхронизируем с bgcolor: убирает дублирующий темный шейп разъемов
    node.boxcolor = "rgba(212, 175, 55, 0.6)"; // Благородный золотой контур активной ноды (#d4af37)
    node.rounded = true;            // Аккуратные скругления углов
    node.title_font = "bold 11px 'Segoe UI', system-ui, sans-serif";
}

// --- КАСТОМНЫЕ РЕНДЕРЕРЫ ДЛЯ ВЕКТОРНЫХ ВИДЖЕТОВ ---

// Слайдер
function drawPremiumSlider(ctx, node, widget_width, y, margin, widget) {
    const height = widget.height || 20;
    const value = widget.value;
    const min = widget.options.min ?? 0;
    const max = widget.options.max ?? 100;
    const range = max - min;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));

    const x = margin;
    const slider_w = widget_width - margin * 2;
    const slider_y = y + height - 2;

    ctx.save();

    // 1. Имя параметра слева вверху
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.textAlign = "left";
    ctx.fillText(widget.label || widget.name, x, y + 11);

    // 2. Числовое значение справа вверху
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.textAlign = "right";
    const displayValue = formatDisplayValue(value, widget);
    ctx.fillText(displayValue, x + slider_w, y + 11);

    // 3. Тонкая подложка слайдера
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, slider_y);
    ctx.lineTo(x + slider_w, slider_y);
    ctx.stroke();

    // 4. Активная золотистая часть
    const active_x = x + ratio * slider_w;
    ctx.strokeStyle = "#d4af37"; // Яркое благородное золото
    ctx.beginPath();
    ctx.moveTo(x, slider_y);
    ctx.lineTo(active_x, slider_y);
    ctx.stroke();

    // 5. Круглый золотой бегунок-кноб
    ctx.fillStyle = "#e5c158";
    ctx.beginPath();
    ctx.arc(active_x, slider_y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Тоггл
function drawPremiumToggle(ctx, node, widget_width, y, margin, widget) {
    const height = widget.height || 20;
    const value = !!widget.value;

    const x = margin;
    const toggle_w = 24;
    const toggle_h = 12;
    const toggle_x = widget_width - margin - toggle_w;
    const toggle_y = y + (height - toggle_h) / 2;

    ctx.save();

    // 1. Имя параметра
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.textAlign = "left";
    ctx.fillText(widget.label || widget.name, x, y + 13);

    // 2. Овальный корпус тоггла
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(toggle_x, toggle_y, toggle_w, toggle_h, 6);
    } else {
        ctx.rect(toggle_x, toggle_y, toggle_w, toggle_h);
    }

    if (value) {
        ctx.fillStyle = "rgba(212, 175, 55, 0.85)";
    } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    }
    ctx.fill();

    // 3. Круглый белый бегунок
    const knob_r = 4;
    const knob_y = toggle_y + toggle_h / 2;
    const knob_x = value ? (toggle_x + toggle_w - knob_r - 2) : (toggle_x + knob_r + 2);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(knob_x, knob_y, knob_r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Комбо-бокс (Выпадающий список)
function drawPremiumCombo(ctx, node, widget_width, y, margin, widget) {
    const height = widget.height || 20;
    const value = widget.value;

    const x = margin;
    const combo_w = widget_width - margin * 2;
    const combo_h = height - 4;
    const combo_y = y + 2;

    ctx.save();

    // 1. Рамка комбо-бокса
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(212, 175, 55, 0.35)"; // Золотистый контур
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, combo_y, combo_w, combo_h, 4);
    } else {
        ctx.rect(x, combo_y, combo_w, combo_h);
    }
    ctx.fill();
    ctx.stroke();

    // 2. Название параметра
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    const labelText = (widget.label || widget.name) + ":";
    ctx.fillText(labelText, x + 8, combo_y + 11);

    // 3. Значение
    const label_w = ctx.measureText(labelText).width;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    let valText = String(value);
    const max_val_w = combo_w - label_w - 28;
    if (ctx.measureText(valText).width > max_val_w) {
        while (valText.length > 0 && ctx.measureText(valText + "...").width > max_val_w) {
            valText = valText.substring(0, valText.length - 1);
        }
        valText += "...";
    }
    ctx.fillText(valText, x + label_w + 12, combo_y + 11);

    // 4. Стрелочка
    ctx.fillStyle = "rgba(212, 175, 55, 0.85)"; // Золотая стрелочка
    ctx.beginPath();
    const arrow_x = x + combo_w - 10;
    const arrow_y = combo_y + 7;
    ctx.moveTo(arrow_x - 3, arrow_y - 1);
    ctx.lineTo(arrow_x + 3, arrow_y - 1);
    ctx.lineTo(arrow_x, arrow_y + 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// Числовой инпут
function drawPremiumNumber(ctx, node, widget_width, y, margin, widget) {
    const height = widget.height || 20;
    const value = widget.value;

    const x = margin;
    const box_w = widget_width - margin * 2;
    const box_h = height - 4;
    const box_y = y + 2;

    ctx.save();

    // 1. Рамка
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(212, 175, 55, 0.25)"; // Золотистая рамка инпута
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, box_y, box_w, box_h, 4);
    } else {
        ctx.rect(x, box_y, box_w, box_h);
    }
    ctx.fill();
    ctx.stroke();

    // 2. Имя параметра
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    const labelText = (widget.label || widget.name) + ":";
    ctx.fillText(labelText, x + 8, box_y + 11);

    // 3. Значение справа
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.textAlign = "right";
    ctx.fillText(String(value), x + box_w - 8, box_y + 11);

    ctx.restore();
}

// Применение кастомных отрисовщиков
function applyPremiumWidgetRenderers(node) {
    if (!node.widgets) return;
    
    removeAllNodeTooltips(node);

    node.widgets.forEach(widget => {
        const type = widget.type === "hidden" ? widget._original_type : widget.type;
        const lowerType = String(type || "").toLowerCase();
        const name = String(widget.name || "").toLowerCase();

        if (lowerType === "slider" || widget.options?.display === "slider" || name === "fovea_strength" || name === "sharpness" || name === "mask_inertia" || name === "denoise" || name === "cfg") {
            widget.draw = function (ctx, node, widget_width, y, margin) {
                drawPremiumSlider(ctx, node, widget_width, y, margin, this);
            };
        } else if (lowerType === "toggle" || typeof widget.value === "boolean") {
            widget.draw = function (ctx, node, widget_width, y, margin) {
                drawPremiumToggle(ctx, node, widget_width, y, margin, this);
            };
        } else if (lowerType === "combo") {
            widget.draw = function (ctx, node, widget_width, y, margin) {
                drawPremiumCombo(ctx, node, widget_width, y, margin, this);
            };
        } else if (lowerType === "number" || lowerType === "int" || lowerType === "float" || lowerType === "integer" || widget.options?.display === "number" || name === "steps" || name === "seed") {
            widget.draw = function (ctx, node, widget_width, y, margin) {
                drawPremiumNumber(ctx, node, widget_width, y, margin, this);
            };
        }
    });
}

app.registerExtension({
    name: "BSS.FLSamplerUI",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FLS_SamplerV4") {

            // --- Добавляем 14px свободного места внизу для гравировки (только в развернутом виде) ---
            const origComputeSize = nodeType.prototype.computeSize;
            nodeType.prototype.computeSize = function () {
                const size = origComputeSize ? origComputeSize.apply(this, arguments) : [220, 100];
                if (!this.flags?.collapsed) {
                    size[1] += 14;
                }
                return size;
            };

            // --- 1. ХУК НА СОЗДАНИЕ НОДЫ ---
            const origOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (origOnNodeCreated) {
                    origOnNodeCreated.apply(this, arguments);
                }
                applyBssLuxuryStyles(this);
                setTimeout(() => {
                    applyPremiumWidgetRenderers(this);
                }, 60);
            };

            // --- 2. ХУК НА ЗАГРУЗКУ ИЗ JSON ---
            const origOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                if (origOnConfigure) {
                    origOnConfigure.apply(this, arguments);
                }
                applyBssLuxuryStyles(this);
                applyPremiumWidgetRenderers(this);
                this.setSize(this.computeSize());
            };

            // --- 3. ОТРИСОВКА ЗАДНЕГО ФОНА ---
            const origOnDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function (ctx, canvas) {
                applyPremiumWidgetRenderers(this);

                if (origOnDrawBackground) {
                    origOnDrawBackground.apply(this, arguments);
                }

                if (this.flags?.collapsed) return;

                // Рисуем золотистый разделитель ровно над первым виджетом
                if (this.widgets && this.widgets.length > 0 && this.widgets_start_y !== undefined) {
                    ctx.save();
                    const dividerY = this.widgets_start_y - 8;
                    ctx.strokeStyle = "rgba(212, 175, 55, 0.35)"; // Полупрозрачное благородное золото
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(12, dividerY);
                    ctx.lineTo(this.size[0] - 12, dividerY);
                    ctx.stroke();
                    ctx.restore();
                }
            };

            // --- 4. ОТРИСОВКА ПЕРЕДНЕГО ПЛАНА (Гравировка на свободном месте снизу) ---
            const origOnDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function (ctx, canvas) {
                if (origOnDrawForeground) {
                    origOnDrawForeground.apply(this, arguments);
                }

                if (this.flags?.collapsed) return;

                ctx.save();
                // Гравировка бренда "BSS OPTIMIZED" в правом нижнем углу на свободном месте (14px отступа)
                ctx.font = "italic bold 7px 'Segoe UI', system-ui, sans-serif";
                ctx.fillStyle = "rgba(212, 175, 55, 0.45)"; // Золотой цвет гравировки
                ctx.textAlign = "right";
                ctx.letterSpacing = "0.5px";
                ctx.fillText("BSS OPTIMIZED", this.size[0] - 10, this.size[1] - 8);
                ctx.restore();
            };
        }
    }
});
