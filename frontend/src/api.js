import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api'

const api = axios.create({ baseURL: BASE })

// Attach JWT token from localStorage to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('recruitiq_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token (don't redirect here — let AuthContext handle it)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('recruitiq_token')
      localStorage.removeItem('recruitiq_user')
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data)  => api.post('/auth/register', data),
  login:    (data)  => api.post('/auth/login', data),
  me:       ()      => api.get('/auth/me'),
  updateMe: (data)  => api.put('/auth/me', data),
}

export const profileApi = {
  get:         ()         => api.get('/profile'),
  uploadFile:  (formData) => api.post('/profile/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateParsed: (data)    => api.put('/profile/parsed', data),
  deleteFile:  (fileType) => api.delete(`/profile/${fileType}`),
}

export const jobsApi = {
  getAll:     (params) => api.get('/jobs', { params }),
  create:     (data)   => api.post('/jobs', data),
  update:     (id, data) => api.put(`/jobs/${id}`, data),
  delete:     (id)     => api.delete(`/jobs/${id}`),
  getStats:   ()       => api.get('/jobs/stats'),
  getFolders: ()       => api.get('/jobs/folders'),
}

export const contactsApi = {
  getAll:       (params) => api.get('/contacts', { params }),
  create:       (data)   => api.post('/contacts', data),
  update:       (id, data) => api.put(`/contacts/${id}`, data),
  delete:       (id)     => api.delete(`/contacts/${id}`),
  searchApollo: (data)   => api.post('/contacts/search-apollo', data),
  enrichApollo: (data)   => api.post('/contacts/enrich-apollo', data),
  hunterDomain: (data)   => api.post('/contacts/hunter-domain', data),
  hunterFind:   (data)   => api.post('/contacts/hunter-find', data),
}

export const discoveredApi = {
  getAll:         (params) => api.get('/discovered-jobs', { params }),
  update:         (id, data) => api.put(`/discovered-jobs/${id}`, data),
  addToTracker:   (id, data) => api.post(`/discovered-jobs/${id}/add-to-tracker`, data || {}),
  triggerScrape:  ()       => api.post('/scrape'),
  getStatus:      ()       => api.get('/scrape/status'),
  companySummary: (company, description) =>
    api.get('/company-summary', { params: { company, description: (description || '').slice(0, 1500) } }),
  getDismissed:   ()       => api.get('/discovered-jobs/dismissed'),
  addFromUrl:     (data)   => api.post('/tracker/add-from-url', data),
}

export const recruitersApi = {
  getAll:  (params)    => api.get('/recruiters', { params }),
  create:  (data)      => api.post('/recruiters', data),
  update:  (id, data)  => api.put(`/recruiters/${id}`, data),
  delete:  (id)        => api.delete(`/recruiters/${id}`),
}

export const statsApi = {
  getAll: () => api.get('/stats'),
}

export const preferencesApi = {
  get:     ()     => api.get('/preferences'),
  update:  (data) => api.put('/preferences', data),
  rescore: ()     => api.post('/rescore'),
}

export const coverLetterApi = {
  getTemplates:   ()          => api.get('/cover-letter/templates'),
  createTemplate: (data)      => api.post('/cover-letter/templates', data),
  updateTemplate: (id, data)  => api.put(`/cover-letter/templates/${id}`, data),
  deleteTemplate: (id)        => api.delete(`/cover-letter/templates/${id}`),
  getSuggestions: (data)      => api.post('/cover-letter/suggest', data),
}

export const emailTemplatesApi = {
  getAll:  ()           => api.get('/email-templates'),
  create:  (data)       => api.post('/email-templates', data),
  update:  (id, data)   => api.put(`/email-templates/${id}`, data),
  delete:  (id)         => api.delete(`/email-templates/${id}`),
}

export const networkingApi = {
  discover:      (data) => api.post('/networking/discover', data),
  generateEmail: (data) => api.post('/networking/generate-email', data),
}

export const coachApi = {
  scanResume:          (data) => api.post('/coach/scan-resume', data),
  coverLetter:         (data) => api.post('/coach/cover-letter', data),
  applicationQuestion: (data) => api.post('/coach/application-question', data),
  resumeDownloadUrl:   () => {
    const token = localStorage.getItem('recruitiq_token') || ''
    return `${BASE}/profile/resume/download?token=${encodeURIComponent(token)}`
  },
}

export const calendarApi = {
  getEvents: () => api.get('/calendar/events'),
}

export const interviewRoundsApi = {
  getAll:  (jobId)         => api.get(`/jobs/${jobId}/interviews`),
  create:  (jobId, data)   => api.post(`/jobs/${jobId}/interviews`, data),
  update:  (roundId, data) => api.put(`/interviews/${roundId}`, data),
  delete:  (roundId)       => api.delete(`/interviews/${roundId}`),
}

export const collectionsApi = {
  getAll:     ()                       => api.get('/collections'),
  create:     (data)                   => api.post('/collections', data),
  update:     (id, data)               => api.put(`/collections/${id}`, data),
  delete:     (id)                     => api.delete(`/collections/${id}`),
  getItems:   (id)                     => api.get(`/collections/${id}/items`),
  addItem:    (id, discovered_job_id)  => api.post(`/collections/${id}/items`, { discovered_job_id }),
  removeItem: (id, job_id)             => api.delete(`/collections/${id}/items/${job_id}`),
}

export const eventsApi = {
  getAll: (params) => api.get('/events', { params }),
}

export const newsApi = {
  getAll:  (params) => api.get('/news', { params }),
  refresh: ()       => api.post('/news/refresh'),
}

export const nylasApi = {
  getAuthUrl:   ()       => api.get('/nylas/auth-url'),
  getStatus:    ()       => api.get('/nylas/status'),
  getConfig:    ()       => api.get('/nylas/config'),
  send:         (data)   => api.post('/nylas/send', data),
  getThreads:   (limit)  => api.get('/nylas/threads', { params: { limit: limit || 20 } }),
  disconnect:   ()       => api.delete('/nylas/disconnect'),
}

export const helpApi = {
  chat: (data) => api.post('/help-chat', data),
}
