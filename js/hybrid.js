let hybridSelectedMethod = '';

document.addEventListener('DOMContentLoaded', function() {
    setupScenarioCards();
    setupInputListeners();
    
    // Устанавливаем начальные значения accounting для MAB (по умолчанию)
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    if (accountingCheckbox) {
        accountingCheckbox.checked = true; // MAB - включен по умолчанию
    }
    
    // Инициализируем превью и выполняем начальный расчет
    updatePreview();
    performHybridCalculation(); // Начальный расчет с MAB
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
            const ocspSection = document.getElementById('hybridOcspSection');
            if (hybridSelectedMethod === 'EAP-TLS') {
                ocspSection.style.display = 'block';
            } else {
                ocspSection.style.display = 'none';
                document.getElementById('hybridOcspEnabled').checked = false;
            }
            
            // Устанавливаем значения по умолчанию для Accounting
            const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
            if (hybridSelectedMethod === 'MAB') {
                accountingCheckbox.checked = true; // для MAB включен по умолчанию
            } else {
                accountingCheckbox.checked = false; // для PEAP и EAP-TLS выключен по умолчанию
            }
            
            // Обновляем превью и пересчитываем
            updatePreview();
            performHybridCalculation();
        });
    });
}

function setupInputListeners() {
    const inputs = document.querySelectorAll('#hybridDevices, #hybridConcurrent, #hybridBurstWindow, #hybridHeadroom, #hybridGatewayOverhead, #hybridNodeCount');
    const checkboxes = document.querySelectorAll('#hybridOcspEnabled, #hybridGatewayEnabled, #hybridAccountingEnabled');
    
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
    
    // Показываем/скрываем OCSP
    const ocspSection = document.getElementById('hybridOcspSection');
    if (hybridSelectedMethod === 'EAP-TLS') {
        ocspSection.style.display = 'block';
    } else {
        ocspSection.style.display = 'none';
    }
    
    // Устанавливаем значения по умолчанию для Accounting
    const accountingCheckbox = document.getElementById('hybridAccountingEnabled');
    if (hybridSelectedMethod === 'MAB') {
        accountingCheckbox.checked = true; // для MAB включен по умолчанию
    } else {
        accountingCheckbox.checked = false; // для PEAP и EAP-TLS выключен по умолчанию
    }
    
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

function updatePreview() {
    // Функция оставлена для возможных будущих обновлений UI
}

function showScalingWarning(devices) {
    const warningDiv = document.getElementById('scalingWarning');
    const messageDiv = document.getElementById('scalingMessage');
    
    messageDiv.innerHTML = `
        Для <strong>${devices.toLocaleString()}</strong> устройств автоматически установлено <strong>5 нод</strong>.<br>
        <strong>Рекомендация:</strong> Для данной конфигурации рекомендуется использовать <strong>5-7 нод</strong> для обеспечения оптимальной производительности и отказоустойчивости.
    `;
    
    warningDiv.style.display = 'block';
    
    // Автоматически скрываем предупреждение через 10 секунд
    setTimeout(() => {
        warningDiv.style.display = 'none';
    }, 10000);
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
    
    // Автоматическое масштабирование для больших нагрузок
    if (devices > 20000 && nodeCount < 5) {
        nodeCount = 5;
        // Обновляем dropdown без вызова событий
        const nodeSelect = document.getElementById('hybridNodeCount');
        const currentValue = nodeSelect.value;
        if (currentValue !== "5") {
            nodeSelect.value = 5;
            // Показываем предупреждение только если реально изменили значение
            showScalingWarning(devices);
        }
    }
    
    return {
        devices: devices,
        authMethod: hybridSelectedMethod,
        ocspEnabled: document.getElementById('hybridOcspEnabled').checked,
        accountingEnabled: document.getElementById('hybridAccountingEnabled').checked,
        concurrentPct: parseFloat(document.getElementById('hybridConcurrent').value),
        burstWindow: parseInt(document.getElementById('hybridBurstWindow').value),
        headroom: parseFloat(document.getElementById('hybridHeadroom').value),
        gatewayEnabled: document.getElementById('hybridGatewayEnabled').checked,
        gatewayOverhead: parseFloat(document.getElementById('hybridGatewayOverhead').value),
        nodeCount: nodeCount
    };
}

function performHybridCalculation() {
    try {
        const inputs = getHybridInputValues();
        console.log('Hybrid inputs:', inputs);
        
        const results = performCalculations(inputs);
        console.log('Calculation results:', results);
        
        displayHybridResults(results);
    } catch (error) {
        console.error('Error in hybrid calculation:', error);
        // Показываем ошибку пользователю
        alert('Ошибка расчета: ' + error.message);
    }
}

function displayHybridResults(results) {
    // Бизнес-показатели - таблица требований к аппаратному обеспечению
    const inputs = getHybridInputValues();
    
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
    document.getElementById('hybridRpsPerPod').textContent = results.rpsPerPod;
    document.getElementById('hybridDbLoad').textContent = results.dbRequirements.dbLoad;
    
    // Обновляем детализацию модуля NAC
    if (results.nacRadiusDetails) {
        document.getElementById('rawNacMemory').textContent = results.nacRadiusDetails.rawNacMemoryGiB;
        document.getElementById('nacMemoryPercent').textContent = results.nacRadiusDetails.nacMemoryPercent;
        document.getElementById('baselineMemory').textContent = results.nacRadiusDetails.baselineMemoryGiB;
        document.getElementById('baselineMemoryPercent').textContent = results.nacRadiusDetails.baselineMemoryPercent;
        document.getElementById('totalCalculatedMemory').textContent = results.nacRadiusDetails.totalCalculatedMemory;
        document.getElementById('finalRoundedMemory').textContent = results.nacRadiusDetails.finalRoundedMemory;
        
        document.getElementById('rawNacCpu').textContent = results.nacRadiusDetails.rawNacCpuCores;
        document.getElementById('baselineCpu').textContent = results.nacRadiusDetails.baselineCpuCores;
        document.getElementById('totalCalculatedCpu').textContent = results.nacRadiusDetails.totalCalculatedCpu;
        document.getElementById('finalRoundedCpu').textContent = results.nacRadiusDetails.finalRoundedCpu;
    }
    
    // Сохраняем для экспорта
    window.lastCalculationResults = results;
}

function exportToPDF() {
    if (!window.lastCalculationResults) {
        alert('Сначала выполните расчет');
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
                margin: [0, 0, 0, 20]
            },

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
                        [{text: '', colSpan: 2}, ''],
                        [{text: 'Операционная система', style: 'bold'}, 'Astra Linux Special Edition, РЕД ОС (сертифицированные)'],
                        [{text: 'База данных', style: 'bold'}, 'PostgreSQL 14+, Jatoba (сертифицированные СУБД)'],
                        [{text: 'Контейнеризация', style: 'bold'}, 'Docker v25.0.5+, Docker-compose v2.4.0'],
                        [{text: 'Дополнительные сервисы', style: 'bold'}, 'Kafka, OpenSearch, MinIO, Nginx']
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

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
                        ['Процессор', `${results.totalCpu} ядер (2+ ГГц)`, `${results.dbRequirements.cpu} ядер (2+ ГГц)`],
                        ['Оперативная память', `${results.totalMemory} ГБ`, `${results.dbRequirements.memory} ГБ`],
                        ['Дисковое пространство', `${results.nodeStorage * inputs.nodeCount} ГБ SSD`, `${results.dbRequirements.storage} ГБ SSD`],
                        ['Сетевой интерфейс', '1 Гбит/с', '1 Гбит/с'],
                        ['Операционная система', 'Linux (Astra/РЕД ОС)', 'Linux (Astra/РЕД ОС)'],
                        ['Kubernetes ноды', `${inputs.nodeCount} шт`, 'Внешний сервис']
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
            
            // Примечания
            {
                text: 'ПРИМЕЧАНИЯ:',
                style: 'noteHeader',
                margin: [0, 0, 0, 10]
            },
            {
                ul: [
                    'Расчет выполнен для стандартной нагрузки',
                    'Встроенная PostgreSQL подходит для пилотной эксплуатации', 
                    'Для продуктивной среды рекомендуется внешняя СУБД',
                    'Все серверы должны иметь резервирование питания и сети'
                ],
                style: 'notes'
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