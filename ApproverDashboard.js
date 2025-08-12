const ApproverDashboard = {
  props: ['approverName'],
  
  template: `
  <div>
    <div v-if="!selectedDocument">
      <h2>Согласование счетов</h2>
      <div v-if="approverName" class="approver-info">
        Согласующий: <strong>{{ approverName }}</strong>
      </div>
      
      <div v-if="isLoading"><p>Загрузка...</p></div>
      <ul v-else class="doc-list">
        <li v-for="doc in pendingDocuments" :key="doc.id" @click="selectDocument(doc)" class="clickable-doc">
          <div class="doc-info">
            <span class="doc-name">{{ doc.name }}</span>
            <span class="doc-details">{{ doc.date }}</span>
            <span class="doc-amount">{{ formatAmount(doc.amount) }}</span>
            <span class="doc-organization" v-if="doc.organization">{{ doc.organization }}</span>
          </div>
          <div class="status-container">
            <div class="current-status">
              <span class="my-status" :class="getMyStatusClass(doc)">
                {{ getMyStatusText(doc) }}
              </span>
            </div>
          </div>
        </li>
      </ul>
      
      <div v-if="!isLoading && pendingDocuments.length === 0" class="no-documents">
        <p>Нет документов для согласования</p>
      </div>
    </div>

    <div v-else class="document-review">
      <div class="review-header">
        <button @click="backToList" class="btn-back">← Назад</button>
        <h3>Согласование документа</h3>
      </div>
      
      <div class="document-details">
        <div class="doc-name">{{ selectedDocument.name }}</div>
        <div class="doc-details">{{ selectedDocument.date }}</div>
        <div class="doc-amount">{{ formatAmount(selectedDocument.amount) }}</div>
        <div class="doc-organization" v-if="selectedDocument.organization">{{ selectedDocument.organization }}</div>
      </div>

      <div class="review-section">
        <h4>Ваше решение:</h4>
        <div class="decision-buttons">
          <button 
            @click="setDecision('Согласовано')" 
            :class="['btn-decision', 'btn-approve', { active: decision === 'Согласовано' }]"
          >
            Согласовать
          </button>
          <button 
            @click="setDecision('Отказано')" 
            :class="['btn-decision', 'btn-reject', { active: decision === 'Отказано' }]"
          >
            Отказать
          </button>
        </div>
        
        <div v-if="decision" class="comment-section">
          <label for="comment">Комментарий:</label>
          <textarea 
            id="comment"
            v-model="comment" 
            :placeholder="getCommentPlaceholder()"
            rows="4"
          ></textarea>
        </div>
        
        <div v-if="decision" class="submit-section">
          <button @click="submitDecision" :disabled="isSubmitting" class="btn-main">
            {{ isSubmitting ? 'Отправка...' : 'Отправить решение' }}
          </button>
        </div>
      </div>
      
      <div v-if="message" class="message" :style="{ color: messageColor }">
        {{ message }}
      </div>
    </div>
  </div>
  `,

  data() {
    return {
      documents: [],
      selectedDocument: null,
      decision: '',
      comment: '',
      isLoading: false,
      isSubmitting: false,
      message: '',
      messageColor: 'green',
      getPendingInvoicesWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/get-pending-invoices',
      submitDecisionWebhookUrl: 'https://h-0084.app.n8n.cloud/webhook/submit-decision',
      messageTimer: null
    };
  },

  computed: {
    pendingDocuments() {
      // Показываем только документы, которые еще не рассмотрены этим согласующим
      return this.documents.filter(doc => {
        const myStatusField = `Статус ${this.approverName}`;
        const myStatus = doc[myStatusField] || '';
        return myStatus === ''; // Только документы без статуса от этого согласующего
      });
    }
  },

  methods: {
    formatAmount(amount) {
      if (!amount) return '';
      return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
    },
    
    getMyStatusText(doc) {
      const myStatusField = `Статус ${this.approverName}`;
      const myStatus = doc[myStatusField] || '';
      return myStatus || 'Не рассмотрено';
    },
    
    getMyStatusClass(doc) {
      const myStatusField = `Статус ${this.approverName}`;
      const myStatus = doc[myStatusField] || '';
      if (myStatus === 'Согласовано') return 'status-approved';
      if (myStatus === 'Отказано') return 'status-rejected';
      return 'status-pending';
    },
    
    selectDocument(doc) {
      this.selectedDocument = doc;
      this.decision = '';
      this.comment = '';
      this.message = '';
    },
    
    backToList() {
      this.selectedDocument = null;
      this.decision = '';
      this.comment = '';
      this.message = '';
      this.fetchDocuments(); // Обновляем список при возврате
    },
    
    setDecision(newDecision) {
      this.decision = newDecision;
    },
    
    getCommentPlaceholder() {
      if (this.decision === 'Согласовано') {
        return 'Комментарий к согласованию (необязательно)';
      } else if (this.decision === 'Отказано') {
        return 'Укажите причину отказа';
      }
      return '';
    },
    
    async submitDecision() {
      if (!this.decision) {
        this.setMessage('Выберите решение', 'red');
        return;
      }
      
      if (this.decision === 'Отказано' && !this.comment.trim()) {
        this.setMessage('При отказе необходимо указать причину', 'red');
        return;
      }
      
      this.isSubmitting = true;
      try {
        const response = await fetch(this.submitDecisionWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: this.selectedDocument.id,
            approver: this.approverName,
            decision: this.decision,
            comment: this.comment,
            tg_data: window.Telegram.WebApp.initData
          })
        });
        
        const result = await response.json();
        if (result.success) {
          this.setMessage('Решение успешно отправлено', 'green');
          setTimeout(() => {
            this.backToList();
          }, 1500);
        } else {
          this.setMessage(result.message || 'Ошибка при отправке решения', 'red');
        }
      } catch (error) {
        this.setMessage('Ошибка сети при отправке решения', 'red');
      } finally {
        this.isSubmitting = false;
      }
    },
    
    setMessage(message, color = 'black') {
      this.message = message;
      this.messageColor = color;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => { this.message = ''; }, 3000);
    },
    
    async fetchDocuments() {
      this.isLoading = true;
      try {
        const response = await fetch(this.getPendingInvoicesWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_data: window.Telegram.WebApp.initData })
        });
        const data = await response.json();
        this.documents = data || [];
      } catch (error) {
        this.setMessage('Не удалось загрузить документы.', 'red');
      } finally {
        this.isLoading = false;
      }
    }
  },

  mounted() {
    this.fetchDocuments();
  }
};
