# utils.py
import spacy
from spacy.pipeline import EntityRuler
import json
import os

# Function to add custom patterns using EntityRuler
def add_custom_patterns(nlp, pattern_file='patterns.json'):
    """
    Adds custom entity patterns to the SpaCy pipeline using EntityRuler.

    Args:
        nlp (spacy.lang.*): The SpaCy language model.
        pattern_file (str): Path to the JSON file containing patterns.
    """
    ruler = EntityRuler(nlp, overwrite_ents=True)
    if os.path.exists(pattern_file):
        try:
            with open(pattern_file, 'r', encoding='utf-8') as f:
                patterns = json.load(f)
            ruler.add_patterns(patterns)
            nlp.add_pipe(ruler, before="ner")
        except Exception as e:
            print(f"Error loading patterns from '{pattern_file}': {e}")
    else:
        print(f"Pattern file '{pattern_file}' not found. Skipping custom patterns.")

# Load larger SpaCy models
try:
    nlp_en = spacy.load("en_core_web_md")
except OSError:
    raise OSError("SpaCy English model 'en_core_web_md' not found. Please download it using 'python -m spacy download en_core_web_md'.")

try:
    nlp_pt = spacy.load("pt_core_news_md")
except OSError:
    print("Warning: SpaCy Portuguese model 'pt_core_news_md' not found. Portuguese text processing will be limited.")
    nlp_pt = None

# Increase the maximum text length appropriately
nlp_en.max_length = 1500000
if nlp_pt:
    nlp_pt.max_length = 1500000

# Add custom patterns to both models
add_custom_patterns(nlp_en, 'patterns_en.json')
if nlp_pt:
    add_custom_patterns(nlp_pt, 'patterns_pt.json')

def is_valid_person(ent, doc):
    """
    Determines whether a PERSON entity is valid based on contextual heuristics.

    Args:
        ent (spacy.tokens.Span): The entity span.
        doc (spacy.tokens.Doc): The SpaCy Doc object containing the entity.

    Returns:
        bool: True if the entity is a valid PERSON, False otherwise.
    """
    # Require that PERSON entities consist of at least two words
    if len(ent.text.strip().split()) >= 2:
        return True

    # Additionally, check if the entity follows a salutation
    salutations = {'mr', 'mrs', 'ms', 'dr', 'prof', 'sen', 'jr', 'sr'}
    token_index = ent.start
    if token_index > 0 and doc[token_index - 1].text.lower() in salutations:
        return True

    return False

def find_entities(text, language):
    """
    Extracts named entities from the text based on the specified language.

    Args:
        text (str): The input text.
        language (str): Language code ('en' for English, 'pt' for Portuguese).

    Returns:
        dict: A dictionary containing sets of entities categorized by their labels.
    """
    if language == 'en':
        doc = nlp_en(text)
    elif language == 'pt':
        if nlp_pt:
            doc = nlp_pt(text)
        else:
            # Fallback to English model with warning
            print("Warning: Portuguese model not available, using English model for Portuguese text")
            doc = nlp_en(text)
    else:
        raise ValueError("Unsupported language. Use 'en' for English or 'pt' for Portuguese.")

    entities = {
        'PERSON': set(),
        'GPE': set(),
        'ORG': set()
    }

    for ent in doc.ents:
        if ent.label_ in entities:
            if ent.label_ == 'PERSON' and not is_valid_person(ent, doc):
                continue
            if len(ent.text.strip()) > 2:
                entities[ent.label_].add(ent.text.strip())

    return entities