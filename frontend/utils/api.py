"""
API utility functions for communicating with the backend
"""
import os
import requests
from typing import Optional, Dict, List
import streamlit as st

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

def upload_meeting(file, title: Optional[str] = None) -> Dict:
    """Upload and process a meeting audio file"""
    try:
        files = {"file": (file.name, file, file.type)}
        data = {"title": title} if title else {}
        
        response = requests.post(
            f"{API_BASE_URL}/api/upload",
            files=files,
            data=data,
            timeout=300
        )
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.json().get('detail', 'Unknown error')}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_meetings() -> Dict:
    """Get all meetings"""
    try:
        response = requests.get(f"{API_BASE_URL}/api/meetings")
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": "Failed to load meetings"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_meeting(meeting_id: int) -> Dict:
    """Get specific meeting details"""
    try:
        response = requests.get(f"{API_BASE_URL}/api/meetings/{meeting_id}")
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": "Meeting not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_meeting(meeting_id: int) -> Dict:
    """Delete a meeting"""
    try:
        response = requests.delete(f"{API_BASE_URL}/api/meetings/{meeting_id}")
        if response.status_code == 200:
            return {"success": True}
        else:
            return {"success": False, "error": "Failed to delete meeting"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def ask_question(meeting_id: int, question: str) -> Dict:
    """Ask a question about a meeting"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/ask",
            json={"meeting_id": meeting_id, "question": question},
            timeout=60
        )
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            error_detail = "Failed to get answer"
            try:
                error_data = response.json()
                error_detail = error_data.get('detail', error_detail)
            except:
                error_detail = f"HTTP {response.status_code}: {response.text[:100]}"
            return {"success": False, "error": error_detail}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out. Please try again."}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to server. Make sure the backend is running."}
    except Exception as e:
        return {"success": False, "error": str(e)}

def send_email(meeting_id: int, recipient_email: str) -> Dict:
    """Send meeting summary via email"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/email",
            json={"meeting_id": meeting_id, "recipient_email": recipient_email}
        )
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": response.json().get('detail', 'Failed to send email')}
    except Exception as e:
        return {"success": False, "error": str(e)}

