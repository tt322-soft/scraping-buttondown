import fetch from "node-fetch";

const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;
const BUTTONDOWN_API_URL = "https://api.buttondown.com/v1";

/**
 * Creates a subscriber using Buttondown API
 * @param {string} email - Email address of the subscriber
 * @returns {Promise<Object>} API response
 */
async function createSubscriber(email) {
    if (!BUTTONDOWN_API_KEY) {
        throw new Error("BUTTONDOWN_API_KEY environment variable is not set");
    }

    const payload = {
        email_address: email,
        type: "regular" // This skips double opt-in
    };

    try {
        console.log("Creating subscriber:", email);
        const response = await fetch(`${BUTTONDOWN_API_URL}/subscribers`, {
            method: "POST",
            headers: {
                Authorization: `Token ${BUTTONDOWN_API_KEY}`,
                "Content-Type": "application/json",
                "X-Buttondown-Collision-Behavior": "overwrite" // This will update if subscriber exists
            },
            body: JSON.stringify(payload),
        });

        console.log("Create subscriber response status:", response.status);
        console.log("Create subscriber response headers:", response.headers.raw());

        if (!response.ok) {
            let errorDetailsMessage = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                console.log("Error response JSON:", errorData);
                if (errorData && typeof errorData === 'object') {
                    errorDetailsMessage = JSON.stringify(errorData);
                } else if (errorData) {
                    errorDetailsMessage = String(errorData);
                }
            } catch (jsonError) {
                console.warn("Buttondown API error response was not valid JSON. Attempting to read as text.", jsonError);
                try {
                    const textResponse = await response.text();
                    console.log("Error response text:", textResponse);
                    errorDetailsMessage = textResponse || errorDetailsMessage;
                } catch (textError) {
                    console.warn("Could not read Buttondown API error response as text.", textError);
                }
            }
            throw new Error(`Buttondown API error: ${errorDetailsMessage}`);
        }

        const responseData = await response.json();
        console.log("Create subscriber successful response:", responseData);
        return responseData;
    } catch (error) {
        console.error("Detailed error creating subscriber via Buttondown:");
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

/**
 * Creates a draft email using Buttondown API
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email content in HTML format
 * @param {string} recipient - Email recipient
 * @returns {Promise<Object>} API response with email ID
 */
async function createDraftEmail(subject, htmlContent, recipient) {
    if (!BUTTONDOWN_API_KEY) {
        throw new Error("BUTTONDOWN_API_KEY environment variable is not set");
    }

    const payload = {
        subject,
        body: htmlContent,
        status: "draft",
        recipient: recipient || "webdev0505@gmail.com", // Default recipient
    };

    try {
        console.log("Creating draft email with payload:", JSON.stringify(payload, null, 2));
        const response = await fetch(`${BUTTONDOWN_API_URL}/emails`, {
            method: "POST",
            headers: {
                Authorization: `Token ${BUTTONDOWN_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        console.log("Draft creation response status:", response.status);
        console.log("Draft creation response headers:", response.headers.raw());

        if (!response.ok) {
            let errorDetailsMessage = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                console.log("Error response JSON:", errorData);
                if (errorData && typeof errorData === 'object') {
                    errorDetailsMessage = JSON.stringify(errorData);
                } else if (errorData) {
                    errorDetailsMessage = String(errorData);
                }
            } catch (jsonError) {
                console.warn("Buttondown API error response was not valid JSON. Attempting to read as text.", jsonError);
                try {
                    const textResponse = await response.text();
                    console.log("Error response text:", textResponse);
                    errorDetailsMessage = textResponse || errorDetailsMessage;
                } catch (textError) {
                    console.warn("Could not read Buttondown API error response as text.", textError);
                }
            }
            throw new Error(`Buttondown API error: ${errorDetailsMessage}`);
        }

        const responseData = await response.json();
        console.log("Draft creation successful response:", responseData);
        return responseData;
    } catch (error) {
        console.error("Detailed error creating draft email via Buttondown:");
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

/**
 * Sends a draft email using Buttondown API
 * @param {string} emailId - The ID of the draft email to send
 * @returns {Promise<Object>} API response
 */
async function sendDraftEmail(emailId) {
    if (!BUTTONDOWN_API_KEY) {
        throw new Error("BUTTONDOWN_API_KEY environment variable is not set");
    }

    try {
        const sendResponse = await fetch(`${BUTTONDOWN_API_URL}/emails/${emailId}/send-draft`, {
            method: "POST",
            headers: {
                Authorization: `Token ${BUTTONDOWN_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                recipients: ["webdev0505@gmail.com"]
            })
        });

        if (!sendResponse.ok) {
            let errorDetailsMessage = `Status: ${sendResponse.status} ${sendResponse.statusText}`;
            try {
                const errorData = await sendResponse.json();
                if (errorData && typeof errorData === 'object') {
                    errorDetailsMessage = JSON.stringify(errorData);
                } else if (errorData) {
                    errorDetailsMessage = String(errorData);
                }
            } catch (jsonError) {
                try {
                    const textResponse = await sendResponse.text();
                    errorDetailsMessage = textResponse || errorDetailsMessage;
                } catch (textError) {
                    // Ignore text parsing error
                }
            }
            throw new Error(`Buttondown API error: ${errorDetailsMessage}`);
        }

        // For successful responses, return a success message since the API returns empty response
        return { success: true, message: "Email sent successfully" };
    } catch (error) {
        console.error("Error sending draft email via Buttondown:", error.message);
        throw error;
    }
}

/**
 * Sends an email using Buttondown API by first creating a draft and then sending it
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email content in HTML format
 * @param {string} recipient - Email recipient
 * @returns {Promise<Object>} API response
 */
export async function sendEmail(subject, htmlContent, recipient) {
    const targetEmail = recipient || "webdev0505@gmail.com";
    
    // First create/update the subscriber
    await createSubscriber(targetEmail);
    
    // Then create a draft
    const draftResponse = await createDraftEmail(subject, htmlContent, targetEmail);
    console.log("Draft created successfully:", draftResponse);
    
    // Finally send the draft
    const sendResponse = await sendDraftEmail(draftResponse.id);
    console.log("Email sent successfully:", sendResponse);
    
    return sendResponse;
}
