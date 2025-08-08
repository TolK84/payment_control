const UserDashboard = {
  template: `
  <div>
    <p v-if="uploadMessage" 
       :style="{ color: uploadMessageColor, marginBottom: '10px', fontWeight: '500' }">
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
        <input type="file" ref="fileInput" @change="onFileSelect" 
               style="display: none;" accept="image/*,application/pdf" multiple>
      </div>

      <!-- Камера -->
      <div v-if="!isDesktop" class="camera-container" style="margin-top:15px;">
        <video v-if="!photoTaken" ref="video" autoplay playsinline width="320" height="240" style="border-radius: 8px; border: 1px solid #ccc;"></video>
        <img v-if="photoTaken" :src="photoDataUrl" alt="Фото" width="320" height="240" style="border-radius: 8px; border: 1px solid #ccc;" />
        <div style="margin-top: 10px;">
          <button v-if="!photoTaken" @click="takePhoto" class="btn-secondary" style="width:auto;">📷 Сделать снимок</button>
          <div v-else>
            <button @click="confirmPhoto" class="btn-main" style="width:auto; margin-right: 8px;">✅ Подтвердить</button>
            <button @click="retakePhoto" class="btn-secondary" style="width:auto;">↩ Сделать заново</button>
          </div>
        </div>
      </div>

      <!-- Список выбранных файлов -->
      <ul v-if="filesToUpload.length > 0" class="doc-list mt-15">
        <li v-for="(file, index) in filesToUpload" :key="file.name + index">
          {{ file.name }}
        </li>
      </ul>

      <!-- Кнопки отправки и отмены -->
      <div v-if="filesToUpload.length > 0" class="mt-15" style="display:flex; gap:8px;">
        <button 
          @click="sendFiles" 
          :disabled="isUploading" 
          class="btn-main"
          style="flex-grow:1;"
        >
          {{ isUploading ? 'Отправка...' : 'Отправить на согласование' }}
        </button>
        <button 
          @click="cancelUpload" 
          class="btn-cancel"
          style="padding: 6px 10px; font-size: 14px; background:#eee; border:none; border-radius:8px; cursor:pointer;"
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
      stream: null,

      photoTaken: false,
      photoDataUrl: null,
      lastPhotoBlob: null,
    }
  },

  mounted() {
    if (!this.isDesktop) {
      this.startCamera();
    }
  },

  beforeUnmount() {
    this.stopCamera();
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
    startCamera() {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          this.stream = stream;
          this.$refs.video.srcObject = stream;
        })
        .catch(err => {
          this.setMessage('Ошибка доступа к камере', 'red');
          console.error(err);
        });
    },
    stopCamera() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    },
    takePhoto() {
      const video = this.$refs.video;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (blob) {
          this.lastPhotoBlob = blob;
          this.photoDataUrl = URL.createObjectURL(blob);
          this.photoTaken = true;
          this.stopCamera();
        } else {
          this.setMessage('Ошибка создания фото', 'red');
        }
      }, 'image/png');
    },
    confirmPhoto() {
      if (this.lastPhotoBlob) {
        const file = new File([this.lastPhotoBlob], `photo_${Date.now()}.png`, { type: 'image/png' });
        this.filesToUpload.push(file);
        this.setMessage(`Добавлено фото: ${file.name}`, 'black');
        this.lastPhotoBlob = null;
        this.photoDataUrl = null;
        this.photoTaken = false;
        this.startCamera();
      }
    },
    retakePhoto() {
      this.lastPhotoBlob = null;
      this.photoDataUrl = null;
      this.photoTaken = false;
      this.startCamera();
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
