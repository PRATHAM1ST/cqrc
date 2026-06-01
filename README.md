# Customer Query Replying Chatbot

An AI-powered chatbot with an integrated Admin Dashboard. This application allows administrators to upload custom knowledge sources (PDFs, DOC/DOCX files, spreadsheets) and manage custom Q&A pairs. The chatbot uses this context to provide accurate, relevant, and conversational answers to customer queries, while gracefully handling questions outside its knowledge base.

## Features
- **Admin Dashboard:** Upload and manage documents, add/edit/delete custom Q&A pairs.
- **Context-Aware Chatbot:** Answers queries strictly based on uploaded context, avoiding hallucinations.

## Getting Started

First, ensure you have your environment variables set up properly (e.g., your database connection and AI model API keys in your `.env` file). 

Then, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Use It

1. **Upload Documents:** Navigate to the upload section of the bot. You can drag and drop various file types. Supported formats typically include PDF, DOCX, XLSX, and TXT.
2. **Process:** Wait for the bot to parse and index the document contents.
3. **Ask Questions:** Use the chat interface to ask questions specific to the documents you uploaded. 

## Recommended Test Documents

If you want to test the bot's capabilities with real-world data, you can download and use these official public documents:

*   **PDF:** [IRS Publication 527 - Residential Rental Property](https://www.irs.gov/pub/irs-pdf/p527.pdf) (Ask it about deductible expenses or advance rent)
*   **Word (DOCX):** [HUD Form 92006 - Supplemental Application](https://www.hud.gov/sites/dfiles/Housing/documents/92006.docx) (Ask if the form is mandatory)
*   **Excel (XLSX):** [HUD Fair Market Rents 2024](https://www.huduser.gov/portal/datasets/fmr/fmr2024/FY24_FMRs_rev.xlsx) (Ask it to find the FMR for a specific county)

## Technologies Used
- Next.js (App Router)
- React
- Typescript
