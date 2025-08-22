// filepath: d:\Git\payment_control\app.js
const app = Vue.createApp({
    data() {
        return {
            authState: 'checking', 
            userRole: '',
            userName: '',
            login: '',
            password: '',
            message: '',
            messageColor: 'green', // Устанавливаем зеленый по умолчанию
            isLoading: false,
            checkAuthWebhookUrl: 'https://mfs-650.app.n8n.cloud/webhook/check-auth',
            loginWebhookUrl: 'https://mfs-650.app.n8n.cloud/webhook/login',
            isDesktop: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.platform === 'tdesktop' : false,
            hasFiles: false
        }
    },
    methods: {
        handleFilesChanged(count) {
            this.hasFiles = count > 0;
        },
        adjustBottomPadding() {
            const tg = window.Telegram.WebApp;
            if (!tg) return;

            const platform = tg.platform;
            const bottomNav = document.querySelector('.bottom-navigation');
            
            if (bottomNav) {
                if (platform === 'ios') {
                    bottomNav.style.bottom = '50px';
                } else if (platform === 'tdesktop' || platform === 'weba' || platform === 'webk') {
                    bottomNav.style.bottom = '50px';
                } else {
                    bottomNav.style.bottom = '40px';
                }
            }
        },
        async checkAuthentication() {
            try {
                const response = await fetch(this.checkAuthWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
                });
                const result = await response.json();
                console.log('Результат проверки авторизации:', result);
                
                // Проверяем если ответ - массив и содержит объект с активированным статусом
                if (Array.isArray(result) && result.length > 0 && result[0].status === 'активировано') {
                    const user = result[0];
                    
                    // Определяем роль на основе логина
                    let userRole = 'user';
                    if (user.login === 'admin' || user.login === 'tolk') {
                        userRole = 'admin';
                    } else if (user.login === 'dameli' || user.login === 'dauren') {
                        userRole = 'approver';
                    }
                    
                    this.authState = 'authenticated';
                    this.userRole = userRole;
                    this.userName = user.login || '';
                } else {
                    this.authState = 'unauthenticated';
                }
            } catch (error) {
                this.authState = 'unauthenticated';
                this.message = 'Ошибка сети при проверке.';
            }
        },
        async processLogin() {
            this.isLoading = true;
            this.message = ''; // Очищаем сообщение, показываем только в кнопке
            try {
                const response = await fetch(this.loginWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login: this.login,
                        password: this.password,
                        tg_data: window.Telegram.WebApp.initData
                    })
                });
                const result = await response.json();
                console.log('Результат авторизации:', result);
                
                // Проверяем если ответ - массив и содержит объект с активированным статусом
                if (Array.isArray(result) && result.length > 0 && result[0].status === 'активировано') {
                    console.log('Авторизация успешна, показываем приветствие');
                    const user = result[0];
                    this.message = `Добро пожаловать, ${user.login || 'пользователь'}!`;
                    this.messageColor = 'green';
                    this.isLoading = false;
                    
                    // Определяем роль на основе логина
                    let userRole = 'user';
                    if (user.login === 'admin' || user.login === 'tolk') {
                        userRole = 'admin';
                    } else if (user.login === 'dameli' || user.login === 'dauren') {
                        userRole = 'approver';
                    }
                    
                    // Небольшая задержка для показа приветствия, затем переход
                    setTimeout(() => {
                        console.log('Переходим на дашборд');
                        this.authState = 'authenticated';
                        this.userRole = userRole;
                        this.userName = user.login || '';
                        this.message = ''; // Очищаем сообщение после перехода
                    }, 1500);
                } else {
                    console.log('Ошибка авторизации или неизвестный формат ответа:', result);
                    this.message = 'Неверный логин или пароль.';
                    this.messageColor = 'red';
                    this.isLoading = false;
                }
            } catch (error) {
                this.message = 'Ошибка сети. Попробуйте снова.';
                this.messageColor = 'red';
                this.isLoading = false;
            }
        }
    },
    mounted() {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            this.checkAuthentication();
            if (!this.isDesktop) {
                tg.expand();
            }

            // Динамическая корректировка отступов для разных платформ
            setTimeout(() => this.adjustBottomPadding(), 100);
        }
    }
});

app.component('user-dashboard', UserDashboard);
app.component('admin-dashboard', AdminDashboard);
app.component('approver-dashboard', ApproverDashboard);

app.mount('#app');
