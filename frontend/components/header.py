"""
Header component for the application
"""
import streamlit as st

def render_header(title: str, subtitle: str = None):
    """Render a professional header"""
    st.markdown(f"""
    <div style="margin-bottom: 2rem;">
        <h1 style="margin-bottom: 0.5rem;">{title}</h1>
        {f'<p style="color: var(--text-secondary); font-size: 1.125rem; margin: 0;">{subtitle}</p>' if subtitle else ''}
    </div>
    """, unsafe_allow_html=True)

