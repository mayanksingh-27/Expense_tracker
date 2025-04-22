const axios = require("axios");
const { MongoClient } = require("mongodb");

// ------------------- Utility Functions -------------------
function convertNaturalDate(dateStr) {
  const today = new Date();
  if (!dateStr || dateStr.toLowerCase() === "today") return today;

  if (dateStr.toLowerCase() === "yesterday") {
    const d = new Date();
    d.setDate(today.getDate() - 1);
    return d;
  }

  const match = dateStr.match(/(\d+)\s+days\s+ago/i);
  if (match) {
    const daysAgo = parseInt(match[1]);
    const d = new Date();
    d.setDate(today.getDate() - daysAgo);
    return d;
  }

  return today;
}

async function getTodayExpenses(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const expenses = await db.collection("expenses").find({
    date: { $gte: today, $lt: tomorrow }
  }).toArray();

  if (!expenses.length) return "📭 No expenses recorded today.";

  return "📅 Today's Expenses:\n" + expenses.map(e => `- ₹${e.amount} for ${e.expenseCategory}`).join('\n');
}

async function getWeeklyCategoryTotals(db) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const expenses = await db.collection("expenses").find({
    date: { $gte: startOfWeek, $lte: now }
  }).toArray();

  if (!expenses.length) return "📭 No expenses recorded this week.";

  const categoryTotals = {};
  expenses.forEach(exp => {
    const cat = exp.expenseCategory;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });

  return "📊 Weekly Category Totals:\n" + Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: ₹${amt}`).join('\n');
}

async function getMonthlyCategoryTotals(db) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const expenses = await db.collection("expenses").find({
    date: { $gte: startOfMonth, $lte: now }
  }).toArray();

  if (!expenses.length) return "📭 No expenses recorded this month.";

  const categoryTotals = {};
  expenses.forEach(exp => {
    const cat = exp.expenseCategory;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });

  return "📅 Monthly Category Totals:\n" + Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: ₹${amt}`).join('\n');
}

async function deleteLastExpense(db) {
  const last = await db.collection("expenses")
    .find()
    .sort({ date: -1 })
    .limit(1)
    .toArray();

  if (!last.length) return "📭 No expense found to delete.";

  const deleted = await db.collection("expenses").deleteOne({ _id: last[0]._id });
  return deleted.deletedCount ? `🗑️ Deleted last entry: ₹${last[0].amount} for ${last[0].expenseCategory}` : "❌ Could not delete the last entry.";
}

async function getExpensesByDay(db, dayNumber) {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), parseInt(dayNumber));
  targetDate.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const expenses = await db.collection("expenses").find({
    date: { $gte: targetDate, $lte: endOfDay }
  }).toArray();

  if (!expenses.length) return `📭 No expenses recorded on ${targetDate.toDateString()}`;

  return `📅 Expenses on ${targetDate.toDateString()}:
` + expenses.map(e => `- ₹${e.amount} for ${e.expenseCategory}`).join("\n");
}

function getHelpMessage() {
  return (
    "📋 Available Commands:\n" +
    "- Spent 100 on tea\n" +
    "- today / week / month\n" +
    "- delete last\n" +
    "- bill for [date]\n" +
    "- help"
  );
}

// ------------------- Twilio Handler -------------------
exports.handler = async function (context, event, callback) {
  const twiml = new Twilio.twiml.MessagingResponse();
  const msg = event.Body?.trim().toLowerCase() || "";

  try {
    const client = await MongoClient.connect(context.MONGO_URI);
    const db = client.db("whatsappbot");

    if (msg.includes("help")) {
      twiml.message(getHelpMessage());
      await client.close();
      return callback(null, twiml);
    }
    if (msg.includes("delete last")) {
      const result = await deleteLastExpense(db);
      twiml.message(result);
      await client.close();
      return callback(null, twiml);
    }
    if (msg.includes("today")) {
      const result = await getTodayExpenses(db);
      twiml.message(result);
      await client.close();
      return callback(null, twiml);
    }
if (msg.includes("week")) {
  const result = await getWeeklyCategoryTotals(db);
  twiml.message(result);
  await client.close();
  return callback(null, twiml);
}
    if (msg.includes("month")) {
      const result = await getMonthlyCategoryTotals(db);
      twiml.message(result);
      await client.close();
      return callback(null, twiml);
    }

    // bill for date (e.g. bill for 20)
    const billMatch = msg.match(/bill for (\d{1,2})/);
    if (billMatch) {
      const result = await getExpensesByDay(db, billMatch[1]);
      twiml.message(result);
      await client.close();
      return callback(null, twiml);
    }

    // Parse with GROQ
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content: `Extract expense info from message and return JSON like:
            { "amount": number, "category": string, "date": "today"|"yesterday"|"3 days ago" }.`
          },
          { role: "user", content: msg }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          Authorization: `Bearer ${context.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const parsed = JSON.parse(response.data.choices[0].message.content.trim());
    const today = new Date();
    let expenseDate = convertNaturalDate(parsed.date);

    const isToday = expenseDate.toDateString() === today.toDateString();

    let reply;
    if (parsed.amount && parsed.category && isToday) {
      await db.collection("expenses").insertOne({
        amount: parsed.amount,
        expenseCategory: parsed.category,
        currency: "₹",
        date: expenseDate
      });

      reply = ` Saved ₹${parsed.amount} for ${parsed.category} on ${expenseDate.toDateString()}`;
    } else {
      reply = ` Parsed: ₹${parsed.amount || "?"} ${parsed.category || "?"}. Only today's expenses are saved.`;
    }

    await client.close();
    twiml.message(reply);
  } catch (err) {
    console.error("❌ Error:", err.message);
    twiml.message("❌ Something went wrong.");
  }

  return callback(null, twiml);
};
