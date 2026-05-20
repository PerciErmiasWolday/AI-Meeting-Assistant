import whisper
import os
from typing import Optional

class TranscriptionService:
    def __init__(self, model_name: str = "base"):
        """
        Initialize Whisper transcription service
        Models: tiny, base, small, medium, large
        'base' is a good balance between speed and accuracy
        """
        print(f"Loading Whisper model: {model_name}...")
        self.model = whisper.load_model(model_name)
        print("Whisper model loaded successfully!")
    
    def transcribe_audio(self, audio_path: str) -> dict:
        """
        Transcribe audio file to text
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            dict with 'text', 'language', and 'segments'
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        print(f"Transcribing audio: {audio_path}")
        result = self.model.transcribe(audio_path)
        
        return {
            "text": result["text"],
            "language": result.get("language", "unknown"),
            "segments": result.get("segments", [])
        }
    
    def get_duration(self, audio_path: str) -> Optional[float]:
        """Get audio duration in seconds"""
        try:
            import wave
            import contextlib
            
            with contextlib.closing(wave.open(audio_path, 'r')) as f:
                frames = f.getnframes()
                rate = f.getframerate()
                duration = frames / float(rate)
                return duration
        except Exception as e:
            print(f"Could not get duration: {e}")
            return None
