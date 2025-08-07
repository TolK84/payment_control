const app = Vue.createApp({
    data() {
        return {
            authState: 'checking',
            userRole: '',
            login: '',
            password: '',
            message: '',
            messageColor: 'red',
            isLoading: false,
            checkAuthWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/check-auth',
            loginWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/login',
            isDesktop: false,
            isFullscreen: false
        };
    },
    methods: {
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
            this.message = 'Проверка...';
            this.messageColor = 'black';

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

                if (result.status === 'success') {
                    this.authState = 'authenticated';
                    this.userRole = result.role;
                } else {
                    this.message = result.message || 'Неверный логин или пароль.';
                    this.messageColor = 'red';
                    this.isLoading = false;
                }
            } catch (error) {
                this.message = 'Ошибка сети. Попробуйте снова.';
                this.messageColor = 'red';
                this.isLoading = false;
            }
        },
        async toggleFullscreen() {
            try {
                const viewport = window.Telegram.WebApp.viewport;
                if (this.isFullscreen && viewport.exitFullscreen?.isAvailable()) {
                    await viewport.exitFullscreen();
                } else if (!this.isFullscreen && viewport.requestFullscreen?.isAvailable()) {
                    await viewport.requestFullscreen();
                }
            } catch (err) {
                console.warn('Ошибка при переключении fullscreen:', err);
            }
        },
        updateFullscreenStatus() {
            this.isFullscreen = window.Telegram.WebApp.viewport.isFullscreen;
        }
    },
    mounted() {
        if (window.Telegram && window.Telegram.WebApp) {
            const WebApp = window.Telegram.WebApp;

            WebApp.ready();

            this.isDesktop = WebApp.platform === 'tdesktop';
            this.updateFullscreenStatus();

            this.checkAuthentication();

            // Подписка на событие изменения fullscreen
            WebApp.onEvent('viewportChanged', this.updateFullscreenStatus);
        }
    }
});

app.component('user-dashboard', UserDashboard);
app.component('admin-dashboard', AdminDashboard);

app.mount('#app');
