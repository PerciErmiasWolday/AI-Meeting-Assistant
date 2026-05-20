"""
Sidebar navigation component
"""
import streamlit as st

def render_sidebar():
    """Render the application sidebar"""
    with st.sidebar:
        st.markdown("""
        <div style="padding: 1rem 0;">
            <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Meeting Organizer</h1>
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.875rem; margin: 0;">AI-Powered Meeting Summaries</p>
        </div>
        """, unsafe_allow_html=True)
        
        st.divider()
        
        # Navigation buttons
        nav_items = [
            ("Upload Meeting", "upload", "📤"),
            ("Meeting History", "history", "📚"),
        ]
        
        for label, page_key, icon in nav_items:
            is_active = st.session_state.get('current_page', 'upload') == page_key
            button_style = "background: rgba(255, 255, 255, 0.15);" if is_active else ""
            
            if st.button(f"{icon} {label}", key=f"nav_{page_key}", use_container_width=True):
                st.session_state.current_page = page_key
                st.rerun()
        
        st.divider()
        
        # Info section
        st.markdown("""
        <div style="padding: 1rem 0;">
            <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">About</h3>
            <p style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.8); line-height: 1.6;">
                Transcribe and summarize your meetings using AI. 
                Powered by Whisper and Gemini.
            </p>
        </div>
        """, unsafe_allow_html=True)

