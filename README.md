# Email Redactor

A privacy-focused email processing tool that extracts emails from Apple Mail, allows you to redact sensitive information by selecting text, and provides AI-powered summarization and Q&A capabilities. Once you redact a term, it's stored in a local database and automatically applied to all future emails - no need to redact the same information twice!

## Features

- 📧 **Direct Apple Mail Integration**: Extract emails directly from Apple Mail using AppleScript
- 🔐 **Smart Redaction with Memory**: Select any text to redact it - once redacted, the app remembers and automatically applies the same redactions to all future emails
- 💾 **Persistent Storage**: Redaction mappings are stored for consistent anonymization
- 🌍 **Multilingual Support**: Works with both English and Portuguese content
- 🤖 **AI-Powered Summaries**: Generate summaries using OpenAI GPT or Google Gemini models
- 💬 **Interactive Q&A**: Ask questions about email content with context preservation
- 🔓 **Deanonymization**: Restore original content when needed (for authorized users)
- 🌙 **Dark Mode**: Full dark mode support for comfortable viewing
- ⚡ **Real-time Streaming**: See AI responses as they're generated
- 🔊 **Text-to-Speech**: Listen to summaries and responses using macOS voices
- 📝 **Summary History**: Store and retrieve past email summaries

## Privacy First

**Important**: Only redacted content is sent to AI models. Your sensitive information never leaves your machine in its original form.

## Prerequisites

- macOS (for Apple Mail integration)
- Python 3.8+
- Node.js 14+
- Apple Mail configured with at least one email account

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/email-redactor.git
   cd email-redactor
   ```

2. Make the setup script executable:
   ```bash
   chmod +x start.sh
   ```

3. Run the setup script:
   ```bash
   ./start.sh
   ```

   This will:
   - Create a Python virtual environment
   - Install all Python dependencies
   - Download spaCy language models
   - Install Node.js dependencies
   - Start both backend and frontend servers

## Configuration

### API Keys

1. Click the Settings icon (⚙️) in the app
2. Enter your API keys:
   - **OpenAI API Key**: Required for GPT models ([Get one here](https://platform.openai.com/api-keys))
   - **Google Gemini API Key**: Required for Gemini models ([Get one here](https://makersuite.google.com/app/apikey))

API keys are stored locally in your browser and never sent anywhere except to the respective AI services.

## Usage

1. **Start the application**:
   ```bash
   ./start.sh
   ```

2. **Open your browser** to http://localhost:3000

3. **Extract emails**:
   - Set the number of emails to fetch
   - Set how many hours back to look
   - Click "Extract Emails"

4. **Review and redact**:
   - Select any text in the email to redact it with one click
   - Your redactions are saved to a local database
   - Previously redacted terms are automatically applied to new emails
   - No need to redact the same names, companies, or locations twice!

5. **Summarize**:
   - Choose your preferred AI model
   - Click "Summarize" to generate a summary
   - Summaries are automatically saved

6. **Ask questions**:
   - Use the Q&A section to ask follow-up questions
   - Context is preserved throughout the conversation

7. **Listen to responses**:
   - Select a voice from the dropdown
   - Click the speaker icon to hear summaries or responses

## Project Structure

```
email-redactor/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── email_extractor.py   # Apple Mail integration
│   ├── redactor.py          # Redaction logic
│   ├── email_processor.py   # Email parsing
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   └── EmailRedactorApp.js  # Main React component
│   └── package.json         # Node dependencies
├── start.sh                 # Setup and launch script
└── README.md               # This file
```

## Security Notes

- All redaction happens locally on your machine
- API keys are stored in browser localStorage
- Email content is never sent to AI services without redaction
- Redaction database is stored locally
- No telemetry or usage data is collected

## Troubleshooting

### "Permission denied" when running AppleScript
- Go to System Preferences > Security & Privacy > Privacy
- Add Terminal (or your terminal app) to "Automation" and allow access to Mail

### spaCy model download fails
- Run manually: `python -m spacy download en_core_web_sm`
- For Portuguese: `python -m spacy download pt_core_news_sm`

### Port already in use
- Backend (8000): `lsof -ti:8000 | xargs kill -9`
- Frontend (3000): `lsof -ti:3000 | xargs kill -9`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details