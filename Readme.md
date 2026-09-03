# AI Call Intelligence CRM

Upload a call recording and get an AI transcript, summary, and extracted CRM data (contact info, reason for the call, outcome, next steps) - reviewed and saved into a lightweight CRM you can browse and ask questions about.

## Features

- **Audio Transcription** - Powered by OpenAI Whisper
- **AI Summarization** - Hugging Face Inference
- **Action Item Extraction** - Automatically identifies tasks
- **CRM Extraction** - Pulls caller identity, company, reason for call, outcome, and sentiment out of a transcript, with a manual review/save step before it becomes a CRM contact
- **Ask AI** - Ask questions across your saved CRM records, with a fallback to unreviewed call transcripts when nothing's been saved yet
- **Meeting History** - Store and search past meetings
- **Export Options** - Email summaries, CSV export of call/CRM data

## Tech Stack

All tools are **100% FREE**:

- **Whisper** - Audio transcription, runs locally (open-source)
- **Hugging Face Inference** - AI summarization, using Mistral-7B-Instruct
- **FastAPI** - Backend API
- **React** - Frontend interface (Vite + Tailwind CSS)
- **SQLite** - Database

## Prerequisites

- Python 3.10 or higher
- FFmpeg (for audio processing - Whisper needs it to decode audio/video)
- A Hugging Face access token (free from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens))

## Installation

### 1. Clone or navigate to the project directory

```bash
cd meeting-organizer
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

### 3. Activate the virtual environment

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Install FFmpeg

**Windows (using Chocolatey):**
```bash
choco install ffmpeg
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 6. Configure environment variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Hugging Face token:

```
HF_TOKEN=your_actual_hf_token_here
```

`ALLOWED_ORIGINS` is optional and controls which frontend origins the backend accepts requests from (comma-separated). It defaults to the local Vite dev server (`http://localhost:5173,http://127.0.0.1:5173`), so you only need to set it if you're serving the frontend from somewhere else.

## Usage

### Start the Backend Server

Open a terminal and run:

```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000`

### Start the Frontend

Open a **new terminal** and run:

```bash
cd frontend-react
npm install
npm run dev
```

The app will open in your browser at `http://localhost:5173`

## How to Use

1. **Upload a Recording** - Click "Upload Recording" on the Calls page, drag in a file (or click to choose one), optionally add a title
2. **Processing** - Transcription, summarization, and CRM extraction all run automatically on upload
3. **Review & Save** - Extracted CRM fields (caller, company, reason for call, outcome) show up ready to review on the Calls page; save them to create a CRM contact, or edit first if anything's off
4. **Browse the CRM** - Saved contacts appear on the CRM page with call history and AI summaries
5. **Ask Questions** - Use Ask AI to query your saved CRM records (and unreviewed calls, if nothing's been saved yet)
6. **Export** - Email a summary, or export call/CRM data as CSV

## Project Structure

```
meeting-organizer/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── database.py          # Database models
│   ├── transcription.py    # Whisper integration
│   └── summarization.py     # Hugging Face summarization
├── frontend-react/
│   ├── src/
│   │   ├── App.jsx          # Routes
│   │   ├── main.jsx         # Entry point
│   │   ├── components/      # Shared UI (Layout, Sidebar, Modal, etc.)
│   │   ├── pages/           # Dashboard, Calls, CRM, Ask AI, Analytics, Settings
│   │   └── lib/             # API client, toast, CSV export helpers
│   └── package.json
├── data/                    # SQLite database
├── uploads/                 # Uploaded audio files
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
└── README.md               # This file
```

## API Endpoints

- `GET /` - Health check
- `POST /api/upload` - Upload audio, transcribe, summarize, and auto-extract/save CRM data
- `GET /api/meetings` - List all meetings
- `GET /api/meetings/{id}` - Get meeting details
- `DELETE /api/meetings/{id}` - Delete meeting
- `POST /api/ask` - Ask questions about a meeting's transcript
- `POST /api/meetings/{id}/extract-crm` - Re-run CRM extraction on a meeting (doesn't save it)
- `POST /api/meetings/{id}/save-crm` - Save (possibly edited) CRM fields as a contact
- `GET /api/crm/records` - List saved CRM contacts
- `GET /api/crm/records/{id}` - Get a single CRM contact
- `DELETE /api/crm/records/{id}` - Delete a CRM contact
- `POST /api/crm/ask` - Ask questions across saved CRM records (falls back to unreviewed calls if none match)
- `GET /api/crm/backfill/candidates` - Preview which meetings are missing a CRM record
- `POST /api/crm/backfill` - Create CRM records for meetings that are missing one
- `POST /api/email` - Email a meeting summary (requires SMTP settings in `.env`)

## Security notes

This app is built for local/single-user use - there's no login or per-user data isolation, so anyone who can reach the API can read or delete any meeting. `ALLOWED_ORIGINS` restricts which origins the backend will answer, but that's not a substitute for authentication. Turning this into a public, multi-user deployment would need real user accounts and session isolation added on top.

## Troubleshooting

**"HF_TOKEN not found"**
- Make sure you created the `.env` file and added your Hugging Face token

**`openai-whisper` fails to install with a `ModuleNotFoundError: No module named 'pkg_resources'` error**
- Recent versions of `setuptools` dropped `pkg_resources`, which `openai-whisper`'s old-style build still needs. Fix: `pip install "setuptools<81" wheel`, then `pip install --no-build-isolation -r requirements.txt`.

**"FFmpeg not found"**
- Install FFmpeg using the instructions above

**"Connection refused"**
- Make sure the backend server is running on port 8000

**Slow processing**
- First run downloads the Whisper model (one-time, ~150MB)
- Subsequent runs will be faster
