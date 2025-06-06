import fetch from "node-fetch";

const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;
const BUTTONDOWN_API_URL = "https://api.buttondown.com/v1/emails";

/**
 * Sends an email using Buttondown API
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email content in HTML format
 * @param {string} recipient - Email recipient
 * @returns {Promise<Object>} API response
 */
export async function sendEmail(subject, htmlContent, recipient) {
    if (!BUTTONDOWN_API_KEY) {
        throw new Error("BUTTONDOWN_API_KEY environment variable is not set");
  }

  
  const payload = {
    subject,
    body: htmlContent,
    status: "published", // Set to 'draft' for testing, 'published' for sending
        recipient: recipient || "webdev0505@gmail.com", // Default recipient
  };

  
  try {
        const response = await fetch(BUTTONDOWN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${BUTTONDOWN_API_KEY}`,
        "Content-Type": "application/json",
      },
            body: JSON.stringify(payload),
    });

    
    if (!response.ok) {
            let errorDetailsMessage = `Status: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          errorDetailsMessage = JSON.stringify(errorData);
        } else if (errorData) {
          errorDetailsMessage = String(errorData);
        }
      } catch (jsonError) {
        console.warn("Buttondown API error response was not valid JSON. Attempting to read as text.", jsonError);
        try {
            const textResponse = await response.text();
            errorDetailsMessage = textResponse || errorDetailsMessage;
        } catch (textError) {
            console.warn("Could not read Buttondown API error response as text.", textError);
        }
      }
      throw new Error(`Buttondown API error: ${errorDetailsMessage}`);
    }

    
    return await response.json();
  } catch (error) {
        console.error("Detailed error sending email via Buttondown:");
    console.error("Error Message:", error.message);
    if (error.cause) {
        console.error("Error Cause:", error.cause);
    }
    if (error.code) console.error("Error Code:", error.code);
    if (error.errno) console.error("Error Errno:", error.errno);
    if (error.syscall) console.error("Error Syscall:", error.syscall);
    console.error("Error Stack:", error.stack);
    throw error;
  }
}
