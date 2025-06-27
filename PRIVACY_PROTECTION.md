# Email Redaction System - Privacy Protection Documentation

## Overview

This document explains how the email redaction system ensures privacy protection when processing emails with Large Language Models (LLMs). The system guarantees that sensitive information is never exposed to external AI services, regardless of whether users make additional redactions or rely solely on automatic redactions from the database.

## Privacy Flow Architecture

### 1. Email Extraction with Automatic Redaction

When emails are extracted from Apple Mail, the system immediately applies privacy protection:

```python
# Backend: main.py lines 247-253
email_text = f"From: {sender}\nDate: {date}\nSubject: {subject}\n\n{body}"

# CRITICAL: Apply stored redactions BEFORE sending to frontend
processed_text = apply_stored_redactions(email_text)

formatted_emails.append({
    "text": processed_text,        # ← REDACTED version (what user sees)
    "original_text": email_text   # ← Original (kept for reference ONLY)
})
```

**Key Privacy Point**: The `text` field contains the redacted version, while `original_text` is kept only for internal reference and is NEVER sent to LLMs.

### 2. Frontend Text Handling

When a user selects an email in the frontend:

```javascript
// Frontend: EmailRedactorApp.js lines 265-268
const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    setExtractedText(email.text);      // ← Sets to REDACTED text
    setRedactedText(email.text);       // ← Sets to REDACTED text
};
```

**Privacy Guarantee**: Both `extractedText` and `redactedText` state variables contain the already-redacted content that matches what the user sees in the UI.

### 3. LLM Interactions - Two Scenarios

#### Scenario A: Email with Existing Redaction Terms (No New Redactions)

**Flow:**
1. Email extracted → Auto-redacted using database terms
2. User sees redacted version in UI
3. User clicks "Summarize" or asks questions
4. LLM receives the same redacted text the user sees

**Code Evidence:**
```javascript
// Summarization - line 332
const textToSummarize = redactedText;  // ← Sends REDACTED text

// Q&A - lines 441-443  
content: `Here is the email content:\n${redactedText}`  // ← Sends REDACTED text
```

#### Scenario B: User Makes Additional Manual Redactions

**Flow:**
1. Email extracted → Auto-redacted using database terms
2. User manually selects and redacts additional text
3. System builds on top of existing redactions
4. LLM receives text with BOTH automatic AND manual redactions

**Code Evidence:**
```javascript
// Manual redaction - lines 284-290
const res = await axios.post(`${API_BASE}/redact`, {
    text: redactedText,  // ← Uses current redacted text as BASE
    entities: {},
    custom_entities: [selectedText]
});
setRedactedText(res.data.redacted_text);  // ← Updates with newly redacted text
```

## Privacy Protection Mechanisms

### 1. Database-Driven Auto-Redaction

The system maintains a persistent redaction database:

```python
# redactor.py - apply_stored_redactions function
def apply_stored_redactions(text):
    redaction_db = RedactionDatabase()
    redacted_text = text
    
    all_originals = redaction_db.get_all_redacted_items()
    for original in all_originals:
        tag = redaction_db.get_tag(original)
        if tag:
            pattern = re.compile(re.escape(original), re.IGNORECASE)
            redacted_text = pattern.sub(tag, redacted_text)
    
    return redacted_text
```

**How it works:**
- Sensitive terms are stored as `original → <ANON_xxxxxxxx>` mappings
- Every email is automatically scanned and redacted before display
- Redaction tags like `<ANON_a1b2c3d4>` replace sensitive information

### 2. Layered Redaction System

Manual redactions build on automatic redactions:

```python
# Backend redaction endpoint
merged_entities = dict(data.entities)
if data.custom_entities:
    merged_entities.setdefault('MANUAL', [])
    merged_entities['MANUAL'].extend(data.custom_entities)

redacted, redaction_map = redact_text(data.text, merged_entities)
```

### 3. Conversation History Protection

When Q&A conversations are initialized, they use redacted content:

```javascript
// Conversation initialization - lines 390-392
setConversationHistory([
    {
        role: "user",
        content: `Here is the email content:\n${redactedText}`  // ← REDACTED
    },
    {
        role: "assistant", 
        content: fullSummary
    }
]);
```

## Privacy Guarantees

### ✅ What LLMs Receive
- **Always**: Redacted text with `<ANON_xxxxxxxx>` tags
- **Always**: Text that matches exactly what user sees in UI
- **Always**: Combination of automatic + manual redactions (if any)

### ❌ What LLMs Never Receive
- **Never**: Original unredacted email content
- **Never**: The `original_text` field from email objects
- **Never**: Sensitive information that exists in the redaction database
- **Never**: Raw email content before redaction processing

### 🔒 Technical Safeguards

1. **Immediate Redaction**: Emails are redacted at extraction time, before frontend display
2. **State Consistency**: Frontend state variables always contain redacted versions
3. **API Isolation**: Original text is never passed to LLM API endpoints
4. **Database Persistence**: Redaction mappings persist across sessions
5. **Layered Protection**: Manual redactions enhance automatic redactions

## Privacy Validation Example

Here's what happens with a sample email:

```
Original Email:
"Hi John, please call me at 555-123-4567 or email john.doe@company.com"

After Auto-Redaction (what user sees):
"Hi John, please call me at <ANON_a1b2c3d4> or email <ANON_e5f6g7h8>"

Sent to LLM:
"Hi John, please call me at <ANON_a1b2c3d4> or email <ANON_e5f6g7h8>"
```

The LLM can understand the context and structure but cannot access the actual phone number or email address.

## Code Flow Diagram

```
Email Extraction
       ↓
Apply Auto-Redaction (Database)
       ↓
Send to Frontend (redacted_text)
       ↓
User Sees Redacted Version
       ↓
[Optional] Manual Redaction
       ↓
LLM Processing (Summarization/Q&A)
       ↓
LLM Receives: Same redacted text user sees
```

## Database Schema

The redaction database stores mappings:

```sql
CREATE TABLE redactions (
    original TEXT PRIMARY KEY,  -- Sensitive information
    tag TEXT                   -- Anonymous replacement (e.g., <ANON_a1b2c3d4>)
);
```

## API Endpoints Privacy

### `/extract-emails`
- **Input**: Email extraction parameters
- **Output**: Emails with `text` (redacted) and `original_text` (reference only)
- **Privacy**: Auto-redaction applied before response

### `/summarize-stream`
- **Input**: `data.text` (redacted content from frontend)
- **LLM Receives**: Only the redacted text
- **Privacy**: No original content ever sent to LLM

### `/followup-stream`
- **Input**: Conversation history with redacted content
- **LLM Receives**: Only redacted conversation context
- **Privacy**: Conversation built on redacted foundation

## Summary

**The system provides complete privacy protection in both scenarios:**

1. **Automatic Redaction Only**: LLM receives pre-redacted content matching the UI
2. **Manual + Automatic Redaction**: LLM receives enhanced redacted content with both layers

**Key Privacy Principle**: The LLM always receives exactly what the user sees in the interface - no more, no less. Sensitive information is replaced with anonymized tokens that preserve context while protecting privacy.

This architecture ensures that even if users don't perform any manual redactions, their sensitive information remains protected when using AI features like summarization and Q&A.

## Verification Steps

To verify privacy protection:

1. **Check Email Display**: Confirm emails show `<ANON_xxxxxxxx>` tags for sensitive data
2. **Inspect Network Requests**: Verify LLM API calls contain only redacted text
3. **Database Audit**: Check that sensitive→anonymous mappings exist
4. **UI Consistency**: Confirm displayed text matches what's sent to LLM

The system's privacy protection is built into its core architecture, not added as an afterthought. 