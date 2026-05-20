"""
Meeting Organizer - Main Application
Professional AI-powered meeting transcription and summarization tool
"""
import streamlit as st
import os

# Import components
from components.sidebar import render_sidebar
from pages.upload import render_upload_page
from pages.result import render_result_page
from pages.history import render_history_page

# Page configuration
st.set_page_config(
    page_title="Meeting Organizer",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load CSS
def load_css():
    """Load the main CSS file"""
    css_path = os.path.join(os.path.dirname(__file__), "styles", "main.css")
    try:
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()
            st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        # If CSS file not found, use inline CSS
        st.markdown("""
        <style>
            .stApp { background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
            [data-testid="stSidebar"] { background: #1E293B; }
        </style>
        """, unsafe_allow_html=True)

# Initialize session state - must happen before any access
if 'current_page' not in st.session_state:
    st.session_state.current_page = "upload"
if 'selected_meeting' not in st.session_state:
    st.session_state.selected_meeting = None

# Main application
def main():
    """Main application entry point"""
    # Load styles
    load_css()
    
    # Render sidebar
    render_sidebar()
    
    # Route to appropriate page
    current_page = st.session_state.get('current_page', 'upload')
    if current_page == "upload":
        render_upload_page()
    elif current_page == "result":
        render_result_page()
    elif current_page == "history":
        render_history_page()

if __name__ == "__main__":
    main()
