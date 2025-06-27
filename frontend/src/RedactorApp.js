import React, { useState, useRef } from 'react';
import { 
  Container, Typography, Box, Button, TextField, Paper, CircularProgress, 
  MenuItem, Select, InputLabel, FormControl, Chip, Alert, Snackbar,
  ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, Divider,
  Card, CardContent, CardActions, Grid, IconButton, useMediaQuery
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon,
  Summarize as SummarizeIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Security as SecurityIcon,
  LockOpen as LockOpenIcon,
  NorthEast as SendIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const MODEL_OPTIONS = [
  { label: 'GPT-4o', value: 'GPT-4o' },
  { label: 'GPT-4.1 Mini (2025-04-14)', value: 'GPT-4.1 Mini (2025-04-14)' },
  { label: 'GPT-4.5 Preview', value: 'GPT-4.5 Preview' },
  { label: 'GPT-4.1 (2025-04-14)', value: 'GPT-4.1 (2025-04-14)' },
  { label: 'GPT-4.1 Nano (2025-04-14)', value: 'GPT-4.1 Nano (2025-04-14)' },
  { label: 'Gemini 2.5 Pro', value: 'Gemini 2.5 Pro' },
  { label: 'Gemini 2.5 Flash', value: 'Gemini 2.5 Flash' }
];

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          boxShadow: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
          },
        },
        contained: {
          boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0px 3px 6px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 3px 6px rgba(0,0,0,0.06)',
          overflow: 'visible',
        },
      },
    },
  },
});

export default function RedactorApp() {
  const [selectedFile, setSelectedFile] = useState(null);
const [isDragActive, setIsDragActive] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [entities, setEntities] = useState({});
  const [selectedEntities, setSelectedEntities] = useState({});
  const [redactedText, setRedactedText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // New state for follow-up chat
  const [conversationHistory, setConversationHistory] = useState([]);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);

  // State for Deanonymizer
  const [anonymizedInput, setAnonymizedInput] = useState('');
  const [deanonymizedOutput, setDeanonymizedOutput] = useState('');
  const [deanonymizeLoading, setDeanonymizeLoading] = useState(false);

  // Responsive design
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Robustly get highlighted text from the DOM and immediately redact
  const handleSelectionAndRedact = async () => {
    const selectionObj = window.getSelection();
    const selectedText = selectionObj ? selectionObj.toString().trim() : '';

    if (selectedText) {
      console.log('Redacting selected text:', selectedText);
      setLoading(true);
      setError('');
      setFollowUpResponse(''); // Clear previous follow-up response on redact
      try {
        const res = await axios.post(`${API_BASE}/redact`, {
          text: extractedText, // Send current text
          entities: {},
          custom_entities: [selectedText] // Send the new selection to redact
        });
        // Update the text area with the newly redacted text from the backend
        setExtractedText(res.data.redacted_text);
      } catch (err) {
        setError(err.response?.data?.error || 'Redaction on selection failed');
      } finally {
        setLoading(false);
      }
    }
  };

  // File upload and extraction
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setExtractedText('');
    setEntities({});
    setRedactedText('');
    setSummary('');
    setError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setExtractedText('');
    setEntities({});
    setRedactedText('');
    setSummary('');
    setError('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExtractedText(res.data.text);
      // Initialize conversation history for follow-up
      setConversationHistory([{"role": "user", "content": res.data.text}]);
      setFollowUpResponse(''); // Clear any previous response
    } catch (err) {
      setError(err.response?.data?.error || 'File processing failed');
    } finally {
      setLoading(false);
    }
  };

  // Entity extraction
  const handleExtractEntities = async () => {
    setLoading(true);
    setEntities({});
    setSelectedEntities({});
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/entities`, { text: extractedText });
      setEntities(res.data.entities);
    } catch (err) {
      setError(err.response?.data?.error || 'Entity extraction failed');
    } finally {
      setLoading(false);
    }
  };

  // Redaction (entity-based)
  const handleRedact = async () => {
    setLoading(true);
    setRedactedText('');
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/redact`, {
        text: extractedText,
        entities: selectedEntities,
        custom_entities: []
      });
      setRedactedText(res.data.redacted_text);
    } catch (err) {
      setError(err.response?.data?.error || 'Redaction failed');
    } finally {
      setLoading(false);
    }
  };

  // LLM Summarization
  const handleSummarize = async () => {
    setSummaryLoading(true);
    setSummary('');
    setError('');
    try {
      const textToSummarize = redactedText || extractedText; // Use redacted if available, else original
      if (!textToSummarize) {
         throw new Error("No text available to summarize.");
      }
      const res = await axios.post(`${API_BASE}/summarize`, {
        text: textToSummarize,
        model: selectedModel
      });
      setSummary(res.data.summary);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Summarization failed');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Entity selection logic
  const handleEntitySelect = (label, entity) => {
    setSelectedEntities((prev) => {
      const updated = { ...prev };
      if (!updated[label]) updated[label] = [];
      if (updated[label].includes(entity)) {
        updated[label] = updated[label].filter((e) => e !== entity);
        if (updated[label].length === 0) delete updated[label];
      } else {
        updated[label].push(entity);
      }
      return { ...updated };
    });
  };

  // New handler for follow-up questions
  const handleFollowUp = async () => {
    if (!followUpQuestion.trim()) return;
    setLlmLoading(true);
    setError('');
    try {
      // Ensure the history sent reflects the *latest* redacted text
      const currentHistory = [...conversationHistory];
      if (currentHistory.length > 0) {
        currentHistory[0] = { ...currentHistory[0], content: extractedText };
      }

      const res = await axios.post(`${API_BASE}/followup`, {
        history: currentHistory, // Send the updated history
        question: followUpQuestion,
        model: selectedModel
      });
      const assistantResponse = res.data.answer;
      // Update history with user question and assistant answer
      const newHistory = [
        ...currentHistory,
        { "role": "user", "content": followUpQuestion },
        { "role": "assistant", "content": assistantResponse }
      ];
      setConversationHistory(newHistory);
      setFollowUpResponse(assistantResponse); // Display the latest answer
      setFollowUpQuestion(''); // Clear input
    } catch (err) {
      setError(err.response?.data?.error || 'Follow-up request failed');
    } finally {
      setLlmLoading(false);
    }
  };

  // Handler for Deanonymizer
  const handleDeanonymize = async () => {
    if (!anonymizedInput.trim()) return;
    setDeanonymizeLoading(true);
    setDeanonymizedOutput('');
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/deanonymize`, {
        text: anonymizedInput
      });
      setDeanonymizedOutput(res.data.text);
    } catch (err) {
      setError(err.response?.data?.error || 'Deanonymization failed');
    } finally {
      setDeanonymizeLoading(false);
    }
  };

  // Ref for the text area element
  const extractedTextAreaRef = useRef(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Handler for Select All & Copy
  const handleSelectAllAndCopy = () => {
    if (extractedTextAreaRef.current) {
      const textArea = extractedTextAreaRef.current.querySelector('textarea');
      if (textArea) {
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        try {
          navigator.clipboard.writeText(extractedText);
          setSnackbarOpen(true);
        } catch (err) {
          console.error('Failed to copy text: ', err);
          setError('Failed to copy text to clipboard.');
        }
      }
    }
  };

  // Handler for Print to TXT
  const handlePrintToTxt = () => {
    if (!extractedText) {
      setError("No text to save.");
      return;
    }

    const filename = selectedFile ? `${selectedFile.name.replace(/\.[^/.]+$/, "")} redacted.txt` : "redacted_text.txt";
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handler for saving deanonymized text to TXT
  const handleSaveDeanonymizedTxt = () => {
    if (!deanonymizedOutput) {
      setError("No deanonymized text to save.");
      return;
    }

    const filename = "deanonymized_text.txt";
    const blob = new Blob([deanonymizedOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Function to reset all state
  const handleNewEmail = () => {
    setSelectedFile(null);
    setExtractedText('');
    setEntities({});
    setSelectedEntities({});
    setRedactedText('');
    setSummary('');
    setError('');
    setFollowUpQuestion('');
    setFollowUpResponse('');
    setConversationHistory([]);
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Only accept .eml files
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.eml')) {
        handleFileChange({ target: { files: [file] } });
      } else {
        setError('Please drop a .eml file.');
      }
      e.dataTransfer.clearData();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="primary" elevation={2} sx={{ mb: 3 }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Email/Text Redactor
          </Typography>
          <Button 
            color="inherit" 
            startIcon={<RefreshIcon />}
            onClick={handleNewEmail}
          >
            New Email
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mb: 6 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3, borderRadius: theme.shape.borderRadius }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Upload Document
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', flexDirection: isSmallScreen ? 'column' : 'row', gap: 2 }}>
                  <Box
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                      border: isDragActive ? '2px solid #1976d2' : '2px dashed #aaa',
                      borderRadius: 2,
                      p: 3,
                      mb: 2,
                      textAlign: 'center',
                      background: isDragActive ? '#e3f2fd' : '#fafafa',
                      transition: 'background 0.2s, border 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography variant="body1" color="textSecondary">
                      Drag and drop a <b>.eml</b> file here, or use the file picker below
                    </Typography>
                  </Box>
                  <Button 
                    variant="outlined" 
                    component="label" 
                    startIcon={<FileUploadIcon />}
                  >
                    <input
                      accept=".eml,.txt"
                      style={{ display: 'none' }}
                      id="upload-file"
                      type="file"
                      onChange={handleFileChange}
                    />
                    Select File
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    disabled={!selectedFile || loading} 
                    onClick={handleUpload}
                    startIcon={loading ? <CircularProgress size={20} /> : <FileUploadIcon />}
                  >
                    {loading ? 'Processing...' : 'Upload & Extract'}
                  </Button>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel id="model-select-label">Model</InputLabel>
                    <Select
                      labelId="model-select-label"
                      value={selectedModel}
                      label="Model"
                      onChange={(e) => setSelectedModel(e.target.value)}
                      size="small"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.value}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                {selectedFile && (
                  <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                    Selected file: <b>{selectedFile.name}</b>
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Extracted Text Card */}
          {extractedText && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Extracted Text
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Select text to redact it automatically
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{
                    mt: 1,
                    maxHeight: '400px',
                    overflow: 'auto',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: theme.shape.borderRadius,
                    padding: '8.5px 14px',
                    bgcolor: 'background.paper',
                  }}>
                    <TextField
                      multiline
                      fullWidth
                      variant="standard"
                      value={extractedText}
                      InputProps={{ readOnly: true, disableUnderline: true }}
                      sx={{ padding: 0 }}
                      onMouseUp={handleSelectionAndRedact}
                      ref={extractedTextAreaRef}
                    />
                  </Box>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button 
                    variant="outlined" 
                    onClick={handleSelectAllAndCopy}
                    startIcon={<ContentCopyIcon />}
                    size="small"
                  >
                    Select All & Copy
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handlePrintToTxt}
                    startIcon={<SaveIcon />}
                    size="small"
                  >
                    Save as TXT
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )}
          
          {/* Summarize Section */}
          {extractedText && (
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Summarize Text
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Button
                    variant="contained"
                    sx={{ mb: 2 }}
                    onClick={handleSummarize}
                    disabled={summaryLoading || llmLoading}
                    startIcon={summaryLoading ? <CircularProgress size={20} /> : <SummarizeIcon />}
                  >
                    {summaryLoading ? 'Summarizing...' : 'Summarize'}
                  </Button>
                  
                  {summary && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Summary
                      </Typography>
                      <TextField
                        multiline
                        fullWidth
                        minRows={4}
                        value={summary}
                        InputProps={{ readOnly: true }}
                        sx={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          '.MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                          }
                        }}
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {/* Follow-up Chat Section */}
          {extractedText && (
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Ask Questions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
                    <TextField
                      fullWidth
                      label="Ask a question..."
                      variant="outlined"
                      size="small"
                      value={followUpQuestion}
                      onChange={(e) => setFollowUpQuestion(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') handleFollowUp(); }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleFollowUp}
                      disabled={llmLoading || !followUpQuestion.trim()}
                      sx={{ flexShrink: 0 }}
                    >
                      {llmLoading ? <CircularProgress size={24} /> : <SendIcon />}
                    </Button>
                  </Box>
                  
                  {/* Display Conversation History/Response */}
                  {conversationHistory.length > 1 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Conversation History
                      </Typography>
                      <TextField
                        multiline
                        fullWidth
                        minRows={4}
                        value={conversationHistory.slice(1).map(msg => 
                          `${msg.role === 'user' ? '🙋' : '🤖'} ${msg.content}`).join('\n\n')}
                        InputProps={{ readOnly: true }}
                        sx={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          '.MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                          }
                        }}
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {/* Deanonymizer Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LockOpenIcon color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6" color="secondary">
                    Deanonymizer
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Restore original text from anonymized content
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Input</Typography>
                    <TextField
                      label="Paste Anonymized Text Here"
                      multiline
                      fullWidth
                      minRows={4}
                      value={anonymizedInput}
                      onChange={(e) => setAnonymizedInput(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Output</Typography>
                    <TextField
                      label="Deanonymized Result"
                      multiline
                      fullWidth
                      minRows={4}
                      value={deanonymizedOutput}
                      InputProps={{ readOnly: true }}
                      sx={{ 
                        backgroundColor: deanonymizedOutput ? 'rgba(0, 0, 0, 0.02)' : 'inherit',
                        '.MuiOutlinedInput-root': {
                          bgcolor: 'background.paper',
                        }
                      }}
                    />
                    {deanonymizedOutput && (
                      <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleSaveDeanonymizedTxt}
                        startIcon={<SaveIcon />}
                        size="small"
                        sx={{ mt: 2 }}
                      >
                        Save as TXT
                      </Button>
                    )}
                  </Grid>
                </Grid>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleDeanonymize}
                    disabled={deanonymizeLoading || !anonymizedInput.trim()}
                    startIcon={deanonymizeLoading ? <CircularProgress size={20} /> : <LockOpenIcon />}
                    sx={{ minWidth: 150 }}
                  >
                    {deanonymizeLoading ? 'Processing...' : 'Deanonymize'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Snackbar for Copy Confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        message="Text copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </ThemeProvider>
  );
}
