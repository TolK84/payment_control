const CONFIG = {
  N8N_BASE: 'https://n8n.eurasiantech.kz/webhook',
  ENDPOINTS: {
    checkAuth: '/check-auth',
    login: '/login',
    uploadInvoice: '/upload-invoice',
    getInvoices: '/get-invoices',
    getPendingInvoices: '/get-pending-invoices',
    submitDecision: '/submit-decision'
  },
  APPROVER_NAMES: ['Дамели', 'Даурен Б'],
  url(endpoint) {
    return this.N8N_BASE + this.ENDPOINTS[endpoint];
  }
};
