import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs/promises'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import WordExtractor from 'word-extractor'

const app = express()
const geminiModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
})

const normalizeText = (text) =>
  text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const parseDocBuffer = async (buffer) => {
  const extractor = new WordExtractor()
  const tempPath = `./temp-${Date.now()}.doc`

  try {
    await fs.writeFile(tempPath, buffer)
    const doc = await extractor.extract(tempPath)
    return normalizeText(doc.getBody())
  } finally {
    await fs.unlink(tempPath).catch(() => {})
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: geminiModel })
})

app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
  const file = req.file

  if (!file) {
    return res.status(400).json({ error: 'No resume file was uploaded.' })
  }

  const extension = file.originalname.split('.').pop()?.toLowerCase()

  try {
    let text = ''

    if (file.mimetype === 'application/pdf' || extension === 'pdf') {
      const result = await pdfParse(file.buffer)
      text = result.text
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      text = result.value
    } else if (file.mimetype === 'application/msword' || extension === 'doc') {
      text = await parseDocBuffer(file.buffer)
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, DOC, or DOCX file.' })
    }

    const normalized = normalizeText(text)

    if (!normalized) {
      return res.status(422).json({ error: 'We could not extract readable text from that file.' })
    }

    return res.json({
      fileName: file.originalname,
      text: normalized
    })
  } catch (error) {
    console.error('Resume parsing failed:', error)
    return res.status(500).json({ error: 'Parsing failed. Please try a different resume file.' })
  }
})

app.post('/api/generate-resume', async (req, res) => {
  const { prompt } = req.body || {}
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    return res.status(500).json({ error: 'Server Gemini API key is missing. Set GEMINI_API_KEY in the environment.' })
  }

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt content for resume generation.' })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      const message = data?.error?.message || 'Gemini request failed.'
      return res.status(response.status).json({ error: message })
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('')

    if (!text) {
      return res.status(502).json({ error: 'Gemini did not return any resume content.' })
    }

    return res.json({ html: text })
  } catch (error) {
    console.error('Gemini generation failed:', error)
    return res.status(500).json({ error: 'Gemini generation failed. Please try again.' })
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large. Please upload a file under 5MB.' })
  }

  return res.status(500).json({ error: 'Unexpected server error.' })
})

export default app
