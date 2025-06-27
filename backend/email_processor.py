import os
from email import policy
from email.parser import BytesParser

class EmailProcessor:
    """
    Processes .eml files to extract and clean text, and find entities.
    """
    def __init__(self, language='en'):
        self.language = language
        self.cleaned_text = ''

    def process_eml_file(self, file_path):
        # Extracts plain text from an .eml file
        with open(file_path, 'rb') as f:
            msg = BytesParser(policy=policy.default).parse(f)
        text_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == 'text/plain':
                    text_parts.append(part.get_content())
        else:
            if msg.get_content_type() == 'text/plain':
                text_parts.append(msg.get_content())
        self.cleaned_text = '\n'.join(text_parts)
        return self.cleaned_text
