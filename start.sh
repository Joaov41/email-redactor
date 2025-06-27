#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script directory
cd "$SCRIPT_DIR"

# Check if virtual environment exists in backend
if [ ! -d "backend/venv" ]; then
    echo "Creating virtual environment for backend..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# Activate virtual environment and install backend dependencies
echo "Installing backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt 2>/dev/null || {
    echo "Creating requirements.txt for backend..."
    cat > requirements.txt << EOL
fastapi==0.104.1
uvicorn==0.23.2
python-multipart==0.0.6
openai==1.3.0
google-generativeai==0.3.0
spacy==3.7.2
python-dotenv==1.0.0
EOL
    pip install -r requirements.txt
}

# Download spaCy model if not already installed
python -m spacy download en_core_web_sm 2>/dev/null || echo "spaCy model already installed"

# Start backend server
echo "Starting backend server..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

# Start frontend
echo "Starting frontend..."
npm start &
FRONTEND_PID=$!

cd ..

# Function to kill both processes on exit
cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Set up trap to catch exit signals
trap cleanup EXIT INT TERM

echo "Email Redactor is running!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait