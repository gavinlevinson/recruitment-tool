import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api'

const api = axios.create({ baseURL: BASE })

// Attach JWT token from localStorage to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('orion_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token (don't redirect here — let AuthContext handle it)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('orion_token')
      localStorage.removeItem('orion_user')
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
  dismissCompany: (company) => api.post('/discovered-jobs/dismiss-company', { company }),
  getNextAtCompany: (company, excludeId, params) => api.get('/discovered-jobs', {
    params: { ...params, company_filter: company, is_active: true, limit: 2, offset: 0 }
  }),
  getNewToday: () => api.get('/discovered-jobs/new-today'),
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
  interview:           (data) => api.post('/coach/interview', data),
  interviewScore:      (data) => api.post('/coach/interview-score', data),
  resumeDownloadUrl:   () => {
    const token = localStorage.getItem('orion_token') || ''
    return `${BASE}/profile/resume/download?token=${encodeURIComponent(token)}`
  },
}

export const calendarApi = {
  getEvents:         ()          => api.get('/calendar/events'),
  getGcalEvents:     ()          => api.get('/gcal/events'),
  createEvent:       (data)      => api.post('/calendar/events', data),
  deleteManualEvent: (eventId)   => api.delete(`/calendar/events/manual/${eventId}`),
  syncDeadline:      (jobId)     => api.post(`/jobs/${jobId}/gcal/deadline`),
  removeDeadline:    (jobId)     => api.delete(`/jobs/${jobId}/gcal/deadline`),
  syncInterview:     (roundId)   => api.post(`/interview-rounds/${roundId}/gcal`),
  removeInterview:   (roundId)   => api.delete(`/interview-rounds/${roundId}/gcal`),
}

export const interviewRoundsApi = {
  getAll:      (jobId)         => api.get(`/jobs/${jobId}/interviews`),
  create:      (jobId, data)   => api.post(`/jobs/${jobId}/interviews`, data),
  update:      (roundId, data) => api.put(`/interviews/${roundId}`, data),
  delete:      (roundId)       => api.delete(`/interviews/${roundId}`),
  setThankYou: (roundId)       => api.patch(`/interviews/${roundId}/thank-you`),
  getToday:    ()              => api.get('/interviews/today'),
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
  getAll:     (params) => api.get('/events', { params }),
  rsvp:       (data)   => api.post('/events/rsvp', data),
  getRsvped:  ()       => api.get('/events/rsvped'),
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

export const googleDocsApi = {
  getAuthUrl:  ()                      => api.get('/google/auth-url'),
  getStatus:   ()                      => api.get('/google/status'),
  disconnect:  ()                      => api.delete('/google/disconnect'),
  createDoc:   (contactId, data)       => api.post(`/contacts/${contactId}/docs/create`, data),
  linkDoc:     (contactId, data)       => api.post(`/contacts/${contactId}/docs/link`, data),
  unlinkDoc:   (contactId, docIndex)   => api.delete(`/contacts/${contactId}/docs/${docIndex}`),
  driveFiles:    (folderId = 'root')   => api.get(`/google/drive/files?folder_id=${folderId}`),
  pruneDeadDocs: ()                    => api.post('/google/drive/prune-dead-docs'),
}

export const helpApi = {
  chat: (data) => api.post('/help-chat', data),
}
