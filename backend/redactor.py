# redactor.py
import re
import uuid
import sqlite3
import os

# Determine the absolute path to the directory containing this script
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Construct the absolute path to the database file
_DB_PATH = os.path.join(_BASE_DIR, 'redactions.db')

class RedactionDatabase:
    def __init__(self):
        print(f"[DB] Connecting to: {_DB_PATH}")
        self.conn = sqlite3.connect(_DB_PATH)
        self.cursor = self.conn.cursor()
        self.create_table()

    def create_table(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS redactions
            (original TEXT PRIMARY KEY, tag TEXT)
        ''')
        self.conn.commit()

    def add_redaction(self, original, tag):
        self.cursor.execute('INSERT OR REPLACE INTO redactions (original, tag) VALUES (?, ?)', (original, tag))
        self.conn.commit()

    def get_tag(self, original):
        self.cursor.execute('SELECT tag FROM redactions WHERE original = ?', (original,))
        result = self.cursor.fetchone()
        return result[0] if result else None

    def get_original(self, tag):
        self.cursor.execute('SELECT original FROM redactions WHERE tag = ?', (tag,))
        result = self.cursor.fetchone()
        return result[0] if result else None

    def get_all_redacted_items(self):
        self.cursor.execute('SELECT original FROM redactions')
        return [row[0] for row in self.cursor.fetchall()]

    def close(self):
        self.conn.close()

def clean_text(text):
    # Remove any HTML tags
    text = re.sub('<[^<]+?>', '', text)
    # Replace multiple newlines with a single newline
    text = re.sub(r'\n\s*\n', '\n', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text

def redact_text(text, entities):
    redacted_text = text
    redaction_map = {}
    redaction_db = RedactionDatabase()

    try:
        for entity_type, entity_set in entities.items():
            print(f"[redact_text] Processing entity type: {entity_type} with {len(entity_set)} entities")
            for entity in entity_set:
                print(f"[redact_text] Processing entity: '{entity}' (type: {entity_type})")
                
                if entity not in redaction_map:
                    tag = redaction_db.get_tag(entity)
                    if not tag:
                        tag = f"<ANON_{uuid.uuid4().hex[:8]}>"
                        redaction_db.add_redaction(entity, tag)
                        print(f"[redact_text] Created new tag: {tag}")
                    else:
                        print(f"[redact_text] Using existing tag: {tag}")
                    redaction_map[entity] = tag
                else:
                    tag = redaction_map[entity]

                # Use precise pattern for manual selections (no word boundaries)
                # Use word boundaries for pre-identified entities
                if entity_type == 'MANUAL':
                    # Handle potential newlines in manual selections, similar to original PyQt app
                    pattern_text = re.escape(entity).replace(r'\n', r'\s*\n\s*')
                    pattern = re.compile(pattern_text, re.DOTALL | re.MULTILINE | re.IGNORECASE)
                    print(f"[redact_text] Manual pattern: {pattern_text}")
                else:
                    pattern_text = r'\b' + re.escape(entity) + r'\b'
                    pattern = re.compile(pattern_text, re.IGNORECASE)
                    print(f"[redact_text] Entity pattern: {pattern_text}")

                # Find matches before replacement
                matches = pattern.findall(redacted_text)
                print(f"[redact_text] Found {len(matches)} matches for '{entity}'")
                
                redacted_text = pattern.sub(tag, redacted_text)
    except Exception as e:
        print(f"[redact_text] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        redaction_db.close()
    
    return redacted_text, redaction_map

def apply_redaction(text, redaction_map):
    """
    Apply redaction to the text using the provided redaction map.
    """
    redacted_text = text
    redaction_db = RedactionDatabase()
    for original, tag in redaction_map.items():
        redaction_db.add_redaction(original, tag)
        pattern = r'\b' + re.escape(original) + r'\b'
        redacted_text = re.sub(pattern, tag, redacted_text, flags=re.IGNORECASE)
    redaction_db.close()
    return redacted_text

def unredact_text(redacted_text, redaction_map):
    """
    Reverse the redaction process using the redaction map.
    """
    unredacted_text = redacted_text
    for original, tag in redaction_map.items():
        unredacted_text = unredacted_text.replace(tag, original)
    return unredacted_text

def apply_stored_redactions(text):
    """
    Applies all previously stored redactions from the database to the text.
    """
    redaction_db = RedactionDatabase()
    redacted_text = text
    try:
        all_originals = redaction_db.get_all_redacted_items()
        for original in all_originals:
            tag = redaction_db.get_tag(original)
            if tag:
                # Use the same pattern logic as manual redaction for consistency
                pattern_text = re.escape(original).replace(r'\n', r'\s*\n\s*')
                pattern = re.compile(pattern_text, re.DOTALL | re.MULTILINE | re.IGNORECASE)
                redacted_text = pattern.sub(tag, redacted_text)
    finally:
        redaction_db.close()
    return redacted_text

def deanonymize_using_db(text):
    """
    Replaces all known <ANON_*> tags found in the text with their
    original values looked up from the database.
    """
    redaction_db = RedactionDatabase()
    deanonymized_text = text
    try:
        # Find all potential ANON tags in the input text
        anon_tags = re.findall(r'<ANON_[a-f0-9]{8}>', text)
        found_tags = set(anon_tags)
        print(f"[Deanonymize] Found tags in input: {found_tags if found_tags else 'None'}")

        for tag in found_tags:
            original = redaction_db.get_original(tag)
            if original:
                print(f"[Deanonymize] Found original for {tag}: '{original[:50]}...'")
                # Replace all instances of this specific tag
                deanonymized_text = deanonymized_text.replace(tag, original)
            else:
                print(f"[Deanonymize] No original found in DB for tag: {tag}")
    finally:
        redaction_db.close()
    return deanonymized_text