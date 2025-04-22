# Privacy-First Dockerized Browser

A privacy-focused web browser that runs in Docker and supports both regular and Tor-enabled browsing. This application allows you to browse news and other websites while maintaining privacy and anonymity.

## Desktop Launcher Setup

For convenient access, follow these steps to set up a desktop launcher:

1. Run the `setup.bat` script once to create desktop shortcuts and finalize installation
2. Click the "Privacy News Browser" icon on your desktop to launch the application
3. Use the application launcher page to browse news sites with or without Tor

## Features

- 🔒 Privacy-first approach with Tor network support
- 🐳 Fully dockerized application
- 🌐 Support for both regular and Tor-enabled browsing
- 🔄 Automatic link handling within the privacy context
- 📰 Perfect for reading news while maintaining privacy
- 🛡️ Built-in protection against tracking
- 🚫 Blocks unnecessary resources (ads, trackers, etc.)
- 🌍 Access to geo-restricted content through Tor
- 🖥️ Desktop launcher for easy access

## Prerequisites

- Docker
- Docker Compose
- Git (optional)

## Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/privacy-first-dockerised-browser.git
cd privacy-first-dockerised-browser
```

2. Build and start the application:
```bash
docker-compose up --build
```

3. Access the application at:
```bash
docker-compose up --build
```

## Usage

The application runs on `http://localhost:3000`. Here are the available endpoints:

### Basic Browsing 