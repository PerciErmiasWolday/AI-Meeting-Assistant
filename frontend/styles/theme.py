"""
Professional theme configuration for the Meeting Organizer application
"""

# Color Palette - Professional and modern
COLORS = {
    # Primary colors - Deep blue-gray for professional look
    "primary": "#1E293B",  # Slate 800
    "primary_light": "#334155",  # Slate 700
    "primary_dark": "#0F172A",  # Slate 900
    
    # Accent colors - Subtle blue for actions
    "accent": "#3B82F6",  # Blue 500
    "accent_hover": "#2563EB",  # Blue 600
    "accent_light": "#DBEAFE",  # Blue 100
    
    # Success/Positive
    "success": "#10B981",  # Emerald 500
    "success_light": "#D1FAE5",  # Emerald 100
    
    # Warning
    "warning": "#F59E0B",  # Amber 500
    "warning_light": "#FEF3C7",  # Amber 100
    
    # Error
    "error": "#EF4444",  # Red 500
    "error_light": "#FEE2E2",  # Red 100
    
    # Neutral grays
    "gray_50": "#F9FAFB",
    "gray_100": "#F3F4F6",
    "gray_200": "#E5E7EB",
    "gray_300": "#D1D5DB",
    "gray_400": "#9CA3AF",
    "gray_500": "#6B7280",
    "gray_600": "#4B5563",
    "gray_700": "#374151",
    "gray_800": "#1F2937",
    "gray_900": "#111827",
    
    # Backgrounds
    "bg_primary": "#FFFFFF",
    "bg_secondary": "#F9FAFB",
    "bg_tertiary": "#F3F4F6",
    
    # Text
    "text_primary": "#111827",
    "text_secondary": "#6B7280",
    "text_tertiary": "#9CA3AF",
    "text_inverse": "#FFFFFF",
}

# Typography
TYPOGRAPHY = {
    "font_family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    "font_mono": "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', monospace",
    
    "h1_size": "2.5rem",
    "h2_size": "2rem",
    "h3_size": "1.5rem",
    "h4_size": "1.25rem",
    "body_size": "1rem",
    "small_size": "0.875rem",
    "tiny_size": "0.75rem",
    
    "font_weight_light": "300",
    "font_weight_normal": "400",
    "font_weight_medium": "500",
    "font_weight_semibold": "600",
    "font_weight_bold": "700",
}

# Spacing
SPACING = {
    "xs": "0.25rem",   # 4px
    "sm": "0.5rem",    # 8px
    "md": "1rem",      # 16px
    "lg": "1.5rem",    # 24px
    "xl": "2rem",      # 32px
    "2xl": "3rem",     # 48px
    "3xl": "4rem",     # 64px
}

# Border radius
RADIUS = {
    "sm": "0.375rem",   # 6px
    "md": "0.5rem",     # 8px
    "lg": "0.75rem",    # 12px
    "xl": "1rem",       # 16px
    "full": "9999px",
}

# Shadows
SHADOWS = {
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
}

# Transitions
TRANSITIONS = {
    "fast": "150ms ease-in-out",
    "normal": "200ms ease-in-out",
    "slow": "300ms ease-in-out",
}

