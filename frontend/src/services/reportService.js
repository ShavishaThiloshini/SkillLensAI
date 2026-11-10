import api from './api'

/**
 * SkillLens AI — Report Generation Client Service
 * Day 31: Client API calls for report preview and PDF download.
 */

/**
 * Retrieves structured preview data for an analysis report.
 *
 * @param {number|string} analysisId
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getReportPreview(analysisId) {
  const response = await api.get(`/reports/${analysisId}/preview`)
  return response.data
}

/**
 * Downloads the formal A4 PDF report from the backend.
 * Uses blob responseType and initiates browser download.
 *
 * @param {number|string} analysisId
 * @param {string} [customFilename]
 * @returns {Promise<boolean>}
 */
export async function downloadReportPdf(analysisId, customFilename) {
  const response = await api.get(`/reports/${analysisId}/download`, {
    responseType: 'blob',
  })

  // Extract filename from Content-Disposition header if available
  let filename = customFilename || `SkillLens_AI_Skill_Gap_Report_Analysis_${analysisId}.pdf`
  const disposition = response.headers['content-disposition']
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/)
    if (match && match[1]) {
      filename = match[1]
    }
  }

  // Create temporary URL and trigger browser download
  const blob = new Blob([response.data], { type: 'application/pdf' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)

  return true
}

