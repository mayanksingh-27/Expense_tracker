#  WhatsApp Expense Tracker Bot (Twilio + GROQ + MongoDB)

This is a serverless **Twilio Function** that turns your WhatsApp into a personal expense tracker using:

-  **GROQ AI (LLaMA3)** for natural language understanding  
-  **MongoDB Atlas** for cloud-based storage  
-  **Twilio WhatsApp API** for sending and receiving messages  

---

##  Features

 Add expenses via WhatsApp  
 View today’s expenses  
 Get weekly/monthly category-wise summaries  
Retrieve bills for a specific date (e.g., `bill for 20`)  
 Delete the last expense  
 `help` command to list available features  

---

##  Tech Stack

| Layer         | Tech Used                         |
|---------------|-----------------------------------|
| Messaging     | Twilio WhatsApp Sandbox           |
| AI Parsing    | GROQ API (LLaMA3-70b-8192)        |
| Database      | MongoDB Atlas                     |
| Runtime       | Twilio Functions (Node.js)        |

---

## 🧪 Sample WhatsApp Commands

text
Spent 100 on tea  
Spent 500 on groceries yesterday  
today  
week  
month  
bill for 20  
delete last  
help


Deploying the Function
	1.	Go to Twilio Console → Functions & Assets → Services
	2.	Create a new service or open an existing one
	3.	Add a new function (e.g., /demo-reply)
	4.	Paste the code from demo-reply.js
	5.	Set Environment Variables (MONGO_URI, GROQ_API_KEY)
	6.	Click Deploy All
	7.	Paste the function’s public URL into the WhatsApp Sandbox:
When a message comes in → POST https://your-service.twil.io/demo-reply

⸻
