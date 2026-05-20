"""
History page component - displays list of past meetings
"""
import streamlit as st
from components.header import render_header
from components.cards import render_meeting_item, render_empty_state
from utils.api import get_meetings, get_meeting, delete_meeting
from utils.formatters import format_date

def render_history_page():
    """Render the history page"""
    render_header("Meeting History", "View and manage your past meetings")
    
    # Fetch meetings
    result = get_meetings()
    
    if not result["success"]:
        st.error(f"Error loading meetings: {result.get('error', 'Unknown error')}")
        return
    
    meetings = result.get("data", [])
    
    if not meetings:
        render_empty_state(
            "No Meetings Yet",
            "Upload your first meeting to get started with AI-powered summaries.",
            "📭"
        )
        return
    
    # Display meetings
    for meeting in meetings:
        def handle_view(meeting_id):
            detail_result = get_meeting(meeting_id)
            if detail_result["success"]:
                st.session_state.selected_meeting = detail_result["data"]
                st.session_state.current_page = "result"
                st.rerun()
        
        def handle_delete(meeting_id):
            delete_result = delete_meeting(meeting_id)
            if delete_result["success"]:
                st.success("Meeting deleted successfully")
                st.rerun()
            else:
                st.error(f"Error: {delete_result.get('error', 'Failed to delete')}")
        
        render_meeting_item(meeting, on_view=handle_view, on_delete=handle_delete)

