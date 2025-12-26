let hybridSelectedMethod = '';

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
                if (hybridSelectedMethod === 'EAP-TLS') {
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
    const inputs = document.querySelectorAll('#hybridDevices, #hybridConcurrent, #hybridBurstWindow, #hybridHeadroom, #hybridNodeCount');
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
        if (hybridSelectedMethod === 'EAP-TLS') {
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
        nodeCount: nodeCount
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
    
    document.getElementById('hybridServerCpu').textContent = serverTotalCpu;
    document.getElementById('hybridServerMemory').textContent = serverTotalMemory;
    document.getElementById('hybridServerStorage').textContent = serverTotalStorage;
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
        const cpu = (ciData.cpuUsageMax || 0).toFixed(1);
        const rawMem = (ciData.memoryUsageMax || 0);
        const mem = (window.roundToCIStandardMemorySize ? window.roundToCIStandardMemorySize(rawMem) : rawMem);
        const rpt1 = (ciData.reportTimePrimary || 0).toFixed(2);
        const rpt2 = (ciData.reportTimeSecondary || 0).toFixed(2);

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            content: [
                { text: 'Требования к инфраструктуре ПК «Efros DO» (CI)', style: 'header', alignment: 'center', margin: [0, 0, 0, 10] },
                { text: `Устройств под мониторингом: ${devices} шт`, margin: [0, 0, 0, 10] },
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
                ]}
            ],
            styles: {
                header: { fontSize: 16, bold: true },
                subheader: { fontSize: 12, bold: true }
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
        'EAP-TLS': 'EAP-TLS'
    };

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
            // Логотип Efros
            {
                svg: `<svg width="180" height="52" viewBox="0 0 355 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M33.4834 0H51.0656C51.581 0 51.9989 0.427668 51.9989 0.955224C51.9989 1.0348 51.9892 1.11406 51.97 1.19117L49.2999 11.9117C48.246 16.1432 44.5225 19.1045 40.2558 19.1045H29.2011C28.6856 19.1045 28.2678 18.6768 28.2678 18.1493C28.2678 18.0697 28.2775 17.9904 28.2967 17.9133L32.579 0.71928C32.6844 0.29613 33.0568 0 33.4834 0Z" fill="#24A7B3"/>
                    <path d="M77.2058 0H60.0724C59.6438 0 59.2703 0.29876 59.1667 0.724418L56.1377 13.1743C56.0459 13.5518 55.9995 13.9394 55.9995 14.3284C55.9995 16.9661 58.0888 19.1045 60.6661 19.1045H73.0225C73.4511 19.1045 73.8246 18.8057 73.9282 18.3801L78.1114 1.18603C78.1298 1.11053 78.1391 1.03302 78.1391 0.955224C78.1391 0.427668 77.7212 0 77.2058 0Z" fill="#24A7B3"/>
                    <path d="M317.333 8.59701H354.667L354.315 10.1822C353.156 15.401 348.622 19.1045 343.393 19.1045H317.333C314.241 19.1045 311.733 21.6705 311.733 24.8358C311.733 28.0012 314.241 30.5672 317.333 30.5672H328.533C336.997 30.5672 343.916 37.3269 344.4 45.8507H334.065C333.621 43.1401 331.318 41.0746 328.543 41.0746H317.333C308.57 41.0746 301.467 33.8043 301.467 24.8358C301.467 15.8674 308.57 8.59701 317.333 8.59701Z" fill="#24A7B3"/>
                    <path d="M104.418 42.0299H91.6122L88.7865 53.4925H126.933L126.573 55.0998C125.406 60.308 120.878 64 115.657 64H75.6L85.019 26.7463H95.3798L93.967 31.5224H115.16L114.23 34.6131C112.905 39.0216 108.925 42.0299 104.418 42.0299Z" fill="#24A7B3"/>
                    <path d="M250.097 47.7612C250.097 47.2969 250.152 46.8343 250.261 46.3836L255.012 26.7463H244.844L240.325 44.9543C238.295 53.1355 243.13 61.452 251.123 63.5297C252.325 63.842 253.56 64 254.799 64H277.051C282.111 64 286.543 60.5268 287.863 55.5266L288.4 53.4925H255.697C252.604 53.4925 250.097 50.9265 250.097 47.7612Z" fill="#24A7B3"/>
                    <path d="M229.112 26.7463L228.086 30.6148C227.644 32.2792 226.168 33.4345 224.483 33.4345H199.762L201.164 26.7463H190.414L181.067 64H192.121L196.958 43.9446H209.11L216.12 64H227.032L219.859 43.9446L223.817 43.9614C230.579 43.9901 236.517 39.3644 238.29 32.6856L239.867 26.7463H229.112Z" fill="#24A7B3"/>
                    <path d="M138.944 26.7463H149.092L148.147 31.5236H169.867L169.302 33.6193C167.962 38.5903 163.544 42.0336 158.505 42.0336H145.787L140.308 64H129.733L138.944 26.7463Z" fill="#24A7B3"/>
                    <path d="M294 64H328.533C335.363 64 341.19 59.6328 343.467 53.4925H305.33C300.231 53.4925 295.775 57.018 294.491 62.0689L294 64Z" fill="#24A7B3"/>
                    <path d="M225.733 8.59701C232.325 8.59701 237.915 13.0026 239.867 19.1045H192.267L193.371 14.4391C194.183 11.0111 197.182 8.59701 200.628 8.59701H225.733Z" fill="#24A7B3"/>
                    <path d="M149.227 8.59701C145.741 8.59701 142.718 11.066 141.946 14.5452L140.933 19.1045H178.193C183.422 19.1045 187.956 15.401 189.115 10.1822L189.467 8.59701H149.227Z" fill="#24A7B3"/>
                    <path d="M87.8124 14.5452C88.5851 11.066 91.6073 8.59701 95.0934 8.59701H137.2L136.848 10.1822C135.689 15.401 131.156 19.1045 125.927 19.1045H86.8L87.8124 14.5452Z" fill="#24A7B3"/>
                    <path d="M70.6656 26.7463H59.6109C55.3441 26.7463 51.6206 29.7076 50.5667 33.9391L47.8967 44.6596C47.8775 44.7367 47.8678 44.8159 47.8678 44.8955C47.8678 45.4231 48.2856 45.8507 48.8011 45.8507H66.3832C66.8099 45.8507 67.1823 45.5546 67.2876 45.1315L71.57 27.9374C71.5892 27.8603 71.5989 27.7811 71.5989 27.7015C71.5989 27.1739 71.181 26.7463 70.6656 26.7463Z" fill="#24A7B3"/>
                    <path d="M10.129 26.7463H39.199C41.7763 26.7463 43.8656 28.8846 43.8656 31.5224C43.8656 31.9061 43.8204 32.2884 43.7311 32.6611L35.9218 63.2725C35.8193 63.6997 35.4451 64 35.0153 64H1.20518C0.689718 64 0.271851 63.5723 0.271851 63.0448C0.271851 62.9641 0.281825 62.8838 0.301535 62.8058L9.22538 27.4625C9.33184 27.0408 9.7035 26.7463 10.129 26.7463Z" fill="#24A7B3"/>
                    <path d="M285.613 24.8358C285.613 25.3011 285.558 25.7647 285.448 26.2163L280.687 45.8507H290.879L295.405 27.6506C297.439 19.4705 292.609 11.1514 284.617 9.06927C283.413 8.75566 282.175 8.59701 280.933 8.59701H258.684C253.625 8.59701 249.195 12.0671 247.873 17.0642L247.333 19.1045H280.013C283.106 19.1045 285.613 21.6705 285.613 24.8358Z" fill="#24A7B3"/>
                    <path d="M60.9609 98V80.9375H66C67.5078 80.9375 68.8437 81.2735 70.0078 81.9453C71.1797 82.6172 72.0859 83.5703 72.7265 84.8047C73.3672 86.0391 73.6875 87.4532 73.6875 89.0469V89.9024C73.6875 91.5196 73.3633 92.9414 72.7148 94.168C72.0742 95.3946 71.1562 96.3399 69.9609 97.0039C68.7734 97.668 67.4101 98 65.8711 98H60.9609ZM63.9258 83.3282V95.6328H65.8593C67.414 95.6328 68.6054 95.1485 69.4336 94.1797C70.2695 93.2032 70.6953 91.8047 70.7109 89.9844V89.0352C70.7109 87.1836 70.3086 85.7696 69.5039 84.793C68.6992 83.8164 67.5312 83.3282 66 83.3282H63.9258ZM88.6133 90.3828H81.6054V95.6328H89.7968V98H78.6406V80.9375H89.7148V83.3282H81.6054V88.0391H88.6133V90.3828ZM104.043 90.7696H97.1758V98H94.2109V80.9375H105.051V83.3282H97.1758V88.4024H104.043V90.7696ZM119.379 90.3828H112.371V95.6328H120.562V98H109.406V80.9375H120.48V83.3282H112.371V88.0391H119.379V90.3828ZM138.512 98H135.547L127.941 85.8946V98H124.977V80.9375H127.941L135.57 93.0899V80.9375H138.512V98ZM157.035 92.4453C156.863 94.2657 156.191 95.6875 155.02 96.711C153.848 97.7266 152.289 98.2344 150.344 98.2344C148.984 98.2344 147.785 97.9141 146.746 97.2735C145.715 96.625 144.918 95.7071 144.355 94.5196C143.793 93.3321 143.5 91.9532 143.477 90.3828V88.7891C143.477 87.1797 143.762 85.7617 144.332 84.5352C144.902 83.3086 145.719 82.3633 146.781 81.6992C147.852 81.0352 149.086 80.7032 150.484 80.7032C152.367 80.7032 153.883 81.2149 155.031 82.2383C156.18 83.2617 156.848 84.7071 157.035 86.5742H154.082C153.941 85.3477 153.582 84.4649 153.004 83.9258C152.434 83.3789 151.594 83.1055 150.484 83.1055C149.195 83.1055 148.203 83.5782 147.508 84.5235C146.82 85.461 146.469 86.8399 146.453 88.6602V90.1719C146.453 92.0157 146.781 93.4219 147.437 94.3907C148.102 95.3594 149.07 95.8438 150.344 95.8438C151.508 95.8438 152.383 95.5821 152.969 95.0586C153.555 94.5352 153.926 93.6641 154.082 92.4453H157.035ZM171.668 90.3828H164.66V95.6328H172.852V98H161.695V80.9375H172.77V83.3282H164.66V88.0391H171.668V90.3828ZM198.859 89.9141C198.859 91.586 198.57 93.0547 197.992 94.3203C197.414 95.5782 196.586 96.5469 195.508 97.2266C194.437 97.8985 193.203 98.2344 191.805 98.2344C190.422 98.2344 189.187 97.8985 188.102 97.2266C187.023 96.5469 186.187 95.5821 185.594 94.3321C185.008 93.0821 184.711 91.6407 184.703 90.0078V89.0469C184.703 87.3828 184.996 85.9141 185.582 84.6407C186.176 83.3672 187.008 82.3946 188.078 81.7227C189.156 81.043 190.391 80.7032 191.781 80.7032C193.172 80.7032 194.402 81.0391 195.473 81.711C196.551 82.375 197.383 83.336 197.969 84.5938C198.555 85.8438 198.852 87.3008 198.859 88.9649V89.9141ZM195.895 89.0235C195.895 87.1328 195.535 85.6836 194.816 84.6758C194.105 83.668 193.094 83.1641 191.781 83.1641C190.5 83.1641 189.496 83.668 188.77 84.6758C188.051 85.6758 187.684 87.0938 187.668 88.9297V89.9141C187.668 91.7891 188.031 93.2383 188.758 94.2617C189.492 95.2852 190.508 95.7969 191.805 95.7969C193.117 95.7969 194.125 95.2969 194.828 94.2969C195.539 93.2969 195.895 91.836 195.895 89.9141V89.0235ZM206.777 91.6602V98H203.812V80.9375H210.34C212.246 80.9375 213.758 81.4336 214.875 82.4258C216 83.418 216.562 84.7305 216.562 86.3633C216.562 88.0352 216.012 89.336 214.91 90.2657C213.816 91.1953 212.281 91.6602 210.305 91.6602H206.777ZM206.777 89.2813H210.34C211.395 89.2813 212.199 89.0352 212.754 88.543C213.309 88.043 213.586 87.3242 213.586 86.3867C213.586 85.4649 213.305 84.7305 212.742 84.1836C212.18 83.6289 211.406 83.3438 210.422 83.3282H206.777V89.2813ZM231.137 90.3828H224.129V95.6328H232.32V98H221.164V80.9375H232.238V83.3282H224.129V88.0391H231.137V90.3828ZM243.004 91.4258H239.699V98H236.734V80.9375H242.734C244.703 80.9375 246.223 81.3789 247.293 82.2617C248.363 83.1446 248.898 84.4219 248.898 86.0938C248.898 87.2344 248.621 88.1914 248.066 88.9649C247.52 89.7305 246.754 90.3203 245.77 90.7344L249.602 97.8477V98H246.426L243.004 91.4258ZM239.699 89.0469H242.746C243.746 89.0469 244.527 88.7969 245.09 88.2969C245.652 87.7891 245.934 87.0977 245.934 86.2227C245.934 85.3086 245.672 84.6016 245.148 84.1016C244.633 83.6016 243.859 83.3438 242.828 83.3282H239.699V89.0469ZM263.262 94.0274H256.652L255.27 98H252.187L258.633 80.9375H261.293L267.75 98H264.656L263.262 94.0274ZM257.484 91.6367H262.43L259.957 84.5586L257.484 91.6367ZM282.617 83.3282H277.297V98H274.355V83.3282H269.082V80.9375H282.617V83.3282ZM289.996 98H287.043V80.9375H289.996V98ZM309.258 89.9141C309.258 91.586 308.969 93.0547 308.391 94.3203C307.812 95.5782 306.984 96.5469 305.906 97.2266C304.836 97.8985 303.602 98.2344 302.203 98.2344C300.82 98.2344 299.586 97.8985 298.5 97.2266C297.422 96.5469 296.586 95.5821 295.992 94.3321C295.406 93.0821 295.109 91.6407 295.102 90.0078V89.0469C295.102 87.3828 295.395 85.9141 295.98 84.6407C296.574 83.3672 297.406 82.3946 298.477 81.7227C299.555 81.043 300.789 80.7032 302.18 80.7032C303.57 80.7032 304.801 81.0391 305.871 81.711C306.949 82.375 307.781 83.336 308.367 84.5938C308.953 85.8438 309.25 87.3008 309.258 88.9649V89.9141ZM306.293 89.0235C306.293 87.1328 305.934 85.6836 305.215 84.6758C304.504 83.668 303.492 83.1641 302.18 83.1641C300.898 83.1641 299.895 83.668 299.168 84.6758C298.449 85.6758 298.082 87.0938 298.066 88.9297V89.9141C298.066 91.7891 298.43 93.2383 299.156 94.2617C299.891 95.2852 300.906 95.7969 302.203 95.7969C303.516 95.7969 304.523 95.2969 305.227 94.2969C305.937 93.2969 306.293 91.836 306.293 89.9141V89.0235ZM327.746 98H324.781L317.176 85.8946V98H314.211V80.9375H317.176L324.805 93.0899V80.9375H327.746V98ZM342.168 93.6055C342.168 92.8555 341.902 92.2774 341.371 91.8711C340.848 91.4649 339.898 91.0547 338.523 90.6407C337.148 90.2266 336.055 89.7657 335.242 89.2578C333.688 88.2813 332.91 87.0078 332.91 85.4375C332.91 84.0625 333.469 82.9297 334.586 82.0391C335.711 81.1485 337.168 80.7032 338.957 80.7032C340.145 80.7032 341.203 80.9219 342.133 81.3594C343.063 81.7969 343.793 82.4219 344.324 83.2344C344.855 84.0391 345.121 84.9336 345.121 85.918H342.168C342.168 85.0274 341.887 84.3321 341.324 83.8321C340.77 83.3242 339.973 83.0703 338.934 83.0703C337.965 83.0703 337.211 83.2774 336.672 83.6914C336.141 84.1055 335.875 84.6836 335.875 85.4258C335.875 86.0508 336.164 86.5742 336.742 86.9961C337.32 87.4102 338.273 87.8164 339.602 88.2149C340.93 88.6055 341.996 89.0547 342.801 89.5625C343.605 90.0625 344.195 90.6407 344.57 91.2969C344.945 91.9453 345.133 92.7071 345.133 93.5821C345.133 95.0039 344.586 96.1367 343.492 96.9805C342.406 97.8164 340.93 98.2344 339.063 98.2344C337.828 98.2344 336.691 98.0078 335.652 97.5547C334.621 97.0938 333.816 96.461 333.238 95.6563C332.668 94.8516 332.383 93.9141 332.383 92.8438H335.348C335.348 93.8125 335.668 94.5625 336.309 95.0938C336.949 95.625 337.867 95.8907 339.063 95.8907C340.094 95.8907 340.867 95.6836 341.383 95.2696C341.906 94.8477 342.168 94.293 342.168 93.6055Z" fill="#24A7B3"/>
                </svg>`,
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
                    ...(inputs.authMethod === 'EAP-TLS' ? [inputs.ocspEnabled ? '✅ OCSP проверка сертификатов включена' : '❌ OCSP проверка сертификатов отключена'] : []),
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
                        ...(inputs.authMethod === 'EAP-TLS' ? [['OCSP проверка сертификатов', inputs.ocspEnabled ? 'Включена' : 'Отключена']] : []),
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
                    body: [
                        [
                            {text: 'Компонент', style: 'tableHeaderCell'},
                            {text: 'Сервер NAC', style: 'tableHeaderCell'},
                            {text: 'Сервер БД', style: 'tableHeaderCell'}
                        ],
                        ['Процессор', `${results.totalCpu} ядер (≥2.0 ГГц)`, `${results.dbRequirements.cpu} ядер (≥2.0 ГГц)`],
                        ['Оперативная память', `${results.totalMemory} ГБ`, `${results.dbRequirements.memory} ГБ`],
                        ['Дисковое пространство', `${results.nodeStorage * inputs.nodeCount} ГБ SSD`, `${results.dbRequirements.storage} ГБ SSD`],
                        ['Сетевой интерфейс', '1 Гбит/с', '1 Гбит/с'],
                        ['Операционная система', 'Linux (Astra/РЕД ОС)', 'Linux (Astra/РЕД ОС)'],
                        ['Kubernetes узлы', `${inputs.nodeCount} шт`, 'Внешний сервис']
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

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
