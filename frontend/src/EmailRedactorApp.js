import React, { useState, useRef } from 'react';
import { 
  Container, Typography, Box, Button, TextField, Paper, CircularProgress, 
  MenuItem, Select, InputLabel, FormControl, Alert, Snackbar,
  ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, Divider,
  Card, CardContent, CardActions, Grid, IconButton, useMediaQuery,
  List, ListItem, ListItemText, ListItemButton, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import {
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon,
  Summarize as SummarizeIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Security as SecurityIcon,
  LockOpen as LockOpenIcon,
  NorthEast as SendIcon,
  Refresh as RefreshIcon,
  Brightness4,
  Brightness7,
  History as HistoryIcon,
  Delete as DeleteIcon,
  VolumeUp as VolumeUpIcon,
  Stop as StopIcon,
  Settings as SettingsIcon
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
const lightTheme = createTheme({
  palette: {
    mode: 'light',
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

export default function EmailRedactorApp() {
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Email extraction states
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailCount, setEmailCount] = useState(10);
  const [hoursBack, setHoursBack] = useState(24);
  const [extractingEmails, setExtractingEmails] = useState(false);
  
  // Original states from RedactorApp
  const [extractedText, setExtractedText] = useState('');
  const [redactedText, setRedactedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // Model Selection
  const [selectedModel, setSelectedModel] = useState('GPT-4o');
  
  // Deanonymizer states
  const [anonymizedInput, setAnonymizedInput] = useState('');
  const [deanonymizedOutput, setDeanonymizedOutput] = useState('');
  const [deanonymizeLoading, setDeanonymizeLoading] = useState(false);
  
  // Summary history states
  const [showSummaryHistory, setShowSummaryHistory] = useState(false);
  const [summaryHistory, setSummaryHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // TTS states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  
  // API Key states
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  // Create dark theme
  const darkTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: {
            main: '#90caf9',
          },
          secondary: {
            main: '#f48fb1',
          },
          background: {
            default: '#121212',
            paper: '#1e1e1e',
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
      }),
    []
  );

  const theme = darkMode ? darkTheme : lightTheme;
  
  // Use media query hook
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Helper function to get API keys
  const getApiKeys = () => {
    return {
      openai: openaiKey || localStorage.getItem('openai_api_key'),
      gemini: geminiKey || localStorage.getItem('gemini_api_key')
    };
  };
  
  // Save API keys
  const handleSaveApiKeys = () => {
    localStorage.setItem('openai_api_key', openaiKey);
    localStorage.setItem('gemini_api_key', geminiKey);
    setOpenSettingsDialog(false);
  };

  // Extract emails from Apple Mail
  const handleExtractEmails = async () => {
    setExtractingEmails(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/extract-emails`, {
        count: emailCount,
        hours_back: hoursBack
      });
      setEmails(res.data.emails);
      if (res.data.emails.length > 0) {
        handleEmailSelect(res.data.emails[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extract emails');
    } finally {
      setExtractingEmails(false);
    }
  };

  // Handle email selection
  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    // email.text already contains auto-redacted content from backend
    setExtractedText(email.text);
    // Set redactedText to the same to make it clear we're working with redacted content
    setRedactedText(email.text);
    
    // Reset states
    setSummary('');
    setFollowUpQuestion('');
    setFollowUpResponse('');
    setConversationHistory([]);
  };


  // Text selection handling for manual redaction
  const handleSelectionAndRedact = async () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      setLoading(true);
      try {
        const res = await axios.post(`${API_BASE}/redact`, {
          text: redactedText,  // Use current redacted text as base
          entities: {},
          custom_entities: [selectedText]
        });
        // Update both states with the newly redacted text
        setExtractedText(res.data.redacted_text);
        setRedactedText(res.data.redacted_text);
        window.getSelection().removeAllRanges();
        
        // Update conversation history if it exists
        if (conversationHistory.length > 0) {
          const updatedHistory = [...conversationHistory];
          updatedHistory[0] = {
            role: "user",
            content: `Here is the email content:\n${res.data.redacted_text}`
          };
          setConversationHistory(updatedHistory);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Manual redaction failed');
      } finally {
        setLoading(false);
      }
    }
  };


  // LLM Summarization with streaming
  const handleSummarize = async () => {
    // Check if API key is needed
    const apiKeys = getApiKeys();
    if (selectedModel.includes('GPT') && !apiKeys.openai) {
      setError('Please set your OpenAI API key in settings');
      setOpenSettingsDialog(true);
      return;
    }
    if (selectedModel.includes('Gemini') && !apiKeys.gemini) {
      setError('Please set your Gemini API key in settings');
      setOpenSettingsDialog(true);
      return;
    }
    
    setSummaryLoading(true);
    setSummary('');
    setError('');
    
    try {
      const textToSummarize = redactedText;
      if (!textToSummarize) {
        throw new Error("No text available to summarize.");
      }
      
      console.log('Summarizing email:', {
        id: selectedEmail?.id,
        subject: selectedEmail?.subject,
        sender: selectedEmail?.sender
      });
      
      const response = await fetch(`${API_BASE}/summarize-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSummarize,
          model: selectedModel,
          email_id: selectedEmail?.id,
          subject: selectedEmail?.subject,
          sender: selectedEmail?.sender,
          email_date: selectedEmail?.date,
          api_keys: getApiKeys()
        })
      });
      
      if (!response.ok) {
        throw new Error('Summarization failed');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullSummary = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              } else if (data.chunk) {
                fullSummary += data.chunk;
                setSummary(fullSummary);
              } else if (data.done) {
                // Initialize conversation history
                setConversationHistory([
                  {
                    role: "user",
                    content: `Here is the email content:\n${redactedText}`
                  },
                  {
                    role: "assistant",
                    content: fullSummary
                  }
                ]);
                
                // Check if this was cached
                if (data.cached) {
                  console.log('Loaded cached summary');
                }
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Summarization failed');
    } finally {
      setSummaryLoading(false);
    }
  };


  // Handler for follow-up questions with streaming
  const handleFollowUp = async () => {
    if (!followUpQuestion.trim()) return;
    
    // Check if API key is needed
    const apiKeys = getApiKeys();
    if (selectedModel.includes('GPT') && !apiKeys.openai) {
      setError('Please set your OpenAI API key in settings');
      setOpenSettingsDialog(true);
      return;
    }
    if (selectedModel.includes('Gemini') && !apiKeys.gemini) {
      setError('Please set your Gemini API key in settings');
      setOpenSettingsDialog(true);
      return;
    }
    
    setLlmLoading(true);
    setError('');
    
    try {
      const currentHistory = [...conversationHistory];
      
      if (currentHistory.length === 0) {
        currentHistory.push({
          role: "user",
          content: `Here is the email content:\n${redactedText}`
        });
      }
      
      const userQuestion = followUpQuestion;
      setFollowUpQuestion('');
      
      // Add user question to history immediately for display
      const updatedHistory = [
        ...currentHistory,
        { "role": "user", "content": userQuestion }
      ];
      setConversationHistory(updatedHistory);
      
      // Start streaming response
      const response = await fetch(`${API_BASE}/followup-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: currentHistory,
          question: userQuestion,
          model: selectedModel,
          api_keys: getApiKeys()
        })
      });
      
      if (!response.ok) {
        throw new Error('Follow-up request failed');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      // Add empty assistant message that we'll update
      setConversationHistory([...updatedHistory, { "role": "assistant", "content": "" }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              } else if (data.chunk) {
                fullResponse += data.chunk;
                // Update the last message in conversation history
                setConversationHistory(prev => {
                  const newHistory = [...prev];
                  newHistory[newHistory.length - 1] = {
                    "role": "assistant",
                    "content": fullResponse
                  };
                  return newHistory;
                });
                setFollowUpResponse(fullResponse);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Follow-up request failed');
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

    const filename = selectedEmail ? `${selectedEmail.subject.replace(/[^a-z0-9]/gi, '_')}_redacted.txt` : "redacted_text.txt";
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
  
  // TTS functions using backend
  const speakText = async (text) => {
    if (isSpeaking) {
      // Stop current speech
      try {
        await axios.post(`${API_BASE}/tts/stop`);
      } catch (err) {
        console.error('Failed to stop speech:', err);
      }
      setIsSpeaking(false);
      return;
    }
    
    if (!selectedVoice) {
      setError('Please select a voice first');
      return;
    }
    
    setIsSpeaking(true);
    
    try {
      await axios.post(`${API_BASE}/tts/speak`, {
        text: text,
        voice: selectedVoice
      });
      // Speech happens on the backend, so we just mark as done
      setIsSpeaking(false);
    } catch (err) {
      console.error('TTS failed:', err);
      setError('Text-to-speech failed');
      setIsSpeaking(false);
    }
  };
  
  // Stop TTS when component unmounts or email changes
  React.useEffect(() => {
    return () => {
      if (isSpeaking) {
        axios.post(`${API_BASE}/tts/stop`).catch(console.error);
      }
    };
  }, [selectedEmail]);
  
  // Load available macOS voices from backend
  React.useEffect(() => {
    const loadVoices = async () => {
      try {
        const res = await axios.get(`${API_BASE}/tts/voices`);
        const voices = res.data.voices || [];
        setAvailableVoices(voices);
        
        // Try to find Samantha voice first
        const samanthaVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('samantha')
        );
        
        if (samanthaVoice) {
          setSelectedVoice(samanthaVoice.name);
        } else {
          // Fall back to enhanced voice
          const enhancedVoice = voices.find(voice => 
            voice.enhanced && voice.language.startsWith('en')
          );
          
          if (enhancedVoice) {
            setSelectedVoice(enhancedVoice.name);
          } else {
            // Fall back to first English voice
            const englishVoice = voices.find(voice => voice.language.startsWith('en'));
            if (englishVoice) {
              setSelectedVoice(englishVoice.name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load voices:', err);
      }
    };
    
    loadVoices();
  }, []);

  // Function to reset all state
  const handleNewEmail = () => {
    setSelectedEmail(null);
    setExtractedText('');
    setRedactedText('');
    setSummary('');
    setError('');
    setFollowUpQuestion('');
    setFollowUpResponse('');
    setConversationHistory([]);
  };
  
  // Load summary history
  const loadSummaryHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE}/summaries`);
      setSummaryHistory(res.data.summaries || []);
    } catch (err) {
      setError('Failed to load summary history');
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Delete a summary
  const handleDeleteSummary = async (emailId) => {
    try {
      await axios.delete(`${API_BASE}/summaries/${emailId}`);
      // Reload history
      loadSummaryHistory();
      // Clear current summary if it's the one being deleted
      if (selectedEmail?.id === emailId) {
        setSummary('');
      }
    } catch (err) {
      setError('Failed to delete summary');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="primary" elevation={2} sx={{ mb: 3 }}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Email Redactor
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setOpenSettingsDialog(true)}
            sx={{ mr: 1 }}
          >
            <SettingsIcon />
          </IconButton>
          <Button
            color="inherit"
            startIcon={<HistoryIcon />}
            onClick={() => {
              setShowSummaryHistory(!showSummaryHistory);
              if (!showSummaryHistory && summaryHistory.length === 0) {
                loadSummaryHistory();
              }
            }}
            sx={{ mr: 1 }}
          >
            History
          </Button>
          <IconButton
            color="inherit"
            onClick={() => setDarkMode(!darkMode)}
            sx={{ mr: 1 }}
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          <Button 
            color="inherit" 
            startIcon={<RefreshIcon />}
            onClick={handleNewEmail}
          >
            Clear
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="xl" sx={{ mb: 6 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3, borderRadius: theme.shape.borderRadius }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}
        
        {/* Summary History Panel */}
        {showSummaryHistory && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" color="primary">
                  Summary History
                </Typography>
                <Button
                  size="small"
                  onClick={loadSummaryHistory}
                  startIcon={<RefreshIcon />}
                >
                  Refresh
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {loadingHistory ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : summaryHistory.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No saved summaries yet
                </Typography>
              ) : (
                <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {summaryHistory.map((item, index) => (
                    <ListItem 
                      key={item.email_id || index}
                      sx={{ 
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          cursor: 'pointer'
                        },
                        alignItems: 'flex-start',
                        py: 2
                      }}
                      onClick={() => {
                        // Load this summary into the summary display
                        setSummary(item.summary);
                        setShowSummaryHistory(false);
                      }}
                    >
                      <ListItemText
                        primary={item.subject || 'No subject'}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.primary">
                              {item.sender || 'Unknown sender'}
                            </Typography>
                            {" — "}{new Date(item.created_at).toLocaleString()}
                            <br />
                            <Typography component="span" variant="body2" sx={{ fontStyle: 'italic' }}>
                              Model: {item.model_used}
                            </Typography>
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                              <Typography variant="body2" sx={{ 
                                maxHeight: '150px', 
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {item.summary}
                              </Typography>
                            </Box>
                          </>
                        }
                      />
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteSummary(item.email_id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}
        
        <Grid container spacing={3}>
          {/* Email Extraction Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Extract Emails from Apple Mail
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', flexDirection: isSmallScreen ? 'column' : 'row', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="Number of emails"
                    type="number"
                    size="small"
                    value={emailCount}
                    onChange={(e) => setEmailCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    label="Hours back"
                    type="number"
                    size="small"
                    value={hoursBack}
                    onChange={(e) => setHoursBack(Math.max(1, Math.min(168, parseInt(e.target.value) || 24)))}
                    sx={{ width: 150 }}
                  />
                  <Button 
                    variant="contained" 
                    color="primary" 
                    disabled={extractingEmails} 
                    onClick={handleExtractEmails}
                    startIcon={extractingEmails ? <CircularProgress size={20} /> : <EmailIcon />}
                  >
                    {extractingEmails ? 'Extracting...' : 'Extract Emails'}
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
                  
                  {/* Voice Selection */}
                  {availableVoices.length > 0 && (
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel id="voice-select-label">TTS Voice</InputLabel>
                      <Select
                        labelId="voice-select-label"
                        value={selectedVoice || ''}
                        label="TTS Voice"
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        size="small"
                      >
                        {availableVoices
                          .filter(voice => voice.language.startsWith('en')) // Show only English voices
                          .map((voice) => (
                            <MenuItem key={voice.name} value={voice.name}>
                              {voice.name} 
                              {voice.enhanced && <Chip label="Enhanced" size="small" color="primary" sx={{ ml: 1, height: 20 }} />}
                              {voice.comment && ` - ${voice.comment}`}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Email List */}
          {emails.length > 0 && (
            <Grid item xs={12} md={4}>
              <Card sx={{ maxHeight: '600px', overflow: 'auto' }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Emails ({emails.length})
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {emails.map((email) => (
                      <ListItemButton 
                        key={email.id} 
                        selected={selectedEmail?.id === email.id}
                        onClick={() => handleEmailSelect(email)}
                      >
                        <ListItemText 
                          primary={email.subject}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="text.primary">
                                {email.sender}
                              </Typography>
                              {" — "}{email.date}
                            </>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {/* Main Content Area */}
          {extractedText && (
            <Grid item xs={12} md={emails.length > 0 ? 8 : 12}>
              {/* Extracted Text Card */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Email Content
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
        </Grid>
        
        {/* Summarize Section - Full Width */}
        {extractedText && (
          <Grid container spacing={3} sx={{ mt: 3 }}>
            <Grid item xs={12} lg={6}>
                  <Card sx={{ height: '700px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', p: 4, overflow: 'hidden' }}>
                      <Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>
                        Summarize Text
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Button
                        variant="contained"
                        sx={{ mb: 3, px: 4, py: 1.5 }}
                        size="large"
                        onClick={handleSummarize}
                        disabled={summaryLoading || llmLoading}
                        startIcon={summaryLoading ? <CircularProgress size={20} /> : <SummarizeIcon />}
                      >
                        {summaryLoading ? 'Summarizing...' : 'Summarize'}
                      </Button>
                      
                      {summary && (
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => speakText(summary)}
                              color={isSpeaking ? "secondary" : "primary"}
                            >
                              {isSpeaking ? <StopIcon /> : <VolumeUpIcon />}
                            </IconButton>
                          </Box>
                          <Paper 
                            sx={{ 
                              p: 3, 
                              bgcolor: darkMode ? 'background.paper' : 'grey.50',
                              flexGrow: 1,
                              height: '500px',
                              overflow: 'auto',
                              overflowX: 'hidden',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              '& *': {
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                              },
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              bgcolor: 'background.paper',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              bgcolor: 'action.disabled',
                              borderRadius: '4px',
                            },
                            '& h1': {
                              fontSize: '1.75rem',
                              fontWeight: 600,
                              mt: 2,
                              mb: 1,
                            },
                            '& h2': {
                              fontSize: '1.5rem',
                              fontWeight: 600,
                              mt: 2,
                              mb: 1,
                            },
                            '& h3': {
                              fontSize: '1.25rem',
                              fontWeight: 600,
                              mt: 1.5,
                              mb: 0.5,
                            },
                            '& p': {
                              mb: 1.5,
                              lineHeight: 1.7,
                            },
                            '& ul, & ol': {
                              mb: 1.5,
                              pl: 3,
                            },
                            '& li': {
                              mb: 0.5,
                              lineHeight: 1.7,
                            },
                            '& code': {
                              bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                              px: 0.5,
                              py: 0.2,
                              borderRadius: 0.5,
                              fontFamily: 'monospace',
                              fontSize: '0.9em',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            },
                            '& pre': {
                              bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                              p: 2,
                              borderRadius: 1,
                              overflow: 'auto',
                              mb: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                            },
                            '& blockquote': {
                              borderLeft: '4px solid',
                              borderColor: 'primary.main',
                              pl: 2,
                              ml: 0,
                              my: 1.5,
                              fontStyle: 'italic',
                            },
                            '& strong': {
                              fontWeight: 700,
                            },
                            '& em': {
                              fontStyle: 'italic',
                            },
                            '& *': {
                              maxWidth: '100%',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                            },
                          }}
                        >
                            <ReactMarkdown>{summary}</ReactMarkdown>
                          </Paper>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Follow-up Questions */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', p: 4 }}>
                      <Typography variant="h5" color="primary" gutterBottom sx={{ mb: 3 }}>
                        Ask Follow-up Questions
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          placeholder="Ask a question about the email..."
                          value={followUpQuestion}
                          onChange={(e) => setFollowUpQuestion(e.target.value)}
                          disabled={!summary || llmLoading}
                          size="small"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleFollowUp();
                            }
                          }}
                        />
                        <IconButton
                          color="primary"
                          onClick={handleFollowUp}
                          disabled={!followUpQuestion.trim() || llmLoading}
                        >
                          {llmLoading ? <CircularProgress size={24} /> : <SendIcon />}
                        </IconButton>
                      </Box>
                      
                      {(followUpResponse || conversationHistory.length > 2) && (
                        <Paper 
                          sx={{ 
                            p: 3, 
                            bgcolor: darkMode ? 'background.paper' : 'grey.50',
                            flexGrow: 1,
                            height: '500px',
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              bgcolor: 'background.paper',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              bgcolor: 'action.disabled',
                              borderRadius: '4px',
                            },
                          }}
                        >
                          {conversationHistory.slice(2).map((msg, idx) => (
                            <Box key={idx} sx={{ mb: 2 }}>
                              {msg.role === 'user' && (
                                <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  You:
                                </Typography>
                              )}
                              {msg.role === 'assistant' && (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 600 }}>
                                    Assistant:
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => speakText(msg.content)}
                                    color={isSpeaking ? "secondary" : "primary"}
                                  >
                                    {isSpeaking ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                                  </IconButton>
                                </Box>
                              )}
                              <Box
                                sx={{
                                  '& h1': {
                                    fontSize: '1.5rem',
                                    fontWeight: 600,
                                    mt: 1,
                                    mb: 0.5,
                                  },
                                  '& h2': {
                                    fontSize: '1.25rem',
                                    fontWeight: 600,
                                    mt: 1,
                                    mb: 0.5,
                                  },
                                  '& h3': {
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    mt: 0.75,
                                    mb: 0.5,
                                  },
                                  '& p': {
                                    mb: 1,
                                    lineHeight: 1.6,
                                  },
                                  '& ul, & ol': {
                                    mb: 1,
                                    pl: 3,
                                  },
                                  '& li': {
                                    mb: 0.5,
                                    lineHeight: 1.6,
                                  },
                                  '& code': {
                                    bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                    px: 0.5,
                                    py: 0.2,
                                    borderRadius: 0.5,
                                    fontFamily: 'monospace',
                                    fontSize: '0.9em',
                                  },
                                  '& pre': {
                                    bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                    p: 2,
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    mb: 1,
                                  },
                                  '& blockquote': {
                                    borderLeft: '3px solid',
                                    borderColor: 'primary.main',
                                    pl: 2,
                                    ml: 0,
                                    my: 1,
                                    fontStyle: 'italic',
                                  },
                                  '& strong': {
                                    fontWeight: 700,
                                  },
                                  '& em': {
                                    fontStyle: 'italic',
                                  },
                                }}
                              >
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </Box>
                            </Box>
                          ))}
                        </Paper>
                      )}
                    </CardContent>
                  </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Deanonymizer Section */}
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  <LockOpenIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Deanonymizer
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      label="Anonymized Text"
                      placeholder="Paste anonymized text here..."
                      value={anonymizedInput}
                      onChange={(e) => setAnonymizedInput(e.target.value)}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      label="Original Text"
                      value={deanonymizedOutput}
                      variant="outlined"
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="contained"
                  onClick={handleDeanonymize}
                  disabled={!anonymizedInput.trim() || deanonymizeLoading}
                  startIcon={deanonymizeLoading ? <CircularProgress size={20} /> : <LockOpenIcon />}
                >
                  {deanonymizeLoading ? 'Processing...' : 'Deanonymize'}
                </Button>
                {deanonymizedOutput && (
                  <Button
                    variant="outlined"
                    onClick={handleSaveDeanonymizedTxt}
                    startIcon={<SaveIcon />}
                  >
                    Save as TXT
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        </Grid>
        
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          message="Text copied to clipboard"
        />
        
        {/* API Key Settings Dialog */}
        <Dialog open={openSettingsDialog} onClose={() => setOpenSettingsDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>API Key Settings</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="OpenAI API Key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                sx={{ mb: 2 }}
                helperText="Required for GPT models"
              />
              <TextField
                fullWidth
                label="Gemini API Key"
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                helperText="Required for Gemini models"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenSettingsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveApiKeys} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}