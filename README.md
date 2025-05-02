# Privacy-First Dockerized (News) Browser

## The Why

This project was born out of frustration with modern news consumption. Today's news platforms increasingly rely on behavioral tracking, user profiling, and recommendation algorithms to "personalize" our news experience. While personalization can be useful in some contexts, it creates an echo chamber in news consumption - a scenario where we're shown what algorithms think we want to see, rather than what we need to see.

### The Problem

- News recommendations based on tracking create bubbles of information
- User behavior tracking influences what news we see
- Privacy concerns with persistent user profiles
- Difficulty in getting "clean", non-personalized news views
- Cookie tracking across news sites creating linked profiles

### The Solution

This tool provides a privacy-focused approach to news consumption. It uses a dockerized browser with Tor integration, ensuring:

- Each browsing session is clean and trackless
- No persistent cookies or user profiles
- Access to news without algorithmic bias
- Protection from cross-site tracking
- Option to bypass regional restrictions through Tor

## Philosophy

News should be a window to understand our world, not a mirror reflecting our existing views and behaviors. This tool embodies the belief that:

- News consumption should be free from algorithmic manipulation
- Privacy is a fundamental right in information access
- Users should control their information exposure
- Clean-slate browsing leads to broader perspectives

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

## Installation

### Desktop Launcher Setup

For convenient access, follow these steps to set up a desktop launcher:

1. Run the `setup.bat` script once to create desktop shortcuts and finalize installation
2. Click the "Privacy News Browser" icon on your desktop to launch the application
3. Use the application launcher page to browse news sites with or without Tor

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/privacy-first-dockerised-browser.git
cd privacy-first-dockerised-browser
```

2. Build and start the application:
```bash
docker-compose up --build
```

3. Access the application at `http://localhost:3000`

## Contributing

Your contributions can help make this tool better for everyone who values privacy in their news consumption. Here are some ways you can contribute:

- **Add News Sources**: Help expand the list of accessible news sources
- **Improve Privacy Features**: Suggest and implement additional privacy protections
- **Enhanced Blocking**: Contribute to better tracking prevention
- **Documentation**: Help make the tool more accessible to others
- **Bug Reports**: Help identify and fix issues
- **Feature Requests**: Suggest new features that align with the project's philosophy

### Development Guidelines

1. Keep privacy as the primary focus
2. Maintain simplicity in user experience
3. Ensure all features respect user autonomy
4. Document changes and their privacy implications

## Future Roadmap

- Enhanced news source categorization
- Improved Tor circuit handling
- Additional privacy-preserving features
- Better mobile support
- Integration with more news sources
- Advanced tracking prevention

## License

This project is open source and available under the MIT License.

## Acknowledgments

This project stands on the shoulders of giants in the privacy and open-source communities. Special thanks to:
- The Tor Project
- Docker community
- Privacy advocates and researchers
- Open-source news platforms

Join us in making news consumption more private, unbiased, and user-controlled. 
🌻 or 🌶️
