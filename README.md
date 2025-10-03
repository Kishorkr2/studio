
# RTPMS (Real Time Prod Management System)

This is a Next.js application designed to manage and track tyre manufacturing processes, built in Firebase Studio.

## How to Run This Project Locally

To get this application running on your computer, you'll need to follow these steps.

### 1. Set Up Your Environment Variables (API Keys & Firebase)

The app uses Google's Gemini AI models and Firebase for online data storage.

1.  **Get a Gemini API Key:** Create a free API key in [Google AI Studio](https://aistudio.google.com/app/apikey).

2.  **Set Up Firebase Project:**
    - Go to [Firebase Console](https://console.firebase.google.com/)
    - Create a new project or use existing one
    - Enable Firestore Database
    - Get your Firebase configuration from Project Settings

3.  **Create the Environment File:** Copy `.env.example` to `.env` and add your keys:
    ```
    GEMINI_API_KEY=your_gemini_api_key_here
    
    NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

### 2. Install Project Dependencies

Next, you need to install all the libraries and packages the project depends on.

1.  Open your computer's terminal (like Terminal on Mac, or Command Prompt/PowerShell on Windows).
2.  Navigate into the project's root directory using the `cd` command (e.g., `cd path/to/your/project`).
3.  Run the following command. This reads the `package.json` file and downloads everything needed.
    ```bash
    npm install
    ```

### 3. Run the Development Servers

This project has two parts that need to run at the same time: the main web application and the AI server. You will need to open **two separate terminal windows** for this.

1.  **Terminal 1: Start the Genkit AI Server**
    This server handles all the AI-related tasks. In your first terminal window (inside the project folder), run this command:
    ```bash
    npm run genkit:watch
    ```
    This will start the AI server. You can leave this terminal running. It will watch for any changes you make to the AI code and automatically restart if needed.

2.  **Terminal 2: Start the Next.js Web App**
    This server runs the user interface and all the main application logic. Open a **new, second terminal window** and navigate to the project folder again. In this new terminal, run this command:
    ```bash
    npm run dev
    ```

### 4. Access the Application

Once both servers are running without errors in their respective terminals, you can open your web browser and go to the following address to use RTPMS:

[http://localhost:9002](http://localhost:9002)

## Deploying to Firebase App Hosting

To make your application live on the web, follow these steps to deploy it.

### 1. Install Firebase CLI

If you haven't already, install the Firebase Command Line Interface (CLI) globally on your machine.

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

Log in to your Google account through the Firebase CLI.

```bash
firebase login
```

### 3. Set Your Project

Tell Firebase which project you want to deploy to. Replace `<YOUR_PROJECT_ID>` with your actual Firebase project ID.

```bash
firebase use <YOUR_PROJECT_ID>
```

### 4. Deploy the Application

Run the deploy command. This will build your Next.js application and deploy it to Firebase App Hosting.

```bash
firebase apphosting:backends:deploy
```

After the command finishes, the CLI will output the URL of your live application. That's it! Your RTPMS application is now live.
