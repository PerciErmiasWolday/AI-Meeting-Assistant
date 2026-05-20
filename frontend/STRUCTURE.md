# Frontend Structure

This document describes the organized folder structure of the Meeting Organizer frontend application.

## Directory Structure

```
frontend/
├── app.py                  # Main application entry point
├── components/             # Reusable UI components
│   ├── __init__.py
│   ├── header.py          # Header component
│   ├── sidebar.py         # Sidebar navigation
│   └── cards.py           # Card components (meeting items, empty states)
├── pages/                  # Page components
│   ├── __init__.py
│   ├── upload.py          # Upload page
│   ├── result.py          # Results/Summary page
│   └── history.py         # Meeting history page
├── styles/                 # Styling files
│   ├── theme.py           # Theme configuration (colors, typography, spacing)
│   └── main.css           # Main stylesheet with professional design
├── utils/                  # Utility functions
│   ├── __init__.py
│   ├── api.py             # API client functions
│   └── formatters.py      # Data formatting utilities
└── assets/                 # Static assets (icons, images)
```

## Design Philosophy

### Professional & Modern
- **Not generic AI-looking**: Uses standard design patterns and professional color schemes
- **Standard UI components**: Follows common design system principles
- **Clean typography**: System fonts for optimal readability
- **Proper spacing**: Consistent spacing scale throughout
- **Visual hierarchy**: Clear information architecture

### Color Scheme
- **Primary**: Deep slate grays (#1E293B) for professional look
- **Accent**: Blue (#3B82F6) for actions and highlights
- **Neutrals**: Gray scale for backgrounds and text
- **Status colors**: Green (success), Amber (warning), Red (error)

### Components
- **Professional cards**: Clean borders, subtle shadows, proper padding
- **Standard buttons**: Clear states (default, hover, active)
- **Form inputs**: Proper focus states and validation styling
- **Navigation**: Clear sidebar with active states
- **Empty states**: Helpful messaging when no data

## Key Features

1. **Modular Architecture**: Components are separated by concern
2. **Reusable Components**: Cards, headers, and other UI elements are reusable
3. **Consistent Styling**: Centralized theme configuration
4. **API Abstraction**: All API calls are abstracted in utils/api.py
5. **Type Safety**: Proper typing and error handling

## Usage

The main `app.py` file:
- Loads CSS styles
- Initializes session state
- Renders the sidebar
- Routes to appropriate pages based on state

Each page component:
- Handles its own logic
- Uses shared components
- Maintains consistent styling

## Adding New Features

1. **New Page**: Add to `pages/` directory and import in `app.py`
2. **New Component**: Add to `components/` directory
3. **New API Endpoint**: Add function to `utils/api.py`
4. **Styling Changes**: Update `styles/main.css` or `styles/theme.py`

