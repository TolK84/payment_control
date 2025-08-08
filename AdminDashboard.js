const AdminDashboard = {
  template: `
  <div>
    <p v-if="uploadMessage" :style="{ color: uploadMessageColor, marginBottom: '10px', fontWeight: '500' }">
      {{ uploadMessage }}
    </p>

    <div v-if="!showingDocumentList" class="send-section">

      <h2 class="section-title">Отправка на согласование</h2>

      <p>Выберите файл для отправки:</p>

      <div 
        class="drop-zone"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        :class="{ 'drag-over': isDragOver }"
      >
        <p>Перетащите файл сюда или</p>
        <button @click="triggerFileInput" class="btn-secondary">+ Добавить файл</button>
        <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" accept="image/*,application/pdf" multiple>
      </div>

      <!-- Кнопка камеры для мобильных -->
      <button 
        v-if="!isDesktop" 
        @click="triggerCameraInput" 
        class="btn-secondary mt-15 camera-btn"
      >📷 Сделать снимок</button>
      <input 
        v-if="!isDesktop" 
        type="file" 
        ref="cameraInput" 
        @change="onFileSelect" 
        style="display: none;" 
        accept="image/*" 
        capture="environment">

      <ul v-if="filesToUpload.length > 0" class="doc-list mt-15">
        <li v-for="(file, index) in filesToUpload" :key="file.name + index">
          {{ file.name }}
        </li>
      </ul>

      <div v-if="filesToUpload.length > 0" class="mt-15">
        <button 
          @click="sendFiles" 
          :disabled="isUploading" 
          class="btn-main"
        >
          {{ isUploading ? 'Отправка...' : 'Отправить на согласование' }}
        </button>
        <button 
          @click="cancelFiles" 
          class="btn-cancel"
          style="margin-left: 10px; font-size: 14px; padding: 6px 10px;"
        >✖</button>
      </div>
    </div>

    <div v-if="showingDocumentList">
      <h2>Мои отправленные счета</h2>
      <div v-if="isLoading">
        <p>Загрузка...</p>
      </div>
      <ul v-else class="doc-list">
        <li v-for="doc in documents" :key="doc.id">
          <div>
            <span class="doc-name">{{ doc.name }}</span>
            <span class="doc-details">Дата: {{ doc.date }}</span>
          </div>
          <span class="doc-status" :class="doc.status">{{ statusLabels[doc.status] || doc.status }}</span>
        </li>
      </ul>
    </div>

    <div class="navigation">
      <button @click="showingDocumentList = false" :class="{ active: !showingDocumentList }">Отправить</button>
      <button @click="fetchDocuments" :class="{ active: showingDocumentList }">История</button>
    </div>
  </div>
  `,

  data() {
    return {
      isDragOver: false,
      showingDocumentList: false,
      documents: [],
      isLoading: false,
      getAllInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-all-invoices',
      isDesktop: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.platform === 'tdesktop' : false,
      uploadMessage: '',
      uploadMessageColor: 'green',
      filesToUpload: [],
      isUploading: false,
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      },
      messageTimer: null
    }
  },

  methods: {
    setMessage(message, color = 'black') {
      this.uploadMessage = message;
      this.uploadMessageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => {
        this.uploadMessage = '';
      }, 3000);
    },
    onDragOver() {
      this.isDragOver = true;
    },
    onDragLeave() {
      this.isDragOver = false;
    },
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        this.addFileToCache(files[i]);
      }
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    triggerCameraInput() {
      this.$refs.cameraInput.click();
    },
    onFileSelect(event) {
      const files = event.target.files;
      for (let i = 0; i < files.length; i++) {
        this.addFileToCache(files[i]);
      }
      event.target.value = '';
    },
    addFileToCache(file) {
      this.filesToUpload.push(file);
      this.setMessage(`Добавлен файл: ${file.name}`, 'black');
    },
    cancelFiles() {
      this.filesToUpload = [];
      this.setMessage('Отправка отменена', 'red');
    },
    async sendFiles() {
      if (this.filesToUpload.length === 0) return;

      this.isUploading = true;
      this.setMessage('Отправка файлов...', 'black');

      const webhookUrl = 'https://h-0084.app.n8n.cloud/webhook/upload-invoice';
      const apiKey = 'super-secret-key-123';

      for (const file of this.filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tg_data', window.Telegram.WebApp.initData);

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'X-N8N-API-Key': apiKey },
            body: formData,
          });

          if (!response.ok) {
            this.setMessage(`Ошибка отправки файла: ${file.name}`, 'red');
            this.isUploading = false;
            return;
          }
        } catch {
          this.setMessage(`Ошибка сети при отправке файла: ${file.name}`, 'red');
          this.isUploading = false;
          return;
        }
      }

      this.setMessage(`Все файлы успешно отправлены. 👌`, 'green');
      this.filesToUpload = [];
      this.isUploading = false;
    },
    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      try {
        const response = await fetch(this.getAllInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.documents = data;
      } catch (error) {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  }
};
