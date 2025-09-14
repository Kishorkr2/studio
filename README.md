# TyreTrack Pro

This is a Next.js application designed to manage and track tyre manufacturing processes, built in Firebase Studio.

## How to Run This Project Locally

To get this application running on your computer, you'll need to follow these steps.

### 1. Set Up Your Environment Variables (API Key)

The AI features in this app (like the AI Optimizer) are powered by Google's Gemini models. To use them, you need an API key.

1.  **Get a Gemini API Key:** If you don't already have one, you can create a free API key in [Google AI Studio](https://aistudio.google.com/app/apikey).

2.  **Create the Environment File:** In the project's root folder, make a copy of the `.env.example` file and rename the copy to just `.env`.

3.  **Add Your Key:** Open the new `.env` file and paste your API key into it, like this:
    ```
    GEMINI_API_KEY=your_api_key_here
    ```

### 2. Install Project Dependencies

Next, you need to install all the libraries and packages the project depends on.

1.  Open a terminal in the project's root directory.
2.  Run the following command. This will read the `package.json` file and download everything needed.
    ```bash
    npm install
    ```

### 3. Run the Development Servers

This project has two parts that need to run at the same time: the main web application and the AI server. You will need to open two separate terminal windows for this.

1.  **Terminal 1: Start the Genkit AI Server**
    This server handles all the AI-related tasks. Run this command to start it. It will also watch for any changes you make to the AI code and automatically restart.
    ```bash
    npm run genkit:watch
    ```

2.  **Terminal 2: Start the Next.js Web App**
    This server runs the user interface and all the main application logic. In a new terminal, run this command:
    ```bash
    npm run dev
    ```

### 4. Access the Application

Once both servers are running without errors, you can open your web browser and navigate to the following address to use TyreTrack Pro:

[http://localhost:9002](http://localhost:9002)

That's it! Your local development environment is all set up. You can now start using and modifying the application.