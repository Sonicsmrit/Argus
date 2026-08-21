require('dotenv').config();
const key = process.env.GEMINI_API_KEY;

async function testModel(modelName) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with JSON: {"status": "success", "model": "' + modelName + '"}' }] }]
      })
    });
    const d = await res.json();
    if (d.candidates && d.candidates[0]) {
      console.log(`[SUCCESS] ${modelName}:`, d.candidates[0].content.parts[0].text.trim());
      return true;
    } else {
      console.log(`[FAIL] ${modelName}:`, d.error?.message || d);
      return false;
    }
  } catch (e) {
    console.log(`[ERR] ${modelName}:`, e.message);
    return false;
  }
}

async function run() {
  await testModel('gemini-2.5-flash');
}

run();
