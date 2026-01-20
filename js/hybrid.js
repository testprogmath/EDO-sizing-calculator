let hybridSelectedMethod = '';

// Load logo SVG from images at runtime to ensure full asset is used
async function loadLogoSvg() {
    try {
        const res = await fetch('images/efros-logo.svg');
        if (res.ok) {
            return await res.text();
        }
    } catch (e) {
        console.warn('Failed to load logo SVG, will skip header:', e);
    }
    // Fallback minimal mark if asset not available
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#24A7B3"/></svg>`;
}

// Legacy inline (truncated) is removed; always use loaded SVG from images/efros-logo.svg

document.addEventListener('DOMContentLoaded', function() {
    setupScenarioCards();
    setupInputListeners();
    
    // После setupScenarioCards() hybridSelectedMethod должен быть 'MAB'
    
    // Устанавливаем accounting включенным по умолчанию для всех методов
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    if (accountingCheckbox) {
        accountingCheckbox.checked = true; // Всегда включен по умолчанию
    }
    
    // Показываем опцию MAC-спуфинга для MAB (который выбран по умолчанию)
    const spoofingOption = document.getElementById('spoofingOption');
    if (spoofingOption && hybridSelectedMethod === 'MAB') {
        spoofingOption.style.display = 'flex';
    }
    
    // Проверяем видимость дополнительных опций при загрузке
    updateAdditionalOptionsVisibility();
    
    // Инициализируем превью и выполняем начальный расчет
    updatePreview();
    
    // Если NAC модуль выбран, показываем NAC таб и делаем начальный расчет
    if (window.isNACSelected && window.isNACSelected()) {
        switchInfoTab('nac');
        performHybridCalculation(); // Начальный расчет с MAB
    }
});

function setupScenarioCards() {
    const pills = document.querySelectorAll('.scenario-pill');
    
    // Устанавливаем начальный метод
    hybridSelectedMethod = 'MAB';
    
    pills.forEach(pill => {
        pill.addEventListener('click', function() {
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            
            hybridSelectedMethod = this.dataset.method;
            
            // Показываем/скрываем OCSP
            const ocspOption = document.getElementById('ocspOption');
            if (ocspOption) {
                if (hybridSelectedMethod === 'EAP-TLS' || hybridSelectedMethod === 'EAP-TEAP') {
                    ocspOption.style.display = 'flex';
                } else {
                    ocspOption.style.display = 'none';
                    const ocspCheckbox = document.getElementById('hybridOcspEnabled');
                    if (ocspCheckbox) {
                        ocspCheckbox.checked = false;
                    }
                }
            }
            
            // Устанавливаем значения по умолчанию для Accounting
            const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
            const spoofingOption = document.getElementById('spoofingOption');
            const spoofingCheckbox = document.getElementById('hybridSpoofingEnabled');
            
            if (spoofingOption) {
                if (hybridSelectedMethod === 'MAB') {
                    if (accountingCheckbox) accountingCheckbox.checked = true; // всегда включен
                    spoofingOption.style.display = 'flex'; // показываем опцию MAC-спуфинга
                } else {
                    if (accountingCheckbox) accountingCheckbox.checked = true; // всегда включен для всех методов
                    spoofingOption.style.display = 'none'; // скрываем опцию MAC-спуфинга
                    if (spoofingCheckbox) spoofingCheckbox.checked = false; // сбрасываем чекбокс
                }
            }
            
            // Проверяем и обновляем видимость секции дополнительных опций
            updateAdditionalOptionsVisibility();
            
            // Обновляем превью и пересчитываем
            updatePreview();
            performHybridCalculation();
        });
    });
}

function setupInputListeners() {
    const inputs = document.querySelectorAll('#hybridDevices, #hybridConcurrent, #hybridBurstWindow, #hybridHeadroom, #hybridNodeCount, #hybridAuthAttemptsPerDay, #hybridRetentionDays, #hybridDbHeadroom');
    const checkboxes = document.querySelectorAll('#hybridOcspEnabled, #hybridAccountingEnabled, #hybridSpoofingEnabled');
    
    // Специальный обработчик для поля устройств
    const devicesInput = document.getElementById('hybridDevices');
    devicesInput.addEventListener('input', function() {
        const devices = parseInt(this.value);
        // Скрываем предупреждение только если устройств стало ≤ 20000
        if (devices <= 20000) {
            hideScalingWarning();
        }
    });
    
    inputs.forEach(input => {
        input.addEventListener('change', function() {
            updatePreview();
            performHybridCalculation(); // Автоматический пересчет
        });
        
        // Также слушаем input для живого обновления
        input.addEventListener('input', function() {
            updatePreview();
        });
    });
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Специальная логика для MAC-спуфинга
            if (this.id === 'hybridSpoofingEnabled' && this.checked) {
                // Если включаем MAC-спуфинг, автоматически включаем аккаунтинг
                document.getElementById('hybridAccountingEnabled').checked = true;
                document.getElementById('hybridAccountingEnabled').disabled = true; // блокируем отключение
            } else if (this.id === 'hybridSpoofingEnabled' && !this.checked) {
                // Если выключаем MAC-спуфинг, разблокируем аккаунтинг
                document.getElementById('hybridAccountingEnabled').disabled = false;
            }
            
            // Специальная логика для аккаунтинга
            if (this.id === 'hybridAccountingEnabled' && !this.checked) {
                // Если пытаемся выключить аккаунтинг, проверяем MAC-спуфинг
                const spoofingEnabled = document.getElementById('hybridSpoofingEnabled').checked;
                if (spoofingEnabled) {
                    // Блокируем отключение аккаунтинга если включен MAC-спуфинг
                    this.checked = true;
                    alert('Нельзя отключить аккаунтинг при включенной защите от MAC-спуфинга');
                    return;
                }
            }
            
            updatePreview();
            performHybridCalculation(); // Автоматический пересчет
        });
    });
}

function applyPreset(type) {
    const presets = {
        'small': { 
            devices: 2000, 
            concurrent: 25, 
            burst: 60, 
            headroom: 30, 
            nodes: 3,
            method: 'MAB'
        },
        'medium': { 
            devices: 8000, 
            concurrent: 30, 
            burst: 60, 
            headroom: 25, 
            nodes: 3,
            method: 'PEAP'
        },
        'enterprise': { 
            devices: 15000, 
            concurrent: 35, 
            burst: 45, 
            headroom: 20, 
            nodes: 5,
            method: 'EAP-TLS'
        }
    };
    
    const preset = presets[type];
    if (!preset) return;
    
    // Применяем значения
    document.getElementById('hybridDevices').value = preset.devices;
    document.getElementById('hybridConcurrent').value = preset.concurrent;
    document.getElementById('hybridBurstWindow').value = preset.burst;
    document.getElementById('hybridHeadroom').value = preset.headroom;
    document.getElementById('hybridNodeCount').value = preset.nodes;
    
    // Выбираем сценарий
    document.querySelectorAll('.scenario-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.dataset.method === preset.method) {
            pill.classList.add('active');
            hybridSelectedMethod = preset.method;
        }
    });
    
    // Показываем/скрываем OCSP и MAC-спуфинг
    const ocspOption = document.getElementById('ocspOption');
    const spoofingOption = document.getElementById('spoofingOption');

    if (ocspOption) {
        if (hybridSelectedMethod === 'EAP-TLS' || hybridSelectedMethod === 'EAP-TEAP') {
            ocspOption.style.display = 'flex';
        } else {
            ocspOption.style.display = 'none';
        }
    }
    
    if (spoofingOption) {
        if (hybridSelectedMethod === 'MAB') {
            spoofingOption.style.display = 'flex';
        } else {
            spoofingOption.style.display = 'none';
        }
    }
    
    // Устанавливаем значения по умолчанию для Accounting
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    if (accountingCheckbox) {
        accountingCheckbox.checked = true; // всегда включен по умолчанию для всех методов
    }
    
    // Проверяем видимость дополнительных опций после применения пресета
    updateAdditionalOptionsVisibility();
    
    updatePreview();
    performHybridCalculation(); // Пересчитываем после применения пресета
}

function toggleAdvanced() {
    const content = document.getElementById('advancedContent');
    const icon = document.querySelector('.expand-icon');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        icon.classList.remove('rotated');
    } else {
        content.classList.add('expanded');
        icon.classList.add('rotated');
    }
}

function toggleNacDetails() {
    const content = document.getElementById('nacDetailsContent');
    const icon = document.getElementById('nacDetailsIcon');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        icon.textContent = '▶';
    } else {
        content.classList.add('expanded');
        icon.textContent = '▼';
    }
}

function updateAdditionalOptionsVisibility() {
    const additionalOptionsSection = document.querySelector('.additional-options');
    const ocspOption = document.getElementById('ocspOption');
    const spoofingOption = document.getElementById('spoofingOption');
    
    if (!additionalOptionsSection) return;
    
    // Проверяем, есть ли видимые опции
    let hasVisibleOptions = false;
    
    if (ocspOption && ocspOption.style.display === 'flex') {
        hasVisibleOptions = true;
    }
    
    if (spoofingOption && spoofingOption.style.display === 'flex') {
        hasVisibleOptions = true;
    }
    
    // Показываем/скрываем всю секцию в зависимости от наличия опций
    if (hasVisibleOptions) {
        additionalOptionsSection.style.display = 'block';
    } else {
        additionalOptionsSection.style.display = 'none';
    }
}

function updatePreview() {
    // Функция оставлена для возможных будущих обновлений UI
}

function showScalingWarning(devices, recommendedNodes) {
    const warningDiv = document.getElementById('scalingWarning');
    const messageDiv = document.getElementById('scalingMessage');
    
    // Если элементы существуют, показываем красивое предупреждение
    if (warningDiv && messageDiv) {
        let rangeText = '';
        let reason = '';
        let additionalWarning = '';
        
        if (recommendedNodes === 3) {
            rangeText = '3 узла';
            reason = 'оптимальная конфигурация для данного количества устройств';
        } else if (recommendedNodes === 5) {
            rangeText = '5-6 узлов';
            reason = 'требуется дополнительная мощность для обработки нагрузки';
        } else if (recommendedNodes === 7) {
            rangeText = '7-8 узлов';
            reason = 'высокая нагрузка требует распределения по большему количеству узлов';
        } else if (recommendedNodes === 9) {
            rangeText = '9-10 узлов';
            reason = 'критическая нагрузка требует максимального распределения';
        } else {
            rangeText = `${recommendedNodes} узлов`;
            reason = 'необходимо для обеспечения производительности';
        }
        
        // Добавляем предупреждение для больших инсталляций
        if (devices > 30000) {
            additionalWarning = `<br><br>
            <strong style="color: #ff6b35;">⚠️ ВНИМАНИЕ:</strong> Для инсталляций более 30,000 устройств расчёт является <strong>приблизительным</strong>. 
            <strong>Требуется проверка и валидация инженерной командой</strong> на ${recommendedNodes} узлах перед развертыванием в продуктивной среде.`;
        }
        
        messageDiv.innerHTML = `
            Для <strong>${devices.toLocaleString()}</strong> устройств автоматически установлено <strong>${recommendedNodes} узлов</strong>.<br>
            <strong>Причина:</strong> ${reason}.<br>
            <strong>Рекомендация:</strong> Используйте <strong>${rangeText}</strong> для оптимальной производительности и отказоустойчивости.
            ${additionalWarning}
        `;
        
        warningDiv.style.display = 'block';
        
        // Для больших инсталляций показываем предупреждение дольше
        const timeout = devices > 30000 ? 15000 : 10000;
        setTimeout(() => {
            warningDiv.style.display = 'none';
        }, timeout);
    } else {
        // Если элементов нет, показываем alert
        let message = `Для ${devices.toLocaleString()} устройств количество узлов автоматически изменено на ${recommendedNodes} для обеспечения оптимальной производительности при лимите 2500 mCPU на под.`;
        
        if (devices > 30000) {
            message += `\n\n⚠️ ВНИМАНИЕ: Для инсталляций более 30,000 устройств расчёт является приблизительным. Требуется проверка инженерной командой на ${recommendedNodes} узлах.`;
        }
        
        alert(message);
    }
}

function hideScalingWarning() {
    const warningDiv = document.getElementById('scalingWarning');
    warningDiv.style.display = 'none';
}

function getHybridInputValues() {
    // Если метод не выбран, используем MAB по умолчанию
    if (!hybridSelectedMethod) {
        hybridSelectedMethod = 'MAB';
    }
    
    const devices = parseInt(document.getElementById('hybridDevices').value);
    let nodeCount = parseInt(document.getElementById('hybridNodeCount').value);
    
    // Автоматическое масштабирование узлов на основе количества устройств
    // С учетом реальной нагрузки и лимита 2500 mCPU на под
    // При MAB с Accounting один под может обработать ~18 RPS
    // При 30% concurrent и 60 сек burst: 1000 устройств = 5 RPS, 20000 = 100 RPS
    
    let recommendedNodes = nodeCount;
    let needsScaling = false;
    
    // Упрощенная формула: каждые 20-23К устройств требуют +2 узла
    // Это учитывает реальную нагрузку с запасом
    if (devices <= 23000) {
        // До 23000 устройств - 3 узла (комфортно для большинства сценариев)
        recommendedNodes = 3;
    } else if (devices <= 46000) {
        // 23001-46000 устройств - минимум 5 узлов
        recommendedNodes = 5;
    } else if (devices <= 69000) {
        // 46001-69000 устройств - минимум 7 узлов
        recommendedNodes = 7;
    } else {
        // Более 69000 устройств - минимум 9 узлов
        recommendedNodes = 9;
    }
    
    // Проверяем, нужно ли изменить количество узлов
    if (nodeCount < recommendedNodes) {
        needsScaling = true;
        nodeCount = recommendedNodes;
        
        // Обновляем dropdown
        const nodeSelect = document.getElementById('hybridNodeCount');
        const currentValue = parseInt(nodeSelect.value);
        if (currentValue !== recommendedNodes) {
            nodeSelect.value = recommendedNodes;
            // Показываем предупреждение с правильным сообщением
            showScalingWarning(devices, recommendedNodes);
        }
    }
    
    // Получаем параметры для расчёта хранилища БД
    const authAttemptsPerDayEl = document.getElementById('hybridAuthAttemptsPerDay');
    const retentionDaysEl = document.getElementById('hybridRetentionDays');
    const dbHeadroomEl = document.getElementById('hybridDbHeadroom');

    const authAttemptsPerDay = authAttemptsPerDayEl ? parseInt(authAttemptsPerDayEl.value) || 2 : 2;
    const retentionDays = retentionDaysEl ? parseInt(retentionDaysEl.value) || 14 : 14;
    const dbHeadroom = dbHeadroomEl ? parseInt(dbHeadroomEl.value) || 20 : 20;

    return {
        devices: devices,
        authMethod: hybridSelectedMethod,
        ocspEnabled: document.getElementById('hybridOcspEnabled').checked,
        accountingEnabled: document.getElementById('hybridAccountingEnabled').checked,
        spoofingEnabled: document.getElementById('hybridSpoofingEnabled').checked,
        concurrentPct: parseFloat(document.getElementById('hybridConcurrent').value),
        burstWindow: parseInt(document.getElementById('hybridBurstWindow').value),
        headroom: parseFloat(document.getElementById('hybridHeadroom').value),
        gatewayEnabled: true,  // Всегда включен
        gatewayOverhead: 10,   // Всегда 10%
        nodeCount: nodeCount,
        authAttemptsPerDay: authAttemptsPerDay,
        retentionDays: retentionDays,
        dbHeadroom: dbHeadroom
    };
}

async function performHybridCalculation() {
    try {
        const inputs = getHybridInputValues();
        console.log('Hybrid inputs:', inputs);
        
        // Получаем данные CI если модуль включен
        let ciData = null;
        if (window.isCIEnabled && window.isCIEnabled()) {
            console.log('CI module enabled, fetching CI data...');
            ciData = await window.calculateCIResources();
            console.log('CI data:', ciData);
        }
        
        // Выполняем расчеты с учетом CI данных
        const results = performCalculations(inputs, ciData);
        console.log('Calculation results:', results);
        
        displayHybridResults(results, ciData);
    } catch (error) {
        console.error('Error in hybrid calculation:', error);
        // Показываем ошибку пользователю
        if (window.showToast) {
            window.showToast('Ошибка расчета: ' + error.message, 'error');
        } else {
            alert('Ошибка расчета: ' + error.message);
        }
    }
}

function displayHybridResults(results, ciData = null) {
    // Бизнес-показатели - таблица требований к аппаратному обеспечению
    const inputs = getHybridInputValues();
    
    // Показываем/скрываем предупреждение для больших инсталляций
    const largeInstallWarning = document.getElementById('largeInstallationWarning');
    if (largeInstallWarning) {
        if (inputs.devices > 30000) {
            largeInstallWarning.style.display = 'block';
            largeInstallWarning.innerHTML = `
                <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 15px 0;">
                    <strong style="color: #ff6b35;">⚠️ Внимание: Крупная инсталляция</strong><br>
                    Для ${inputs.devices.toLocaleString()} устройств расчёт является <strong>приблизительным</strong>.<br>
                    <strong>Обязательно требуется проверка и валидация инженерной командой</strong> на ${inputs.nodeCount} узлах перед развертыванием.
                </div>
            `;
        } else {
            largeInstallWarning.style.display = 'none';
        }
    }
    
    // Рассчитываем общие требования к серверу комплекса (все ноды)
    const serverTotalCpu = results.totalCpu; // уже рассчитано в calculator.js
    const serverTotalMemory = results.totalMemory; // уже рассчитано в calculator.js
    const serverTotalStorage = results.nodeStorage * inputs.nodeCount;
    // Обновляем строку "Система (кластер из N узлов)"
    const sysEl = document.getElementById('businessSystemNodes');
    if (sysEl) sysEl.textContent = inputs.nodeCount;
    
    document.getElementById('hybridServerCpu').textContent = serverTotalCpu;
    document.getElementById('hybridServerMemory').textContent = serverTotalMemory;
    document.getElementById('hybridServerStorage').textContent = serverTotalStorage;

    // Расчёт и отображение объёма данных о сессиях
    if (typeof calculateSessionStorageRequirements === 'function') {
        const storageReqs = calculateSessionStorageRequirements(inputs);
        const sessionStorageEl = document.getElementById('hybridSessionStorageGb');
        if (sessionStorageEl) {
            // Показываем общий объём на весь кластер, округлённый до 2 знаков
            sessionStorageEl.textContent = storageReqs.sessionStorageGb.toFixed(2);
        }
    }
    document.getElementById('hybridDbCpu').textContent = results.dbRequirements.cpu;
    document.getElementById('hybridDbMemory').textContent = results.dbRequirements.memory;
    document.getElementById('hybridDbStorage').textContent = results.dbRequirements.storage;
    
    // Технические показатели
    document.getElementById('hybridResultNodes').textContent = inputs.nodeCount;
    document.getElementById('hybridNodeCpu').textContent = results.nodeCpu;
    document.getElementById('hybridNodeMemory').textContent = results.nodeMemory;
    document.getElementById('hybridPods').textContent = results.recommendedPods;
    document.getElementById('hybridPodCpuLimit').textContent = results.podCpuLimit;
    document.getElementById('hybridPodMemLimit').textContent = results.podMemLimit;
    document.getElementById('hybridTargetRps').textContent = results.targetRps;
    document.getElementById('hybridRpsPerPod').textContent = Math.round(results.rpsPerPod * 10) / 10; // Округляем до 1 знака
    document.getElementById('hybridDbLoad').textContent = results.dbRequirements.dbLoad;
    
    // Проверяем, превышает ли CPU лимит стандартное значение 2500 mCPU
    const cpuLimitWarning = document.getElementById('cpuLimitWarning');
    if (cpuLimitWarning) {
        if (results.podCpuLimit > 2500) {
            const podsWithStandardLimit = Math.ceil(results.targetRps / (2500 / (results.podCpuLimit / results.rpsPerPod)));
            cpuLimitWarning.style.display = 'block';
            cpuLimitWarning.innerHTML = `
                <strong style="color: #ff6b35;">⚠️ Внимание:</strong> Рекомендуемый CPU лимит (${results.podCpuLimit} mCPU) превышает стандартное значение 2500 mCPU.<br>
                <strong>Варианты решения:</strong><br>
                • Использовать рекомендуемый лимит ${results.podCpuLimit} mCPU для ${results.recommendedPods} подов<br>
                • Или увеличить количество подов до ${podsWithStandardLimit} с лимитом 2500 mCPU на каждый
            `;
        } else {
            cpuLimitWarning.style.display = 'none';
        }
    }
    
    // Отображение результатов CI калькулятора
    const ciInfoSection = document.getElementById('ciInfoSection');
    if (ciData && ciInfoSection) {
        // Обновляем значения в CI результатах с правильными IDs
        const ciDevicesTotal = document.getElementById('ciDevicesTotal');
        const ciCpuLoad = document.getElementById('ciCpuLoad');
        const ciMemoryLoad = document.getElementById('ciMemoryLoad');
        const ciReportPrimary = document.getElementById('ciReportTimePrimary');
        const ciReportSecondary = document.getElementById('ciReportTimeSecondary');
        
        if (ciDevicesTotal) ciDevicesTotal.textContent = ciData.totalDevices || 0;
        if (ciCpuLoad) ciCpuLoad.textContent = (ciData.cpuUsageMax || 0).toFixed(1);
        if (ciMemoryLoad) ciMemoryLoad.textContent = (ciData.memoryUsageMax || 0).toFixed(1);
        // API уже возвращает время в часах
        if (ciReportPrimary) ciReportPrimary.textContent = (ciData.reportTimePrimary || 0).toFixed(2);
        if (ciReportSecondary) ciReportSecondary.textContent = (ciData.reportTimeSecondary || 0).toFixed(2);
        
        console.log('📊 CI Results displayed:', ciData);
    }
    
    // Выводим детализацию модуля NAC в консоль для разработчиков
    if (results.nacRadiusDetails) {
        console.group('%c🔧 NAC Module Technical Details', 'color: #24A7B3; font-size: 16px; font-weight: bold');
        
        console.group('%c📊 Memory Analysis (per node/узел)', 'color: #02A7B6; font-size: 14px');
        console.table({
            'NAC Module': {
                'Memory (GB)': results.nacRadiusDetails.rawNacMemoryGiB,
                'Percentage': results.nacRadiusDetails.nacMemoryPercent + '%'
            },
            'System Resources': {
                'Memory (GB)': results.nacRadiusDetails.baselineMemoryGiB,
                'Percentage': results.nacRadiusDetails.baselineMemoryPercent + '%'
            },
            'Total Calculated': {
                'Memory (GB)': results.nacRadiusDetails.totalCalculatedMemory,
                'Percentage': '100%'
            },
            'Final (Rounded)': {
                'Memory (GB)': results.nacRadiusDetails.finalRoundedMemory,
                'Percentage': '-'
            }
        });
        console.groupEnd();
        
        console.group('%c⚡ CPU Analysis (per node/узел)', 'color: #02A7B6; font-size: 14px');
        console.table({
            'NAC Module': {
                'CPU Cores': results.nacRadiusDetails.rawNacCpuCores
            },
            'System Resources': {
                'CPU Cores': results.nacRadiusDetails.baselineCpuCores
            },
            'Total Calculated': {
                'CPU Cores': results.nacRadiusDetails.totalCalculatedCpu
            },
            'Final (Rounded)': {
                'CPU Cores': results.nacRadiusDetails.finalRoundedCpu
            }
        });
        console.groupEnd();
        
        console.group('%c🎯 Resource Distribution', 'color: #02A7B6; font-size: 14px');
        console.log('%cMemory Distribution:', 'color: #333; font-weight: bold');
        console.log(`  NAC Pods: ${results.nacRadiusDetails.nacMemoryPercent}%`);
        console.log(`  System: ${results.nacRadiusDetails.baselineMemoryPercent}%`);
        console.log(`  Headroom: ${((results.nacRadiusDetails.finalRoundedMemory - results.nacRadiusDetails.totalCalculatedMemory) / results.nacRadiusDetails.finalRoundedMemory * 100).toFixed(1)}%`);
        console.groupEnd();
        
        console.group('%c📋 Raw Calculation Data', 'color: #02A7B6; font-size: 14px');
        console.log('Full NAC details object:', results.nacRadiusDetails);
        console.groupEnd();
        
        // Alternative calculations with 2500 mCPU limit
        if (results.nacRadiusDetails.podCpuLimit > 2500) {
            console.group('%c⚠️ Alternative Configuration (2500 mCPU limit)', 'color: #ff9800; font-size: 14px; font-weight: bold');
            
            const altCpuLimit = 2500;
            const altRpsPerPod = altCpuLimit / results.nacRadiusDetails.cpuPeakPerRps;
            const altPodsNeeded = Math.ceil(results.nacRadiusDetails.targetRps / altRpsPerPod);
            const altPodsPerNode = Math.ceil(altPodsNeeded / inputs.nodeCount);
            
            console.log(`%c📊 With 2500 mCPU limit:`, 'color: #ff9800; font-weight: bold');
            console.log(`  RPS per pod: ${altRpsPerPod.toFixed(1)}`);
            console.log(`  Pods needed: ${altPodsNeeded}`);
            console.log(`  Pods per node: ${altPodsPerNode}`);
            console.log(`  Total pods capacity: ${(altPodsNeeded * altRpsPerPod).toFixed(1)} RPS`);
            
            console.log(`%c⚡ CPU comparison:`, 'color: #ff9800; font-weight: bold');
            console.log(`  Recommended: ${results.nacRadiusDetails.podCpuLimit.toFixed(0)} mCPU`);
            console.log(`  Limited: ${altCpuLimit} mCPU`);
            console.log(`  Performance impact: ${((results.nacRadiusDetails.podCpuLimit - altCpuLimit) / results.nacRadiusDetails.podCpuLimit * 100).toFixed(1)}% reduction`);
            
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    // Сохраняем для экспорта
    window.lastCalculationResults = results;
}

function exportToPDF() {
    const isNacSelected = window.isNACSelected && window.isNACSelected();
    const isCIEnabled = window.isCISelected && window.isCISelected();
    const ciData = isCIEnabled ? window.getCIData && window.getCIData() : null;

    // Разрешаем экспорт при CI-only даже без lastCalculationResults
    if (!window.lastCalculationResults && !(isCIEnabled && ciData && !isNacSelected)) {
        if (window.showToast) {
            window.showToast('Сначала выполните расчет', 'warning');
        } else {
            alert('Сначала выполните расчет');
        }
        return;
    }

    // Ветка CI-only: упрощенный PDF
    if (!isNacSelected && isCIEnabled && ciData) {
        const devices = (ciData.totalDevices || 0).toLocaleString('ru-RU');
        const rawCpu = (ciData.cpuUsageMax || 0);
        const cpu = (window.roundToCIStandardCpu ? window.roundToCIStandardCpu(rawCpu) : rawCpu);
        const rawMem = (ciData.memoryUsageMax || 0);
        const mem = (window.roundToCIStandardMemorySize ? window.roundToCIStandardMemorySize(rawMem) : rawMem);
        const rpt1 = (ciData.reportTimePrimary || 0).toFixed(2);
        const rpt2 = (ciData.reportTimeSecondary || 0).toFixed(2);

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            content: [
                { svg: EFROS_LOGO_SVG, alignment: 'center', margin: [0, 0, 0, 20] },
                { text: 'Требования к инфраструктуре ПК «Efros DO»', style: 'header', alignment: 'center', margin: [0, 0, 0, 10] },
                { text: 'Модуль Config Inspector (CI)', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 10] },
                { text: `Устройств под мониторингом: ${devices} шт`, style: 'normal', margin: [0, 0, 0, 10] },
                { text: 'Бизнес-показатели', style: 'subheader', margin: [0, 0, 0, 8] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['40%', '30%', '30%'],
                        body: [
                            ['Сервер', 'Процессор', 'Оперативная память'],
                            ['Комплекс CI', `${cpu} vCPU`, `${mem} ГБ`],
                            ['Сервер СУБД', `${cpu} vCPU`, `${mem} ГБ`]
                        ]
                    },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 12]
                },
                { text: 'Показатели CI', style: 'subheader', margin: [0, 0, 0, 8] },
                { ul: [
                    `Время отчетов (первичных): ${rpt1} ч`,
                    `Время отчетов (повторных): ${rpt2} ч`
                ], style: 'normal' }
            ],
            styles: {
                header: { fontSize: 16, bold: true },
                subheader: { fontSize: 12, bold: true },
                normal: { fontSize: 10 }
            }
        };

        const filename = `Требования_Efros_CI_${devices}_устройств.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
        return;
    }

    const results = window.lastCalculationResults;
    const inputs = getHybridInputValues();
    const deviceCount = inputs.devices.toLocaleString();
    
    const authMethodRu = {
        'MAB': 'MAC-адрес',
        'PEAP': 'PEAP (MS-CHAPv2)',
        'EAP-TLS': 'EAP-TLS',
        'EAP-TEAP': 'EAP-TEAP'
    };

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
            // Логотип Efros
            {
                svg: EFROS_LOGO_SVG,
                alignment: 'center',
                margin: [0, 0, 0, 20]
            },
            // Заголовок
            {
                text: 'Требования к инфраструктуре ПК «Efros DO»',
                style: 'header',
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            {
                text: 'Технические характеристики оборудования',
                style: 'subheader', 
                alignment: 'center',
                margin: [0, 0, 0, 20]
            },
            
            // Конфигурация
            {
                text: `Конфигурация: ${deviceCount} устройств`,
                style: 'normal',
                margin: [0, 0, 0, 5]
            },
            {
                text: `Метод аутентификации: ${authMethodRu[inputs.authMethod] || inputs.authMethod}`,
                style: 'normal',
                margin: [0, 0, 0, 5]
            },
            
            // Дополнительные опции
            {
                text: 'Дополнительные опции:',
                style: 'normal',
                margin: [0, 0, 0, 5]
            },
            {
                ul: [
                    '✅ RADIUS Accounting включен (обязателен для всех методов)',
                    ...((inputs.authMethod === 'EAP-TLS' || inputs.authMethod === 'EAP-TEAP') ? [inputs.ocspEnabled ? '✅ OCSP проверка сертификатов включена' : '❌ OCSP проверка сертификатов отключена'] : []),
                    ...(inputs.authMethod === 'MAB' ? [inputs.spoofingEnabled ? '✅ Защита от MAC-спуфинга включена (требует RADIUS Accounting)' : '❌ Защита от MAC-спуфинга отключена'] : []),
                    ...(isCIEnabled ? ['✅ Config Inspector (CI) включен - мониторинг конфигураций устройств'] : [])
                ],
                style: 'normal',
                margin: [20, 0, 0, 20]
            },

            // Информация о CI если модуль включен
            ...(isCIEnabled && ciData ? [{
                text: 'Модуль Config Inspector (CI):',
                style: 'normal',
                margin: [0, 10, 0, 5]
            },
            {
                ul: [
                    `Устройств под управлением: ${ciData.totalDevices || 0} шт`,
                    `Потребление CPU: ${(ciData.cpuUsageMax || 0).toFixed(1)} vCPU на кластер`,
                    `Потребление памяти: ${(ciData.memoryUsageMax || 0).toFixed(1)} ГБ на кластер`,
                    `Время выполнения отчетов (первичных): ${(ciData.reportTimePrimary || 0).toFixed(2)} ч`,
                    `Время выполнения отчетов (вторичных): ${(ciData.reportTimeSecondary || 0).toFixed(2)} ч`
                ],
                style: 'normal',
                margin: [20, 0, 0, 20]
            }] : []),

            // Таблица программного обеспечения
            {
                text: 'Требования к программному обеспечению',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['30%', '70%'],
                    body: [
                        [{text: 'Компонент', style: 'tableHeaderCell'}, {text: 'Характеристики', style: 'tableHeaderCell'}],
                        ['Количество устройств', deviceCount],
                        ['Метод аутентификации', authMethodRu[inputs.authMethod] || inputs.authMethod],
                        ...((inputs.authMethod === 'EAP-TLS' || inputs.authMethod === 'EAP-TEAP') ? [['OCSP проверка сертификатов', inputs.ocspEnabled ? 'Включена' : 'Отключена']] : []),
                        ...(inputs.authMethod === 'MAB' ? [['MAC-спуфинг защита', inputs.spoofingEnabled ? 'Включена' : 'Отключена']] : []),
                        [{text: '', colSpan: 2}, ''],
                        [{text: 'Операционная система', style: 'bold'}, 'Astra Linux Special Edition, РЕД ОС (сертифицированные)'],
                        [{text: 'База данных', style: 'bold'}, 'PostgreSQL 14+, Jatoba (сертифицированные СУБД)'],
                        [{text: 'Платформа контейнеризации', style: 'bold'}, 'Kubernetes v1.29.6'],
                        [{text: 'Дополнительные сервисы', style: 'bold'}, 'Strimzi Kafka v3.7.0, OpenSearch v2.18.0, MinIO v220218, NGINX Ingress Controller v1.25, External DNS v1.15.2']
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

            // Разрыв страницы перед таблицей аппаратных требований
            {text: '', pageBreak: 'before'},

            // Таблица аппаратных требований
            {
                text: 'Требования к аппаратному обеспечению',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['33%', '33%', '34%'],
                    body: (() => {
                        const tableBody = [
                            [
                                {text: 'Компонент', style: 'tableHeaderCell'},
                                {text: 'Сервер NAC', style: 'tableHeaderCell'},
                                {text: 'Сервер БД', style: 'tableHeaderCell'}
                            ],
                            ['Процессор', `${results.totalCpu} ядер (≥2.0 ГГц)`, `${results.dbRequirements.cpu} ядер (≥2.0 ГГц)`],
                            ['Оперативная память', `${results.totalMemory} ГБ`, `${results.dbRequirements.memory} ГБ`],
                            ['Дисковое пространство', `${results.nodeStorage * inputs.nodeCount} ГБ SSD`, `${results.dbRequirements.storage} ГБ SSD`]
                        ];
                        // Добавляем строку с данными о хранилище сессий (в колонке БД)
                        if (typeof calculateSessionStorageRequirements === 'function') {
                            const storageReqs = calculateSessionStorageRequirements(inputs);
                            tableBody.push([{text: '↳ из них для данных о сессиях', style: 'notes', color: '#666'}, '-', `${storageReqs.sessionStorageGb.toFixed(2)} ГБ`]);
                        }
                        tableBody.push(
                            ['Сетевой интерфейс', '1 Гбит/с', '1 Гбит/с'],
                            ['Операционная система', 'Linux (Astra/РЕД ОС)', 'Linux (Astra/РЕД ОС)'],
                            ['Kubernetes узлы', `${inputs.nodeCount} шт`, 'Внешний сервис']
                        );
                        return tableBody;
                    })()
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

            // Параметры хранения данных БД
            ...(typeof calculateSessionStorageRequirements === 'function' ? [{
                text: 'Параметры хранения данных о сессиях в БД:',
                style: 'normal',
                margin: [0, 0, 0, 5]
            },
            {
                ul: (() => {
                    const storageReqs = calculateSessionStorageRequirements(inputs);
                    return [
                        `Подключений на устройство в день: ${storageReqs.authAttemptsPerDay}`,
                        `Период хранения данных: ${storageReqs.retentionDays} дней`,
                        `Объём данных о сессиях на кластер: ${storageReqs.sessionStorageGb.toFixed(2)} ГБ`
                    ];
                })(),
                style: 'normal',
                margin: [20, 0, 0, 15]
            }] : []),

            // Текст о системных ресурсах перед примечаниями
            {
                text: [
                    'Расчёт отражает потребность модуля NAC как продуктового компонента и включает дополнительные инфраструктурные ресурсы, необходимые для стабильной работы в текущих версиях продукта.'
                ],
                style: 'noteText',
                margin: [0, 20, 0, 20]
            },
            
            // Страница с георезервированием
            {
                text: 'Рекомендации по геораспределению и отказоустойчивости',
                pageBreak: 'before',
                style: 'header',
                alignment: 'center',
                margin: [0, 0, 0, 20]
            },
            
            // Минимальные требования
            {
                text: 'Минимальные требования для ПК «Efros DO»',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                ul: [
                    `Минимальная конфигурация: 3 узла (3+3+1 или 2+2+1 или 1+1+1)`,
                    `Рекомендуемая конфигурация: 5 и более узлов для обеспечения высокой доступности`,
                    `CPU на узел: минимум 8 ядер, рекомендуется 16 ядер`,
                    `Память на узел: минимум 32 ГБ, рекомендуется 64 ГБ`
                ],
                margin: [20, 0, 0, 20]
            },
            
            // Геораспределенная установка
            {
                text: 'Геораспределенная установка',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                ul: [
                    'Отказоустойчивость: Сохранение работоспособности при выходе из строя одного ЦОД',
                    'Балансировка нагрузки: Автоматическое перераспределение между ЦОД',
                    'Keepalived: VRRP 112 с multicast на 224.0.0.18 для высокой доступности',
                    'Важно: Необходимо отключить SWAP-файл в системе'
                ],
                margin: [20, 0, 0, 20]
            },
            
            // Текущая конфигурация
            {
                text: 'Анализ текущей конфигурации',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                text: [
                    {text: 'Количество узлов: ', bold: true},
                    `${inputs.nodeCount} узлов`,
                    inputs.nodeCount < 3 ? ' ⚠️ Ниже минимума!' : 
                    inputs.nodeCount <= 4 ? ' - минимальная конфигурация' : ' - рекомендуемая конфигурация'
                ],
                margin: [0, 0, 0, 5]
            },
            {
                text: [
                    {text: 'CPU на узел: ', bold: true},
                    `${results.nodeCpu} ядер`,
                    results.nodeCpu < 8 ? ' ⚠️ Ниже минимума!' :
                    results.nodeCpu < 16 ? ' - минимальная конфигурация' : ' - рекомендуемая конфигурация'
                ],
                margin: [0, 0, 0, 5]
            },
            {
                text: [
                    {text: 'Память на узел: ', bold: true},
                    `${results.nodeMemory} ГБ`,
                    results.nodeMemory < 32 ? ' ⚠️ Ниже минимума!' :
                    results.nodeMemory < 64 ? ' - минимальная конфигурация' : ' - рекомендуемая конфигурация'
                ],
                margin: [0, 0, 0, 20]
            },
            
            // Схема геораспределения
            {
                text: 'Рекомендуемая схема геораспределения',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                ul: inputs.nodeCount === 3 ? [
                    'Вариант 1: 1+1+1 (три ЦОД)',
                    'Вариант 2: 2+1 (два ЦОД)'
                ] : inputs.nodeCount === 5 ? [
                    'Вариант 1: 2+2+1 (три ЦОД)',
                    'Вариант 2: 3+2 (два ЦОД)'
                ] : inputs.nodeCount === 7 ? [
                    'Рекомендуется: 3+3+1 (три ЦОД)',
                    'Альтернатива: 4+3 (два ЦОД)'
                ] : [
                    'Равномерное распределение по 2-3 ЦОД',
                    'Обеспечение кворума в каждом ЦОД'
                ],
                margin: [20, 0, 0, 20]
            },
            
            // Важная информация
            {
                text: 'Важная информация по установке',
                style: 'tableHeader',
                margin: [0, 0, 0, 10]
            },
            {
                ol: [
                    'При установке на базе инфраструктуры Kubernetes необходимо отключить SWAP-файл',
                    'Для edo-dns-service необходимо выделить не менее 2 ГБ памяти и 2 ядер процессора на каждый контейнер',
                    'Точные требования к аппаратному обеспечению для узла определяются проектным решением и инфраструктурой заказчика'
                ],
                margin: [20, 0, 0, 0]
            }
        ],
        
        styles: {
            header: {
                fontSize: 16,
                bold: true,
                color: '#005EB8'
            },
            subheader: {
                fontSize: 14,
                bold: true,
                color: '#333'
            },
            tableHeader: {
                fontSize: 12,
                bold: true,
                color: '#005EB8',
                margin: [0, 10, 0, 5]
            },
            tableHeaderCell: {
                bold: true,
                fillColor: '#f0f0f0',
                alignment: 'center'
            },
            normal: {
                fontSize: 10,
                lineHeight: 1.3
            },
            bold: {
                fontSize: 10,
                bold: true
            },
            noteHeader: {
                fontSize: 10,
                bold: true
            },
            notes: {
                fontSize: 9,
                lineHeight: 1.4
            },
            noteText: {
                fontSize: 9,
                lineHeight: 1.4,
                alignment: 'justify',
                margin: [0, 0, 0, 5]
            }
        },
        
        defaultStyle: {
            font: 'Roboto',
            fontSize: 10
        }
    };
    // Logo is already embedded in the docDefinition content above, no need to replace

    // Генерация и скачивание PDF
    const scenarioName = inputs.authMethod; // EAP-TLS, MAB, или PEAP
    const nodeCount = inputs.nodeCount;
    
    // Правильное склонение для "нода/ноды/нод"
    let nodeWord;
    if (nodeCount === 1) {
        nodeWord = 'нода';
    } else if (nodeCount === 3) {
        nodeWord = 'ноды';
    } else {
        nodeWord = 'нод';
    }
    
    const filename = `Требования_Efros_NAC_${scenarioName}_${deviceCount}_устройств_${nodeCount}_${nodeWord}.pdf`;
    
    pdfMake.createPdf(docDefinition).download(filename);
}

// Функция для переключения табов справочной информации
function switchInfoTab(tabName) {
    const ciTab = document.getElementById('ciTab');
    
    // Проверяем, если пытаемся переключиться на CI таб, но CI модуль не выбран
    if (tabName === 'ci') {
        const isCISelected = window.isCISelected && window.isCISelected();
        if (!isCISelected) {
            // CI модуль не выбран, не переключаемся
            console.log('CI модуль не выбран, переключение запрещено');
            return;
        }
    }
    
    // Скрываем все контенты
    const nacSection = document.getElementById('nacInfoSection');
    const ciSection = document.getElementById('ciInfoSection');
    
    if (nacSection) nacSection.style.display = 'none';
    if (ciSection) ciSection.style.display = 'none';
    
    // Убираем активный класс со всех кнопок
    const nacTab = document.getElementById('nacTab');
    
    if (nacTab) nacTab.classList.remove('active');
    if (ciTab) ciTab.classList.remove('active');
    
    // Показываем нужную секцию и активируем кнопку
    if (tabName === 'nac') {
        if (nacSection) nacSection.style.display = 'block';
        if (nacTab) nacTab.classList.add('active');
    } else if (tabName === 'ci') {
        if (ciSection) ciSection.style.display = 'block';
        if (ciTab) ciTab.classList.add('active');
    }
}

// Функция для обновления состояния CI таба
function updateCITabState() {
    const ciTab = document.getElementById('ciTab');
    const nacTab = document.getElementById('nacTab');
    if (!ciTab) return;

    const isCISelected = window.isCISelected && window.isCISelected();
    const isNACSelectedFlag = window.isNACSelected && window.isNACSelected();

    // Управление доступностью CI таба
    if (isCISelected) {
        ciTab.classList.remove('disabled');
        ciTab.removeAttribute('title');
        ciTab.removeAttribute('data-hint');
    } else {
        ciTab.classList.add('disabled');
        ciTab.removeAttribute('title');
        ciTab.setAttribute('data-hint', 'Для получения расчетов по модулю Config Inspector выберите его в списке модулей в верхней части страницы');
        if (ciTab.classList.contains('active')) {
            switchInfoTab('nac');
        }
    }

    // Подсказка для NAC, когда выбраны оба модуля
    if (nacTab) {
        if (isNACSelectedFlag && isCISelected) {
            nacTab.removeAttribute('title');
            nacTab.setAttribute('data-hint', 'На этой вкладке показаны метрики только модуля NAC. Данные CI — во вкладке CI.');
        } else {
            nacTab.removeAttribute('title');
            nacTab.removeAttribute('data-hint');
        }
    }
}

// Экспортируем функции для глобального доступа
window.switchInfoTab = switchInfoTab;
window.updateCITabState = updateCITabState;
