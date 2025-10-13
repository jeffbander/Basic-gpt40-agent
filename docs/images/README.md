# Images and Screenshots

This directory contains architecture diagrams, screenshots, and mockups for the Medical AI Calling System.

## Current Files

- **architecture-diagram.svg**: System architecture diagram showing the flow from patient calls through Twilio, Fastify server, OpenAI API, and data storage.

## Adding Screenshots

To make the GitHub repository look more professional, consider adding the following screenshots:

### Recommended Screenshots to Add

1. **Patient Dashboard Screenshot** (`patient-dashboard.png`)
   - Capture the patient management interface
   - Show the list of patients with their details
   - Include the "Call Now" buttons and patient information

2. **Call Management Interface** (`call-management.png`)
   - Show the call scheduling interface
   - Display active and completed calls
   - Include call history and transcripts view

3. **Call in Progress** (`call-in-progress.png`)
   - Show a live call with real-time transcription
   - Display the conversation flow between AI and patient
   - Show call duration and status

4. **Webhook Configuration** (`webhook-setup.png`)
   - Show the webhook registration interface
   - Display example webhook payloads
   - Show webhook testing results

5. **Deployment Dashboard** (`deployment.png`)
   - Google Cloud Run console showing deployed service
   - Firestore database with patient records
   - Environment variables configuration

6. **Mobile View** (`mobile-view.png`)
   - Show how the dashboard looks on mobile devices
   - Display responsive design features

## How to Take Screenshots

### For Web Interfaces (Patient Dashboard)

1. Start the server: `npm run start:medical`
2. Open http://localhost:5051/patient-dashboard.html
3. Take a screenshot using:
   - **Windows**: Windows + Shift + S
   - **Mac**: Command + Shift + 4
   - **Linux**: Screenshot tool or PrintScreen

### For Call Flows

1. Make a test call using the dashboard
2. Capture the screen during the call
3. Show the real-time transcription appearing

### For Cloud Deployment

1. Log into Google Cloud Console
2. Navigate to Cloud Run services
3. Screenshot the deployed service details
4. Screenshot Firestore database collections

## Mockup Tools

If you want to create professional mockups instead of raw screenshots:

- **Figma** (https://figma.com) - Free design tool
- **Excalidraw** (https://excalidraw.com) - Simple diagramming
- **Draw.io** (https://draw.io) - Architecture diagrams
- **Canva** (https://canva.com) - Marketing materials

## Using Images in README

Once you have screenshots, add them to the main README.md like this:

```markdown
## Screenshots

### Patient Dashboard
![Patient Dashboard](./docs/images/patient-dashboard.png)

### Call Management
![Call Management](./docs/images/call-management.png)

### Architecture
![Architecture](./docs/images/architecture-diagram.svg)
```

## Image Optimization

Before committing images to Git:

1. **Compress images** to reduce repository size
   - Use tools like TinyPNG, ImageOptim, or Squoosh
   - Aim for < 500KB per image

2. **Use appropriate formats**
   - PNG for UI screenshots (supports transparency)
   - JPEG for photos
   - SVG for diagrams (vector, scalable)

3. **Standard dimensions**
   - Full-width screenshots: 1200-1400px wide
   - Thumbnails: 400-600px wide
   - Maintain aspect ratio

## Example README Section with Screenshots

Here's how your README could look with screenshots:

```markdown
## Preview

<div align="center">

### Patient Dashboard
![Patient Dashboard](./docs/images/patient-dashboard.png)
*Manage patients, schedule calls, and view call history*

### Real-Time Call Transcription
![Call Transcription](./docs/images/call-in-progress.png)
*AI-powered conversation with automatic transcription*

### Architecture Overview
![Architecture](./docs/images/architecture-diagram.svg)
*System architecture showing integration with Twilio and OpenAI*

</div>
```

## Tips for Great Screenshots

1. **Clean up your UI** before capturing
   - Remove test data or use realistic sample data
   - Close unnecessary tabs/windows
   - Use a clean browser without extensions visible

2. **Highlight key features**
   - Use arrows or circles to draw attention
   - Add brief annotations
   - Show the most important features

3. **Show real functionality**
   - Use actual patient data (anonymized)
   - Show completed calls with transcripts
   - Display realistic use cases

4. **Consistent styling**
   - Use the same browser and zoom level
   - Maintain consistent window sizes
   - Use the same theme/styling across screenshots

## Animated GIFs

For even better demonstrations, consider creating short animated GIFs:

1. **Making a call** (GIF showing the call initiation process)
2. **Real-time transcription** (GIF showing text appearing as AI speaks)
3. **Scheduling workflow** (GIF showing how to schedule recurring calls)

Tools for creating GIFs:
- **LICEcap** (Windows/Mac) - Simple screen recording to GIF
- **ScreenToGif** (Windows) - More advanced features
- **Kap** (Mac) - Modern GIF recording tool

---

*Updated: 2025-10-13*
