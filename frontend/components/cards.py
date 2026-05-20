"""
Professional card components
"""
import streamlit as st

def render_card(title: str, content: str, icon: str = None):
    """Render a professional card component"""
    icon_html = f'<span style="font-size: 1.5rem; margin-right: 0.5rem;">{icon}</span>' if icon else ''
    
    st.markdown(f"""
    <div class="professional-card">
        <div class="professional-card-header">
            <h3 class="professional-card-title">{icon_html}{title}</h3>
        </div>
        <div class="professional-card-content">
            {content}
        </div>
    </div>
    """, unsafe_allow_html=True)

def render_meeting_item(meeting: dict, on_view=None, on_delete=None):
    """Render a meeting list item"""
    col1, col2, col3 = st.columns([3, 1.5, 1])
    
    with col1:
        st.markdown(f"""
        <div class="meeting-item-content">
            <div class="meeting-item-title">{meeting.get('title', 'Untitled Meeting')}</div>
            <div class="meeting-item-meta">
                <span>📅 {meeting.get('created_at', 'N/A')}</span>
                <span class="status-badge {'status-badge-success' if meeting.get('has_summary') else 'status-badge-warning'}">
                    {'Processed' if meeting.get('has_summary') else 'Processing'}
                </span>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        if st.button("View Details", key=f"view_{meeting['id']}", use_container_width=True):
            if on_view:
                on_view(meeting['id'])
    
    with col3:
        if st.button("Delete", key=f"delete_{meeting['id']}", use_container_width=True):
            if on_delete:
                on_delete(meeting['id'])

def render_empty_state(title: str, description: str, icon: str = "📭"):
    """Render an empty state component"""
    st.markdown(f"""
    <div class="empty-state">
        <div class="empty-state-icon">{icon}</div>
        <div class="empty-state-title">{title}</div>
        <div class="empty-state-description">{description}</div>
    </div>
    """, unsafe_allow_html=True)

