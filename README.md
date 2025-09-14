# TyreTrack Pro

This is a Next.js application designed to manage and track tyre manufacturing processes, built in Firebase Studio.

## Running Locally

To run this project on your local machine, follow these steps:

### 1. Set Up Environment Variables

The application uses the Gemini API for its AI features. You will need an API key to run it.

1.  Create a copy of the `.env.example` file and rename it to `.env`.
2.  Open the new `.env` file and add your Gemini API key:

    ```
    GEMINI_API_KEY=your_api_key_here
    ```

### 2. Install Dependencies

Open a terminal in the project's root directory and run the following command to install all the necessary packages:

```bash
npm install
```

### 3. Run the Development Servers

This project requires two separate processes to run concurrently: the Next.js web application and the Genkit AI server.

1.  **Terminal 1: Start the Genkit AI Server**
    Run this command to start the Genkit development server, which powers the AI features. It will watch for any changes you make to the AI flows.

    ```bash
    npm run genkit:watch
    ```

2.  **Terminal 2: Start the Next.js Web App**
    In a new terminal window, run this command to start the main web application.

    ```bash
    npm run dev
    ```

### 4. Access the Application

Once both servers are running, you can access the TyreTrack Pro application in your web browser at:

[http://localhost:9002](http://localhost:9002)

That's it! Your local development environment is now set up.