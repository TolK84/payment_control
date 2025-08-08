const UserDashboard = {
  template: `
  <div>
    <p v-if="uploadMessage"
       :style="{ color: uploadMessageColor, marginBottom: '10px', fontWeight: '500' }">
      {{ uploadMessage }}
    </p>

    <div v-if="!showingDocumentList && !cameraActive" class="send-section">

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
        <input type="file" ref="fileInput" @change="onFileSelect" 
               style="display: none;" accept="image/*,application/pdf" multiple>
      </div>

      <button 
        v-if="!isDesktop" 
        @click="openCameraFullScreen" 
        class="btn-secondary mt-15 camera-btn"
      >📷 Сделать снимок</button>

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
          @click="cancelUpload" 
          class="btn-cancel"
          style="margin-left: 8px; padding: 6px 10px; font-size: 14px;"
        >
          ✖
        </button>
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
      <button @click="showingDocumentList = false; cameraActive = false" :class="{ active: !showingDocumentList && !cameraActive }">Отправить</button>
      <button @click="fetchDocuments" :class="{ active: showingDocumentList }">История</button>
    </div>

    <div v-if="cameraActive" class="camera-modal">
      <video ref="video" autoplay playsinline></video>
      <button @click="capturePhoto" class="btn-main" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); width: 120px;">Сделать фото</button>
      <button @click="closeCamera" class="btn-cancel" style="position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; font-size: 24px;">✖</button>
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
      isDesktop: window.Telegram && window.Telegram.WebApp 
                 ? window.Telegram.WebApp.platform === 'tdesktop' 
                 : false,
      uploadMessage: '',
      uploadMessageColor: 'green',
      filesToUpload: [],
      isUploading: false,
      statusLabels: {
        approved: 'Согласован',
        pending: 'В обработке',
        rejected: 'Отклонен'
      },
      messageTimer: null,
      
      cameraActive: false,
      mediaStream: null,
    };
  },

  methods: {
    setMessage(message, color) {
      this.uploadMessage = message;
      this.uploadMessageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => {
        this.uploadMessage = '';
      }, 3000);
    },

    onDragOver() { this.isDragOver = true; },
    onDragLeave() { this.isDragOver = false; },
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        this.addFileToCache(files[i]);
      }
    },
    triggerFileInput() { this.$refs.fileInput.click(); },

    async openCameraFullScreen() {
      try {
        if (!this.mediaStream) {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        }
        this.cameraActive = true;
        this.$nextTick(() => {
          this.$refs.video.srcObject = this.mediaStream;
        });
      } catch (error) {
        this.setMessage('Доступ к камере запрещён или произошла ошибка.', 'red');
        this.cameraActive = false;
        this.mediaStream = null;
      }
    },

    capturePhoto() {
      const video = this.$refs.video;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        this.addFileToCache(file);
        this.closeCamera();
      }, 'image/jpeg', 0.9);
    },

    closeCamera() {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      this.cameraActive = false;
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
    cancelUpload() {
      this.filesToUpload = [];
      this.setMessage('Загрузка отменена', 'red');
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

      this.setMessage('Все файлы успешно отправлены 👌', 'green');
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
      } catch {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  }
};