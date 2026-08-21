require('dotenv').config();
const key = process.env.GEMINI_API_KEY;

async function findWorkingModels() {
  const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const modelsData = await modelsRes.json();
  
  console.log('Total models:', modelsData.models?.length);
  const genModels = modelsData.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [];
  console.log('Content generation models:', genModels.length);

  for (const m of genModels) {
    const cleanName = m.name.replace('models/', '');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      });
      const d = await res.json();
      if (d.candidates && d.candidates[0]) {
        console.log(`✅ WORKING MODEL FOUND: ${cleanName}`);
      } else {
        console.log(`❌ ${cleanName}: ${d.error?.message?.substring(0, 70)}`);
      }
    } catch (e) {
      console.log(`❌ ${cleanName}: ${e.message}`);
    }
  }
}

findWorkingModels();
