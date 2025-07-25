# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "SRT Auto Booker" that automates booking tickets on the Korean SRT (Super Rapid Train) reservation website. The extension monitors for available reservation buttons within a specified time range and automatically clicks them when tickets become available.

## Architecture

**Chrome Extension Structure:**
- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Service worker for managing intervals and notifications
- `content.js` - Injected into SRT website pages for DOM manipulation
- `popup.html/js` - Extension popup UI for user controls
- `help.html` - Help documentation
- `style.css` - Popup styling

**Key Components:**
- **Background Service**: Manages refresh intervals using `setInterval()` and stores monitoring options per tab
- **Content Script**: Monitors DOM for reservation buttons (`a.btn_small.btn_burgundy_dark.val_m.wx90`), handles time filtering, and detects user input
- **Popup Interface**: Provides controls for refresh interval, time range selection, and monitoring state

**Data Flow:**
1. User sets parameters in popup (interval, time range)
2. Popup sends commands to background service worker
3. Background worker manages intervals and sends trigger messages to content script
4. Content script queries DOM, filters by time range, clicks reservation buttons
5. Success/failure notifications sent back through background worker

## Target Website Integration

- **Target URL**: `https://etk.srail.kr/hpg/hra/01/selectScheduleList.do*`
- **Key Selectors**: 
  - Reservation buttons: `a.btn_small.btn_burgundy_dark.val_m.wx90`
  - Query button: `input.inquery_btn`
  - Departure time inputs: `input[name^="dptTm"]`
- **Time Format**: Internal format "HHMMSS" converted to "HH:MM" for filtering

## State Management

- Uses `chrome.storage` for persistent settings
- `localStorage` for temporary flags and UI state
- Tab-specific monitoring via `refreshers_map` and `monitorOptions` objects in background

## Development Notes

- Extension uses Korean language in UI and messages
- Includes user input detection to pause monitoring during form interactions
- ESC key support for quick monitoring termination
- Automatic cleanup when tabs are updated or closed
- Chrome notifications for status updates and success/error messages