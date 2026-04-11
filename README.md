# 🚀 Resume Modifier 

A modern, full-stack web application designed to help users update and refine their resumes seamlessly. Powered by Google's Gemini AI, Resume Modifier extracts text from your existing resume (PDF, DOC, or DOCX) and selectively rewrites sections—like your summary, experience, or skills—while maintaining your original formatting flow. Once generated, you can export your new, ATS-friendly resume as a beautifully formatted PDF or Word document.

## ✨ Features

- **Multi-format Uploads**: Supports parsing PDF, DOC, and DOCX resume formats.
- **AI-Powered Rewriting**: Integrates `gemini-2.0-flash` & `gemini-2.5-flash` to intelligently update specific sections while preserving the rest of your resume.
- **Section-Targeted Updates**: Focus on modifying just your Professional Summary, Work Experience, or Skills.
- **Rich Export Options**: Download the generated resume as a structured PDF or a well-formatted DOCX file.
- **Modern UI**: Built with React, Tailwind CSS, Lucide icons, features an elegant glassmorphism design and a dark/light mode toggle.
- **Robust Error Handling**: Gracefully handles API quota limits, rate limits, and parsing errors.

## 🛠️ Tech Stack

### Frontend (Client)
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Document Export**: `jspdf` (for PDF), `docx` (for Word)
- **Bundler**: Vite

### Backend (Server)
- **Framework**: Node.js & Express.js
- **File Upload**: Multer (in-memory storage)
- **Document Parsing**: `pdf-parse`, `mammoth` (for DOCX), `word-extractor` (for DOC)
- **AI Integration**: Google Generative AI (Gemini API via HTTP parsing)

## 📋 Prerequisites

Before you begin, ensure you have met the following requirements:
- Node.js (v18 or higher recommended)
- A Google API Key for Google Generative AI (Gemini)

## 🚀 Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sanjeeb-J/Resume_Modifier.git
   cd Resume_Modifier
   ```

2. **Install dependencies:**
   This project uses npm workspaces to manage both client and server dependencies. Run the following command in the root directory:
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   GEMINI_MODELS=gemini-2.0-flash,gemini-2.5-flash # Optional
   PORT=3001 # Optional
   ```

4. **Run the Application:**
   Start both the frontend and backend development servers concurrently:
   ```bash
   npm run dev
   ```
   - The React frontend will typically be available at `http://localhost:5173`
   - The Express backend will run on `http://localhost:3001`

## 📁 Project Structure

```text
Resume_Modifier/
├── client/                 # React frontend application
│   ├── src/                # Frontend source code (Components, App.jsx, styles)
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── vite.config.js      # Vite build configuration
├── server/                 # Express backend application
│   ├── app.js              # Express app setup, API routes, and logic
│   ├── index.js            # Server entry point
│   └── package.json        # Backend dependencies
├── .env                    # Environment variables (Add your keys here)
├── package.json            # Base package.json defining the npm workspaces
└── vercel.json             # Vercel deployment configuration
```

## ☁️ Deployment

This project is tailored for easy deployment on platforms like **Vercel**. 

1. Push your code to a GitHub repository.
2. Import the project in Vercel.
3. Vercel will automatically detect the frontend in `client/dist`.
4. Ensure you set the following Environment Variables in your Vercel project settings:
   - `GEMINI_API_KEY`
   - `GEMINI_MODELS` (optional)
5. The included `vercel.json` ensures that all `/api/*` routes are automatically directed to the Express serverless functions, whilst other requests serve the built React frontend.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to modify and adapt this tool to your resume-building needs.
