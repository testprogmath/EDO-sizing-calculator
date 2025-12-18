# Развертывание NAC Calculator

## Варианты развертывания

### 1. Простое развертывание (рекомендуемое)

Калькулятор - это статический сайт (HTML + JS + CSS), Docker не нужен.

#### На Linux сервере с nginx:

```bash
# 1. Установка nginx (Ubuntu/Debian)
sudo apt update
sudo apt install nginx

# 2. Копирование файлов
sudo cp -r . /var/www/html/nac-calculator/
sudo chown -R www-data:www-data /var/www/html/nac-calculator
sudo chmod -R 644 /var/www/html/nac-calculator
sudo chmod 755 /var/www/html/nac-calculator

# 3. Настройка nginx
sudo cp nginx.conf /etc/nginx/sites-available/nac-calculator
sudo ln -s /etc/nginx/sites-available/nac-calculator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### На любом веб-сервере:
Просто скопируйте все файлы в корневую директорию веб-сервера.

### 2. Azure DevOps Pipeline

Pipeline автоматически:
- ✅ Проверяет код
- ✅ Валидирует HTML/JS файлы  
- ✅ Создает артефакты
- ✅ Развертывает на сервер

#### Настройка pipeline:
1. Поместите `azure-pipelines.yml` в корень репозитория
2. В Azure DevOps создайте новый pipeline на основе этого файла
3. Настройте agent pool `efros-do-pool` с Linux агентами
4. Настройте environment `production` для деплоя

#### Автоматический деплой:
Pipeline может автоматически развертывать на сервер. Измените в `azure-pipelines.yml`:

```yaml
# Включите этот шаг для автоматического деплоя
- script: |
    WEB_DIR="/var/www/html/nac-calculator"  # Ваш путь
    # ... остальные команды
  condition: true  # Измените на true
```

### 3. Docker (если очень нужно)

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```bash
docker build -t nac-calculator .
docker run -d -p 80:80 nac-calculator
```

## Файловая структура

```
nac-calculator/
├── index.html           # Основной калькулятор
├── variant1.html        # Вариант 1
├── variant2.html        # Вариант 2  
├── variant3.html        # Вариант 3
├── js/
│   ├── calculator.js    # Логика расчетов
│   └── coefficients.js  # Коэффициенты
├── azure-pipelines.yml  # CI/CD pipeline
├── nginx.conf          # Конфиг nginx
└── DEPLOYMENT.md       # Эта инструкция
```

## Проверка развертывания

После развертывания проверьте:

1. **Доступность**: Откройте `http://your-server/`
2. **Функциональность**: 
   - Выберите количество устройств (например, 5000)
   - Выберите метод аутентификации (например, EAP-TLS)
   - Нажмите "Рассчитать"
   - Проверьте что появились результаты
3. **PDF экспорт**: Нажмите "Экспорт в PDF" и проверьте русский текст
4. **Excel экспорт**: Проверьте экспорт в CSV

## Мониторинг

Логи nginx:
```bash
# Ошибки
tail -f /var/log/nginx/nac-calculator.error.log

# Доступы
tail -f /var/log/nginx/nac-calculator.access.log
```

## Troubleshooting

### Проблема: Калькулятор не работает
- Проверьте что все JS файлы загружаются (F12 → Network)
- Проверьте консоль браузера на ошибки (F12 → Console)

### Проблема: PDF не экспортируется
- Убедитесь что PDFMake библиотеки загружаются
- Проверьте наличие интернет-соединения (библиотеки грузятся с CDN)

### Проблема: Кодировка PDF
- PDFMake должен корректно работать с кириллицей
- Если проблемы остались, проверьте версию браузера