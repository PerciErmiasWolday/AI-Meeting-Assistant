"""
Upload page component
"""
import streamlit as st
from components.header import render_header
from components.cards import render_card
from utils.api import upload_meeting

def render_upload_page():
    """Render the upload page"""
    render_header(
        "Upload Meeting",
        "Upload your meeting audio to get AI-powered transcription and summary"
    )
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown('<div class="professional-card">', unsafe_allow_html=True)
        
        # Meeting title input
        meeting_title = st.text_input(
            "Meeting Title",
            placeholder="e.g., Weekly Team Sync - February 2026",
            help="Optional: Add a descriptive title for easy identification"
        )
        
        st.markdown('<div style="margin: 1.5rem 0;"></div>', unsafe_allow_html=True)
        
        # File upload
        uploaded_file = st.file_uploader(
            "Upload Audio File",
            type=['mp3', 'wav', 'm4a', 'ogg', 'flac', 'mp4'],
            help="Supported formats: MP3, WAV, M4A, OGG, FLAC, MP4"
        )
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        if uploaded_file:
            file_size_mb = len(uploaded_file.getvalue()) / (1024 * 1024)
            st.info(f"**File ready:** {uploaded_file.name} ({file_size_mb:.2f} MB)")
            
            if st.button("Process Meeting", type="primary", use_container_width=True):
                with st.spinner("Processing your meeting... This may take a few minutes."):
                    result = upload_meeting(uploaded_file, meeting_title)
                    
                    if result["success"]:
                        st.session_state.selected_meeting = result["data"]
                        st.session_state.current_page = "result"
                        st.rerun()
                    else:
                        st.error(f"Error: {result.get('error', 'Unknown error occurred')}")
    
    with col2:
        # How It Works card
        st.markdown("""
        <div class="professional-card">
            <div class="professional-card-header">
                <h3 class="professional-card-title">
                    <span style="font-size: 1.5rem; margin-right: 0.5rem;">⚙️</span>How It Works
                </h3>
            </div>
            <div class="professional-card-content">
                <ol style="padding-left: 1.5rem; line-height: 2; margin: 0;">
                    <li>Upload your meeting audio file</li>
                    <li>AI transcribes using Whisper</li>
                    <li>AI summarizes with Gemini</li>
                    <li>Get key points & action items</li>
                    <li>Export or share your summary</li>
                </ol>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Features card
        st.markdown("""
        <div class="professional-card">
            <div class="professional-card-header">
                <h3 class="professional-card-title">
                    <span style="font-size: 1.5rem; margin-right: 0.5rem;">✨</span>Features
                </h3>
            </div>
            <div class="professional-card-content">
                <ul style="padding-left: 1.5rem; line-height: 2; margin: 0;">
                    <li>Accurate transcription</li>
                    <li>Smart summarization</li>
                    <li>Action item extraction</li>
                    <li>Meeting history</li>
                    <li>Q&A about meetings</li>
                    <li>Export options</li>
                </ul>
            </div>
        </div>
        """, unsafe_allow_html=True)

