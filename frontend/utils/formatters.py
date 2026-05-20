"""
Utility functions for formatting data
"""
from datetime import datetime
from typing import Optional
import re

def format_datetime(dt_string: Optional[str]) -> str:
    """Format ISO datetime string to readable format"""
    if not dt_string:
        return "N/A"
    
    try:
        dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        return dt.strftime("%B %d, %Y at %I:%M %p")
    except:
        return dt_string

def format_date(dt_string: Optional[str]) -> str:
    """Format ISO datetime string to date only"""
    if not dt_string:
        return "N/A"
    
    try:
        dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        return dt.strftime("%B %d, %Y")
    except:
        return dt_string

def truncate_text(text: str, max_length: int = 100) -> str:
    """Truncate text to max length with ellipsis"""
    if len(text) <= max_length:
        return text
    return text[:max_length].rsplit(' ', 1)[0] + "..."

def format_key_points(text: str) -> str:
    """Format key points with beautiful HTML styling"""
    if not text:
        return '<p style="color: #6B7280; font-style: italic;">No key points available</p>'
    
    # Clean up the text
    text = text.strip()
    
    # Split by bullet points or dashes
    # Handle both markdown-style and plain text bullets
    lines = re.split(r'\n\s*[-•*]\s+|\n\s*\*\*\s*[-•*]\s+', text)
    
    # If no bullets found, try splitting by double newlines or numbered lists
    if len(lines) == 1:
        lines = re.split(r'\n\s*\d+[\.\)]\s+|\n\n+', text)
    
    formatted_items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Remove markdown bold markers
        line = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', line)
        
        # Format as a list item with actual color values (single line to avoid parsing issues)
        formatted_items.append(f'<div style="padding: 0.75rem 0; border-left: 3px solid #3B82F6; padding-left: 1rem; margin-bottom: 0.5rem; line-height: 1.7; color: #111827;">{line}</div>')
    
    if not formatted_items:
        # If no structure found, just format as paragraphs
        paragraphs = text.split('\n\n')
        formatted_items = []
        for para in paragraphs:
            para = para.strip()
            if para:
                para = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', para)
                formatted_items.append(f'<p style="margin-bottom: 1rem; line-height: 1.7; color: #111827;">{para}</p>')
    
    return '<div style="padding: 0.5rem 0;">' + ''.join(formatted_items) + '</div>'

def format_action_items(text: str) -> str:
    """Format action items with beautiful HTML styling"""
    if not text:
        return '<p style="color: #6B7280; font-style: italic;">No action items identified</p>'
    
    # Clean up the text
    text = text.strip()
    
    # Split by bullet points, dashes, or numbered items
    lines = re.split(r'\n\s*[-•*]\s+|\n\s*\*\*\s*[-•*]\s+', text)
    
    # If no bullets found, try splitting by numbered lists
    if len(lines) == 1:
        lines = re.split(r'\n\s*\d+[\.\)]\s+', text)
    
    formatted_items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Extract responsible person if mentioned
        responsible_match = re.search(r'\(Responsible[^)]+\)', line, re.IGNORECASE)
        responsible = responsible_match.group(0) if responsible_match else None
        if responsible:
            line = line.replace(responsible, '').strip()
            responsible = responsible.replace('(Responsible:', '').replace(')', '').strip()
        
        # Remove markdown bold markers
        line = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', line)
        
        # Format as an action item card with actual color values (single line to avoid parsing issues)
        responsible_html = f'<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6B7280; font-style: italic;">👤 {responsible if responsible else "Assigned"}</div>' if responsible else ''
        
        formatted_items.append(f'<div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 1rem; margin-bottom: 0.75rem; border-radius: 0.5rem;"><div style="display: flex; align-items: flex-start; gap: 0.75rem;"><span style="font-size: 1.25rem; flex-shrink: 0; color: #10B981;">✓</span><div style="flex: 1;"><div style="line-height: 1.7; color: #111827;">{line}</div>{responsible_html}</div></div></div>')
    
    if not formatted_items:
        # If no structure found, format as paragraphs
        paragraphs = text.split('\n\n')
        formatted_items = []
        for para in paragraphs:
            para = para.strip()
            if para:
                para = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', para)
                formatted_items.append(f'<p style="margin-bottom: 1rem; line-height: 1.7; color: #111827;">{para}</p>')
    
    return '<div style="padding: 0.5rem 0;">' + ''.join(formatted_items) + '</div>'

def sanitize_for_pdf(text: str) -> str:
    """Sanitize text for PDF export by replacing problematic Unicode characters"""
    if not text:
        return ""
    
    # Comprehensive replacement of Unicode characters to ASCII equivalents
    replacements = {
        # Apostrophes and single quotes (most common issue)
        '\u2018': "'",  # LEFT SINGLE QUOTATION MARK
        '\u2019': "'",  # RIGHT SINGLE QUOTATION MARK (most common curly apostrophe)
        '\u201A': "'",  # SINGLE LOW-9 QUOTATION MARK
        '\u201B': "'",  # SINGLE HIGH-REVERSED-9 QUOTATION MARK
        '\u2032': "'",  # PRIME
        '\u2035': "'",  # REVERSED PRIME
        # Double quotes
        '\u201C': '"',  # LEFT DOUBLE QUOTATION MARK
        '\u201D': '"',  # RIGHT DOUBLE QUOTATION MARK
        '\u201E': '"',  # DOUBLE LOW-9 QUOTATION MARK
        '\u201F': '"',  # DOUBLE HIGH-REVERSED-9 QUOTATION MARK
        '\u2033': '"',  # DOUBLE PRIME
        # Dashes
        '\u2013': '-',  # EN DASH
        '\u2014': '-',  # EM DASH
        '\u2015': '-',  # HORIZONTAL BAR
        # Other punctuation
        '\u2026': '...',  # HORIZONTAL ELLIPSIS
        '\u2022': '-',  # BULLET
        '\u00B7': '-',  # MIDDLE DOT
        '\u2039': '<',  # SINGLE LEFT-POINTING ANGLE QUOTATION MARK
        '\u203A': '>',  # SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
        '\u00AB': '"',  # LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
        '\u00BB': '"',  # RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
        # Spaces
        '\u00A0': ' ',  # NO-BREAK SPACE
        '\u202F': ' ',  # NARROW NO-BREAK SPACE
        '\u3000': ' ',  # IDEOGRAPHIC SPACE
    }
    
    # Apply replacements
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    # Convert any remaining non-ASCII characters to ASCII-safe equivalents
    import unicodedata
    result = []
    for char in text:
        # Keep ASCII printable characters (32-126), newlines, and tabs
        if 32 <= ord(char) <= 126 or char in '\n\t\r':
            result.append(char)
        else:
            # Try to decompose and get ASCII equivalent
            try:
                # Normalize and try to get ASCII representation
                decomposed = unicodedata.normalize('NFKD', char)
                # Remove combining marks and get base character
                ascii_char = decomposed.encode('ascii', 'ignore').decode('ascii')
                if ascii_char:
                    result.append(ascii_char)
                else:
                    # If no ASCII equivalent, replace with safe character
                    result.append('?')
            except:
                result.append('?')
    
    return ''.join(result)
