const UserDashboard = {
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

      <!-- Кнопка камеры для мобильных (под дроп-зоной) -->
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

      <button 
        v-if="filesToUpload.length > 0" 
        @click="sendFiles" 
        :disabled="isUploading" 
        class="btn-main mt-15"
      >
        {{ isUploading ? 'Отправка...' : 'Подтвердить отправку' }}
      </button>
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
      getInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-invoices',
      isDesktop: window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.platform === 'tdesktop' : false,
      uploadMessage: '',
      uploadMessageColor: 'green',
      filesToUpload: [],
      isUploading: false,
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      }
    }
  },

  methods: {
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
      // Открывает камеру на мобильных (input с capture)
      this.$refs.cameraInput.click();
    },
    onFileSelect(event) {
      const files = event.target.files;
      for (let i = 0; i < files.length; i++) {
        this.addFileToCache(files[i]);
      }
      // Сброс value чтобы можно было снова выбрать тот же файл/сделать несколько снимков подряд
      event.target.value = '';
    },
    addFileToCache(file) {
      // Можно добавить проверку дубликатов
      this.filesToUpload.push(file);
      this.uploadMessage = `Добавлен файл: ${file.name}`;
      this.uploadMessageColor = 'black';
    },
    async sendFiles() {
      if (this.filesToUpload.length === 0) return;

      this.isUploading = true;
      this.uploadMessage = 'Отправка файлов...';
      this.uploadMessageColor = 'black';

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
            this.uploadMessage = `Ошибка отправки файла: ${file.name}`;
            this.uploadMessageColor = 'red';
            this.isUploading = false;
            return;
          }
        } catch {
          this.uploadMessage = `Ошибка сети при отправке файла: ${file.name}`;
          this.uploadMessageColor = 'red';
          this.isUploading = false;
          return;
        }
      }

      this.uploadMessage = `Все файлы успешно отправлены. 👌`;
      this.uploadMessageColor = 'green';
      this.filesToUpload = [];
      this.isUploading = false;
    },
    async fetchDocuments() {
      this.showingDocumentList = true;
      this.isLoading = true;
      try {
        const response = await fetch(this.getInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.documents = data;
      } catch (error) {
        this.uploadMessage = 'Не удалось загрузить документы.';
        this.uploadMessageColor = 'red';
      } finally {
        this.isLoading = false;
      }
    }
  }
};
