// Управление интерфейсом калькулятора

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Настраиваем обработчики событий
    setupEventListeners();
    
    // Инициализируем видимость элементов
    updateUIVisibility();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработчик изменения метода аутентификации
    const authMethodSelect = document.getElementById('authMethod');
    authMethodSelect.addEventListener('change', function() {
        updateOCSPVisibility();
        hideResults();
    });
    
    // Обработчик для чекбокса Gateway
    const gatewayCheckbox = document.getElementById('gatewayEnabled');
    gatewayCheckbox.addEventListener('change', function() {
        updateGatewayOverheadVisibility();
        hideResults();
    });
    
    // Обработчики для всех инпутов - скрываем результаты при изменении
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', hideResults);
    });
    
    // Обработчик для кнопки расчета (Enter в любом поле)
    const formInputs = document.querySelectorAll('.input-section input');
    formInputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                calculate();
            }
        });
    });
    
    // Добавляем анимацию при фокусе на инпуты
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.select();
        });
    });
}

// Обновление видимости элементов интерфейса
function updateUIVisibility() {
    updateOCSPVisibility();
    updateGatewayOverheadVisibility();
}

// Показать/скрыть поле OCSP в зависимости от метода аутентификации
function updateOCSPVisibility() {
    const authMethod = document.getElementById('authMethod').value;
    const ocspGroup = document.getElementById('ocspGroup');
    
    if (authMethod === 'EAP-TLS') {
        ocspGroup.style.display = 'block';
        // Анимация появления
        ocspGroup.style.opacity = '0';
        setTimeout(() => {
            ocspGroup.style.transition = 'opacity 0.3s ease';
            ocspGroup.style.opacity = '1';
        }, 10);
    } else {
        ocspGroup.style.display = 'none';
        document.getElementById('ocspEnabled').checked = false;
    }
}

// Показать/скрыть поле надбавки Gateway
function updateGatewayOverheadVisibility() {
    const gatewayEnabled = document.getElementById('gatewayEnabled').checked;
    const gatewayOverheadGroup = document.getElementById('gatewayOverheadGroup');
    
    if (gatewayEnabled) {
        gatewayOverheadGroup.style.display = 'block';
        gatewayOverheadGroup.style.opacity = '0';
        setTimeout(() => {
            gatewayOverheadGroup.style.transition = 'opacity 0.3s ease';
            gatewayOverheadGroup.style.opacity = '1';
        }, 10);
    } else {
        gatewayOverheadGroup.style.display = 'none';
    }
}

// Скрыть результаты при изменении входных данных
function hideResults() {
    const resultsSection = document.getElementById('results');
    if (resultsSection.style.display === 'block') {
        resultsSection.style.opacity = '0.5';
        resultsSection.style.transition = 'opacity 0.3s ease';
        
        // Добавляем индикатор необходимости пересчета
        const calculateBtn = document.querySelector('.calculate-btn');
        if (!calculateBtn.classList.contains('needs-recalc')) {
            calculateBtn.classList.add('needs-recalc');
            calculateBtn.style.animation = 'pulse 1s infinite';
        }
    }
}

// Добавляем CSS анимацию для кнопки пересчета
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% {
            box-shadow: 0 4px 15px rgba(0, 94, 184, 0.3);
        }
        50% {
            box-shadow: 0 4px 20px rgba(0, 94, 184, 0.6);
        }
        100% {
            box-shadow: 0 4px 15px rgba(0, 94, 184, 0.3);
        }
    }
    
    .calculate-btn.needs-recalc {
        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    }
`;
document.head.appendChild(style);

// Сброс индикатора пересчета после расчета
const originalCalculate = window.calculate;
window.calculate = function() {
    const calculateBtn = document.querySelector('.calculate-btn');
    calculateBtn.classList.remove('needs-recalc');
    calculateBtn.style.animation = '';
    
    const resultsSection = document.getElementById('results');
    resultsSection.style.opacity = '1';
    
    originalCalculate();
};

// Функция для форматирования чисел с разделителями тысяч
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Улучшенное отображение результатов с форматированием
const originalDisplayResults = window.displayResults;
window.displayResults = function(results) {
    // Вызываем оригинальную функцию
    originalDisplayResults(results);
    
    // Добавляем форматирование больших чисел
    const largeNumbers = ['podCpuLimit', 'podCpuRequest', 'podMemLimit', 'podMemRequest'];
    largeNumbers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const value = parseInt(element.textContent);
            if (!isNaN(value)) {
                element.textContent = formatNumber(value);
            }
        }
    });
    
    // Добавляем анимацию появления результатов
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 50);
    });
};

// Добавляем визуальную обратную связь при наведении на результаты
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем возможность копирования отдельных значений
    setTimeout(() => {
        const resultValues = document.querySelectorAll('.result-value');
        resultValues.forEach(value => {
            value.style.cursor = 'pointer';
            value.title = 'Нажмите для копирования';
            
            value.addEventListener('click', function() {
                const text = this.textContent;
                const label = this.previousElementSibling.textContent.replace(':', '');
                
                navigator.clipboard.writeText(text).then(() => {
                    // Временно показываем индикатор копирования
                    const originalText = this.textContent;
                    this.textContent = 'Скопировано!';
                    this.style.color = '#28a745';
                    
                    setTimeout(() => {
                        this.textContent = originalText;
                        this.style.color = '';
                    }, 1000);
                });
            });
        });
    }, 100);
});

// Валидация в реальном времени
document.addEventListener('DOMContentLoaded', function() {
    const deviceInput = document.getElementById('devices');
    const concurrentInput = document.getElementById('concurrentPct');
    const burstInput = document.getElementById('burstWindow');
    const headroomInput = document.getElementById('headroom');
    const gatewayInput = document.getElementById('gatewayOverhead');
    const nodeInput = document.getElementById('nodeCount');
    
    // Функция валидации для числовых инпутов
    function validateNumberInput(input, min, max) {
        input.addEventListener('input', function() {
            const value = parseFloat(this.value);
            
            if (isNaN(value) || value < min || value > max) {
                this.style.borderColor = '#dc3545';
                this.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.1)';
            } else {
                this.style.borderColor = '';
                this.style.boxShadow = '';
            }
        });
        
        // Автокоррекция при потере фокуса
        input.addEventListener('blur', function() {
            const value = parseFloat(this.value);
            
            if (isNaN(value) || value < min) {
                this.value = min;
            } else if (value > max) {
                this.value = max;
            }
            
            this.style.borderColor = '';
            this.style.boxShadow = '';
        });
    }
    
    // Применяем валидацию
    validateNumberInput(deviceInput, 1000, 20000);
    validateNumberInput(concurrentInput, 1, 100);
    validateNumberInput(burstInput, 10, 300);
    validateNumberInput(headroomInput, 0, 100);
    validateNumberInput(gatewayInput, 0, 50);
    validateNumberInput(nodeInput, 1, 10);
});