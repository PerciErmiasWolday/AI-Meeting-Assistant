# AI Meeting Summarizer

An AI-powered meeting summarizer that transcribes audio recordings and generates intelligent summaries with action items.

## Features

- **Audio Transcription** - Powered by OpenAI Whisper
- **AI Summarization** - Hugging Face Inference
- **Action Item Extraction** - Automatically identifies tasks
- **Meeting History** - Store and search past meetings
- **Ask Questions** - Query your meeting transcripts
- **Export Options** - PDF and text export
- **Beautiful UI** - Modern green & white design

## Tech Stack

All tools are **100% FREE**:

- **Whisper** - Audio transcription, runs locally (open-source)
- **Hugging Face Inference** - AI summarization, using Mistral-7B-Instruct
- **FastAPI** - Backend API
- **Streamlit** - Frontend interface
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

`ALLOWED_ORIGINS` is optional and controls which frontend origins the backend accepts requests from (comma-separated). It defaults to the local Streamlit dev server (`http://localhost:8501,http://127.0.0.1:8501`), so you only need to set it if you're serving the frontend from somewhere else.

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
cd frontend
streamlit run app.py
```

The app will open in your browser at `http://localhost:8501`

## How to Use

1. **Upload Audio** - Click "Upload Meeting" and select your audio file
2. **Add Title** - Optionally add a meeting title
3. **Process** - Click "Process Meeting" and wait for AI to work its magic
4. **View Results** - See your summary, action items, and full transcript
5. **Ask Questions** - Use the Q&A feature to query your meeting
6. **Export** - Download as PDF, copy the text, or email it to someone

## Project Structure

```
meeting-organizer/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── database.py          # Database models
│   ├── transcription.py    # Whisper integration
│   └── summarization.py     # Hugging Face summarization
├── frontend/
│   ├── app.py               # Main Streamlit application
│   ├── components/          # Reusable UI components
│   │   ├── header.py        # Header component
│   │   ├── sidebar.py       # Sidebar navigation
│   │   └── cards.py         # Card components
│   ├── pages/               # Page components
│   │   ├── upload.py        # Upload page
│   │   ├── result.py        # Results page
│   │   └── history.py       # History page
│   ├── styles/              # Styling files
│   │   ├── theme.py         # Theme configuration
│   │   └── main.css         # Main stylesheet
│   └── utils/               # Utility functions
│       ├── api.py           # API client functions
│       └── formatters.py    # Data formatting utilities
├── data/                    # SQLite database
├── uploads/                 # Uploaded audio files
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
└── README.md               # This file
```

## Design

The app features a **professional, modern design** with:
- **Color Scheme**: Deep slate grays with blue accents for a professional look
- **Typography**: System fonts for optimal readability and performance
- **Components**: Standard UI patterns with proper spacing and visual hierarchy
- **Layout**: Clean, organized structure with clear information architecture
- **Interactions**: Smooth transitions and hover effects
- **Responsive**: Works well on different screen sizes

## API Endpoints

- `GET /` - Health check
- `POST /api/upload` - Upload and process audio
- `GET /api/meetings` - List all meetings
- `GET /api/meetings/{id}` - Get meeting details
- `DELETE /api/meetings/{id}` - Delete meeting
- `POST /api/ask` - Ask questions about a meeting
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
