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
            checkAuthWebhookUrl: 'https://n8n.eurasiantech.kz/webhook/check-auth',
            loginWebhookUrl: 'https://n8n.eurasiantech.kz/webhook/login',
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
                
                if (result.status === 'authenticated') {
                    this.authState = 'authenticated';
                    this.userRole = result.role;
                    this.userName = this.login;
                } else {
                    this.authState = 'unauthenticated';
                }
            } catch (error) {
                this.authState = 'unauthenticated';
            }
        },
        async processLogin() {
            this.isLoading = true;
            this.message = '';
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
                
                // Проверяем формат ответа с status: "authenticated"
                if (result.status === 'authenticated') {
                    this.message = result.message || `Добро пожаловать!`;
                    this.messageColor = 'green';
                    
                    setTimeout(() => {
                        this.authState = 'authenticated';
                        this.userRole = result.role;
                        this.userName = this.login;
                        this.message = '';
                        this.isLoading = false;
                    }, 1500);
                } else {
                    this.message = 'Неверный логин или пароль.';
                    this.messageColor = 'red';
                    this.isLoading = false;
                }
            } catch (error) {
                this.message = 'Ошибка сети.';
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
