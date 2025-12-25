// Основной JavaScript для калькулятора Efros NAC

// Обновление зависимостей accounting/spoofing для интеграции с hybrid.js
function updateAccountingDependency() {
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    if (!accountingCheckbox) return;
    
    const accountingEnabled = accountingCheckbox.checked;
    const spoofingCheckbox = document.getElementById('hybridSpoofingEnabled');
    const spoofingWarning = document.getElementById('spoofingWarning');
    
    // Если accounting отключен, отключаем MAC-споofing и показываем предупреждение
    if (!accountingEnabled && spoofingCheckbox && spoofingCheckbox.checked) {
        spoofingCheckbox.checked = false;
        if (spoofingWarning) {
            spoofingWarning.style.display = 'block';
            setTimeout(() => {
                spoofingWarning.style.display = 'none';
            }, 3000);
        }
    }
    
    // Вызываем hybrid.js функцию для перерасчета
    if (window.performHybridCalculation) {
        performHybridCalculation();
    }
}

function updateSpoofingDependency() {
    const spoofingCheckbox = document.getElementById('hybridSpoofingEnabled');
    if (!spoofingCheckbox) return;
    
    const spoofingEnabled = spoofingCheckbox.checked;
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    const spoofingWarning = document.getElementById('spoofingWarning');
    
    // Если включаем MAC-spoofing, но accounting выключен - включаем accounting
    if (spoofingEnabled && accountingCheckbox && !accountingCheckbox.checked) {
        accountingCheckbox.checked = true;
        if (spoofingWarning) {
            spoofingWarning.style.display = 'block';
            spoofingWarning.innerHTML = '<strong>ℹ️ Информация:</strong> RADIUS Accounting автоматически включен, так как требуется для MAC-спуфинг защиты.';
            setTimeout(() => {
                spoofingWarning.style.display = 'none';
            }, 3000);
        }
    }
    
    // Вызываем hybrid.js функцию для перерасчета
    if (window.performHybridCalculation) {
        performHybridCalculation();
    }
}

// Функция preset из index.html
function applyPreset(presetType) {
    const deviceInput = document.getElementById('hybridDevices');
    
    // Убираем активный класс со всех preset cards
    document.querySelectorAll('.preset-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Добавляем активный класс к выбранной карточке
    event.target.closest('.preset-card').classList.add('active');
    
    // Устанавливаем значения в зависимости от типа
    switch(presetType) {
        case 'small':
            deviceInput.value = 1500;
            break;
        case 'medium':
            deviceInput.value = 8000;
            break;
        case 'enterprise':
            deviceInput.value = 15000;
            break;
    }
    
    // Вызываем перерасчет
    if (window.performHybridCalculation) {
        performHybridCalculation();
    }
}

// Функция для сворачивания/разворачивания расширенных настроек
function toggleAdvanced() {
    const content = document.getElementById('advancedContent');
    const icon = document.querySelector('.expand-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(90deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// Функция для выбора модуля
function selectModule(moduleId) {
    const moduleCard = document.getElementById(`${moduleId}-module`);
    const moduleButton = document.getElementById(`${moduleId}-module-button`);
    
    // Переключаем выбранное состояние модуля
    if (moduleCard.classList.contains('selected')) {
        // Если модуль уже выбран - отменяем выбор
        moduleCard.classList.remove('selected');
        updateModuleButtonState(moduleId, false);
    } else {
        // Выбираем модуль
        moduleCard.classList.add('selected');
        updateModuleButtonState(moduleId, true);
    }
    
    // Обновляем видимость секций калькулятора
    updateCalculatorSections();
    
    // Если хотя бы один модуль выбран, прокручиваем к секции калькулятора
    if (isAnyModuleSelected()) {
        document.getElementById('calculator-section').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Функция для обновления состояния кнопок модулей
function updateModuleButtonState(moduleId, isSelected) {
    const button = document.getElementById(`${moduleId}-module-button`);
    const features = document.querySelectorAll(`#${moduleId}-module .feature-check, #${moduleId}-module .feature-text`);
    
    if (isSelected) {
        button.classList.add('module-button-active');
        button.textContent = 'Модуль активен';
        features.forEach(feature => {
            if (feature.classList.contains('feature-check')) {
                feature.classList.add('feature-check-active');
            } else {
                feature.classList.add('feature-text-active');
            }
        });
    } else {
        button.classList.remove('module-button-active');
        button.textContent = 'Настроить параметры';
        features.forEach(feature => {
            feature.classList.remove('feature-check-active', 'feature-text-active');
        });
    }
}

// Функция для проверки выбранности модулей
function isAnyModuleSelected() {
    return document.querySelector('.module-card.selected') !== null;
}

function isNACSelected() {
    return document.getElementById('nac-module').classList.contains('selected');
}

function isCISelected() {
    return document.getElementById('ci-module').classList.contains('selected');
}

// Функция для обновления видимости секций калькулятора
function updateCalculatorSections() {
    const ciSection = document.getElementById('ciSection');
    
    if (isCISelected()) {
        ciSection.style.display = 'block';
    } else {
        ciSection.style.display = 'none';
        
        // Автоматически переключаемся на NAC таб при снятии выделения с CI модуля
        if (window.switchInfoTab) {
            window.switchInfoTab('nac');
        }
    }
    
    // Обновляем состояние CI таба
    if (window.updateCITabState) {
        window.updateCITabState();
    }
    
    // Обновляем расчеты при изменении модулей
    if (window.performHybridCalculation && isAnyModuleSelected()) {
        performHybridCalculation();
    }
}

// Функция копирования результатов в буфер обмена
function copyToClipboard() {
    if (!window.lastCalculationResults) {
        alert('Сначала выполните расчет');
        return;
    }
    
    const results = window.lastCalculationResults;
    const inputs = getHybridInputValues ? getHybridInputValues() : {};
    
    // Получаем данные CI если модуль активен
    const isCIEnabled = window.isCISelected && window.isCISelected();
    const ciData = isCIEnabled ? window.getCIData && window.getCIData() : null;
    
    let text = 'Результаты расчета калькулятора Efros NAC\n';
    text += '==========================================\n\n';
    text += 'Конфигурация:\n';
    text += '• Количество устройств: ' + (inputs.devices || 'N/A') + '\n';
    text += '• Метод аутентификации: ' + (inputs.authMethod || 'N/A') + '\n';
    
    if (inputs.authMethod === 'EAP-TLS' && inputs.ocspEnabled !== undefined) {
        text += '• OCSP проверка: ' + (inputs.ocspEnabled ? 'Включена' : 'Отключена') + '\n';
    }
    if (inputs.authMethod === 'MAB' && inputs.spoofingEnabled !== undefined) {
        text += '• MAC-спуфинг защита: ' + (inputs.spoofingEnabled ? 'Включена' : 'Отключена') + '\n';
    }
    if (isCIEnabled) {
        text += '• Config Inspector (CI): Включен - мониторинг конфигураций устройств\n';
    }
    
    text += '\nБИЗНЕС-ПОКАЗАТЕЛИ:\n';
    text += '• Минимальное количество подов: ' + results.minPods + '\n';
    text += '• Рекомендуемое количество подов: ' + results.recommendedPods + '\n';
    text += '• CPU на ноду: ' + results.nodeCpu + ' vCPU\n';
    text += '• Память на ноду: ' + results.nodeMemory + ' ГБ\n';
    text += '• Хранилище на ноду: ' + results.nodeStorage + ' ГБ\n';
    text += '• Общий CPU на кластер: ' + results.totalCpu + ' vCPU\n';
    text += '• Общая память на кластер: ' + results.totalMemory + ' ГБ\n';
    
    text += '\nТЕХНИЧЕСКИЕ ПОКАЗАТЕЛИ:\n';
    text += '• Целевой RPS: ' + results.targetRps + ' запросов/сек\n';
    text += '• RPS на под: ' + results.rpsPerPod + '\n';
    text += '• CPU лимит на под: ' + results.podCpuLimit + ' mCPU\n';
    text += '• Память лимит на под: ' + results.podMemLimit + ' MiB\n';
    
    if (results.dbRequirements) {
        text += '\nТРЕБОВАНИЯ К БД:\n';
        text += '• CPU БД: ' + results.dbRequirements.cpu + ' vCPU\n';
        text += '• Память БД: ' + results.dbRequirements.memory + ' ГБ\n';
        text += '• Хранилище БД: ' + results.dbRequirements.storage + ' ГБ\n';
    }
    
    // Добавляем информацию о CI если модуль включен
    if (isCIEnabled && ciData) {
        text += '\nCONFIG INSPECTOR (CI):\n';
        text += '• Устройств под управлением: ' + (ciData.totalDevices || 0) + ' шт\n';
        text += '• Потребление CPU: ' + (ciData.cpuUsageMax || 0).toFixed(1) + ' vCPU на кластер\n';
        text += '• Потребление памяти: ' + (ciData.memoryUsageMax || 0).toFixed(1) + ' ГБ на кластер\n';
        text += '• Время выполнения отчетов (первичных): ' + (ciData.reportTimePrimary || 0).toFixed(2) + ' ч\n';
        text += '• Время выполнения отчетов (вторичных): ' + (ciData.reportTimeSecondary || 0).toFixed(2) + ' ч\n';
    }
    
    // Используем современный API или фоллбэк
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() {
            showToast('Результаты скопированы в буфер обмена');
        }).catch(function(err) {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Функция показа toast уведомлений
function showToast(message, type = 'success') {
    // Удаляем существующие toast если есть
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Создаем новый toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Иконки для разных типов
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type] || icons.success}</span>
            <span>${message}</span>
        </div>
    `;
    
    // Добавляем в DOM
    document.body.appendChild(toast);
    
    // Показываем с анимацией
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// Фоллбэк функция для копирования
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-999999px";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('Результаты скопированы в буфер обмена');
    } catch (err) {
        showToast('Не удалось скопировать в буфер обмена. Попробуйте выделить текст вручную.', 'error');
        console.error('Ошибка копирования:', err);
    }
    
    document.body.removeChild(textArea);
}

// Экспортируем функцию для глобального использования
window.showToast = showToast;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Устанавливаем начальное состояние CI таба
    if (window.updateCITabState) {
        window.updateCITabState();
    }
});