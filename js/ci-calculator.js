// CI Calculator Module - Config Inspector Integration
// Взаимодействие с API бекенда для расчета ресурсов CI

// Глобальные переменные
let ciDevices = [];
let lastCIResults = null;

// Helpers for tolerant key lookups in CI API responses with Russian labels
function normalizeKeyLabel(label) {
    if (label == null) return '';
    return String(label)
        .toLowerCase()
        .replace(/[ё]/g, 'е')
        .replace(/[\s\u00A0\u202F\u2009]+/g, '') // all spaces incl. NBSP/narrow
        .replace(/[.,;:()"'`«»\-–—]/g, '') // punctuation and dashes
        .replace(/№/g, 'no'); // normalize numero sign
}

function buildKeyIndex(obj) {
    const idx = {};
    Object.keys(obj || {}).forEach((k) => {
        idx[normalizeKeyLabel(k)] = k;
    });
    return idx;
}

function getField(obj, idx, label) {
    if (!obj) return undefined;
    if (label in obj) return obj[label];
    const normalized = normalizeKeyLabel(label);
    const orig = idx[normalized];
    return orig !== undefined ? obj[orig] : undefined;
}

function getNumber(obj, idx, label) {
    const v = getField(obj, idx, label);
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : null;
}

// API Configuration
const CI_API_BASE_URL = 'http://127.0.0.1:8888';
// Временно отключен из-за недоступности
// const CI_API_FALLBACK_URL = 'http://sizing-calc.edo.dev.da.lan:8000';

// Функция для добавления устройства в таблицу
function addDeviceRow(deviceType = null, deviceCount = null) {
    const tableBody = document.getElementById('deviceTableBody');
    const deviceSelector = document.getElementById('deviceTypeSelector');
    const countInput = document.getElementById('quickAddCount');
    
    // Определяем тип устройства
    const selectedType = deviceType || deviceSelector.value;
    
    // Определяем количество (из параметра или из input)
    const count = deviceCount || parseInt(countInput?.value) || 1;
    
    // Проверяем, есть ли уже такое устройство
    const existingRow = Array.from(tableBody.rows).find(row => {
        const nameInput = row.querySelector('input[data-device-type]');
        return nameInput && nameInput.getAttribute('data-device-type') === selectedType;
    });
    
    if (existingRow) {
        // Если устройство уже есть, увеличиваем количество
        const existingCountInput = existingRow.querySelector('input[type="number"]');
        existingCountInput.value = parseInt(existingCountInput.value) + count;
        updateDeviceInArray(selectedType, parseInt(existingCountInput.value));
    } else {
        // Создаем новую строку
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="text" readonly 
                       data-device-type="${selectedType}" 
                       value="${selectedType}" 
                       class="device-name-input">
            </td>
            <td>
                <input type="number" 
                       min="0" 
                       value="${count}" 
                       class="device-count-input"
                       oninput="updateDeviceCount(this)">
            </td>
            <td>
                <button type="button" 
                        class="remove-device-btn" 
                        onclick="removeDeviceRow(this)"
                        title="Удалить устройство">
                    ❌
                </button>
            </td>
        `;
        tableBody.appendChild(row);
        
        // Добавляем в массив устройств
        ciDevices.push({
            type: selectedType,
            count: count
        });
    }
    
    // Сбрасываем поле количества после добавления
    if (countInput) {
        countInput.value = '1';
    }
    
    updateDevicesSummary();
}

// Функция для удаления строки устройства
function removeDeviceRow(button) {
    const row = button.closest('tr');
    const deviceType = row.querySelector('[data-device-type]').getAttribute('data-device-type');
    
    // Удаляем из массива
    ciDevices = ciDevices.filter(device => device.type !== deviceType);
    
    // Удаляем строку
    row.remove();
    
    updateDevicesSummary();
    
    // Проверяем, остались ли активные CI устройства
    checkCIDevicesAndSwitchToNAC();
}

// Функция для обновления количества устройств
function updateDeviceCount(input) {
    const row = input.closest('tr');
    const deviceType = row.querySelector('[data-device-type]').getAttribute('data-device-type');
    const newCount = parseInt(input.value) || 0;
    
    // Всегда обновляем количество в массиве, даже если 0
    updateDeviceInArray(deviceType, newCount);
    updateDevicesSummary();
    
    // Проверяем, остались ли активные CI устройства
    checkCIDevicesAndSwitchToNAC();
}

// Функция для обновления устройства в массиве
function updateDeviceInArray(deviceType, count) {
    const device = ciDevices.find(d => d.type === deviceType);
    if (device) {
        device.count = count;
    }
}

// Функция для обновления сводки устройств
function updateDevicesSummary() {
    const totalCount = ciDevices.reduce((sum, device) => sum + device.count, 0);
    const typesCount = ciDevices.filter(device => device.count > 0).length;
    
    document.getElementById('totalDevicesCount').textContent = totalCount;
    document.getElementById('deviceTypesCount').textContent = typesCount;
}

// Функция для получения данных от CI API
async function calculateCIResources() {
    // Проверяем, есть ли устройства с количеством > 0
    const hasActiveDevices = ciDevices.some(device => device.count > 0);
    if (!hasActiveDevices) {
        return null;
    }
    
    const marginCoeff = parseFloat(document.getElementById('ciMarginCoeff').value) || 1.2;
    
    // Полный список всех возможных устройств в том же порядке, что и в API
    const allDeviceTypes = [
        "обощенное устройство",
        "Cisco IOS (FA)",
        "Cisco IOS (NA, FA, ICC, VC)",
        "Cisco IOS (NA)",
        "Linux (FA)",
        "Linux (ICC)",
        "Linux (NA, FA, ICC, VC)",
        "Linux (NA)",
        "Postgres (ICC)",
        "Windows (ICC)",
        "Dionis-NX (NA)"
    ];
    
    // Создаем массив количеств для всех устройств
    const allDeviceCounts = allDeviceTypes.map(deviceType => {
        const device = ciDevices.find(d => d.type === deviceType);
        return device ? device.count : 0;
    });
    
    // Подготавливаем данные для API
    const requestData = {
        filter_by: ["devices", allDeviceTypes, false],
        num_devices: allDeviceCounts,
        cont_margin: marginCoeff
    };
    
    console.log('CI API Request:', requestData);
    console.log('Request JSON:', JSON.stringify(requestData, null, 2));
    
    try {
        // Пробуем основной URL
        const url = `${CI_API_BASE_URL}/calculator/table`;
        console.log('Sending request to:', url);
        
        let response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        }, 5000);
        
        if (!response.ok) {
            // Пытаемся получить детали ошибки из ответа
            let errorDetail = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorData.message || errorDetail;
                console.error('Server error response:', errorData);
            } catch (e) {
                // Если не удалось распарсить JSON ответ
                console.error('Could not parse error response');
            }
            throw new Error(errorDetail);
        }
        
        let data = await response.json();
        return processCIResponse(data);
        
    } catch (error) {
        // Определяем тип ошибки для более точной диагностики
        let errorMessage = 'CI API недоступен';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Не удается подключиться к CI API (проверьте CORS и что сервер запущен)';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `CI API ошибка: ${error.message}`;
        } else {
            errorMessage = `Ошибка: ${error.message}`;
        }
        
        console.error('CI API Error:', error);
        console.log('Убедитесь, что бекенд запущен на http://127.0.0.1:8888');
        
        // Показываем уведомление пользователю с деталями
        showCIErrorNotification(errorMessage);
        
        return null;
    }
}

// Функция для показа уведомления об ошибке CI API
function showCIErrorNotification(errorMessage = 'CI API недоступен') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b6b;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
    `;
    notification.innerHTML = `
        <strong>⚠️ Ошибка CI API</strong><br>
        ${errorMessage}<br>
        <small style="opacity: 0.9; margin-top: 8px; display: block;">
            Убедитесь, что бекенд запущен и настроен CORS для http://127.0.0.1:8888
        </small>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 7000);
}

// Функция для показа предупреждения о недостающих данных
function showCIWarningNotification(warningMessage = 'Нет данных о производительности') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffa94d;
        color: #2e2e2e;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
    `;
    notification.innerHTML = `
        <strong>⚠️ Внимание</strong><br>
        ${warningMessage}
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 8000);
}

// Вспомогательная функция для запросов с таймаутом
function fetchWithTimeout(url, options, timeout) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

// Функция для обработки ответа от CI API
function processCIResponse(data) {
    console.log('CI API Response:', data);
    
    // Парсим JSON response (может прийти как строка)
    let parsedData;
    try {
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        console.error('Failed to parse CI response:', e);
        return null;
    }
    
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
        console.error('Invalid CI response format');
        return null;
    }
    
    // Ищем строку "Итого" с устройством "-" - она уже содержит данные с коэффициентом запаса
    // Строим индекс ключей для каждого объекта, чтобы устойчиво извлекать поля
    const rowsWithIndex = parsedData.map((item) => ({ item, idx: buildKeyIndex(item) }));
    const totalRowEntry = rowsWithIndex.find(({ item, idx }) => getField(item, idx, 'Устройства') === '-');
    const totalRow = totalRowEntry ? totalRowEntry.item : null;
    const totalIdx = totalRowEntry ? totalRowEntry.idx : {};
    
    if (!totalRow) {
        console.error('Не найдена строка "Итого" в ответе CI API');
        return null;
    }
    
    console.log('Found CI Total Row:', totalRow);
    
    // Используем данные из строки "Итого" (с учетом возможных вариаций ключей)
    const totalDevices = getNumber(totalRow, totalIdx, 'Количество устройств') ?? 0;
    const totalCpuUsageAvg = getNumber(totalRow, totalIdx, 'ЦПУ, срдн., № ядер') ?? 0;
    const totalCpuUsageMax = getNumber(totalRow, totalIdx, 'ЦПУ, макс., № ядер') ?? 0;
    const totalMemUsageAvg = getNumber(totalRow, totalIdx, 'Память, срдн., Гб') ?? 0;
    const totalMemUsageMax = getNumber(totalRow, totalIdx, 'Память, макс., Гб') ?? 0;
    const totalReportTimePrimary = getNumber(totalRow, totalIdx, 'Длительность запроса отчётов (Первичная)') ?? 0;
    const totalReportTimeSecondary = getNumber(totalRow, totalIdx, 'Длительность запроса отчётов (Повторная)') ?? 0;
    
    // Проверяем, есть ли валидные данные
    const validDataFound = totalCpuUsageAvg > 0 || totalCpuUsageMax > 0 || totalMemUsageAvg > 0 || totalMemUsageMax > 0;
    
    // Для отладки выводим информацию о каждом устройстве (кроме итого)
    let devicesWithoutData = [];
    rowsWithIndex.forEach(({ item, idx }) => {
        // Пропускаем строку итого
        const devName = getField(item, idx, 'Устройства');
        if (devName === '-' || devName === null) {
            return;
        }
        
        // Для отладки выводим информацию о каждом устройстве
        const deviceCount = getNumber(item, idx, 'Количество устройств') ?? 0;
        const deviceType = devName;
        
        // Проверяем, есть ли валидные данные (не null)
        const cpuAvg = getNumber(item, idx, 'ЦПУ, срдн., № ядер');
        const cpuMax = getNumber(item, idx, 'ЦПУ, макс., № ядер');
        const memAvg = getNumber(item, idx, 'Память, срдн., Гб');
        const memMax = getNumber(item, idx, 'Память, макс., Гб');
        
        const hasValidPerformanceData = [cpuAvg, cpuMax, memAvg, memMax].some(Number.isFinite);
        
        if (!hasValidPerformanceData && deviceCount > 0) {
            // Устройство есть, но данных производительности нет
            devicesWithoutData.push(deviceType);
        }
        
        console.log('Device CI info:', {
            type: deviceType,
            count: deviceCount,
            hasPerformanceData: hasValidPerformanceData,
            cpuAvg: Number.isFinite(cpuAvg) ? (cpuAvg + ' vCPU') : '-',
            cpuMax: Number.isFinite(cpuMax) ? (cpuMax + ' vCPU') : '-', 
            memAvg: Number.isFinite(memAvg) ? (memAvg + ' GB') : '-',
            memMax: Number.isFinite(memMax) ? (memMax + ' GB') : '-',
            reportPrimary: (getNumber(item, idx, 'Длительность запроса отчётов (Первичная)') ?? '-') + ' ч',
            reportSecondary: (getNumber(item, idx, 'Длительность запроса отчётов (Повторная)') ?? '-') + ' ч'
        });
    });
    
    // Если нет валидных данных производительности, показываем предупреждение
    if (!validDataFound && totalDevices > 0) {
        console.warn('⚠️ CI API вернул устройства без данных производительности:', devicesWithoutData);
        
        // Показываем уведомление пользователю
        const deviceList = devicesWithoutData.join(', ');
        showCIWarningNotification(`Устройства без данных производительности: ${deviceList}.`);
    } else if (devicesWithoutData.length > 0 && validDataFound) {
        // Есть как устройства с данными, так и без данных
        console.warn('⚠️ Некоторые устройства не имеют данных производительности:', devicesWithoutData);
        const deviceList = devicesWithoutData.join(', ');
        showCIWarningNotification(`Частичные данные: устройства "${deviceList}" не имеют данных производительности.`);
    }
    
    // Возвращаем обработанные данные
    const result = {
        totalDevices: totalDevices,
        cpuUsageAvg: totalCpuUsageAvg,
        cpuUsageMax: totalCpuUsageMax,
        memoryUsageAvg: totalMemUsageAvg,
        memoryUsageMax: totalMemUsageMax,
        reportTimePrimary: totalReportTimePrimary,
        reportTimeSecondary: totalReportTimeSecondary,
        rawData: parsedData,
        hasValidData: validDataFound,
        devicesWithoutData: devicesWithoutData
    };
    
    console.log('Processed CI results:', result);
    console.log('=== CI TOTALS (from Total Row with coeff) ===');
    console.log('Total Devices:', totalDevices);
    console.log('Total CPU Max:', totalCpuUsageMax, 'vCPU (with coefficient)');
    console.log('Total Memory Max:', totalMemUsageMax, 'GB (with coefficient)');
    console.log('Coefficient applied:', getField(totalRow, totalIdx, 'Коэффициент безопасного использования'));
    console.log('=============================================');
    lastCIResults = result;
    
    return result;
}

// Функция для получения данных CI (используется в hybrid.js)
function getCIData() {
    return lastCIResults;
}

// Функция для проверки, включен ли CI модуль
function isCIEnabled() {
    return isCISelected && isCISelected() && ciDevices.some(device => device.count > 0);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем одно устройство по умолчанию при активации CI
    // (будет вызвано через updateCalculatorSections при выборе модуля)
});

// Функция для сброса CI данных
function resetCIData() {
    ciDevices = [];
    lastCIResults = null;
    const tableBody = document.getElementById('deviceTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    updateDevicesSummary();
}

// Функция для проверки CI устройств и переключения на NAC
function checkCIDevicesAndSwitchToNAC() {
    // Проверяем, есть ли активные устройства (с количеством > 0)
    const hasActiveDevices = ciDevices.some(device => device.count > 0);
    
    if (!hasActiveDevices) {
        console.log('Нет активных CI устройств, переключаемся на NAC таб');
        
        // Переключаемся на NAC таб
        if (window.switchInfoTab) {
            window.switchInfoTab('nac');
        }
        
        // Делаем пересчет только NAC данных
        if (window.performHybridCalculation) {
            window.performHybridCalculation();
        }
    }
}

// Экспортируем функции для использования в других модулях
window.addDeviceRow = addDeviceRow;
window.removeDeviceRow = removeDeviceRow;
window.updateDeviceCount = updateDeviceCount;
window.calculateCIResources = calculateCIResources;
window.getCIData = getCIData;
window.isCIEnabled = isCIEnabled;
window.resetCIData = resetCIData;
