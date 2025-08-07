const UserDashboard = {
  template: `
  <div>
    <p v-if="uploadMessage" :style="{ color: uploadMessageColor, marginBottom: '10px', fontWeight: '500' }">
      {{ uploadMessage }}
    </p>

    <div v-if="!showingDocumentList">
      <h2>Отправка на согласование</h2>
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
        <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" accept="image/*,application/pdf">
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
      getInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-invoices',
      isDesktop: window.Telegram.WebApp.platform === 'tdesktop',
      uploadMessage: '',
      uploadMessageColor: 'green'
    }
  },
  methods: {
    onDragOver(event) {
      this.isDragOver = true;
    },
    onDragLeave(event) {
      this.isDragOver = false;
    },
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    onFileSelect(event) {
      const files = event.target.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    },
    takePhoto() {
      this.uploadMessage = 'Функция "Сделать фото" в разработке.';
      this.uploadMessageColor = 'red';
    },
    async uploadFile(file) {
      this.uploadMessage = 'Отправка файла...';
      this.uploadMessageColor = 'black';

      const webhookUrl = 'https://h-0084.app.n8n.cloud/webhook/upload-invoice';
      const apiKey = 'super-secret-key-123';
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tg_data', window.Telegram.WebApp.initData);

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'X-N8N-API-Key': apiKey,
          },
          body: formData,
        });

        if (response.ok) {
          this.uploadMessage = 'Файл успешно отправлен. 👌';
          this.uploadMessageColor = 'green';
        } else {
          this.uploadMessage = 'Ошибка отправки файла.';
          this.uploadMessageColor = 'red';
        }
      } catch (error) {
        this.uploadMessage = 'Ошибка сети при отправке файла.';
        this.uploadMessageColor = 'red';
      }
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
    },
    getStatusText(status) {
        const statuses = {
            'approved': 'Согласован',
            'pending': 'В обработке',
            'rejected': 'Отклонен'
        };
        return statuses[status] || 'Неизвестно';
    }
  }
};