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
    if (moduleId === 'nac') {
        // Плавная прокрутка к секции калькулятора
        document.getElementById('calculator-section').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    } else {
        // Для других модулей показываем сообщение о разработке
        alert('Модуль находится в разработке');
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
    
    let text = 'Результаты расчета калькулятора Efros NAC\n';
    text += '==========================================\n\n';
    text += 'Конфигурация:\n';
    text += '• Количество устройств: ' + (inputs.devices || 'N/A') + '\n';
    text += '• Метод аутентификации: ' + (inputs.authMethod || 'N/A') + '\n';
    text += '• API Gateway: Включен (10% накладные расходы)\n';
    text += '• RADIUS Accounting: ' + (inputs.accountingEnabled ? 'Включен' : 'Отключен') + '\n';
    
    if (inputs.authMethod === 'EAP-TLS' && inputs.ocspEnabled !== undefined) {
        text += '• OCSP проверка: ' + (inputs.ocspEnabled ? 'Включена' : 'Отключена') + '\n';
    }
    if (inputs.authMethod === 'MAB' && inputs.spoofingEnabled !== undefined) {
        text += '• MAC-спуфинг защита: ' + (inputs.spoofingEnabled ? 'Включена' : 'Отключена') + '\n';
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
    
    // Используем современный API или фоллбэк
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() {
            alert('Результаты скопированы в буфер обмена');
        }).catch(function(err) {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
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
        alert('Результаты скопированы в буфер обмена');
    } catch (err) {
        alert('Не удалось скопировать в буфер обмена. Попробуйте выделить текст вручную.');
        console.error('Ошибка копирования:', err);
    }
    
    document.body.removeChild(textArea);
}