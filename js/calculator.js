
function calculate() {
    const inputs = getInputValues();
    
    if (!validateInputs(inputs)) {
        return;
    }
    
    const results = performCalculations(inputs);
    
    displayResults(results);
    
    document.getElementById('results').style.display = 'block';
    
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function getInputValues() {
    return {
        devices: parseInt(document.getElementById('devices').value),
        authMethod: document.getElementById('authMethod').value,
        ocspEnabled: document.getElementById('ocspEnabled').checked,
        concurrentPct: parseFloat(document.getElementById('concurrentPct').value),
        burstWindow: parseInt(document.getElementById('burstWindow').value),
        headroom: parseFloat(document.getElementById('headroom').value),
        gatewayEnabled: document.getElementById('gatewayEnabled').checked,
        gatewayOverhead: parseFloat(document.getElementById('gatewayOverhead').value),
        nodeCount: parseInt(document.getElementById('nodeCount').value)
    };
}

function validateInputs(inputs) {
    const errors = [];
    
    // Убрали верхний лимит для устройств - теперь автоматически масштабируем узлы
    if (inputs.devices < 1000) {
        errors.push('Количество устройств должно быть не менее 1000');
    }
    
    if (inputs.concurrentPct < 1 || inputs.concurrentPct > 100) {
        errors.push('Процент одновременных подключений должен быть от 1 до 100');
    }
    
    if (inputs.burstWindow < 10 || inputs.burstWindow > 300) {
        errors.push('Окно всплеска должно быть от 10 до 300 секунд');
    }
    
    if (inputs.headroom < 0 || inputs.headroom > 100) {
        errors.push('Запас производительности должен быть от 0 до 100%');
    }
    
    if (inputs.nodeCount < 1 || inputs.nodeCount > 10) {
        errors.push('Количество узлов должно быть от 1 до 10');
    }
    
    if (errors.length > 0) {
        alert('Ошибки валидации:\n' + errors.join('\n'));
        return false;
    }
    
    return true;
}

function performCalculations(inputs, ciData = null) {
    const coeffs = COEFFICIENTS[inputs.authMethod];
    const commonCoeffs = COEFFICIENTS.common;
    
    // 1. Расчет количества одновременных устройств
    const concurrentDevices = inputs.devices * (inputs.concurrentPct / 100);
    
    // 2. Расчет базового RPS
    const baseRps = concurrentDevices / inputs.burstWindow;
    
    // 3. RPS с учетом Gateway
    let rpsWithGateway = baseRps;
    if (inputs.gatewayEnabled) {
        rpsWithGateway = baseRps * (1 + inputs.gatewayOverhead / 100);
    }
    
    // 4. RPS с учетом Headroom
    const rpsWithHeadroom = rpsWithGateway * (1 + inputs.headroom / 100);
    
    // 5. Итоговый RPS (с учетом OCSP для EAP-TLS)
    let targetRps = rpsWithHeadroom;
    if (inputs.authMethod === 'EAP-TLS' && inputs.ocspEnabled) {
        targetRps = rpsWithHeadroom * (1 + coeffs.ocspOverheadPct / 100);
    }
    
    // 6. RPS с учетом Accounting (увеличиваем targetRps)
    if (inputs.accountingEnabled) {
        targetRps = targetRps / commonCoeffs.accountingRpsReduction;
    }
    
    // 7. RPS с учетом MAC-спуфинга (только для MAB, дополнительно к аккаунтингу)
    if (inputs.spoofingEnabled && inputs.authMethod === 'MAB') {
        // MAC-спуфинг работает поверх аккаунтинга
        // Применяем дополнительное уменьшение производительности
        targetRps = targetRps * (commonCoeffs.accountingRpsReduction / commonCoeffs.spoofingRpsReduction);
    }
    
    // 8. Расчет количества подов (без дополнительного влияния на производительность)
    const effectiveNominalRpsPerPod = coeffs.nominalRpsPerPod;
    const calculatedPods = Math.ceil(targetRps / effectiveNominalRpsPerPod);
    const profile = getProfile(inputs.authMethod, inputs.devices);
    const minPods = profile.minPods;
    const recommendedPods = Math.max(calculatedPods, minPods);
    
    const finalPods = Math.ceil(recommendedPods / inputs.nodeCount) * inputs.nodeCount;
    
    // 7. Фактический RPS на под
    const rpsPerPod = targetRps / finalPods;
    
    // 9. Расчет лимитов CPU для пода (с учетом Accounting и MAC-спуфинга)
    let baseCpuPeakPerRps = coeffs.cpuPeakPerRps;
    if (inputs.accountingEnabled) {
        baseCpuPeakPerRps = coeffs.cpuPeakPerRps * commonCoeffs.accountingCpuOverhead;
    }
    if (inputs.spoofingEnabled && inputs.authMethod === 'MAB') {
        // MAC-спуфинг добавляет дополнительный overhead поверх accounting
        baseCpuPeakPerRps = baseCpuPeakPerRps * commonCoeffs.spoofingCpuOverhead;
    }
    const podCpuLimitCores = rpsPerPod * baseCpuPeakPerRps * commonCoeffs.safetyFactor;
    const podCpuLimitMCpu = Math.ceil(podCpuLimitCores * 1000 / 10) * 10; // Округляем до 10 mCPU
    
    // 10. Расчет лимитов памяти для пода (с учетом Accounting и MAC-спуфинга)
    let baseMemPeakPerRpsMiB = coeffs.memPeakPerRpsMiB;
    if (inputs.accountingEnabled) {
        baseMemPeakPerRpsMiB = coeffs.memPeakPerRpsMiB * commonCoeffs.accountingMemOverhead;
    }
    if (inputs.spoofingEnabled && inputs.authMethod === 'MAB') {
        // MAC-спуфинг добавляет дополнительный overhead поверх accounting
        baseMemPeakPerRpsMiB = baseMemPeakPerRpsMiB * commonCoeffs.spoofingMemOverhead;
    }
    // Формула: =MAX(1024,CEILING(rpsPerPod*memPeakPerRpsMiB*safetyFactor,64))
    const calculatedMemLimit = Math.ceil(rpsPerPod * baseMemPeakPerRpsMiB * commonCoeffs.safetyFactor / 64) * 64;
    const podMemLimitMiB = Math.max(1024, calculatedMemLimit);
    
    // Для детализации NAC - используем рассчитанное значение без минимума
    const podMemLimitForDetailsNAC = calculatedMemLimit;
    
    // 10. Расчет requests (60% от limits)
    const podCpuRequestMCpu = Math.ceil(podCpuLimitMCpu * commonCoeffs.requestRatio / 10) * 10;
    const podMemRequestMiB = Math.ceil(podMemLimitMiB * commonCoeffs.requestRatio / 64) * 64;
    
    // 11. Расчет требований к нодам (CPU уже учитывает Accounting в podCpuLimitCores)
    // NAC потребление + базовая линия
    const nacNodeCpu = (podCpuLimitCores * finalPods / inputs.nodeCount) + coeffs.baselineNodeCpuP95;
    
    // Добавляем данные CI (если доступны)
    // CI нагрузка добавляется К КАЖДОМУ узлу (не распределяется между ними)
    const ciCpuPerNode = ciData ? ciData.cpuUsageMax : 0;
    const rawNodeCpu = nacNodeCpu + ciCpuPerNode;
    const nodeCpu = roundUpToCpuSize(rawNodeCpu);
    
    // Новая формула памяти согласно C38: =(C22*C27/Inputs!$C10/1024+Coefficients!$C$12)*Coefficients!$C8
    // где C22 = rpsPerPod, C27 = podMemLimit, C10 = nodeCount, C12 = baseline, C8 = nodeHeadroom  
    const baselineMemGiB = getBaselineNodeMemGiB(inputs.devices);
    // NAC потребление + базовая линия
    const nacCalculatedMemory = (rpsPerPod * podMemLimitMiB / inputs.nodeCount / 1024 + baselineMemGiB) * commonCoeffs.nodeHeadroom;
    
    // Новая логика округления памяти:
    // 1. NAC + baseline память 
    // 2. Округление по количеству устройств (существующая функция getNodeMemorySize)
    // 3. Добавление CI памяти к уже округленному значению
    // 4. Финальное округление до стандартных размеров: 24, 32, 48, 64, 96 GB
    
    const nacRoundedMemory = getNodeMemorySize(inputs.devices, nacCalculatedMemory, inputs.authMethod);
    const ciMemoryPerNodeGiB = ciData ? ciData.memoryUsageMax : 0;
    
    if (ciData) {
        console.log('=== MEMORY CALCULATION DEBUG ===');
        console.log('NAC Memory (raw):', nacCalculatedMemory.toFixed(2), 'GiB');
        console.log('NAC Memory (rounded):', nacRoundedMemory, 'GiB');
        console.log('CI Memory per node:', ciMemoryPerNodeGiB.toFixed(2), 'GB (добавляется к каждому узлу)');
        console.log('Node Count:', inputs.nodeCount);
    }
    
    const totalMemoryWithCI = nacRoundedMemory + ciMemoryPerNodeGiB;
    const nodeMemory = roundToStandardMemorySize(totalMemoryWithCI);
    
    if (ciData) {
        console.log('Total Memory with CI:', totalMemoryWithCI.toFixed(2), 'GiB');
        console.log('Final Memory (standard):', nodeMemory, 'GiB');
        console.log('================================');
    }
    
    // 12. Общие ресурсы кластера
    const totalCpu = nodeCpu * inputs.nodeCount;
    const totalMemory = nodeMemory * inputs.nodeCount;
    
    // 13. Расчет требований к СУБД
    const dbRequirements = calculateDatabaseRequirements(inputs, targetRps);
    
    return {
        // Входные данные (для копирования)
        inputs: inputs,
        
        // Профиль
        profileName: `${inputs.authMethod}: ${profile.name}`,
        
        // Бизнес-показатели
        minPods: minPods,
        recommendedPods: finalPods,
        nodeCpu: nodeCpu,
        nodeMemory: nodeMemory,
        nodeStorage: 120,
        totalCpu: totalCpu,
        totalMemory: totalMemory,
        
        // Технические показатели
        targetRps: targetRps.toFixed(2),
        rpsPerPod: rpsPerPod.toFixed(2),
        podCpuLimit: podCpuLimitMCpu,
        podCpuRequest: podCpuRequestMCpu,
        podMemLimit: podMemLimitMiB,
        podMemRequest: podMemRequestMiB,
        
        // Требования к СУБД
        dbRequirements: dbRequirements,
        
        // Для отладки
        debug: {
            concurrentDevices: concurrentDevices.toFixed(0),
            baseRps: baseRps.toFixed(2),
            rpsWithGateway: rpsWithGateway.toFixed(2),
            rpsWithHeadroom: rpsWithHeadroom.toFixed(2),
            calculatedPods: calculatedPods,
            rawNodeCpu: rawNodeCpu.toFixed(2),
            rawCalculatedMemory: totalMemoryWithCI.toFixed(2),
            baselineMemGiB: baselineMemGiB.toFixed(2)
        },
        
        // Детализация модуля NAC
        nacRadiusDetails: {
            // "Чистые" требования модуля NAC (без baseline и округления, с учетом accounting)  
            // Формула: (подов_на_ноду * память_на_под) в ГБ
            rawNacMemoryGiB: ((finalPods / inputs.nodeCount) * Math.max(1024, podMemLimitForDetailsNAC) / 1024).toFixed(2),
            baselineMemoryGiB: baselineMemGiB.toFixed(2),
            totalCalculatedMemory: totalMemoryWithCI.toFixed(2),
            finalRoundedMemory: nodeMemory,
            
            // CPU только для модуля NAC (с учетом accounting)
            rawNacCpuCores: ((finalPods / inputs.nodeCount) * podCpuLimitCores).toFixed(2),
            baselineCpuCores: coeffs.baselineNodeCpuP95.toFixed(2),
            totalCalculatedCpu: rawNodeCpu.toFixed(2),
            finalRoundedCpu: nodeCpu,
            
            // Процентное соотношение - NAC память от общей памяти без headroom
            // nacMemory = память подов NAC на ноду
            // totalMemoryWithoutHeadroom = nacMemory + baseline (без headroom)
            nacMemoryPercent: ((((finalPods / inputs.nodeCount) * Math.max(1024, podMemLimitForDetailsNAC) / 1024) / (((finalPods / inputs.nodeCount) * Math.max(1024, podMemLimitForDetailsNAC) / 1024) + baselineMemGiB)) * 100).toFixed(1),
            baselineMemoryPercent: ((baselineMemGiB / (((finalPods / inputs.nodeCount) * Math.max(1024, podMemLimitForDetailsNAC) / 1024) + baselineMemGiB)) * 100).toFixed(1)
        }
    };
}

function displayResults(results) {
    // Бизнес-показатели
    document.getElementById('profileName').textContent = results.profileName;
    document.getElementById('minPods').textContent = results.minPods;
    document.getElementById('recommendedPods').textContent = results.recommendedPods;
    document.getElementById('nodeCpu').textContent = results.nodeCpu;
    document.getElementById('nodeMemory').textContent = results.nodeMemory;
    document.getElementById('nodeStorage').textContent = results.nodeStorage;
    document.getElementById('totalCpu').textContent = results.totalCpu;
    document.getElementById('totalMemory').textContent = results.totalMemory;
    
    // Технические показатели
    document.getElementById('targetRps').textContent = results.targetRps;
    document.getElementById('rpsPerPod').textContent = results.rpsPerPod;
    document.getElementById('podCpuLimit').textContent = results.podCpuLimit;
    document.getElementById('podCpuRequest').textContent = results.podCpuRequest;
    document.getElementById('podMemLimit').textContent = results.podMemLimit;
    document.getElementById('podMemRequest').textContent = results.podMemRequest;
    
    // Обновляем требования к СУБД
    updateDatabaseRequirements(results.dbRequirements);
    
    // Сохраняем результаты для экспорта
    window.lastCalculationResults = results;
}

function updateDatabaseRequirements(dbReq) {
    const reqList = document.querySelector('.requirements-list ul');
    if (reqList) {
        reqList.innerHTML = `
            <li>PostgreSQL версии ${dbReq.postgresql}</li>
            <li>${dbReq.cpu} vCPU и ${dbReq.memory} GB оперативной памяти</li>
            <li>SSD хранилище не менее ${dbReq.storage} GB</li>
            <li>Сетевой канал не менее ${dbReq.network}</li>
            <li>Резервное копирование с ${dbReq.backup}</li>
            <li>Мониторинг и алертинг (${dbReq.monitoring})</li>
            <li>Сценарий: ${dbReq.scenario}, нагрузка на БД: ${dbReq.dbLoad} операций/сек</li>
        `;
    }
}


function exportToCSV() {
    if (!window.lastCalculationResults) {
        if (window.showToast) {
            window.showToast('Сначала выполните расчет', 'warning');
        } else {
            alert('Сначала выполните расчет');
        }
        return;
    }
    
    const results = window.lastCalculationResults;
    
    // Получаем входные параметры для добавления дополнительных опций
    const inputs = getHybridInputValues ? getHybridInputValues() : {};
    
    // Получаем данные CI если модуль активен
    const isCIEnabled = window.isCISelected && window.isCISelected();
    const ciData = isCIEnabled ? window.getCIData && window.getCIData() : null;
    
    // Формируем CSV контент
    let csv = 'Параметр,Значение\n';
    csv += 'Профиль конфигурации,' + results.profileName + '\n';
    
    // Дополнительные опции конфигурации
    if (inputs.authMethod) {
        csv += '\nКонфигурация\n';
        csv += 'Метод аутентификации,' + inputs.authMethod + '\n';
        if (inputs.authMethod === 'EAP-TLS') {
            csv += 'OCSP проверка сертификатов,' + (inputs.ocspEnabled ? 'Включена' : 'Отключена') + '\n';
        }
        if (inputs.authMethod === 'MAB') {
            csv += 'MAC-спуфинг защита,' + (inputs.spoofingEnabled ? 'Включена' : 'Отключена') + '\n';
        }
        if (isCIEnabled) {
            csv += 'Config Inspector (CI),Включен - мониторинг конфигураций устройств\n';
        }
    }
    csv += '\nБизнес-показатели\n';
    csv += 'Минимальное количество подов,' + results.minPods + '\n';
    csv += 'Рекомендуемое количество подов,' + results.recommendedPods + '\n';
    csv += 'CPU на ноду (vCPU),' + results.nodeCpu + '\n';
    csv += 'Минимальная частота CPU (ГГц),≥2.0\n';
    csv += 'Память на ноду (GiB),' + results.nodeMemory + '\n';
    csv += 'Хранилище на ноду (GB),' + results.nodeStorage + '\n';
    csv += 'Общий CPU на кластер (vCPU),' + results.totalCpu + '\n';
    csv += 'Общая память на кластер (GiB),' + results.totalMemory + '\n';
    csv += '\nТехнические показатели\n';
    csv += 'Целевой RPS (запросов/сек),' + results.targetRps + '\n';
    csv += 'RPS на под,' + results.rpsPerPod + '\n';
    csv += 'CPU лимит на под (mCPU),' + results.podCpuLimit + '\n';
    csv += 'CPU request на под (mCPU),' + results.podCpuRequest + '\n';
    csv += 'Память лимит на под (MiB),' + results.podMemLimit + '\n';
    csv += 'Память request на под (MiB),' + results.podMemRequest + '\n';
    
    // Добавляем информацию о БД если есть
    if (results.dbRequirements) {
        csv += '\nТребования к БД\n';
        csv += 'CPU БД (vCPU),' + results.dbRequirements.cpu + '\n';
        csv += 'Память БД (ГБ),' + results.dbRequirements.memory + '\n';
        csv += 'Хранилище БД (ГБ),' + results.dbRequirements.storage + '\n';
        csv += 'Kubernetes ноды БД,Внешний сервис\n';
    }
    
    // Добавляем информацию о CI если модуль включен
    if (isCIEnabled && ciData) {
        csv += '\nConfig Inspector (CI)\n';
        csv += 'Устройств под управлением,' + (ciData.totalDevices || 0) + ' шт\n';
        csv += 'Потребление CPU,' + (ciData.cpuUsageMax || 0).toFixed(1) + ' vCPU на кластер\n';
        csv += 'Потребление памяти,' + (ciData.memoryUsageMax || 0).toFixed(1) + ' ГБ на кластер\n';
        csv += 'Время выполнения отчетов (первичных),' + (ciData.reportTimePrimary || 0).toFixed(2) + ' ч\n';
        csv += 'Время выполнения отчетов (вторичных),' + (ciData.reportTimeSecondary || 0).toFixed(2) + ' ч\n';
    }
    
    // Создаем blob и скачиваем
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'nac_calculator_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Фоллбэк функция для копирования в буфер обмена
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
        const successful = document.execCommand('copy');
        const msg = successful ? 'Результаты скопированы в буфер обмена' : 'Не удалось скопировать результаты';
        alert(msg);
    } catch (err) {
        alert('Ошибка при копировании: ' + err);
    }
    
    document.body.removeChild(textArea);
}

function copyToClipboard() {
    if (!window.lastCalculationResults) {
        if (window.showToast) {
            window.showToast('Сначала выполните расчет', 'warning');
        } else {
            alert('Сначала выполните расчет');
        }
        return;
    }
    
    const results = window.lastCalculationResults;
    console.log('Copy results:', results);
    
    let text = 'Результаты расчета калькулятора NAC\n';
    text += '=====================================\n\n';
    text += 'Конфигурация: ' + results.inputs.devices + ' устройств, ' + results.inputs.authMethod;
    if (results.inputs.authMethod === 'EAP-TLS' && results.inputs.ocspEnabled) {
        text += ' с OCSP';
    }
    text += '\n\n';
    
    text += 'БИЗНЕС-ПОКАЗАТЕЛИ:\n\n';
    text += 'Требования к аппаратному обеспечению:\n';
    text += '• Количество серверов: ' + results.inputs.nodeCount + ' шт\n';
    text += '• NAC комплекс + СУБД\n\n';
    
    text += 'Параметры серверов:\n';
    text += '                    Сервер NAC комплекса    Сервер СУБД\n';
    text += 'Процессор:          от ' + results.nodeCpu + ' vCPU, ≥2.0 ГГц    от ' + results.dbRequirements.cpu + ' vCPU, ≥2.0 ГГц\n';
    text += 'Оперативная память: от ' + results.nodeMemory + ' ГБ               от ' + results.dbRequirements.memory + ' ГБ\n';
    text += 'Жесткий диск:       от ' + results.nodeStorage + ' ГБ              от ' + results.dbRequirements.storage + ' ГБ\n';
    text += 'Сетевая карта:      от 10 Гбит/с            от ' + results.dbRequirements.network + '\n\n';
    
    text += 'ТЕХНИЧЕСКИЕ ПОКАЗАТЕЛИ:\n';
    text += '• Количество нод Kubernetes: ' + results.inputs.nodeCount + ' шт\n';
    text += '• CPU на ноду: ' + results.nodeCpu + ' vCPU\n';
    text += '• Память на ноду: ' + results.nodeMemory + ' GiB\n';
    text += '• Количество подов: ' + results.recommendedPods + '\n';
    text += '• CPU лимит на под: ' + results.podCpuLimit + ' mCPU\n';
    text += '• Память лимит на под: ' + results.podMemLimit + ' MiB\n';
    
    // Проверяем доступность API clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Результаты скопированы в буфер обмена');
        }).catch(err => {
            // Фоллбэк для случаев без HTTPS
            fallbackCopyToClipboard(text);
        });
    } else {
        // Используем фоллбэк для старых браузеров или не-HTTPS
        fallbackCopyToClipboard(text);
    }
}

function calculateDatabaseRequirements(inputs, targetRps) {
    const baseRequirements = {
        postgresql: "15+",
        cpu: 4,
        memory: 16,
        storage: 500,
        network: "1 Gbps",
        backup: "RPO ≤ 24ч",
        monitoring: "Prometheus + Grafana"
    };
    
    // Коэффициенты нагрузки на СУБД в зависимости от метода аутентификации
    const dbLoadCoefficients = {
        'MAB': 0.3,     // MAC адреса - легкие операции
        'PEAP': 0.6,    // Проверка пароля - средние операции  
        'EAP-TLS': 0.8  // Сертификаты - тяжелые операции
    };
    
    const loadCoeff = dbLoadCoefficients[inputs.authMethod] || 0.5;
    const dbLoad = targetRps * loadCoeff;
    
    // Масштабирование ресурсов в зависимости от нагрузки
    let scaledCpu = baseRequirements.cpu;
    let scaledMemory = baseRequirements.memory;
    let scaledStorage = baseRequirements.storage;
    
    // Увеличиваем ресурсы при высокой нагрузке
    if (dbLoad > 50) {
        scaledCpu = Math.max(8, Math.ceil(dbLoad / 25) * 2);
        scaledMemory = Math.max(32, Math.ceil(dbLoad / 25) * 8);
        scaledStorage = Math.max(1000, Math.ceil(dbLoad / 10) * 100);
    } else if (dbLoad > 20) {
        scaledCpu = 6;
        scaledMemory = 24;
        scaledStorage = 750;
    }
    
    
    return {
        postgresql: baseRequirements.postgresql,
        cpu: scaledCpu,
        memory: scaledMemory,
        storage: scaledStorage,
        network: baseRequirements.network,
        backup: baseRequirements.backup,
        monitoring: baseRequirements.monitoring,
        dbLoad: dbLoad.toFixed(1),
        scenario: inputs.authMethod + (inputs.ocspEnabled ? ' + OCSP' : '')
    };
}