// Document Service - File Upload & Management
// DATABASE INTEGRATION POINT: Replace localStorage with POST /api/v1/documents
// Current: stores in localStorage under 'nfinity_documents'
// Future: POST /api/v1/documents with file storage integration (S3/Supabase)
// Schema: { id, file_name, type, uploaded_by, uploaded_at, status, size_kb, mime_type }

const documentService = {
  // Get all documents from storage
  getDocuments() {
    const stored = localStorage.getItem('nfinity_documents');
    return stored ? JSON.parse(stored) : [];
  },

  // Save documents to storage
  saveDocuments(documents) {
    localStorage.setItem('nfinity_documents', JSON.stringify(documents));
  },

  // Simulate document upload
  simulateDocumentUpload(fileName, type = 'other', uploadedBy = null, sizeKb = Math.random() * 5000) {
    const documents = this.getDocuments();

    const document = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file_name: fileName || `document-${Date.now()}.pdf`,
      type: type, // invoice, compliance, contract, ratecon, bol, pod, other
      uploaded_by: uploadedBy || 'demo-user',
      uploaded_at: new Date().toISOString(),
      status: 'uploaded', // uploading, uploaded, error
      size_kb: Math.round(sizeKb),
      mime_type: this.getMimeType(fileName),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    documents.push(document);
    this.saveDocuments(documents);

    return document;
  },

  // Get MIME type from filename
  getMimeType(fileName) {
    if (!fileName) return 'application/octet-stream';

    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      txt: 'text/plain'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  },

  // Get documents by type
  getDocumentsByType(type) {
    const documents = this.getDocuments();
    return documents.filter(doc => doc.type === type);
  },

  // Get documents by status
  getDocumentsByStatus(status) {
    const documents = this.getDocuments();
    return documents.filter(doc => doc.status === status);
  },

  // Get document by ID
  getDocumentById(id) {
    const documents = this.getDocuments();
    return documents.find(doc => doc.id === id);
  },

  // Update document
  updateDocument(id, updates) {
    const documents = this.getDocuments();
    const index = documents.findIndex(doc => doc.id === id);

    if (index !== -1) {
      documents[index] = {
        ...documents[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveDocuments(documents);
      return documents[index];
    }

    return null;
  },

  // Delete document
  deleteDocument(id) {
    const documents = this.getDocuments().filter(doc => doc.id !== id);
    this.saveDocuments(documents);
  },

  // Get recent documents
  getRecentDocuments(limit = 10) {
    const documents = this.getDocuments();
    return documents.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)).slice(0, limit);
  },

  // Get total document count
  getTotalCount() {
    return this.getDocuments().length;
  },

  // Calculate total storage (KB)
  getTotalStorageKb() {
    const documents = this.getDocuments();
    return documents.reduce((sum, doc) => sum + (doc.size_kb || 0), 0);
  },

  // Get documents pending review
  getPendingReview() {
    const documents = this.getDocuments();
    return documents.filter(doc => doc.status === 'pending_review');
  }
};
